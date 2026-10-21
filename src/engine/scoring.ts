import { haversineKm, ramp, round } from './geo';
import { monthOf } from './dates';
import { profileById, type Profile } from '../data/profiles';
import type { Base, Factor, FactorKey, HourConditions, ProfileId, Spot, SpotScore, Verdict } from './types';

/*
 * Step 2: judge the analysed conditions for a given guest profile.
 *
 * Every hour starts at 100 and loses points for each problem (rough sea, gusts, rain, heat...).
 * Each deduction is recorded as a Factor with the numbers behind it, so the final recommendation
 * can always be explained ("Falasarna 31/100: 1.6 m onshore waves from the WNW").
 */

type HourEval = { score: number; rankScore: number; factors: Factor[] };

const f = (key: FactorKey, impact: number, params: Factor['params'] = {}): Factor => ({ key, impact: round(impact, 1), params });

function push(list: Factor[], key: FactorKey, impact: number, params: Factor['params'] = {}) {
  if (Math.abs(impact) >= 0.5) list.push(f(key, impact, params));
}

function weatherBasics(c: HourConditions, out: Factor[], rainWeight: number, thunderPenalty: number) {
  const pp = c.precipProb ?? 0;
  const mm = c.precip ?? 0;
  // likelihood of rain plus how heavy it is (a 90% chance of drizzle is not a 90% chance of a downpour)
  push(out, 'rain', -(ramp(pp, 25, 70) + ramp(mm, 0.5, 3) * 0.6) * rainWeight, { pp, mm: round(mm, 1) });
  if (c.thunder) push(out, 'thunder', -thunderPenalty);
}

function evalBeach(c: HourConditions, spot: Spot, p: Profile): HourEval {
  const out: Factor[] = [];
  const [ok, bad] = p.seaTolerance;

  if (c.sea) {
    const eff = c.sea.effectiveWave;
    const seaPen = ramp(eff, ok, bad) * 55 + (eff > bad ? Math.min(25, (eff - bad) * 40) : 0);
    const params = {
      wave: round(eff, 2),
      offshore: round(c.sea.offshoreWave, 1),
      dir: Math.round(c.sea.waveDir),
      exposure: Math.round(c.sea.waveExposure * 100),
      period: c.sea.period == null ? '-' : round(c.sea.period, 0),
    };
    if (seaPen >= 0.5) push(out, 'seaRough', -seaPen, params);
    else if (eff < ok * 0.8) push(out, 'seaCalm', 4, params);
    // the "glassy sea, big surf" trap: long swell on a calm day breaks harder than it looks
    if (c.sea.period != null && c.sea.period >= 8 && eff >= 0.4 && c.wind.speed < 15) {
      push(out, 'longSwell', -ramp(c.sea.period, 8, 12) * 8, { period: round(c.sea.period, 0), wave: round(eff, 1) });
    }
    if (spot.ripRisk && eff > 0.7) push(out, 'ripCurrents', -15, { wave: round(eff, 1) });
    if (c.sea.sst != null) push(out, 'coldWater', -ramp(21 - c.sea.sst, 0, 4) * 10, { sst: round(c.sea.sst, 1) });
  }

  const onshore = c.wind.speed * c.windExposure;
  const windParams = { kmh: Math.round(c.wind.speed), bf: c.bf, dir: Math.round(c.wind.dir) };
  push(out, 'onshoreWind', -ramp(onshore, 18, 45) * 15, windParams);
  if (c.shelteredNow && c.wind.speed >= 20) push(out, 'sheltered', 5, windParams);
  else if ((c.exposureClass === 'offshore' || c.exposureClass === 'cross-offshore') && c.wind.speed >= 15 && c.wind.speed < 25) push(out, 'offshoreWind', 3, windParams);

  // wind on the beach is unpleasant whatever its direction (sand, umbrellas, inflatables drifting);
  // an offshore wind keeps the water flat but a 5 Bf offshore wind is still a windy beach
  push(out, 'windy', -ramp(c.wind.speed, 18, 40) * (p.id === 'family' || p.id === 'senior' ? 28 : 20), windParams);
  push(out, c.gustyNow ? 'downslopeGusts' : 'gusts', -ramp(c.effectiveGust, 30, 70) * 28, { gust: Math.round(c.effectiveGust) });
  weatherBasics(c, out, 35, 35);
  if (c.apparent != null) {
    push(out, 'cool', -ramp(22 - c.apparent, 0, 7) * 25, { apparent: Math.round(c.apparent) });
    if (p.heatSensitive && !spot.traits.shade) push(out, 'heat', -ramp(c.apparent, 32, 38) * 15, { apparent: Math.round(c.apparent) });
  }
  if ((c.cloud ?? 0) > 85) push(out, 'cloudy', -6, { cloud: c.cloud ?? 0 });
  return finish(out);
}

