import { windConsensus } from './analysis';
import { hourOf } from './dates';
import { angleDiff, beaufort, haversineKm, round } from './geo';
import { MODELS, type Dataset, type ModelId } from './types';
import type { PointPlan } from './openmeteo';
import type { HourObs } from './metar';

/*
 * Forecast verification: the forecast issued the day before vs what the airport station measured.
 * Pure functions; scripts/verify.ts does the fetching and file writing.
 */

/** Chania airport (LGSA), Akrotiri peninsula. */
export const STATION = { id: 'LGSA', name: 'Chania airport (Akrotiri)', lat: 35.5317, lon: 24.1497 };

const DAY_FROM = 6;
const DAY_TO = 21;
const AFTERNOON = [13, 18] as const;

export interface VerificationRow {
  date: string;
  station: string;
  /** Which forecast point was compared and how far it is from the station (km). */
  point: string;
  pointDistanceKm: number;
  forecastFetchedAt: string;
  hoursCompared: number;
  wind: { mae: number; bias: number; afternoonBias: number | null; dirMae: number | null };
  gust: { forecastMax: number; observedMax: number };
  temp: { mae: number | null; bias: number | null; forecastMax: number | null; observedMax: number | null };
  bf: { forecastMax: number; observedMax: number; within1: boolean };
  rain: { forecastProbMax: number; forecastSumMm: number; observed: boolean; agree: boolean };
  /** Per wind model: mean absolute error of speed (km/h) over the compared hours. */
  perModel: Record<ModelId, number | null>;
  hourly: { hour: number; fc: number; obs: number; fcDir: number | null; obsDir: number | null; fcTemp: number | null; obsTemp: number | null }[];
}

