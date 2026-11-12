import { offsetPoint } from './geo';
import { shiftDate } from './dates';
import { MODELS, WAVE_MODELS, type AtmosHour, type Dataset, type MarineHour, type ModelId, type ModelWave, type ModelWind, type PointWeather, type RecentRain, type Spot, type WaveModelId } from './types';
import type { RefPoint } from '../data/region';

/*
 * Open-Meteo (https://open-meteo.com) — free for non-commercial use, no API key.
 * Commercial use needs an API subscription (customer-api.open-meteo.com + apikey).
 *
 * We make three multi-location requests per day:
 *   atmos  – best-match model: temperature, feels-like, rain, cloud, UV, wind
 *   models – wind/gusts from 5 independent global models, to measure agreement
 *   marine – waves, swell and sea temperature at offshore points
 * plus, for the gorge and hike points only, the daily rain of the previous days (recentRain):
 * a gorge after a wet day is closed or dangerous even under a blue sky.
 */

export const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
export const MARINE_URL = 'https://marine-api.open-meteo.com/v1/marine';
const TZ = 'Europe/Athens';

const ATMOS_VARS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'cloud_cover',
  'uv_index',
  'weather_code',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
];
// rain per model too: the best-match model alone missed half the showers in Oct 2026 (docs/rain-calibration-2026-11-01.md)
const MODEL_VARS = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation'];
const WAVE_MODEL_VARS = ['wave_height', 'wave_direction', 'wave_period'];
const MARINE_VARS = [
  'wave_height',
  'wave_direction',
  'wave_period',
  'wind_wave_height',
  'swell_wave_height',
  'swell_wave_direction',
  'swell_wave_period',
  'sea_surface_temperature',
];

export interface PointRef {
  id: string;
  lat: number;
  lon: number;
}

export interface PointPlan {
  land: PointRef[];
  marine: PointRef[];
  /** Points whose previous-days rain we fetch (gorges and hikes). Absent for the outlook plan. */
  recentRain?: PointRef[];
}

/** How many days back the previous-days rain request looks. */
export const RECENT_RAIN_DAYS = 3;

/** Offshore point used for a spot's marine forecast. */
export function seaPointFor(spot: Spot) {
  if (spot.seaPoint) return spot.seaPoint;
  if (spot.facing === undefined) return undefined;
  return offsetPoint(spot.lat, spot.lon, spot.facing, 5);
}

export const depSeaId = (spotId: string) => `${spotId}:dep`;
/** Atmospheric point just off the shore: the wind a swimmer feels comes from there, and coastal land
 *  grid cells (sheltered by terrain in the model) can read 2–3× too low on sea-breeze afternoons. */
export const seaWindId = (spotId: string) => `${spotId}:wind`;

export function planPoints(spots: Spot[], refs: RefPoint[]): PointPlan {
  const land: PointRef[] = [...spots.map(({ id, lat, lon }) => ({ id, lat, lon })), ...refs.map(({ id, lat, lon }) => ({ id, lat, lon }))];
  const marine: PointRef[] = [];
  for (const s of spots) {
    const p = (s.type === 'beach' || s.type === 'boat') && seaPointFor(s);
    if (p) marine.push({ id: s.id, ...p });
    if (p) land.push({ id: seaWindId(s.id), ...p });
    if (s.dependsOnSea) marine.push({ id: depSeaId(s.id), lat: s.dependsOnSea.lat, lon: s.dependsOnSea.lon });
  }
  for (const r of refs) if (r.facing !== undefined) marine.push({ id: r.id, lat: r.lat, lon: r.lon });
  const recentRain = spots.filter((s) => s.type === 'gorge' || s.type === 'hike').map(({ id, lat, lon }) => ({ id, lat, lon }));
  return { land, marine, ...(recentRain.length ? { recentRain } : {}) };
}

const coords = (pts: PointRef[]) => ({
  latitude: pts.map((p) => p.lat).join(','),
  longitude: pts.map((p) => p.lon).join(','),
});

export function buildUrls(plan: PointPlan, date: string, apiKey?: string, endDate = date) {
  const common = { timezone: TZ, start_date: date, end_date: endDate, ...(apiKey ? { apikey: apiKey } : {}) };
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  return {
    atmos: `${FORECAST_URL}?${q({ ...coords(plan.land), hourly: ATMOS_VARS.join(','), daily: 'sunrise,sunset', ...common })}`,
    models: `${FORECAST_URL}?${q({ ...coords(plan.land), hourly: MODEL_VARS.join(','), models: MODELS.join(','), ...common })}`,
    marine: `${MARINE_URL}?${q({ ...coords(plan.marine), hourly: MARINE_VARS.join(','), ...common })}`,
    waves: `${MARINE_URL}?${q({ ...coords(plan.marine), hourly: WAVE_MODEL_VARS.join(','), models: WAVE_MODELS.join(','), ...common })}`,
    // the days before `date` (the forecast API serves recent past days too)
    recentRain: plan.recentRain?.length
      ? `${FORECAST_URL}?${q({ ...coords(plan.recentRain), daily: 'precipitation_sum', ...common, start_date: shiftDate(date, -RECENT_RAIN_DAYS), end_date: shiftDate(date, -1) })}`
      : undefined,
  };
}

