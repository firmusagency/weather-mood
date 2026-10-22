import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import type { HourObs } from '../src/engine/metar';
import { compassToDeg, NOA_STATIONS, parseNoaaMonthly, summarizeStations, verifyDaily } from '../src/engine/noa';
import { planPoints } from '../src/engine/openmeteo';
import { observedDataset, recheckRecommendations, summarizeRechecks } from '../src/engine/recheck';
import { scenario } from './helpers';

const SAMPLE = `                    MONTHLY CLIMATOLOGICAL SUMMARY for OCT. 2026
NAME: Falasarna,     ELEV: 10   m     LAT: 35deg 30min     LONG: 23deg 36min
DAY  TEMP  HIGH    TIME   LOW    TIME     RH   RH  RAIN  SPEED   HIGH    TIME   DIR
-----------------------------------------------------------------------------------
21   20.4  23.6   11:00  16.9   02:50     80   43   0.0    7.0   29.0   15:30    SE
22   23.5  29.6   14:30  18.8   02:20     70   37   0.0    8.0   41.8   16:20    NE
23    ---   ---     ---   ---     ---    ---  ---   ---    ---    ---     ---   ---
-----------------------------------------------------------------------------------
     20.4  29.6      22  14.6      17   78.1 53.2  27.4   14.8   96.6      13     N
`;

describe('National Observatory daily files', () => {
  it('parses the monthly summary rows and skips empty days and the footer', () => {
    const m = parseNoaaMonthly(SAMPLE);
    expect(m.name).toBe('Falasarna');
    expect(m.month).toBe(10);
    expect(m.year).toBe(2026);
    expect(m.days.map((d) => d.day)).toEqual([21, 22]);
    const d22 = m.days[1];
    expect(d22.highWind).toBe(41.8);
    expect(d22.highWindTime).toBe('16:20');
    expect(d22.domDirLabel).toBe('NE');
    expect(d22.domDir).toBe(45);
    expect(d22.high).toBe(29.6);
    expect(compassToDeg('SSW')).toBe(202.5);
  });

  it('judges the Falasarna pick by whether the day’s big gust fell inside the window', () => {
    const data = scenario({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20, date: '2026-10-22' });
    const plan = planPoints(SPOTS, REF_POINTS);
    const st = NOA_STATIONS.find((s) => s.id === 'falasarna')!;
    const calmDay = parseNoaaMonthly(SAMPLE).days[0]; // 29 km/h at 15:30
    const held = verifyDaily(data, plan, calmDay, st, '2026-10-21', SPOTS, BASES[0]);
    expect(held.pick?.spotId).toBe('falasarna');
    expect(held.pick?.held).toBe(true);
    expect(held.gust.observedHour).toBe(15);
    // a 45 km/h gust at 11:00 on a day we said "go 09:00–13:00" is a miss
    const blow = { ...calmDay, highWind: 45, highWindTime: '11:10' };
    const miss = verifyDaily(data, plan, blow, st, '2026-10-21', SPOTS, BASES[0]);
    expect(miss.pick?.verdict).toBe('go');
    expect(miss.pick?.gustInWindow).toBe(true);
    expect(miss.pick?.held).toBe(false);
    const sum = summarizeStations([held, miss]).find((s) => s.id === 'falasarna')!;
    expect(sum.days).toBe(2);
    expect(sum.picks).toBe(2);
    expect(sum.picksHeld).toBe(1);
  });
});

describe('recommendation re-check with the measured wind (north coast)', () => {
  const plan = planPoints(SPOTS, REF_POINTS);
  const obsHours = (kmh: number, dir: number, gust = kmh * 1.5): HourObs[] => Array.from({ length: 16 }, (_, i) => ({ hour: 6 + i, windKmh: kmh, windDir: dir, gustKmh: gust, tempC: 24, rain: false, count: 2 }));

  it('imposes the station wind on the forecast', () => {
    const data = scenario({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 });
    const { data: obs, hours } = observedDataset(data, plan, obsHours(32, 350));
    expect(hours).toBe(16);
    expect(obs.land['ref-north'].atmos[12].wind).toBeCloseTo(32, 0);
    expect(obs.land['ref-north'].atmos[12].windDir).toBe(350);
    expect(obs.land['ref-north'].atmos[3].wind).toBeCloseTo(8, 0); // 03:00 had no observation
  });

  it('a calm forecast that turned into a 5 Bf northerly: north-coast beach picks do not hold', () => {
    const data = scenario({ windKmh: 6, windDir: 20, waveM: 0.2, waveDir: 20 });
    const r = recheckRecommendations(data, plan, obsHours(36, 350, 55), SPOTS, BASES[0], ['family']);
    expect(r.spotsJudged.length).toBeGreaterThan(5);
    expect(r.spotsJudged).not.toContain('elafonisi');
    const fam = r.profiles[0];
    expect(fam.picks.length).toBeGreaterThan(0);
    expect(fam.picks.every((p) => p.forecastVerdict === 'go')).toBe(true);
    expect(fam.picks.some((p) => !p.held)).toBe(true);
    const s = summarizeRechecks([r]);
    expect(s.days).toBe(1);
    expect(s.pickHeldRate).not.toBeNull();
    expect(s.pickHeldRate!).toBeLessThan(1);
  });

  it('a forecast that came true keeps every pick', () => {
    const data = scenario({ windKmh: 10, windDir: 20, waveM: 0.3, waveDir: 20 });
    const r = recheckRecommendations(data, plan, obsHours(10, 20), SPOTS, BASES[0], ['couple']);
    expect(summarizeRechecks([r]).pickHeldRate).toBe(1);
  });
});
