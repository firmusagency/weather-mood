import { analyzeSpot } from './analysis';
import { scoreSpot, type ScoreOptions } from './scoring';
import type { Base, Dataset, HourConditions, ProfileId, Spot, SpotScore } from './types';

/*
 * Step 3: rank everything for one profile and pick a varied short list.
 */

export interface DayAnalysis {
  conditions: Record<string, HourConditions[]>;
  scores: Record<string, SpotScore>;
}

export function analyzeDay(spots: Spot[], data: Dataset, profile: ProfileId, base: Base, opts: ScoreOptions = {}): DayAnalysis {
  const conditions: Record<string, HourConditions[]> = {};
  const scores: Record<string, SpotScore> = {};
  for (const s of spots) {
    conditions[s.id] = analyzeSpot(s, data);
    scores[s.id] = scoreSpot(s, conditions[s.id], profile, base, data.date, opts);
  }
  return { conditions, scores };
}

export interface Recommendation {
  top: SpotScore[];
  alternatives: SpotScore[];
  avoid: SpotScore[];
  /** True when nothing outdoors scores well — suggest a "plan B" day. */
  badWeatherDay: boolean;
}

export function recommend(spots: Spot[], scores: Record<string, SpotScore>): Recommendation {
  const byId = new Map(spots.map((s) => [s.id, s]));
  const ranked = Object.values(scores)
    .filter((s) => s.verdict !== 'unsuitable')
    .sort((a, b) => b.rank - a.rank);

  // Top 3: best options, one per area so guests get real alternatives (not three Akrotiri coves).
  const top: SpotScore[] = [];
  const usedAreas = new Set<string>();
  for (const s of ranked) {
    if (top.length === 3) break;
    const area = byId.get(s.spotId)!.area;
    if (s.verdict === 'avoid' || usedAreas.has(area)) continue;
    top.push(s);
    usedAreas.add(area);
  }

  // Alternatives: next best, including at least one non-beach idea when a good one exists.
  const rest = ranked.filter((s) => !top.includes(s) && s.verdict !== 'avoid');
  const alternatives = rest.slice(0, 3);
  const hasNonBeach = [...top, ...alternatives].some((s) => byId.get(s.spotId)!.type !== 'beach');
  if (!hasNonBeach) {
    const other = rest.find((s) => byId.get(s.spotId)!.type !== 'beach' && s.verdict === 'go');
    if (other) alternatives.splice(Math.min(2, alternatives.length), 1, other);
  }

  // Avoid: well-known places guests are likely to head to anyway, but which are a bad idea tomorrow.
  const avoid = Object.values(scores)
    .filter((s) => byId.get(s.spotId)!.traits.popular && s.verdict === 'avoid')
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);

  // town strolls (shops, cafés) survive most weather, so they don't count as "a good day out"
  const outdoorBest = Math.max(0, ...ranked.filter((s) => !['museum', 'town'].includes(byId.get(s.spotId)!.type)).map((s) => s.score));
  return { top, alternatives, avoid, badWeatherDay: outdoorBest < 55 };
}