/** Raw API responses, stored as-is so snapshots can be re-analysed later with an improved engine. */
export interface RawBundle {
  date: string;
  /** Last day covered when the bundle spans several days (the 7-day outlook); absent = one day. */
  endDate?: string;
  fetchedAt: string;
  plan: PointPlan;
  atmos: unknown;
  models: unknown;
  marine: unknown;
  /** Multi-model wave request; optional so older snapshots still load. */
  waves?: unknown;
  /** Daily rain of the previous days at the gorge/hike points; optional (added Nov 2026). */
  recentRain?: unknown;
}

type OMResponse = {
  hourly?: Record<string, (number | string | null)[]>;
  daily?: Record<string, (number | string | null)[]>;
  error?: boolean;
  reason?: string;
};

function asList(resp: unknown, expected: number, label: string): OMResponse[] {
  const list = (Array.isArray(resp) ? resp : [resp]) as OMResponse[];
  const err = list.find((r) => r?.error);
  if (err) throw new Error(`Open-Meteo ${label}: ${err.reason}`);
  if (list.length !== expected) throw new Error(`Open-Meteo ${label}: expected ${expected} locations, got ${list.length}`);
  return list;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function datasetFromRaw(raw: RawBundle, source: Dataset['source']): Dataset {
  const atmosList = asList(raw.atmos, raw.plan.land.length, 'forecast');
  const modelList = asList(raw.models, raw.plan.land.length, 'models');
  const marineList = asList(raw.marine, raw.plan.marine.length, 'marine');

  const land: Dataset['land'] = {};
  raw.plan.land.forEach((pt, i) => {
    const h = atmosList[i].hourly ?? {};
    const times = (h.time ?? []) as string[];
    const atmos: AtmosHour[] = times.map((time, k) => ({
      time,
      temp: num(h.temperature_2m?.[k]),
      apparent: num(h.apparent_temperature?.[k]),
      precipProb: num(h.precipitation_probability?.[k]),
      precip: num(h.precipitation?.[k]),
      cloud: num(h.cloud_cover?.[k]),
      uv: num(h.uv_index?.[k]),
      code: num(h.weather_code?.[k]),
      wind: num(h.wind_speed_10m?.[k]),
      windDir: num(h.wind_direction_10m?.[k]),
      gust: num(h.wind_gusts_10m?.[k]),
    }));
    const mh = modelList[i].hourly ?? {};
    const models = {} as Record<ModelId, ModelWind[]>;
    for (const m of MODELS) {
      models[m] = times.map((_, k) => ({
        wind: num(mh[`wind_speed_10m_${m}`]?.[k]),
        dir: num(mh[`wind_direction_10m_${m}`]?.[k]),
        gust: num(mh[`wind_gusts_10m_${m}`]?.[k]),
        precip: num(mh[`precipitation_${m}`]?.[k]),
      }));
    }
    const d = atmosList[i].daily ?? {};
    land[pt.id] = { atmos, models, sunrise: d.sunrise?.[0] as string | undefined, sunset: d.sunset?.[0] as string | undefined };
  });

  const marine: Dataset['marine'] = {};
  raw.plan.marine.forEach((pt, i) => {
    const h = marineList[i].hourly ?? {};
    const times = (h.time ?? []) as string[];
    marine[pt.id] = times.map(
      (time, k): MarineHour => ({
        time,
        wave: num(h.wave_height?.[k]),
        waveDir: num(h.wave_direction?.[k]),
        wavePeriod: num(h.wave_period?.[k]),
        windWave: num(h.wind_wave_height?.[k]),
        swell: num(h.swell_wave_height?.[k]),
        swellDir: num(h.swell_wave_direction?.[k]),
        swellPeriod: num(h.swell_wave_period?.[k]),
        sst: num(h.sea_surface_temperature?.[k]),
      }),
    );
  });

  let waveModels: Dataset['waveModels'];
  if (raw.waves) {
    const waveList = asList(raw.waves, raw.plan.marine.length, 'wave models');
    waveModels = {};
    raw.plan.marine.forEach((pt, i) => {
      const h = waveList[i].hourly ?? {};
      const times = (h.time ?? []) as string[];
      const perModel = {} as Record<WaveModelId, ModelWave[]>;
      for (const m of WAVE_MODELS) {
        perModel[m] = times.map((_, k) => ({
          wave: num(h[`wave_height_${m}`]?.[k]),
          dir: num(h[`wave_direction_${m}`]?.[k]),
          period: num(h[`wave_period_${m}`]?.[k]),
        }));
      }
      waveModels![pt.id] = perModel;
    });
  }

  let recentRain: Dataset['recentRain'];
  if (raw.recentRain && raw.plan.recentRain?.length) {
    const list = asList(raw.recentRain, raw.plan.recentRain.length, 'recent rain');
    recentRain = {};
    raw.plan.recentRain.forEach((pt, i) => {
      const sums = ((list[i].daily?.precipitation_sum ?? []) as (number | null)[]).map(num);
      const known = sums.filter((x): x is number => x != null);
      const prev = sums[sums.length - 1] ?? null;
      recentRain![pt.id] = { prevDayMm: prev, threeDayMm: known.length ? Math.round(known.reduce((a, b) => a + b, 0) * 10) / 10 : null } satisfies RecentRain;
    });
  }

  return { date: raw.date, fetchedAt: raw.fetchedAt, source, land, marine, waveModels, recentRain };
}

export interface FetchOptions {
  /** Extra attempts after the first one, for timeouts, 5xx and "too many requests" (default 2). */
  retries?: number;
  /** Injected in tests so they do not really wait. */
  sleep?: (ms: number) => Promise<void>;
  log?: (msg: string) => void;
}

/** Open-Meteo's free limit is per minute: after a 429 the only useful wait is a full minute. */
export const RATE_LIMIT_WAIT_MS = 62_000;
// short first waits: a connect timeout is usually one dead server behind the round-robin DNS, and the next try lands elsewhere
const RETRY_WAITS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * One GET with patience. A connect timeout, a 5xx or a 429 is the provider having a bad moment
 * (12 Nov 2026: a 10 s connect timeout on the marine API cancelled the whole evening message);
 * any other 4xx is our request being wrong and is not retried.
 */
export async function getWithRetry(url: string, fetchImpl: typeof fetch = fetch, opts: FetchOptions = {}): Promise<unknown> {
  const retries = opts.retries ?? 2;
  const sleep = opts.sleep ?? realSleep;
  const host = url.split('/')[2] ?? 'open-meteo';
  let last: Error = new Error('no attempt made');
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let wait = RETRY_WAITS_MS[Math.min(attempt, RETRY_WAITS_MS.length - 1)];
    try {
      const res = await fetchImpl(url);
      const body = (await res.json().catch(() => null)) as { reason?: string } | null;
      if (res.ok) return body;
      last = new Error(`Open-Meteo ${res.status}: ${body?.reason ?? res.statusText}`);
      if (res.status === 429) wait = RATE_LIMIT_WAIT_MS;
      else if (res.status < 500) throw Object.assign(last, { fatal: true });
    } catch (e) {
      if ((e as { fatal?: boolean }).fatal) throw e;
      last = e as Error;
    }
    if (attempt < retries) {
      opts.log?.(`${host}: ${last.message}; retrying in ${Math.round(wait / 1000)} s (${attempt + 1}/${retries})`);
      await sleep(wait);
    }
  }
  throw last;
}