function evalLake(c: HourConditions, _spot: Spot, _p: Profile): HourEval {
  const out: Factor[] = [];
  push(out, 'gusts', -ramp(c.wind.gust, 45, 80) * 15, { gust: Math.round(c.wind.gust) });
  weatherBasics(c, out, 35, 35);
  if (c.apparent != null) push(out, 'cool', -ramp(21 - c.apparent, 0, 7) * 20, { apparent: Math.round(c.apparent) });
  return finish(out);
}

function evalTrail(c: HourConditions, spot: Spot, _p: Profile, isGorge: boolean): HourEval {
  const out: Factor[] = [];
  weatherBasics(c, out, 45, 40);
  if ((c.precip ?? 0) >= 0.5) push(out, 'closureRisk', -15, { mm: round(c.precip ?? 0, 1), kind: 'rain' });

  const lim = spot.limits?.maxGustKmh ?? 70;
  push(out, 'gusts', -ramp(c.wind.gust, lim - 25, lim) * 40, { gust: Math.round(c.wind.gust) });
  if (c.wind.gust >= lim) push(out, 'closureRisk', -30, { gust: Math.round(c.wind.gust), limit: lim, kind: 'wind' });

  if (c.apparent != null) {
    // walkers tolerate a cool start, but near-freezing mornings in the mountains are unpleasant
    push(out, 'cold', -ramp(8 - c.apparent, 0, 8) * 15, { apparent: Math.round(c.apparent) });
    const [lo, hi, w] = isGorge ? [27, 35, 25] : [25, 33, 30];
    push(out, 'heat', -ramp(c.apparent, lo, hi) * w * (spot.traits.shade ? 0.6 : 1), { apparent: Math.round(c.apparent) });
  }
  if (c.depSea && spot.dependsOnSea) {
    const risk = Math.max(ramp(c.depSea.wave * c.depSea.exposure, 1.0, 2.0), ramp(c.depSea.wind, 35, 50));
    push(out, 'returnBoat', -risk * 25, { wave: round(c.depSea.wave, 1), risk: Math.round(risk * 100) });
  }
  return finish(out);
}

function evalBoat(c: HourConditions, spot: Spot, p: Profile): HourEval {
  const out: Factor[] = [];
  const maxWind = spot.limits?.maxWindKmh ?? 40;
  const maxWave = spot.limits?.maxWaveM ?? 2;
  const wave = c.sea?.offshoreWave ?? 0;
  const waveOnRoute = wave * (c.sea?.waveExposure ?? 1);
  const windOnRoute = c.wind.speed * c.windExposure;
  const risk = Math.max(ramp(windOnRoute, maxWind - 15, maxWind), ramp(waveOnRoute, maxWave - 0.8, maxWave));
  push(out, 'boatCancel', -risk * 70, {
    risk: Math.round(risk * 100),
    kmh: Math.round(c.wind.speed),
    bf: c.bf,
    dir: Math.round(c.wind.dir),
    wave: round(wave, 1),
  });
  if (p.id === 'family' || p.id === 'senior') push(out, 'boatRough', -ramp(waveOnRoute, 0.6, 1.3) * 15, { wave: round(wave, 1) });
  weatherBasics(c, out, 35, 30);
  return finish(out);
}

function evalOutdoorCulture(c: HourConditions, spot: Spot): HourEval {
  const out: Factor[] = [];
  weatherBasics(c, out, spot.type === 'town' ? 20 : 35, 30);
  if (c.apparent != null) {
    push(out, 'heat', -ramp(c.apparent, 30, 37) * (spot.traits.shade ? 12 : 25), { apparent: Math.round(c.apparent) });
    push(out, 'cold', -ramp(15 - c.apparent, 0, 8) * 20, { apparent: Math.round(c.apparent) });
  }
  push(out, 'gusts', -ramp(c.wind.gust, 45, 80) * 15, { gust: Math.round(c.wind.gust) });
  if (!out.some((x) => x.impact < -2) && c.apparent != null && c.apparent >= 17 && c.apparent <= 29) {
    push(out, 'pleasant', 3, { apparent: Math.round(c.apparent) });
  }
  return finish(out);
}