/** The forecast land point closest to the station. */
export function nearestLandPoint(plan: PointPlan, lat = STATION.lat, lon = STATION.lon) {
  let best = plan.land[0];
  let bestKm = Infinity;
  for (const p of plan.land) {
    if (p.id.endsWith(':wind')) continue;
    const km = haversineKm(lat, lon, p.lat, p.lon);
    if (km < bestKm) {
      best = p;
      bestKm = km;
    }
  }
  return { point: best, km: bestKm };
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const orNull = (x: number) => (Number.isNaN(x) ? null : round(x, 1));

export function verifyDay(data: Dataset, plan: PointPlan, obs: HourObs[], date: string): VerificationRow {
  const { point, km } = nearestLandPoint(plan);
  const land = data.land[point.id];
  const obsByHour = new Map(obs.map((o) => [o.hour, o]));

  const rows: VerificationRow['hourly'] = [];
  const absErr: number[] = [];
  const err: number[] = [];
  const pmErr: Record<string, number[]> = {};
  const dirErr: number[] = [];
  const tErr: number[] = [];
  const afternoonErr: number[] = [];
  let fcGustMax = 0;
  let obsGustMax = 0;
  let fcBfMax = 0;
  let obsBfMax = 0;

  land.atmos.forEach((a, k) => {
    const hour = hourOf(a.time);
    if (hour < DAY_FROM || hour > DAY_TO) return;
    const o = obsByHour.get(hour);
    if (!o) return;
    const wc = windConsensus(data, point.id, k);
    const e = wc.speed - o.windKmh;
    absErr.push(Math.abs(e));
    err.push(e);
    if (hour >= AFTERNOON[0] && hour <= AFTERNOON[1]) afternoonErr.push(e);
    if (o.windDir != null && o.windKmh >= 8 && wc.speed >= 8) dirErr.push(angleDiff(wc.dir, o.windDir));
    if (a.temp != null && o.tempC != null) tErr.push(a.temp - o.tempC);
    fcGustMax = Math.max(fcGustMax, wc.gust);
    obsGustMax = Math.max(obsGustMax, o.gustKmh);
    fcBfMax = Math.max(fcBfMax, beaufort(wc.speed));
    obsBfMax = Math.max(obsBfMax, beaufort(o.windKmh));
    for (const m of MODELS) {
      const w = land.models[m]?.[k];
      if (w?.wind == null) continue;
      (pmErr[m] ??= []).push(Math.abs(w.wind - o.windKmh));
    }
    rows.push({ hour, fc: round(wc.speed), obs: round(o.windKmh), fcDir: Math.round(wc.dir), obsDir: o.windDir == null ? null : Math.round(o.windDir), fcTemp: a.temp, obsTemp: o.tempC == null ? null : round(o.tempC) });
  });

  const day = land.atmos.filter((a) => {
    const h = hourOf(a.time);
    return h >= DAY_FROM && h <= DAY_TO;
  });
  const probMax = Math.max(0, ...day.map((a) => a.precipProb ?? 0));
  const sumMm = round(day.reduce((s, a) => s + (a.precip ?? 0), 0), 1);
  const rainObs = obs.some((o) => o.hour >= DAY_FROM && o.hour <= DAY_TO && o.rain);
  const rainFc = probMax >= 50 || sumMm >= 1;
  const fcTemps = day.map((a) => a.temp).filter((x): x is number => x != null);
  const obsTemps = obs.map((o) => o.tempC).filter((x): x is number => x != null);

  const perModel = {} as Record<ModelId, number | null>;
  for (const m of MODELS) perModel[m] = pmErr[m]?.length ? round(mean(pmErr[m])) : null;

  return {
    date,
    station: STATION.id,
    point: point.id,
    pointDistanceKm: round(km),
    forecastFetchedAt: data.fetchedAt,
    hoursCompared: rows.length,
    wind: { mae: round(mean(absErr)), bias: round(mean(err)), afternoonBias: orNull(mean(afternoonErr)), dirMae: orNull(mean(dirErr)) },
    gust: { forecastMax: round(fcGustMax), observedMax: round(obsGustMax) },
    temp: {
      mae: orNull(mean(tErr.map(Math.abs))),
      bias: orNull(mean(tErr)),
      forecastMax: fcTemps.length ? round(Math.max(...fcTemps)) : null,
      observedMax: obsTemps.length ? round(Math.max(...obsTemps)) : null,
    },
    bf: { forecastMax: fcBfMax, observedMax: obsBfMax, within1: Math.abs(fcBfMax - obsBfMax) <= 1 },
    rain: { forecastProbMax: probMax, forecastSumMm: sumMm, observed: rainObs, agree: rainFc === rainObs },
    perModel,
    hourly: rows,
  };
}

export interface VerificationSummary {
  updatedAt: string;
  station: typeof STATION;
  days: number;
  from: string;
  to: string;
  wind: { mae: number; bias: number; afternoonBias: number | null; dirMae: number | null };
  temp: { mae: number | null; bias: number | null };
  bfWithin1Rate: number;
  rainAgreeRate: number;
  gustMaeMax: number;
  perModel: { model: ModelId; mae: number | null; days: number }[];
  recent: Pick<VerificationRow, 'date' | 'wind' | 'bf' | 'temp' | 'rain' | 'gust'>[];
}

/** Rolling summary over the last `windowDays` rows (most recent last). */
export function summarize(rows: VerificationRow[], windowDays = 30, now = new Date()): VerificationSummary {
  const recentRows = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-windowDays);
  const nn = (xs: (number | null)[]) => xs.filter((x): x is number => x != null);
  const perModel = MODELS.map((m) => {
    const vals = nn(recentRows.map((r) => r.perModel[m]));
    return { model: m, mae: vals.length ? round(mean(vals)) : null, days: vals.length };
  }).sort((a, b) => (a.mae ?? Infinity) - (b.mae ?? Infinity));
  return {
    updatedAt: now.toISOString(),
    station: STATION,
    days: recentRows.length,
    from: recentRows[0]?.date ?? '',
    to: recentRows[recentRows.length - 1]?.date ?? '',
    wind: {
      mae: round(mean(recentRows.map((r) => r.wind.mae))),
      bias: round(mean(recentRows.map((r) => r.wind.bias))),
      afternoonBias: orNull(mean(nn(recentRows.map((r) => r.wind.afternoonBias)))),
      dirMae: orNull(mean(nn(recentRows.map((r) => r.wind.dirMae)))),
    },
    temp: { mae: orNull(mean(nn(recentRows.map((r) => r.temp.mae)))), bias: orNull(mean(nn(recentRows.map((r) => r.temp.bias)))) },
    bfWithin1Rate: recentRows.length ? round(recentRows.filter((r) => r.bf.within1).length / recentRows.length, 2) : 0,
    rainAgreeRate: recentRows.length ? round(recentRows.filter((r) => r.rain.agree).length / recentRows.length, 2) : 0,
    gustMaeMax: round(mean(recentRows.map((r) => Math.abs(r.gust.forecastMax - r.gust.observedMax)))),
    perModel,
    recent: recentRows.slice(-7).map(({ date, wind, bf, temp, rain, gust }) => ({ date, wind, bf, temp, rain, gust })),
  };
}
