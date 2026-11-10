import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { planPoints } from '../src/engine/openmeteo';
import { MODELS, WAVE_MODELS, type Dataset, type ModelId, type ModelWave, type ModelWind, type WaveModelId } from '../src/engine/types';

export interface Scenario {
  windKmh: number;
  windDir: number;
  gustKmh?: number;
  waveM: number;
  waveDir: number;
  periodS?: number;
  /** Make the wave models disagree by this much (m), centred on waveM. */
  waveSpreadM?: number;
  apparent?: number;
  precipProb?: number;
  precip?: number;
  /** Per land point overrides (e.g. { 'ref-west': 78 }) for rain that sits on one coast. */
  precipProbByPoint?: Record<string, number>;
  precipByPoint?: Record<string, number>;
  /** Rain of the previous days at every gorge/hike point (mm). */
  recentRain?: { prevDayMm: number; threeDayMm?: number };
  /** Sea surface temperature (default 25) and cloud cover % (default 10). */
  sst?: number;
  cloud?: number;
  /** Local "HH:MM" sun times; without them no hour is marked as dark. */
  sunrise?: string;
  sunset?: string;
  date?: string;
}

/** Uniform synthetic weather over the whole region, all hours, all models agreeing. */
export function scenario(s: Scenario): Dataset {
  const date = s.date ?? '2026-07-15';
  const plan = planPoints(SPOTS, REF_POINTS);
  const hours = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  const gust = s.gustKmh ?? s.windKmh * 1.4;
  const land: Dataset['land'] = {};
  for (const p of plan.land) {
    const models = {} as Record<ModelId, ModelWind[]>;
    for (const m of MODELS) models[m] = hours.map(() => ({ wind: s.windKmh, dir: s.windDir, gust, precip: s.precipByPoint?.[p.id] ?? s.precip ?? 0 }));
    land[p.id] = {
      models,
      atmos: hours.map((time) => ({
        time,
        temp: s.apparent ?? 28,
        apparent: s.apparent ?? 28,
        precipProb: s.precipProbByPoint?.[p.id] ?? s.precipProb ?? 0,
        precip: s.precipByPoint?.[p.id] ?? s.precip ?? 0,
        cloud: s.cloud ?? 10,
        uv: 8,
        code: 0,
        wind: s.windKmh,
        windDir: s.windDir,
        gust,
      })),
      ...(s.sunrise ? { sunrise: `${date}T${s.sunrise}` } : {}),
      ...(s.sunset ? { sunset: `${date}T${s.sunset}` } : {}),
    };
  }
  const marine: Dataset['marine'] = {};
  for (const p of plan.marine) {
    marine[p.id] = hours.map((time) => ({
      time,
      wave: s.waveM,
      waveDir: s.waveDir,
      wavePeriod: s.periodS ?? 5,
      windWave: s.waveM,
      swell: null,
      swellDir: null,
      swellPeriod: s.periodS ?? null,
      sst: s.sst ?? 25,
    }));
  }
  const waveModels: NonNullable<Dataset['waveModels']> = {};
  for (const p of plan.marine) {
    const perModel = {} as Record<WaveModelId, ModelWave[]>;
    WAVE_MODELS.forEach((m, i) => {
      const offset = s.waveSpreadM ? ((i / (WAVE_MODELS.length - 1)) - 0.5) * s.waveSpreadM : 0;
      perModel[m] = hours.map(() => ({ wave: Math.max(0, s.waveM + offset), dir: s.waveDir, period: s.periodS ?? 5 }));
    });
    waveModels[p.id] = perModel;
  }
  let recentRain: Dataset['recentRain'];
  if (s.recentRain) {
    recentRain = {};
    for (const p of plan.recentRain ?? []) recentRain[p.id] = { prevDayMm: s.recentRain.prevDayMm, threeDayMm: s.recentRain.threeDayMm ?? s.recentRain.prevDayMm };
  }
  return { date, fetchedAt: '2026-07-14T18:00:00Z', source: 'snapshot', land, marine, waveModels, recentRain };
}