/**
 * Museums: the weather never spoils them (score 100), but they are a fallback — ranked low by
 * default and pushed up when it is rainy, very hot or stormy outside.
 */
function evalIndoor(c: HourConditions): HourEval {
  const out: Factor[] = [f('indoor', -30)];
  const pp = c.precipProb ?? 0;
  const badWeather = ramp(pp, 30, 70) * 25 + (c.apparent != null ? ramp(c.apparent, 31, 37) * 15 : 0) + ramp(c.wind.gust, 50, 80) * 10;
  push(out, 'goodForBadWeather', badWeather, { pp, apparent: c.apparent == null ? '-' : Math.round(c.apparent) });
  return finish(out);
}

/** Factors that only affect ranking, not the weather score. */
const RANK_ONLY = new Set<FactorKey>(['indoor', 'goodForBadWeather']);

function finish(factors: Factor[]): HourEval {
  const sum = (pred: (x: Factor) => boolean) => factors.filter(pred).reduce((s, x) => s + x.impact, 0);
  const score = Math.max(0, Math.min(100, 100 + sum((x) => !RANK_ONLY.has(x.key))));
  return { score, rankScore: score + sum((x) => RANK_ONLY.has(x.key)), factors };
}

function evalHour(c: HourConditions, spot: Spot, p: Profile): HourEval {
  switch (spot.type) {
    case 'beach':
      return evalBeach(c, spot, p);
    case 'lake':
      return evalLake(c, spot, p);
    case 'gorge':
      return evalTrail(c, spot, p, true);
    case 'hike':
      return evalTrail(c, spot, p, false);
    case 'boat':
      return evalBoat(c, spot, p);
    case 'museum':
      return evalIndoor(c);
    default:
      return evalOutdoorCulture(c, spot);
  }
}

/** Which start hours make sense for each kind of activity. */
function candidateStarts(spot: Spot, len: number): number[] {
  const range = (a: number, b: number) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
  switch (spot.type) {
    case 'boat':
      return [10];
    case 'gorge':
      return range(7, 10);
    case 'hike':
      return range(7, 18 - len);
    case 'museum':
      return range(9, 17 - len);
    case 'town':
      return range(9, 21 - len);
    default:
      return range(8, 19 - len);
  }
}

// ---------- travel ----------

export function travelMinutes(base: Base, spot: Spot, profile: ProfileId): number {
  const km = haversineKm(base.lat, base.lon, spot.lat, spot.lon);
  if (km < 1.5) return Math.round((km / 4.5) * 60); // walking distance
  const drive = ((km * (spot.roadFactor ?? 1.45)) / 50) * 60 + (spot.extraMinutes ?? 0);
  return Math.round(profile === 'nocar' ? drive * 1.5 + 15 : drive);
}

// ---------- profile fit ----------

function unsuitable(spot: Spot, p: Profile, date: string, base: Base): Factor | undefined {
  const month = monthOf(date);
  if (spot.season && (month < spot.season.from || month > spot.season.to)) {
    return f('closed', 0, { from: spot.season.from, to: spot.season.to });
  }
  if (p.id === 'family' && (spot.traits.kids === 'no' || spot.access.difficulty === 'hard')) return f('notForProfile', 0, { why: 'kids' });
  if (p.id === 'senior' && (spot.traits.seniors === 'no' || spot.access.difficulty === 'hard')) return f('notForProfile', 0, { why: 'mobility' });
  if (p.id === 'nocar') {
    const walkable = haversineKm(base.lat, base.lon, spot.lat, spot.lon) < 2;
    if (!walkable && spot.access.bus === 'no') return f('notForProfile', 0, { why: 'nobus' });
    if (!walkable && spot.access.bus === 'seasonal' && (month < 5 || month > 10)) return f('notForProfile', 0, { why: 'nobus' });
  }
  return undefined;
}

