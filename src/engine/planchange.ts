import type { Recommendation } from './recommend';
import type { Synopsis } from './synopsis';
import type { ProfileId, SpotScore, Verdict } from './types';

/*
 * "Plan B": did the picture change between the evening message and the next morning's forecast?
 * The evening run stores a compact PlanSnapshot per profile; the morning run rebuilds the plan with
 * fresh data and compares. Only changes a guest would care about count.
 */

export interface PlanPick {
  spotId: string;
  verdict: Verdict;
  score: number;
  window: { start: number; end: number };
}

export interface PlanSnapshot {
  date: string;
  profile: ProfileId;
  generatedAt: string;
  picks: PlanPick[];
  avoid: string[];
  wind: { bf: number; dir: number; gust: number };
  rainProbMax: number;
  /** Max wave per reference coast (m). */
  coasts: Record<string, number>;
}

export type ChangeKind = 'pickDropped' | 'pickDowngraded' | 'newTop' | 'windUp' | 'windDown' | 'rainUp' | 'seaUp' | 'seaDown';

export interface PlanChange {
  kind: ChangeKind;
  params: Record<string, string | number>;
}

export interface PlanDiff {
  date: string;
  profile: ProfileId;
  /** True when the guest should be told. */
  significant: boolean;
  changes: PlanChange[];
  before: PlanSnapshot;
  after: PlanSnapshot;
}

export function planSnapshot(date: string, profile: ProfileId, rec: Recommendation, syn: Synopsis, generatedAt = new Date().toISOString()): PlanSnapshot {
  const pick = (sc: SpotScore): PlanPick => ({ spotId: sc.spotId, verdict: sc.verdict, score: sc.score, window: sc.window });
  const coasts: Record<string, number> = {};
  for (const c of syn.coasts) coasts[c.id] = c.waveMax ?? 0;
  return {
    date,
    profile,
    generatedAt,
    picks: rec.top.map(pick),
    avoid: rec.avoid.map((sc) => sc.spotId),
    wind: { bf: syn.wind.bf, dir: Math.round(syn.wind.dir), gust: Math.round(syn.wind.gust) },
    rainProbMax: syn.town.rainProbMax ?? 0,
    coasts,
  };
}

const rank: Record<Verdict, number> = { go: 3, caution: 2, avoid: 1, unsuitable: 0 };

/** Compare the evening plan with the morning one. */
export function comparePlans(before: PlanSnapshot, after: PlanSnapshot): PlanDiff {
  const changes: PlanChange[] = [];
  const afterIds = new Set(after.picks.map((p) => p.spotId));
  const afterById = new Map(after.picks.map((p) => [p.spotId, p]));

  for (const p of before.picks) {
    const now = afterById.get(p.spotId);
    if (!now) {
      // dropped from the top three: significant only if it is now bad, not just outranked
      const nowAvoid = after.avoid.includes(p.spotId);
      if (nowAvoid) changes.push({ kind: 'pickDropped', params: { spot: p.spotId } });
    } else if (rank[now.verdict] < rank[p.verdict]) {
      changes.push({ kind: 'pickDowngraded', params: { spot: p.spotId, from: p.verdict, to: now.verdict } });
    }
  }
  const newTop = after.picks[0];
  if (newTop && before.picks[0] && newTop.spotId !== before.picks[0].spotId && !before.picks.some((p) => p.spotId === newTop.spotId)) {
    changes.push({ kind: 'newTop', params: { spot: newTop.spotId } });
  }
  const dBf = after.wind.bf - before.wind.bf;
  if (dBf >= 2) changes.push({ kind: 'windUp', params: { from: before.wind.bf, to: after.wind.bf, dir: after.wind.dir } });
  else if (dBf <= -2 && before.wind.bf >= 4) changes.push({ kind: 'windDown', params: { from: before.wind.bf, to: after.wind.bf } });
  if (after.rainProbMax >= 50 && before.rainProbMax < 30) changes.push({ kind: 'rainUp', params: { pp: after.rainProbMax } });
  for (const [coast, wave] of Object.entries(after.coasts)) {
    const was = before.coasts[coast] ?? 0;
    if (wave >= 0.8 && was < 0.5) changes.push({ kind: 'seaUp', params: { coast, from: was, to: wave } });
    else if (wave < 0.4 && was >= 0.8) changes.push({ kind: 'seaDown', params: { coast, from: was, to: wave } });
  }

  const significant = changes.some((c) => c.kind === 'pickDropped' || c.kind === 'pickDowngraded' || c.kind === 'windUp' || c.kind === 'rainUp' || c.kind === 'seaUp');
  void afterIds;
  return { date: after.date, profile: after.profile, significant, changes, before, after };
}
