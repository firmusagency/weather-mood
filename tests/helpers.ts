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
    for (const m of MODELS) models[m] = hours.map(() => ({ wind: s.windKmh, dir: s.windDir, gust }));
    land[p.id] = {
      models,
      atmos: hours.map((time) => ({
        time,
        temp: s.apparent ?? 28,
        apparent: s.apparent ?? 28,
        precipProb: s.precipProb ?? 0,
        precip: s.precip ?? 0,
        cloud: 10,
        uv: 8,
        code: 0,
        wind: s.windKmh,
        windDir: s.windDir,
        gust,
      })),
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
      sst: 25,
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
  return { date, fetchedAt: '2026-07-14T18:00:00Z', source: 'snapshot', land, marine, waveModels };
}