function traitBonus(spot: Spot, p: Profile): { bonus: number; traits: string[] } {
  const t = spot.traits;
  const picks: [boolean | undefined, number, string][] = [];
  switch (p.id) {
    case 'family':
      picks.push([t.kids === 'great', 6, 'kidFriendly'], [t.shallow, 4, 'shallow'], [t.facilities, 3, 'facilities'], [t.shade, 2, 'shade']);
      break;
    case 'senior':
      picks.push([t.seniors === 'great', 6, 'easyAccess'], [t.facilities, 3, 'facilities'], [t.shade, 3, 'shade']);
      break;
    case 'couple':
      picks.push([t.scenic, 5, 'scenic'], [t.sunset, 2, 'sunset'], [t.snorkeling, 2, 'snorkeling']);
      break;
    case 'solo':
      picks.push([t.scenic, 3, 'scenic'], [spot.access.bus === 'yes', 2, 'bus'], [t.snorkeling, 2, 'snorkeling']);
      break;
    case 'active':
      picks.push([spot.type === 'gorge' || spot.type === 'hike', 8, 'hiking'], [t.snorkeling, 4, 'snorkeling'], [t.scenic, 2, 'scenic']);
      break;
    case 'nocar':
      picks.push([spot.access.bus === 'yes', 4, 'bus'], [t.facilities, 2, 'facilities']);
      break;
  }
  const hit = picks.filter(([ok]) => ok);
  return { bonus: hit.reduce((s, [, b]) => s + b, 0), traits: hit.map(([, , name]) => name) };
}

/** Per-profile preference for kinds of places (ranking only). */
const TYPE_PREF: Record<ProfileId, Partial<Record<Spot['type'], number>>> = {
  family: { beach: 4, lake: 4, nature: 4, town: 2, gorge: -6, hike: -4 },
  couple: { beach: 3, culture: 2, village: 2, boat: 2 },
  solo: { hike: 2, town: 2, culture: 1 },
  active: { beach: 1, boat: 1 },
  senior: { town: 4, village: 4, culture: 3, museum: 2, beach: 2 },
  nocar: { town: 3, beach: 2 },
};

/** How much the wave models disagree, relative to the sea state: 0.3 m apart matters on a 0.5 m day, not on a 2 m day. */
export function waveAgreement(spreadM: number, waveM: number): 'high' | 'medium' | 'low' {
  if (spreadM > Math.max(0.35, 0.5 * waveM)) return 'low';
  if (spreadM > Math.max(0.15, 0.25 * waveM)) return 'medium';
  return 'high';
}

export function verdictOf(score: number): Verdict {
  return score >= 70 ? 'go' : score >= 50 ? 'caution' : 'avoid';
}

function confidenceOf(window: HourConditions[], daysAhead: number): SpotScore['confidence'] {
  if (!window.length) return 'low';
  const speedSpread = window.reduce((s, c) => s + c.wind.speedSpread, 0) / window.length;
  const windy = window.filter((c) => c.wind.speed >= 12);
  const dirSpread = windy.length ? windy.reduce((s, c) => s + c.wind.dirSpread, 0) / windy.length : 0;
  let level: SpotScore['confidence'] = speedSpread > 20 || dirSpread > 90 ? 'low' : speedSpread <= 12 && dirSpread <= 50 ? 'high' : 'medium';
  // wave models disagreeing on the offshore height counts the same way as wind models disagreeing
  const sea = window.filter((c) => c.sea && c.sea.waveModelCount > 1);
  if (sea.length) {
    const spread = sea.reduce((s, c) => s + c.sea!.waveSpread, 0) / sea.length;
    const wave = sea.reduce((s, c) => s + c.sea!.offshoreWave, 0) / sea.length;
    const waveLevel = waveAgreement(spread, wave);
    if (waveLevel === 'low') level = 'low';
    else if (waveLevel === 'medium' && level === 'high') level = 'medium';
  }
  if (daysAhead >= 2 && level === 'high') level = 'medium';
  return level;
}

/** Merge per-hour factors over the chosen window: average impact, numbers from the worst hour. */
function mergeFactors(hours: HourEval[]): Factor[] {
  const byKey = new Map<FactorKey, { sum: number; worst: Factor }>();
  for (const h of hours) {
    for (const x of h.factors) {
      const cur = byKey.get(x.key);
      if (!cur) byKey.set(x.key, { sum: x.impact, worst: x });
      else {
        cur.sum += x.impact;
        if (Math.abs(x.impact) > Math.abs(cur.worst.impact)) cur.worst = x;
      }
    }
  }
  return [...byKey.entries()]
    .map(([key, v]) => f(key, v.sum / hours.length, v.worst.params))
    .filter((x) => Math.abs(x.impact) >= 0.5 || x.key === 'indoor');
}

export interface ScoreOptions {
  daysAhead?: number;
  /** Ignore windows starting before this hour (e.g. it is already afternoon today). */
  earliestStart?: number;
}