export async function fetchRaw(plan: PointPlan, date: string, apiKey?: string, fetchImpl: typeof fetch = fetch, endDate = date, opts: FetchOptions = {}): Promise<RawBundle> {
  const urls = buildUrls(plan, date, apiKey, endDate);
  const get = (url: string) => getWithRetry(url, fetchImpl, opts);
  const [atmos, models, marine, waves, recentRain] = await Promise.all([get(urls.atmos), get(urls.models), get(urls.marine), get(urls.waves), urls.recentRain
      ? get(urls.recentRain).catch((e: unknown) => {
          // the gorges fall back to today's rain only; the snapshot itself must not fail over it
          console.warn('previous-days rain request failed; gorge limits use today only', e);
          return undefined;
        })
      : Promise.resolve(undefined),
  ]);
  return { date, ...(endDate !== date ? { endDate } : {}), fetchedAt: new Date().toISOString(), plan, atmos, models, marine, waves, ...(recentRain ? { recentRain } : {}) };
}

/*
 * 7-day outlook. Days 0–2 are fetched in full (every spot, every model). For days 3–7 we only
 * fetch the handful of reference points (one per coast plus the town), in a single multi-day
 * request, and map every spot onto its nearest reference. Beyond three days the spot-level
 * detail is noise anyway; what the stay planner needs is "which day is the west coast calm".
 */
export const OUTLOOK_DAYS = 7;

