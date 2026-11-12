import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { planPoints, type RawBundle } from '../src/engine/openmeteo';
import { MODELS, WAVE_MODELS } from '../src/engine/types';
import type { Scenario } from './helpers';

/**
 * The same uniform synthetic weather as `scenario`, but in the raw Open-Meteo shape the nightly
 * scripts read from the snapshot (one response per point, hourly arrays, per-model columns).
 */
export function rawBundle(s: Scenario): RawBundle {
  const date = s.date ?? '2026-07-15';
  const plan = planPoints(SPOTS, REF_POINTS);
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`);
  const all = <T>(v: T) => time.map(() => v);
  const gust = s.gustKmh ?? s.windKmh * 1.4;
  const atmos = plan.land.map(() => ({
    hourly: {
      time,
      temperature_2m: all(s.apparent ?? 28),
      apparent_temperature: all(s.apparent ?? 28),
      precipitation_probability: all(s.precipProb ?? 0),
      precipitation: all(s.precip ?? 0),
      cloud_cover: all(s.cloud ?? 10),
      uv_index: all(8),
      weather_code: all(0),
      wind_speed_10m: all(s.windKmh),
      wind_direction_10m: all(s.windDir),
      wind_gusts_10m: all(gust),
    },
    daily: { time: [date], sunrise: [`${date}T${s.sunrise ?? '06:15'}`], sunset: [`${date}T${s.sunset ?? '20:40'}`] },
  }));
  const models = plan.land.map(() => {
    const hourly: Record<string, unknown[]> = { time };
    for (const m of MODELS) {
      hourly[`wind_speed_10m_${m}`] = all(s.windKmh);
      hourly[`wind_direction_10m_${m}`] = all(s.windDir);
      hourly[`wind_gusts_10m_${m}`] = all(gust);
      hourly[`precipitation_${m}`] = all(s.precip ?? 0);
    }
    return { hourly };
  });
  const marine = plan.marine.map(() => ({
    hourly: {
      time,
      wave_height: all(s.waveM),
      wave_direction: all(s.waveDir),
      wave_period: all(s.periodS ?? 5),
      wind_wave_height: all(s.waveM),
      swell_wave_height: all(null),
      swell_wave_direction: all(null),
      swell_wave_period: all(s.periodS ?? null),
      sea_surface_temperature: all(s.sst ?? 25),
    },
  }));
  const waves = plan.marine.map(() => {
    const hourly: Record<string, unknown[]> = { time };
    for (const m of WAVE_MODELS) {
      hourly[`wave_height_${m}`] = all(s.waveM);
      hourly[`wave_direction_${m}`] = all(s.waveDir);
      hourly[`wave_period_${m}`] = all(s.periodS ?? 5);
    }
    return { hourly };
  });
  return { date, fetchedAt: '2026-07-14T18:00:00Z', plan, atmos, models, marine, waves };
}
