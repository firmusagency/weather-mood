import { angleDiff, beaufort, circularMean, inAnySector, median } from './geo';
import { hourOf } from './dates';
import { depSeaId, seaWindId } from './openmeteo';
import { MODELS, type Dataset, type Exposure, type HourConditions, type Spot, type WindConsensus } from './types';

/*
 * Step 1 of the pipeline: turn raw forecasts into per-hour, per-spot conditions.
 * No judgement happens here — only physics/geometry:
 *   - how much do all models agree on the wind?
 *   - is the wind blowing onto the shore, along it, or off it?
 *   - how much of the offshore wave actually reaches this shore?
 */

export const REGIONAL_WIND_POINT = 'ref-north';
export const FIRST_HOUR = 6;
export const LAST_HOUR = 21;

/** Combine all models into one wind estimate + a measure of disagreement. */
export function windConsensus(data: Dataset, pointId: string, k: number): WindConsensus {
  const pt = data.land[pointId];
  const speeds: number[] = [];
  const dirs: number[] = [];
  const gusts: number[] = [];
  for (const m of MODELS) {
    const w = pt.models[m]?.[k];
    if (w?.wind == null || w.dir == null) continue;
    speeds.push(w.wind);
    dirs.push(w.dir);
    if (w.gust != null) gusts.push(w.gust);
  }
  if (!speeds.length) {
    const a = pt.atmos[k];
    return { speed: a.wind ?? 0, dir: a.windDir ?? 0, gust: a.gust ?? a.wind ?? 0, speedSpread: 0, dirSpread: 0, modelCount: a.wind == null ? 0 : 1 };
  }
  const dir = circularMean(dirs, speeds.map((s) => Math.max(s, 1)));
  const speed = median(speeds);
  return {
    speed,
    dir,
    gust: gusts.length ? Math.max(median(gusts), speed) : speed * 1.4,
    speedSpread: Math.max(...speeds) - Math.min(...speeds),
    // direction disagreement only matters for winds strong enough to have a direction
    dirSpread: Math.max(...dirs.map((d, i) => (speeds[i] >= 8 ? angleDiff(d, dir) : 0))),
    modelCount: speeds.length,
  };
}

/** Take the stronger of the two estimates, never the weaker: an under-read beach is the costly mistake. */
export function blendWind(sea: WindConsensus, land: WindConsensus): WindConsensus {
  return sea.speed >= land.speed ? sea : { ...land, speedSpread: Math.max(sea.speedSpread, land.speedSpread), dirSpread: Math.max(sea.dirSpread, land.dirSpread) };
}

/**
 * How exposed a shore facing `facing` is to wind/waves coming FROM `from` (0..1).
 * Head-on (onshore) = 1, parallel to the shore ≈ 0.35, blowing off the land ≈ 0.05.
 */
export function exposureFactor(from: number, facing: number, floor = 0.05): number {
  const d = angleDiff(from, facing);
  if (d <= 30) return 1;
  if (d <= 90) return 1 - ((d - 30) / 60) * 0.65;
  if (d <= 135) return Math.max(floor, 0.35 - ((d - 90) / 45) * 0.27);
  return floor;
}

export function exposureClass(from: number, facing: number): Exposure {
  const d = angleDiff(from, facing);
  if (d <= 30) return 'onshore';
  if (d <= 67.5) return 'cross-onshore';
  if (d <= 112.5) return 'cross';
  if (d <= 150) return 'cross-offshore';
  return 'offshore';
}

/**
 * Long-period swell grows as it shoals: a 0.8 m / 10 s swell breaks noticeably higher than a 0.8 m / 4 s
 * wind chop. Rough breaker-height multipliers; a 5 s chop is left as is.
 */
export function shoalingFactor(periodS: number | null): number {
  if (periodS == null) return 1;
  if (periodS >= 11) return 1.5;
  if (periodS >= 8) return 1.3;
  if (periodS >= 6.5) return 1.12;
  return 1;
}

/** Fetch-limited wind-sea height (JONSWAP): what an onshore wind whips up over a short stretch of water. */
export function localWindSea(windKmh: number, fetchKm: number): number {
  const u = windKmh / 3.6;
  return 0.0016 * u * Math.sqrt((fetchKm * 1000) / 9.81);
}

