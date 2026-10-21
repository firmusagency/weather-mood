import { angleDiff, beaufort, circularMean, round } from './geo';
import { hourOf } from './dates';
import { waveConsensus, windConsensus } from './analysis';
import { waveAgreement } from './scoring';
import { WAVE_MODELS, WAVE_MODEL_LABELS, type WaveModelId } from './types';
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
  /** Per wave model, mean height 10:00–18:00 (empty when the snapshot has no multi-model waves). */
  waveModels: { model: WaveModelId; label: string; wave: number; period: number | null }[];
  waveSpread: number | null;
  waveAgreement: 'high' | 'medium' | 'low' | null;
  waveMax: number | null;
  waveDir: number | null;
  sst: number | null;
  /** Is the wind blowing onto this coast, away from it, or is there hardly any wind? */
  exposure: 'exposed' | 'sheltered' | 'calm';
}

export interface ModelRow {
  model: ModelId;
  speed: number | null;
  gust: number | null;
  dir: number | null;
}

export interface Synopsis {
  date: string;
  /** Which coast reference the headline wind comes from (the windiest one). */
  windRef: string;
  wind: { speed: number; gust: number; dir: number; bf: number; speedSpread: number; dirSpread: number };
  hourlyWind: { hour: number; speed: number; gust: number; dir: number }[];
  coasts: CoastSummary[];
  models: ModelRow[];
  agreement: 'high' | 'medium' | 'low';
  /** Agreement between the wave models across the coasts; null for snapshots without multi-model waves. */
  waveAgreement: 'high' | 'medium' | 'low' | null;
  town: { tMax: number | null; apparentMax: number | null; uvMax: number | null; rainProbMax: number | null; rainSum: number; sunrise?: string; sunset?: string };
  takeaways: { key: string; params: Record<string, string | number> }[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const maxOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? Math.max(...v) : null;
};

export function buildSynopsis(data: Dataset, refs: RefPoint[]): Synopsis {
  // The headline wind is the strongest of the three coast references (a light northerly in town
  // says nothing about a 5 Bf southerly on the west coast); the coast cards show each one.
  const refIds = ['ref-north', 'ref-west', 'ref-south'].filter((id) => data.land[id]);
  const dayIdx = data.land['ref-north'].atmos.map((a, k) => ({ k, h: hourOf(a.time) })).filter(({ h }) => h >= DAY_FROM && h <= DAY_TO);
  const perRef = refIds.map((id) => {
    const c = dayIdx.map(({ k }) => windConsensus(data, id, k));
    return { id, cons: c, mean: mean(c.map((x) => x.speed)), peak: Math.max(...c.map((x) => x.speed)) };
  });
  const head = perRef.reduce((a, b) => (b.mean > a.mean ? b : a));
  const headId = head.id;
  const north = data.land[headId];

  const cons = head.cons;
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
      const c = windConsensus(data, headId, k);
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
      const wmPoint = data.waveModels?.[r.id];
      const waveModels = WAVE_MODELS.flatMap((m) => {
        const vals = (wmPoint?.[m] ?? [])
          .filter((_, k) => {
            const h = hourOf(data.marine[r.id]?.[k]?.time ?? '');
            return h >= DAY_FROM && h <= DAY_TO;
          })
          .filter((w) => w.wave != null);
        if (!vals.length) return [];
        const periods = vals.map((w) => w.period).filter((x): x is number => x != null);
        return [{ model: m, label: WAVE_MODEL_LABELS[m], wave: round(mean(vals.map((w) => w.wave!)), 2), period: periods.length ? round(mean(periods)) : null }];
      });
      const consensus = dayIdx.map(({ k }) => waveConsensus(data, r.id, k)).filter((x): x is NonNullable<typeof x> => !!x && x.modelCount > 1);
      const waveSpread = consensus.length ? round(mean(consensus.map((x) => x.spread)), 2) : null;
      const waveAgr = waveSpread == null ? null : waveAgreement(waveSpread, mean(consensus.map((x) => x.wave)));
      const wdirs = marine.filter((m) => m.waveDir != null).map((m) => m.waveDir!);
      return {
        id: r.id,
        wind: { speed: round(mean(csp)), gust: round(Math.max(...c.map((x) => x.gust))), dir: Math.round(cdir), bf: beaufort(mean(csp)) },
        waveMean: waves.length ? round(mean(waves), 1) : null,
        waveMax: waves.length ? round(Math.max(...waves), 1) : null,
        waveDir: wdirs.length ? Math.round(circularMean(wdirs)) : null,
        sst: marine.length ? marine[Math.floor(marine.length / 2)].sst : null,
        exposure: speed < 12 ? 'calm' : angleDiff(dir, r.facing!) <= 70 ? 'exposed' : 'sheltered',
        waveModels,
        waveSpread,
        waveAgreement: waveAgr,
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
  // one coast clearly windier than another (by peak, so an afternoon blow is not averaged away)
  const weakest = perRef.reduce((a, b) => (b.peak < a.peak ? b : a));
  if (perRef.length > 1 && beaufort(head.peak) - beaufort(weakest.peak) >= 2) {
    const firstStrong = hourlyWind.find((h) => h.speed >= 20)?.hour ?? '';
    takeaways.push({ key: 'windCoast', params: { coast: headId, bf: beaufort(head.peak), dir: Math.round(dir), from: firstStrong } });
  }
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
  const worstWave = coasts.map((c) => c.waveAgreement).filter(Boolean);
  const waveAgreementAll = worstWave.includes('low') ? 'low' : worstWave.includes('medium') ? 'medium' : worstWave.length ? 'high' : null;
  if (waveAgreementAll && waveAgreementAll !== 'high') takeaways.push({ key: 'waveAgreement', params: { level: waveAgreementAll } });
  takeaways.push({ key: 'agreement', params: { level: agreement } });

  return {
    windRef: headId,
    date: data.date,
    wind: { speed: round(speed), gust: round(gust), dir: Math.round(dir), bf, speedSpread: round(speedSpread), dirSpread: Math.round(dirSpread) },
    hourlyWind,
    coasts,
    models,
    agreement,
    waveAgreement: waveAgreementAll,
    town: townSummary,
    takeaways,
  };
}
