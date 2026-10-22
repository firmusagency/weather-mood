import { angleDiff, beaufort, circularMean, round } from './geo';
import { windConsensus } from './analysis';
import type { PointPlan } from './openmeteo';
import { scoreSpot } from './scoring';
import type { Base, Dataset, Spot } from './types';
import { nearestLandPoint } from './verify';

/*
 * Second, third and fourth verification stations: the National Observatory of Athens (meteo.gr)
 * automatic stations on the west and south coasts. They publish a public daily climatological
 * file per month (NOAAMO.TXT): mean/max/min temperature, rain, average wind, highest gust with
 * its time, dominant direction. Daily, not hourly, so the check is "did the day look like we
 * said", with the gust time telling us whether the blow fell inside the window we recommended.
 */

export interface NoaStation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** The spot whose recommendation this station can judge. */
  spotId: string;
}

export const NOA_STATIONS: NoaStation[] = [
  { id: 'falasarna', name: 'Falasarna (NOA)', lat: 35.5, lon: 23.6, spotId: 'falasarna' },
  { id: 'elafonisi', name: 'Elafonisi (NOA)', lat: 35.2, lon: 23.5, spotId: 'elafonisi' },
  { id: 'paleochora', name: 'Paleochora (NOA)', lat: 35.2, lon: 23.7, spotId: 'paleochora-sandy' },
  { id: 'kissamos', name: 'Kissamos (NOA)', lat: 35.5, lon: 23.7, spotId: 'balos' },
];

export const noaUrl = (id: string, previousMonth = false) => `https://penteli.meteo.gr/stations/${id}/${previousMonth ? 'NOAAPRMO' : 'NOAAMO'}.TXT`;

export interface DailyObs {
  day: number;
  meanTemp: number;
  high: number;
  highTime: string;
  low: number;
  lowTime: string;
  rhMax: number;
  rhMin: number;
  rain: number;
  avgWind: number;
  highWind: number;
  highWindTime: string;
  /** Dominant direction (deg FROM), from the 16-point compass label. */
  domDir: number;
  domDirLabel: string;
}

const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compassToDeg = (label: string) => {
  const i = COMPASS16.indexOf(label.toUpperCase());
  return i < 0 ? NaN : i * 22.5;
};

export interface NoaMonthly {
  name: string;
  month: number;
  year: number;
  days: DailyObs[];
}

const MONTHS: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };

/** Parses a Davis/NOAA style monthly summary (the format every meteo.gr station publishes). */
export function parseNoaaMonthly(text: string): NoaMonthly {
  const head = text.match(/SUMMARY for ([A-Z]{3})\.? (\d{4})/i);
  const month = head ? MONTHS[head[1].toUpperCase()] ?? 0 : 0;
  const year = head ? Number(head[2]) : 0;
  const name = text.match(/NAME:\s*([^,\n]+?)\s*(,|ELEV)/)?.[1]?.trim() ?? '';
  const days: DailyObs[] = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(
      /^\s*(\d{2})\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(\d{2}:\d{2})\s+(-?[\d.]+)\s+(\d{2}:\d{2})\s+(\d+)\s+(\d+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+(\d{2}:\d{2})\s+([A-Z]{1,3})\s*$/,
    );
    if (!m) continue;
    days.push({
      day: Number(m[1]),
      meanTemp: Number(m[2]),
      high: Number(m[3]),
      highTime: m[4],
      low: Number(m[5]),
      lowTime: m[6],
      rhMax: Number(m[7]),
      rhMin: Number(m[8]),
      rain: Number(m[9]),
      avgWind: Number(m[10]),
      highWind: Number(m[11]),
      highWindTime: m[12],
      domDir: compassToDeg(m[13]),
      domDirLabel: m[13],
    });
  }
  return { name, month, year, days };
}

export const hourOfTime = (hhmm: string) => Number(hhmm.slice(0, 2));

export interface DailyVerificationRow {
  date: string;
  station: string;
  point: string;
  pointDistanceKm: number;
  forecastFetchedAt: string;
  wind: { forecastAvg: number; observedAvg: number; forecastDir: number; observedDir: number; dirDiff: number };
  gust: { forecastMax: number; forecastHour: number; observedMax: number; observedHour: number; withinHours: number };
  temp: { forecastMax: number | null; observedMax: number; forecastMin: number | null; observedMin: number };
  rain: { forecastSumMm: number; forecastProbMax: number; observed: boolean; agree: boolean };
  /** Did the recommendation for the station's spot survive the day? */
  pick: { spotId: string; verdict: string; window: { start: number; end: number }; gustInWindow: boolean; held: boolean } | null;
}

