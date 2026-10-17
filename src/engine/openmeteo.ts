import { offsetPoint } from './geo';
import { MODELS, type AtmosHour, type Dataset, type MarineHour, type ModelId, type ModelWind, type Spot } from './types';
import type { RefPoint } from '../data/region';

/*
 * Open-Meteo (https://open-meteo.com) — free for non-commercial use, no API key.
 * Commercial use needs an API subscription (customer-api.open-meteo.com + apikey).
 *
 * We make three multi-location requests per day:
 *   atmos  – best-match model: temperature, feels-like, rain, cloud, UV, wind
 *   models – wind/gusts from 5 independent global models, to measure agreement
 *   marine – waves, swell and sea temperature at offshore points
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
const MODEL_VARS = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
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
}

/** Offshore point used for a spot's marine forecast. */
export function seaPointFor(spot: Spot) {
  if (spot.seaPoint) return spot.seaPoint;
  if (spot.facing === undefined) return undefined;
  return offsetPoint(spot.lat, spot.lon, spot.facing, 5);
}

export const depSeaId = (spotId: string) => `${spotId}:dep`;

export function planPoints(spots: Spot[], refs: RefPoint[]): PointPlan {
  const land: PointRef[] = [...spots.map(({ id, lat, lon }) => ({ id, lat, lon })), ...refs.map(({ id, lat, lon }) => ({ id, lat, lon }))];
  const marine: PointRef[] = [];
  for (const s of spots) {
    const p = (s.type === 'beach' || s.type === 'boat') && seaPointFor(s);
    if (p) marine.push({ id: s.id, ...p });
    if (s.dependsOnSea) marine.push({ id: depSeaId(s.id), lat: s.dependsOnSea.lat, lon: s.dependsOnSea.lon });
  }
  for (const r of refs) if (r.facing !== undefined) marine.push({ id: r.id, lat: r.lat, lon: r.lon });
  return { land, marine };
}

const coords = (pts: PointRef[]) => ({
  latitude: pts.map((p) => p.lat).join(','),
  longitude: pts.map((p) => p.lon).join(','),
});

export function buildUrls(plan: PointPlan, date: string, apiKey?: string) {
  const common = { timezone: TZ, start_date: date, end_date: date, ...(apiKey ? { apikey: apiKey } : {}) };
  const q = (o: Record<string, string>) => new URLSearchParams(o).toString();
  return {
    atmos: `${FORECAST_URL}?${q({ ...coords(plan.land), hourly: ATMOS_VARS.join(','), daily: 'sunrise,sunset', ...common })}`,
    models: `${FORECAST_URL}?${q({ ...coords(plan.land), hourly: MODEL_VARS.join(','), models: MODELS.join(','), ...common })}`,
    marine: `${MARINE_URL}?${q({ ...coords(plan.marine), hourly: MARINE_VARS.join(','), ...common })}`,
  };
}

/** Raw API responses, stored as-is so snapshots can be re-analysed later with an improved engine. */
export interface RawBundle {
  date: string;
  fetchedAt: string;
  plan: PointPlan;
  atmos: unknown;
  models: unknown;
  marine: unknown;
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

  return { date: raw.date, fetchedAt: raw.fetchedAt, source, land, marine };
}

export async function fetchRaw(plan: PointPlan, date: string, apiKey?: string, fetchImpl: typeof fetch = fetch): Promise<RawBundle> {
  const urls = buildUrls(plan, date, apiKey);
  const get = async (url: string) => {
    const res = await fetchImpl(url);
    const body = await res.json();
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}: ${body?.reason ?? res.statusText}`);
    return body;
  };
  const [atmos, models, marine] = await Promise.all([get(urls.atmos), get(urls.models), get(urls.marine)]);
  return { date, fetchedAt: new Date().toISOString(), plan, atmos, models, marine };
}
