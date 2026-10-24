import type { Factor, ProfileId, Spot, SpotScore } from './types';

/*
 * Stay planner: the question every reception hears is "which day should we do Samaria / Balos /
 * Elafonisi?". Given one scored day per date of the stay (full forecasts for the next 3 days,
 * reference-point outlook beyond), assign each big trip to its best day, one trip per day,
 * scarce trips first (a trip with a single good day gets it before a trip that works any day).
 */

export interface StayTrip {
  id: string;
  /** Places that count as the same outing; the best-scoring one that day is used. */
  spotIds: string[];
  /** 1 = the headline trips planned first, 2 = fillers for the remaining days. */
  priority: 1 | 2;
}

export const STAY_TRIPS: StayTrip[] = [
  { id: 'balos', spotIds: ['balos', 'gramvousa-boat'], priority: 1 },
  { id: 'elafonisi', spotIds: ['elafonisi', 'kedrodasos'], priority: 1 },
  { id: 'falasarna', spotIds: ['falasarna'], priority: 1 },
  { id: 'gorge', spotIds: ['samaria', 'imbros', 'agia-irini'], priority: 1 },
  { id: 'sfakia', spotIds: ['loutro', 'glyka-nera', 'sfakia-ferry', 'frangokastello'], priority: 1 },
  { id: 'akrotiri', spotIds: ['seitan-limania', 'stavros', 'marathi'], priority: 2 },
];

export type StayConfidence = 'high' | 'medium' | 'low';

export interface StayDayInput {
  date: string;
  daysAhead: number;
  /** 'full' = every spot forecast in detail; 'outlook' = built from the coast reference points. */
  detail: 'full' | 'outlook';
  scores: Record<string, SpotScore>;
}

export interface TripOption {
  date: string;
  spotId: string;
  score: number;
  /** Score minus an uncertainty allowance for distant / coarse / disputed forecasts. */
  adjusted: number;
  verdict: SpotScore['verdict'];
  confidence: StayConfidence;
  window: SpotScore['window'];
}

export interface PlannedTrip {
  trip: StayTrip;
  /** unplaced = it would work, but every fitting day went to another trip (shown as an alternative). */
  status: 'planned' | 'possible' | 'unplaced' | 'notThisStay';
  /** The chosen day and place (for planned / possible). */
  pick: TripOption | null;
  /** Best option per date, in date order (null where every place of the trip is unsuitable). */
  options: (TripOption | null)[];
  /** Why not, when nothing fits: the negative factors of the least bad day, or the unsuitable reason. */
  reasons: Factor[];
}

export interface StayDayPlan {
  date: string;
  daysAhead: number;
  detail: 'full' | 'outlook';
  trip?: PlannedTrip;
}

export interface StayPlan {
  profile: ProfileId;
  days: StayDayPlan[];
  trips: PlannedTrip[];
}

/** How far to trust a day's score: distance in time, coarse outlook data and model disagreement all cost. */
export function stayConfidence(sc: SpotScore, day: Pick<StayDayInput, 'daysAhead' | 'detail'>): StayConfidence {
  if (day.daysAhead >= 5 || sc.confidence === 'low') return 'low';
  if (day.detail === 'outlook' || day.daysAhead >= 3 || sc.confidence === 'medium') return 'medium';
  return 'high';
}

function uncertaintyPenalty(day: Pick<StayDayInput, 'daysAhead' | 'detail'>, conf: StayConfidence): number {
  let pen = day.detail === 'outlook' ? 6 : 0;
  pen += Math.max(0, day.daysAhead - 3) * 2;
  if (conf === 'low') pen += 5;
  return pen;
}

function bestOption(trip: StayTrip, day: StayDayInput): TripOption | null {
  let best: TripOption | null = null;
  for (const id of trip.spotIds) {
    const sc = day.scores[id];
    if (!sc || sc.verdict === 'unsuitable') continue;
    const confidence = stayConfidence(sc, day);
    const opt: TripOption = { date: day.date, spotId: id, score: sc.score, adjusted: sc.score - uncertaintyPenalty(day, confidence), verdict: sc.verdict, confidence, window: sc.window };
    if (!best || opt.adjusted > best.adjusted) best = opt;
  }
  return best;
}

function worstFactors(trip: StayTrip, days: StayDayInput[]): Factor[] {
  // the least bad day's main problem (or its unsuitable reason when every place is ruled out)
  let bestSc: SpotScore | undefined;
  for (const d of days) {
    for (const id of trip.spotIds) {
      const sc = d.scores[id];
      if (!sc) continue;
      if (!bestSc || (sc.verdict !== 'unsuitable' && (bestSc.verdict === 'unsuitable' || sc.score > bestSc.score))) bestSc = sc;
    }
  }
  if (!bestSc) return [];
  if (bestSc.verdict === 'unsuitable') return bestSc.unsuitableReason ? [bestSc.unsuitableReason] : [];
  return bestSc.factors.filter((f) => f.impact < 0);
}

export function planStay(days: StayDayInput[], profile: ProfileId, spots: Spot[], trips: StayTrip[] = STAY_TRIPS): StayPlan {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const appeal = new Map(spots.map((s) => [s.id, s.appeal]));
  const planned: PlannedTrip[] = trips.map((trip) => ({ trip, status: 'notThisStay', pick: null, options: sorted.map((d) => bestOption(trip, d)), reasons: [] }));
  const taken = new Set<string>();

  const goodDays = (p: PlannedTrip) => p.options.filter((o) => o && o.verdict === 'go').length;
  const maxAppeal = (p: PlannedTrip) => Math.max(0, ...p.trip.spotIds.map((id) => appeal.get(id) ?? 0));
  // scarce trips first within each priority, then the more rewarding ones
  const order = [...planned].sort((a, b) => a.trip.priority - b.trip.priority || goodDays(a) - goodDays(b) || maxAppeal(b) - maxAppeal(a));

  for (const p of order) {
    const fitting = p.options.filter((o): o is TripOption => !!o && o.verdict !== 'avoid');
    const free = fitting.filter((o) => !taken.has(o.date));
    const go = free.filter((o) => o.verdict === 'go');
    const pool = go.length ? go : free.filter((o) => o.verdict === 'caution');
    if (!pool.length) {
      if (fitting.length) p.status = 'unplaced';
      else p.reasons = worstFactors(p.trip, sorted);
      continue;
    }
    // best adjusted score; on a near tie prefer the earlier (more certain) day
    const pick = pool.reduce((a, b) => (b.adjusted > a.adjusted + 3 ? b : a));
    p.pick = pick;
    p.status = go.length ? 'planned' : 'possible';
    taken.add(pick.date);
  }

  const byDate = new Map(planned.filter((p) => p.pick).map((p) => [p.pick!.date, p]));
  return {
    profile,
    days: sorted.map((d) => ({ date: d.date, daysAhead: d.daysAhead, detail: d.detail, trip: byDate.get(d.date) })),
    trips: planned,
  };
}

/** Dates of a stay the planner can use: from tomorrow (or today while the morning is young) to the night before check-out. */
export function stayDates(today: string, hourNow: number, checkout: string, available: string[]): string[] {
  const start = hourNow < 10 ? today : shift(today, 1);
  return available.filter((d) => d >= start && d < checkout).sort();
}

export function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
