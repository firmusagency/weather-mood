import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { adjustSpots, NO_ADJUSTMENTS } from '../src/engine/adjust';
import type { DailyVerificationRow } from '../src/engine/noa';
import { analyzeDay } from '../src/engine/recommend';
import { applyStationCalibration, buildStationCalibration, STATION_CAL } from '../src/engine/stationcal';
import { scenario } from './helpers';

const NOW = new Date('2026-12-01T06:00:00Z');
/** `days` daily rows for a station: forecast gust `fc`, observed = fc × ratio(i). */
function rows(station: string, days: number, ratio: (i: number) => number, fc = (i: number) => 30 + (i % 7) * 3): DailyVerificationRow[] {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.UTC(2026, 9, 18 + i)).toISOString().slice(0, 10),
    station,
    point: station,
    pointDistanceKm: 2,
    forecastFetchedAt: '',
    wind: { forecastAvg: 12, observedAvg: 11, forecastDir: 270, observedDir: 270, dirDiff: 0 },
    gust: { forecastMax: fc(i), forecastHour: 14, observedMax: Math.round(fc(i) * ratio(i) * 10) / 10, observedHour: 14, withinHours: 0 },
    temp: { forecastMax: 22, observedMax: 22, forecastMin: 16, observedMin: 16 },
    rain: { forecastSumMm: 0, forecastProbMax: 0, observed: false, agree: true },
    pick: null,
  }));
}
const entry = (cal: ReturnType<typeof buildStationCalibration>, id: string) => cal.stations.find((s) => s.station === id)!;

describe('station gust calibration', () => {
  it('waits for a month of data, then applies a consistent under-forecast, capped', () => {
    const early = buildStationCalibration(rows('falasarna', STATION_CAL.minDays - 1, () => 1.2), NOW);
    expect(entry(early, 'falasarna')).toMatchObject({ status: 'collecting', gustFactor: 1, medianRatio: 1.2 });
    expect(early.spots).toEqual({});

    const ready = buildStationCalibration(rows('falasarna', 30, () => 1.2), NOW);
    expect(entry(ready, 'falasarna')).toMatchObject({ status: 'applied', gustFactor: 1.2, underShare: 1 });
    expect(ready.spots).toEqual({ falasarna: { gustFactor: 1.2, station: 'falasarna' } });

    const wild = buildStationCalibration(rows('paleochora', 40, () => 1.6), NOW);
    expect(entry(wild, 'paleochora').gustFactor).toBe(STATION_CAL.maxFactor);
    expect(Object.keys(wild.spots).sort()).toEqual(['paleochora-pebble', 'paleochora-sandy']);
  });

  it('never relaxes a forecast: a station that reads low is reported, not applied', () => {
    const cal = buildStationCalibration(rows('elafonisi', 40, () => 0.64), NOW);
    expect(entry(cal, 'elafonisi')).toMatchObject({ status: 'reads-low', gustFactor: 1 });
    expect(cal.spots).toEqual({});
  });

  it('ignores a small or erratic difference and days without wind', () => {
    expect(entry(buildStationCalibration(rows('falasarna', 40, () => 1.04), NOW), 'falasarna').status).toBe('no-bias');
    // median above the bar, but the station is above the forecast on barely half the days
    const erratic = buildStationCalibration(rows('falasarna', 40, (i) => (i % 2 ? 1.5 : 0.8)), NOW);
    expect(entry(erratic, 'falasarna').status).toBe('inconsistent');
    // calm days (forecast gust under 15 km/h) do not count towards the month
    const calm = buildStationCalibration(rows('falasarna', 40, () => 1.3, () => 9), NOW);
    expect(entry(calm, 'falasarna')).toMatchObject({ days: 0, status: 'collecting' });
  });

  it('scales the gust the engine sees at the covered spots only', () => {
    const cal = buildStationCalibration(rows('falasarna', 30, () => 1.2), NOW);
    const spots = applyStationCalibration(SPOTS, cal);
    expect(spots.find((s) => s.id === 'falasarna')!.gustFactor).toBe(1.2);
    expect(spots.find((s) => s.id === 'stavros')!.gustFactor).toBeUndefined();
    expect(applyStationCalibration(SPOTS, null)).toBe(SPOTS);

    const data = scenario({ windKmh: 20, windDir: 90, gustKmh: 40, waveM: 0.3, waveDir: 90 });
    const base = analyzeDay(SPOTS, data, 'couple', BASES[0]).conditions;
    const adj = analyzeDay(adjustSpots(SPOTS, { ...NO_ADJUSTMENTS, stations: cal }), data, 'couple', BASES[0]).conditions;
    expect(base.falasarna[5].wind.gust).toBe(40);
    expect(adj.falasarna[5].wind.gust).toBeCloseTo(48, 5);
    expect(adj.falasarna[5].wind.speed).toBe(base.falasarna[5].wind.speed); // the mean wind is not touched
    expect(adj.stavros[5].wind.gust).toBe(40);
  });
});