export function scoreSpot(spot: Spot, conditions: HourConditions[], profileId: ProfileId, base: Base, date: string, opts: ScoreOptions = {}): SpotScore {
  const p = profileById(profileId);
  const travel = travelMinutes(base, spot, profileId);
  const len = Math.max(1, Math.min(spot.type === 'beach' ? 4 : 7, Math.round(spot.visitHours)));
  const evals = new Map(conditions.map((c) => [c.hour, evalHour(c, spot, p)]));
  const hourly = conditions.map((c) => ({ hour: c.hour, score: Math.round(evals.get(c.hour)!.score) }));

  // 1. best time window by weather (museums: when it is worst outside)
  let best = { start: -1, mean: -1 };
  const starts = candidateStarts(spot, len).filter((h) => h >= (opts.earliestStart ?? 0));
  for (const start of starts) {
    const hs = Array.from({ length: len }, (_, i) => evals.get(start + i)).filter(Boolean) as HourEval[];
    if (hs.length < len) continue;
    const mean = hs.reduce((s, h) => s + h.rankScore, 0) / hs.length;
    if (mean > best.mean) best = { start, mean };
  }
  const windowEvals = best.start < 0 ? [] : (Array.from({ length: len }, (_, i) => evals.get(best.start + i)) as HourEval[]);
  const windowConds = conditions.filter((c) => c.hour >= best.start && c.hour < best.start + len);
  const merged = windowEvals.length ? mergeFactors(windowEvals) : [];
  const factors = merged.filter((x) => !RANK_ONLY.has(x.key));
  const score = windowEvals.length ? Math.round(windowEvals.reduce((s, h) => s + h.score, 0) / windowEvals.length) : 0;

  // 2. fit: everything that is not weather
  const fit: Factor[] = merged.filter((x) => RANK_ONLY.has(x.key));
  const [lo, hi, maxPen] = p.travel;
  const travelPen = ramp(travel, lo, hi) * maxPen;
  if (travelPen >= 0.5) fit.push(f(profileId === 'nocar' ? 'bus' : 'drive', -travelPen, { min: travel }));
  const { bonus, traits } = traitBonus(spot, p);
  if (bonus) fit.push(f('trait', bonus, { traits: traits.join(',') }));
  if (spot.appeal) fit.push(f('appeal', spot.appeal, { appeal: spot.appeal }));
  const pref = TYPE_PREF[profileId][spot.type] ?? 0;
  if (pref) fit.push(f('typePref', pref, { type: spot.type }));
  // "rare opportunity" only when the whole day is calm there, not just the chosen window
  const dayConds = conditions.filter((c) => c.hour >= 10 && c.hour <= 18);
  const calmAllDay =
    dayConds.length > 0 &&
    dayConds.reduce((sum, c) => sum + c.wind.speed, 0) / dayConds.length < 15 &&
    Math.max(...dayConds.map((c) => c.effectiveGust)) < 32 &&
    Math.max(...dayConds.map((c) => c.sea?.effectiveWave ?? 0)) < 0.5;
  if (spot.calmDayGem && score >= 85 && calmAllDay) fit.push(f('opportunity', 8));
  // wind arriving after the window: the guest should know when to leave
  const later = best.start >= 0 ? conditions.find((c) => c.hour >= best.start + len && c.hour <= 20 && c.wind.speed >= 20) : undefined;
  const laterWind = later && (spot.type === 'beach' || spot.type === 'boat' || spot.type === 'lake') ? { fromHour: later.hour, kmh: Math.round(later.wind.speed), bf: later.bf, dir: Math.round(later.wind.dir) } : undefined;
  if (spot.access.dirtRoad && (profileId === 'family' || profileId === 'senior')) fit.push(f('dirtRoad', -5));
  if (spot.traits.crowded) fit.push(f('crowds', 0));

  const unsuitableReason = best.start < 0 ? f('closed', 0, { kind: 'tooLate' }) : unsuitable(spot, p, date, base);
  factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  fit.sort((a, b) => b.impact - a.impact);

  return {
    spotId: spot.id,
    profile: profileId,
    score,
    rank: round(score + fit.reduce((s, x) => s + x.impact, 0), 1),
    verdict: unsuitableReason ? 'unsuitable' : verdictOf(score),
    window: { start: best.start, end: best.start + len },
    hourly,
    factors,
    fit,
    unsuitableReason,
    confidence: confidenceOf(windowConds, opts.daysAhead ?? 1),
    travelMinutes: travel,
    laterWind,
  };
}