export function outlookPlan(refs: RefPoint[]): PointPlan {
  return {
    land: refs.map(({ id, lat, lon }) => ({ id, lat, lon })),
    marine: refs.filter((r) => r.facing !== undefined).map(({ id, lat, lon }) => ({ id, lat, lon })),
  };
}

/** The hours of one calendar day out of a multi-day dataset. */
export function sliceDay(ds: Dataset, date: string): Dataset {
  const land: Dataset['land'] = {};
  for (const [id, pw] of Object.entries(ds.land)) {
    const idx = pw.atmos.map((a, k) => (a.time.startsWith(date) ? k : -1)).filter((k) => k >= 0);
    const models = {} as PointWeather['models'];
    for (const m of MODELS) models[m] = idx.map((k) => pw.models[m]?.[k] ?? { wind: null, dir: null, gust: null });
    land[id] = { atmos: idx.map((k) => pw.atmos[k]), models, sunrise: pw.sunrise, sunset: pw.sunset };
  }
  const marine: Dataset['marine'] = {};
  const waveModels: NonNullable<Dataset['waveModels']> = {};
  for (const [id, hours] of Object.entries(ds.marine)) {
    const idx = hours.map((h, k) => (h.time.startsWith(date) ? k : -1)).filter((k) => k >= 0);
    marine[id] = idx.map((k) => hours[k]);
    const wm = ds.waveModels?.[id];
    if (wm) {
      const per = {} as Record<WaveModelId, ModelWave[]>;
      for (const m of WAVE_MODELS) per[m] = idx.map((k) => wm[m]?.[k] ?? { wave: null, dir: null, period: null });
      waveModels[id] = per;
    }
  }
  return { ...ds, date, land, marine, waveModels: ds.waveModels ? waveModels : undefined };
}

/** Day-by-day sunrise/sunset for a multi-day bundle (Open-Meteo returns one per day). */
export function dailySun(raw: RawBundle, pointIndex = 0): Record<string, { sunrise?: string; sunset?: string }> {
  const list = Array.isArray(raw.atmos) ? (raw.atmos as OMResponse[]) : [raw.atmos as OMResponse];
  const d = list[pointIndex]?.daily ?? {};
  const out: Record<string, { sunrise?: string; sunset?: string }> = {};
  ((d.time ?? []) as string[]).forEach((date, i) => {
    out[date] = { sunrise: d.sunrise?.[i] as string | undefined, sunset: d.sunset?.[i] as string | undefined };
  });
  return out;
}

function nearestRef<T extends PointRef>(refs: T[], lat: number, lon: number): T {
  let best = refs[0];
  let bestD = Infinity;
  for (const r of refs) {
    const d = (r.lat - lat) ** 2 + ((r.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/**
 * Builds a full spot-level dataset out of a reference-points-only day: each spot (and its sea-side
 * wind point and marine point) takes the data of the nearest reference. The spot's own geometry
 * (facing, shelter, fetch) is still applied by the analysis, so a lee-side beach still comes out
 * calmer than an exposed one — only the mesoscale detail is lost.
 */
export function proxyDataset(ref: Dataset, spots: Spot[], refs: RefPoint[]): Dataset {
  const landRefs = refs.filter((r) => ref.land[r.id]);
  const seaRefs = refs.filter((r) => r.facing !== undefined && ref.marine[r.id]);
  const land: Dataset['land'] = { ...ref.land };
  const marine: Dataset['marine'] = { ...ref.marine };
  const waveModels: NonNullable<Dataset['waveModels']> = { ...(ref.waveModels ?? {}) };
  for (const s of spots) {
    const lr = nearestRef(landRefs, s.lat, s.lon);
    land[s.id] = ref.land[lr.id];
    const sea = (s.type === 'beach' || s.type === 'boat') && seaPointFor(s);
    if (sea && seaRefs.length) {
      const sr = nearestRef(seaRefs, sea.lat, sea.lon);
      marine[s.id] = ref.marine[sr.id];
      if (ref.waveModels?.[sr.id]) waveModels[s.id] = ref.waveModels[sr.id];
      land[seaWindId(s.id)] = ref.land[nearestRef(landRefs, sea.lat, sea.lon).id];
    }
    if (s.dependsOnSea && seaRefs.length) {
      const sr = nearestRef(seaRefs, s.dependsOnSea.lat, s.dependsOnSea.lon);
      marine[depSeaId(s.id)] = ref.marine[sr.id];
      if (ref.waveModels?.[sr.id]) waveModels[depSeaId(s.id)] = ref.waveModels[sr.id];
    }
  }
  return { ...ref, land, marine, waveModels: ref.waveModels ? waveModels : undefined, source: 'snapshot' };
}
