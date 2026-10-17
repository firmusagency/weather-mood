import { angleDiff, beaufort, circularMean, round } from './geo';
import { hourOf } from './dates';
import { windConsensus } from './analysis';
import { MODELS, type Dataset, type ModelId } from './types';
import type { RefPoint } from '../data/region';

/*
 * Regional overview for the day: what the wind does over the open sea, what each coast gets,
 * how much the models agree, plus heat / UV / rain. This is the "data first" view staff see
 * before any recommendation.
 */

const DAY_FROM = 10;
const DAY_TO = 18;

export interface CoastSummary {
  id: string;
  wind: { speed: number; gust: number; dir: number; bf: number };
  waveMean: number | null;
  waveMax: number | null;
  waveDir: number | null;
  sst: number | null;
  /** Is the wind blowing onto this coast? */
  exposed: boolean;
}

export interface ModelRow {
  model: ModelId;
  speed: number | null;
  gust: number | null;
  dir: number | null;
}

export interface Synopsis {
  date: string;
  wind: { speed: number; gust: number; dir: number; bf: number; speedSpread: number; dirSpread: number };
  hourlyWind: { hour: number; speed: number; gust: number; dir: number }[];
  coasts: CoastSummary[];
  models: ModelRow[];
  agreement: 'high' | 'medium' | 'low';
  town: { tMax: number | null; apparentMax: number | null; uvMax: number | null; rainProbMax: number | null; rainSum: number; sunrise?: string; sunset?: string };
  takeaways: { key: string; params: Record<string, string | number> }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const maxOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
};

export function buildSynopsis(data: Dataset, refs: RefPoint[]): Synopsis {
  const north = data.land['ref-north'];
  const dayIdx = north.atmos.map((a, k) => ({ k, h: hourOf(a.time) })).filter(({ h }) => h >= DAY_FROM && h <= DAY_TO);

  const cons = dayIdx.map(({ k }) => windConsensus(data, 'ref-north', k));
  const speeds = cons.map((c) => c.speed);
  const dir = circularMean(cons.map((c) => c.dir), speeds.map((s) => Math.max(s, 1)));
  const speed = mean(speeds);
  const gust = Math.max(...cons.map((c) => c.gust));
  const speedSpread = mean(cons.map((c) => c.speedSpread));
  const dirSpread = mean(cons.map((c) => c.dirSpread));
  const agreement = speedSpread > 18 || dirSpread > 80 ? 'low' : speedSpread <= 10 && dirSpread <= 45 ? 'high' : 'medium';

  const hourlyWind = north.atmos
    .map((a, k) => ({ h: hourOf(a.time), k }))
    .filter(({ h }) => h >= 6 && h <= 21)
    .map(({ h, k }) => {
      const c = windConsensus(data, 'ref-north', k);
      return { hour: h, speed: round(c.speed), gust: round(c.gust), dir: Math.round(c.dir) };
    });

  const models: ModelRow[] = MODELS.map((m) => {
    const vals = dayIdx.map(({ k }) => north.models[m]?.[k]).filter((w) => w?.wind != null && w.dir != null);
    if (!vals.length) return { model: m, speed: null, gust: null, dir: null };
    const sp = vals.map((w) => w!.wind!);
    return {
      model: m,
      speed: round(mean(sp)),
      gust: maxOf(vals.map((w) => w!.gust)),
      dir: Math.round(circularMean(vals.map((w) => w!.dir!), sp)),
    };
  });

  const coasts: CoastSummary[] = refs
    .filter((r) => r.facing !== undefined)
    .map((r) => {
      const c = dayIdx.map(({ k }) => windConsensus(data, r.id, k));
      const csp = c.map((x) => x.speed);
      const cdir = circularMean(c.map((x) => x.dir), csp.map((s) => Math.max(s, 1)));
      const marine = (data.marine[r.id] ?? []).filter((m) => {
        const h = hourOf(m.time);
        return h >= DAY_FROM && h <= DAY_TO;
      });
      const waves = marine.map((m) => m.wave).filter((x): x is number => x != null);
      const wdirs = marine.filter((m) => m.waveDir != null).map((m) => m.waveDir!);
      return {
        id: r.id,
        wind: { speed: round(mean(csp)), gust: round(Math.max(...c.map((x) => x.gust))), dir: Math.round(cdir), bf: beaufort(mean(csp)) },
        waveMean: waves.length ? round(mean(waves), 1) : null,
        waveMax: waves.length ? round(Math.max(...waves), 1) : null,
        waveDir: wdirs.length ? Math.round(circularMean(wdirs)) : null,
        sst: marine.length ? marine[Math.floor(marine.length / 2)].sst : null,
        exposed: angleDiff(dir, r.facing!) <= 70 && speed >= 12,
      };
    });

  const town = data.land['ref-town'];
  const townDay = town.atmos.filter((a) => {
    const h = hourOf(a.time);
    return h >= 8 && h <= 20;
  });
  const townSummary = {
    tMax: maxOf(townDay.map((a) => a.temp)),
    apparentMax: maxOf(townDay.map((a) => a.apparent)),
    uvMax: maxOf(townDay.map((a) => a.uv)),
    rainProbMax: maxOf(townDay.map((a) => a.precipProb)),
    rainSum: round(townDay.reduce((s, a) => s + (a.precip ?? 0), 0), 1),
    sunrise: town.sunrise,
    sunset: town.sunset,
  };

  // Plain-language takeaways, generated from the numbers above.
  const takeaways: Synopsis['takeaways'] = [];
  const bf = beaufort(speed);
  takeaways.push({ key: 'wind', params: { dir: Math.round(dir), bf, kmh: Math.round(speed), gust: Math.round(gust) } });
  for (const c of coasts) {
    if (c.waveMax != null && c.waveMax >= 1.0) takeaways.push({ key: 'roughCoast', params: { coast: c.id, wave: c.waveMax } });
  }
  const calm = coasts.filter((c) => c.waveMax != null && c.waveMax < 0.5);
  if (calm.length) takeaways.push({ key: 'calmCoasts', params: { coasts: calm.map((c) => c.id).join(',') } });
  if (bf >= 4 && angleDiff(dir, 0) <= 45) takeaways.push({ key: 'southGusts', params: { bf } });
  const hourlyMax = Math.max(...hourlyWind.filter((h) => h.hour >= 10 && h.hour <= 19).map((h) => h.speed));
  const morning = hourlyWind.find((h) => h.hour === 9)?.speed ?? 0;
  if (hourlyMax - morning >= 10) takeaways.push({ key: 'windPicksUp', params: { from: Math.round(morning), to: Math.round(hourlyMax) } });
  if ((townSummary.apparentMax ?? 0) >= 32) takeaways.push({ key: 'heat', params: { apparent: Math.round(townSummary.apparentMax!) } });
  if ((townSummary.uvMax ?? 0) >= 7) takeaways.push({ key: 'uv', params: { uv: round(townSummary.uvMax!, 0) } });
  if ((townSummary.rainProbMax ?? 0) >= 40) takeaways.push({ key: 'rain', params: { pp: townSummary.rainProbMax!, mm: townSummary.rainSum } });
  takeaways.push({ key: 'agreement', params: { level: agreement } });

  return {
    date: data.date,
    wind: { speed: round(speed), gust: round(gust), dir: Math.round(dir), bf, speedSpread: round(speedSpread), dirSpread: Math.round(dirSpread) },
    hourlyWind,
    coasts,
    models,
    agreement,
    town: townSummary,
    takeaways,
  };
}