const THUNDER_CODES = new Set([95, 96, 99]);

export function analyzeSpot(spot: Spot, data: Dataset): HourConditions[] {
  const land = data.land[spot.id];
  if (!land) return [];
  const marine = data.marine[spot.id];
  const dep = spot.dependsOnSea ? data.marine[depSeaId(spot.id)] : undefined;
  const out: HourConditions[] = [];

  land.atmos.forEach((a, k) => {
    const hour = hourOf(a.time);
    if (hour < FIRST_HOUR || hour > LAST_HOUR) return;
    // wind from the sea-side point when the snapshot has it (older snapshots fall back to the land cell)
    const windPoint = data.land[seaWindId(spot.id)] ? seaWindId(spot.id) : spot.id;
    const wind = blendWind(windConsensus(data, windPoint, k), windConsensus(data, spot.id, k));
    const shelteredNow = inAnySector(wind.dir, spot.shelteredFrom);
    // Downslope gusts on the lee side depend on the wind crossing the mountains, so we look at the
    // open-sea wind north of the island rather than the (often weak) model wind at the spot itself.
    const regional = data.land[REGIONAL_WIND_POINT] ? windConsensus(data, REGIONAL_WIND_POINT, k) : wind;
    const gustyNow = inAnySector(regional.dir, spot.gustyFrom) && regional.speed >= 22;

    let windExposure = 1;
    let exposure: Exposure | undefined;
    if (spot.facing !== undefined) {
      windExposure = exposureFactor(wind.dir, spot.facing);
      if (shelteredNow) windExposure = Math.min(windExposure, 0.2);
      exposure = exposureClass(wind.dir, spot.facing);
    } else if (spot.exposedFrom) {
      windExposure = inAnySector(wind.dir, spot.exposedFrom) ? 1 : 0.4;
    }

    const c: HourConditions = {
      time: a.time,
      hour,
      wind,
      bf: beaufort(wind.speed),
      windExposure,
      exposureClass: exposure,
      shelteredNow,
      gustyNow,
      effectiveGust: gustyNow ? Math.max(wind.gust, regional.gust) * 1.3 : wind.gust,
      temp: a.temp,
      apparent: a.apparent,
      precipProb: a.precipProb,
      precip: a.precip,
      cloud: a.cloud,
      uv: a.uv,
      thunder: a.code != null && THUNDER_CODES.has(a.code),
    };

    const m = marine?.find((x) => x.time === a.time);
    if (m && m.wave != null) {
      const waveDir = m.waveDir ?? wind.dir;
      let waveExposure = 1;
      if (spot.facing !== undefined) {
        // waves refract around headlands, so even "offshore" swell leaves a little at the shore
        waveExposure = exposureFactor(waveDir, spot.facing, 0.1);
        if (inAnySector(waveDir, spot.shelteredFrom)) waveExposure = Math.min(waveExposure, 0.25);
      } else if (spot.exposedFrom) {
        waveExposure = inAnySector(waveDir, spot.exposedFrom) ? 1 : 0.6;
      }
      const factor = spot.waveFactor ?? 1;
      const windSea = spot.facing !== undefined ? localWindSea(wind.speed * windExposure, spot.localFetchKm ?? 12) : 0;
      const periodFactor = shoalingFactor(m.wavePeriod);
      c.sea = {
        offshoreWave: m.wave,
        waveDir,
        swell: m.swell,
        period: m.wavePeriod,
        swellPeriod: m.swellPeriod,
        periodFactor,
        waveExposure,
        localWindSea: windSea,
        effectiveWave: Math.max(m.wave * waveExposure * periodFactor, windSea) * factor,
        sst: m.sst,
      };
    }

    const d = dep?.find((x) => x.time === a.time);
    if (spot.dependsOnSea && d?.wave != null) {
      const expo = inAnySector(d.waveDir ?? 0, spot.dependsOnSea.exposedFrom) ? 1 : 0.5;
      c.depSea = { wave: d.wave, wind: wind.speed, exposure: expo };
    }
    out.push(c);
  });
  return out;
}