/** Compare one archived next-day forecast with the station's daily summary row. */
export function verifyDaily(data: Dataset, plan: PointPlan, obs: DailyObs, station: NoaStation, date: string, spots: Spot[], base: Base): DailyVerificationRow {
  const { point, km } = nearestLandPoint(plan, station.lat, station.lon);
  const land = data.land[point.id];
  const cons = land.atmos.map((_, k) => windConsensus(data, point.id, k));
  const speeds = cons.map((c) => c.speed);
  const fcAvg = speeds.reduce((s, x) => s + x, 0) / Math.max(1, speeds.length);
  let fcGustMax = 0;
  let fcGustHour = 0;
  cons.forEach((c, k) => {
    if (c.gust > fcGustMax) {
      fcGustMax = c.gust;
      fcGustHour = k;
    }
  });
  const fcDir = circularMean(cons.map((c) => c.dir), speeds.map((s) => Math.max(s, 1)));
  const temps = land.atmos.map((a) => a.temp).filter((x): x is number => x != null);
  const rainSum = round(land.atmos.reduce((s, a) => s + (a.precip ?? 0), 0), 1);
  const probMax = Math.max(0, ...land.atmos.map((a) => a.precipProb ?? 0));
  const rainFc = probMax >= 50 || rainSum >= 1;
  const rainObs = obs.rain >= 0.5;
  const obsGustHour = hourOfTime(obs.highWindTime);

  // the recommendation for the station's own spot, judged by where the day's strongest gust fell
  const spot = spots.find((s) => s.id === station.spotId);
  let pick: DailyVerificationRow['pick'] = null;
  if (spot) {
    const conds = analyzeFor(spot, data);
    const sc = scoreSpot(spot, conds, 'couple', base, date, { daysAhead: 1 });
    const inWindow = sc.window.start >= 0 && obsGustHour >= sc.window.start && obsGustHour < sc.window.end;
    const gustInWindow = inWindow && obs.highWind >= 40;
    const said = sc.verdict === 'go' || sc.verdict === 'caution';
    // held: we said go/caution and no 40+ km/h gust landed inside the window; or we said avoid and the day was indeed windy
    const held = said ? !gustInWindow : obs.highWind >= 35 || obs.avgWind >= 15;
    pick = { spotId: spot.id, verdict: sc.verdict, window: sc.window, gustInWindow, held };
  }

  return {
    date,
    station: station.id,
    point: point.id,
    pointDistanceKm: round(km),
    forecastFetchedAt: data.fetchedAt,
    wind: { forecastAvg: round(fcAvg), observedAvg: obs.avgWind, forecastDir: Math.round(fcDir), observedDir: obs.domDir, dirDiff: Number.isNaN(obs.domDir) ? NaN : Math.round(angleDiff(fcDir, obs.domDir)) },
    gust: { forecastMax: round(fcGustMax), forecastHour: fcGustHour, observedMax: obs.highWind, observedHour: obsGustHour, withinHours: Math.abs(fcGustHour - obsGustHour) },
    temp: { forecastMax: temps.length ? round(Math.max(...temps)) : null, observedMax: obs.high, forecastMin: temps.length ? round(Math.min(...temps)) : null, observedMin: obs.low },
    rain: { forecastSumMm: rainSum, forecastProbMax: probMax, observed: rainObs, agree: rainFc === rainObs },
    pick,
  };
}

// analyzeSpot lives in analysis.ts; imported lazily here to keep this module's imports acyclic for tests
import { analyzeSpot } from './analysis';
const analyzeFor = (spot: Spot, data: Dataset) => analyzeSpot(spot, data);

export interface StationSummary {
  id: string;
  name: string;
  days: number;
  from: string;
  to: string;
  gustMae: number;
  /** Share of days where the forecast max gust was within 10 km/h of the measured one. */
  gustWithin10Rate: number;
  /** Beaufort of the daily max gust within ±1 (gust Beaufort as a proxy for "how windy was the day"). */
  gustBfWithin1Rate: number;
  avgWindMae: number;
  dirWithin45Rate: number | null;
  tempMaxMae: number | null;
  rainAgreeRate: number;
  picks: number;
  picksHeld: number;
  recent: Pick<DailyVerificationRow, 'date' | 'wind' | 'gust' | 'temp' | 'rain' | 'pick'>[];
}

export function summarizeStations(rows: DailyVerificationRow[], windowDays = 30): StationSummary[] {
  const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
  const orNull = (x: number) => (Number.isNaN(x) ? null : round(x, 1));
  return NOA_STATIONS.map((st) => {
    const rs = rows
      .filter((r) => r.station === st.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-windowDays);
    const dirs = rs.map((r) => r.wind.dirDiff).filter((x) => !Number.isNaN(x));
    const tm = rs.map((r) => (r.temp.forecastMax == null ? null : Math.abs(r.temp.forecastMax - r.temp.observedMax))).filter((x): x is number => x != null);
    const picks = rs.filter((r) => r.pick);
    return {
      id: st.id,
      name: st.name,
      days: rs.length,
      from: rs[0]?.date ?? '',
      to: rs[rs.length - 1]?.date ?? '',
      gustMae: round(mean(rs.map((r) => Math.abs(r.gust.forecastMax - r.gust.observedMax)))) || 0,
      gustWithin10Rate: rs.length ? round(rs.filter((r) => Math.abs(r.gust.forecastMax - r.gust.observedMax) <= 10).length / rs.length, 2) : 0,
      gustBfWithin1Rate: rs.length ? round(rs.filter((r) => Math.abs(beaufort(r.gust.forecastMax) - beaufort(r.gust.observedMax)) <= 1).length / rs.length, 2) : 0,
      avgWindMae: round(mean(rs.map((r) => Math.abs(r.wind.forecastAvg - r.wind.observedAvg)))) || 0,
      dirWithin45Rate: dirs.length ? round(dirs.filter((d) => d <= 45).length / dirs.length, 2) : null,
      tempMaxMae: orNull(mean(tm)),
      rainAgreeRate: rs.length ? round(rs.filter((r) => r.rain.agree).length / rs.length, 2) : 0,
      picks: picks.length,
      picksHeld: picks.filter((r) => r.pick!.held).length,
      recent: rs.slice(-7).map(({ date, wind, gust, temp, rain, pick }) => ({ date, wind, gust, temp, rain, pick })),
    };
  });
}
