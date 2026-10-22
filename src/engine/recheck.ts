import { haversineKm } from './geo';
import type { HourObs } from './metar';
import type { PointPlan } from './openmeteo';
import { analyzeDay, recommend } from './recommend';
import type { Base, Dataset, ProfileId, Spot, Verdict } from './types';
import { nearestLandPoint, STATION } from './verify';

/*
 * "Was the recommendation right?" for the north coast, where we have hourly observations.
 * We rebuild the day's dataset with the wind the station actually measured (hour by hour the
 * forecast is scaled by observed/forecast at the station, direction taken from the station when
 * there was wind) and rerun the recommendation. A pick "held" when it is still go/caution on the
 * observed day; an "avoid" was right when the observed day still says avoid/caution.
 * Only spots near the station are judged: scaling a north-coast error onto Elafonisi would be fiction.
 */

export const RECHECK_RADIUS_KM = 30;

export interface RecheckPick {
  spotId: string;
  forecastVerdict: Verdict;
  observedVerdict: Verdict;
  forecastScore: number;
  observedScore: number;
  held: boolean;
}

export interface RecheckProfile {
  profile: ProfileId;
  picks: RecheckPick[];
  avoids: { spotId: string; observedVerdict: Verdict; right: boolean }[];
}

export interface RecheckResult {
  station: string;
  radiusKm: number;
  spotsJudged: string[];
  hoursWithObs: number;
  profiles: RecheckProfile[];
}

/** The forecast with the station's measured wind imposed, hour by hour. */
export function observedDataset(data: Dataset, plan: PointPlan, obs: HourObs[]): { data: Dataset; hours: number } {
  const { point } = nearestLandPoint(plan, STATION.lat, STATION.lon);
  const ref = data.land[point.id];
  const byHour = new Map(obs.map((o) => [o.hour, o]));
  const factors = new Map<number, { ratio: number; add: number; dir: number | null; gustRatio: number; gustAdd: number }>();
  ref.atmos.forEach((a, k) => {
    const h = Number(a.time.slice(11, 13));
    const o = byHour.get(h);
    if (!o) return;
    const fcSpeed = a.wind ?? 0;
    const fcGust = a.gust ?? fcSpeed;
    // multiplicative when the forecast had real wind (an error there scales with the flow),
    // additive when it was calm (ratios explode near zero and a missed blow must come through whole)
    const ratio = fcSpeed >= 12 ? Math.min(3, Math.max(0.33, o.windKmh / fcSpeed)) : 1;
    const add = fcSpeed >= 12 ? 0 : o.windKmh - fcSpeed;
    const gustRatio = fcGust >= 18 ? Math.min(3, Math.max(0.33, o.gustKmh / fcGust)) : 1;
    const gustAdd = fcGust >= 18 ? 0 : o.gustKmh - fcGust;
    factors.set(k, { ratio, add, dir: o.windKmh >= 8 && o.windDir != null ? o.windDir : null, gustRatio, gustAdd });
  });
  const land: Dataset['land'] = {};
  for (const [id, p] of Object.entries(data.land)) {
    const models = Object.fromEntries(
      Object.entries(p.models).map(([m, arr]) => [
        m,
        arr.map((w, k) => {
          const f = factors.get(k);
          if (!f || w.wind == null) return w;
          return { ...w, wind: Math.max(0, w.wind * f.ratio + f.add), gust: w.gust == null ? w.gust : Math.max(0, w.gust * f.gustRatio + f.gustAdd), dir: f.dir ?? w.dir };
        }),
      ]),
    ) as typeof p.models;
    const atmos = p.atmos.map((a, k) => {
      const f = factors.get(k);
      if (!f) return a;
      return { ...a, wind: a.wind == null ? a.wind : Math.max(0, a.wind * f.ratio + f.add), gust: a.gust == null ? a.gust : Math.max(0, a.gust * f.gustRatio + f.gustAdd), windDir: f.dir ?? a.windDir };
    });
    land[id] = { ...p, models, atmos };
  }
  return { data: { ...data, land }, hours: factors.size };
}

const bad = (v: Verdict) => v === 'avoid' || v === 'unsuitable';

export function recheckRecommendations(data: Dataset, plan: PointPlan, obs: HourObs[], spots: Spot[], base: Base, profiles: ProfileId[]): RecheckResult {
  const near = spots.filter((s) => haversineKm(s.lat, s.lon, STATION.lat, STATION.lon) <= RECHECK_RADIUS_KM);
  const { data: observed, hours } = observedDataset(data, plan, obs);
  const result: RecheckResult = { station: STATION.id, radiusKm: RECHECK_RADIUS_KM, spotsJudged: near.map((s) => s.id), hoursWithObs: hours, profiles: [] };
  if (!near.length || hours < 6) return result;
  for (const profile of profiles) {
    const fc = analyzeDay(near, data, profile, base, { daysAhead: 1 });
    const ob = analyzeDay(near, observed, profile, base, { daysAhead: 0 });
    const rec = recommend(near, fc.scores);
    const picks = rec.top.map((sc) => {
      const o = ob.scores[sc.spotId];
      return { spotId: sc.spotId, forecastVerdict: sc.verdict, observedVerdict: o.verdict, forecastScore: sc.score, observedScore: o.score, held: !bad(o.verdict) };
    });
    const avoids = rec.avoid.map((sc) => {
      const o = ob.scores[sc.spotId];
      return { spotId: sc.spotId, observedVerdict: o.verdict, right: o.verdict !== 'go' };
    });
    result.profiles.push({ profile, picks, avoids });
  }
  return result;
}

export interface RecheckSummary {
  days: number;
  picks: number;
  picksHeld: number;
  avoids: number;
  avoidsRight: number;
  pickHeldRate: number | null;
  avoidRightRate: number | null;
}

export function summarizeRechecks(results: (RecheckResult | undefined)[]): RecheckSummary {
  let picks = 0;
  let held = 0;
  let avoids = 0;
  let right = 0;
  let days = 0;
  for (const r of results) {
    if (!r || !r.profiles.length) continue;
    days += 1;
    for (const p of r.profiles) {
      picks += p.picks.length;
      held += p.picks.filter((x) => x.held).length;
      avoids += p.avoids.length;
      right += p.avoids.filter((x) => x.right).length;
    }
  }
  return { days, picks, picksHeld: held, avoids, avoidsRight: right, pickHeldRate: picks ? Math.round((held / picks) * 100) / 100 : null, avoidRightRate: avoids ? Math.round((right / avoids) * 100) / 100 : null };
}
