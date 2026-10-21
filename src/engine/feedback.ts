import type { FactorKey, ProfileId, Spot, SpotScore, Verdict } from './types';

/*
 * Guest / reception feedback ("did the place match what we said?") tied to the forecast we issued.
 * This is the dataset nobody else has: forecast → what people actually found, per beach.
 *
 * Rows arrive from the database (see scripts/export-feedback.ts); here we join them with the
 * archived forecast, aggregate per spot, and derive small, bounded calibration adjustments.
 */

export type FeedbackVerdict = 'up' | 'down';
export const FEEDBACK_TAGS = ['wave', 'wind', 'crowd', 'rain', 'heat', 'cold', 'other'] as const;
export type FeedbackTag = (typeof FEEDBACK_TAGS)[number];
export type FeedbackSource = 'guest' | 'reception';

export interface FeedbackRow {
  id: string;
  created_at: string;
  property_id: string;
  source: FeedbackSource;
  visit_date: string;
  spot_id: string;
  verdict: FeedbackVerdict;
  tag: FeedbackTag | null;
  profile: ProfileId | null;
  lang: string | null;
  note: string | null;
  party_size: number | null;
}

/** What we had said about that spot on that day (from the archived next-day forecast). */
export interface ForecastAtVisit {
  verdict: Verdict;
  score: number;
  /** Largest weather penalty, i.e. the headline reason if we warned against it. */
  problem: FactorKey | null;
  effectiveWaveM: number | null;
  gustKmh: number | null;
}

export interface JoinedRow extends FeedbackRow {
  forecast: ForecastAtVisit | null;
}

export interface SpotFeedback {
  spotId: string;
  n: number;
  up: number;
  down: number;
  tags: Partial<Record<FeedbackTag, number>>;
  /** Rows where the forecast had an opinion and the guest disagreed (go→👎 or avoid→👍). */
  disagree: number;
  /** Rows with a joined forecast. */
  judged: number;
  lastDate: string;
}

export interface FeedbackSummary {
  updatedAt: string;
  total: number;
  from: string | null;
  to: string | null;
  /** Share of judged rows where guest and forecast agreed. */
  agreeRate: number | null;
  judged: number;
  bySpot: SpotFeedback[];
  recent: Omit<JoinedRow, 'id'>[];
  visits: VisitStats;
}

export interface VisitStats {
  days: number;
  total: number;
  byView: Record<string, number>;
  byLang: Record<string, number>;
  byProfile: Record<string, number>;
  perDay: { date: string; n: number }[];
}

export interface CalibrationEntry {
  /** Multiplier applied to the spot's waveFactor (1 = unchanged). */
  waveFactor: number;
  samples: number;
  waveComplaints: number;
  falseAlarms: number;
}

export interface Calibration {
  updatedAt: string;
  minSamples: number;
  spots: Record<string, CalibrationEntry>;
}

const SEA_KEYS: FactorKey[] = ['seaRough', 'longSwell', 'ripCurrents', 'boatRough', 'boatCancel', 'returnBoat'];

/** Headline weather problem of a score: the largest penalty, or null when nothing was deducted. */
export function headlineProblem(sc: SpotScore): FactorKey | null {
  const worst = sc.factors.filter((f) => f.impact < 0).sort((a, b) => a.impact - b.impact)[0];
  return worst ? worst.key : null;
}

export function forecastAtVisit(sc: SpotScore, maxWave: number | null, maxGust: number | null): ForecastAtVisit {
  return { verdict: sc.verdict, score: sc.score, problem: headlineProblem(sc), effectiveWaveM: maxWave, gustKmh: maxGust };
}

/** Guest and forecast disagree when we said "go" and they say 👎, or we said "avoid" and they say 👍. */
export function disagrees(r: JoinedRow): boolean {
  if (!r.forecast) return false;
  if (r.forecast.verdict === 'go' && r.verdict === 'down') return true;
  if ((r.forecast.verdict === 'avoid' || r.forecast.verdict === 'unsuitable') && r.verdict === 'up') return true;
  return false;
}

export function summarizeFeedback(rows: JoinedRow[], visits: VisitStats, now = new Date()): FeedbackSummary {
  const bySpot = new Map<string, SpotFeedback>();
  let judged = 0;
  let agree = 0;
  for (const r of rows) {
    const s = bySpot.get(r.spot_id) ?? { spotId: r.spot_id, n: 0, up: 0, down: 0, tags: {}, disagree: 0, judged: 0, lastDate: r.visit_date };
    s.n += 1;
    s[r.verdict] += 1;
    if (r.tag) s.tags[r.tag] = (s.tags[r.tag] ?? 0) + 1;
    if (r.visit_date > s.lastDate) s.lastDate = r.visit_date;
    if (r.forecast && r.forecast.verdict !== 'caution') {
      s.judged += 1;
      judged += 1;
      if (disagrees(r)) s.disagree += 1;
      else agree += 1;
    }
    bySpot.set(r.spot_id, s);
  }
  const dates = rows.map((r) => r.visit_date).sort();
  const recent = [...rows]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 30)
    .map(({ id: _id, ...rest }) => rest);
  return {
    updatedAt: now.toISOString(),
    total: rows.length,
    from: dates[0] ?? null,
    to: dates[dates.length - 1] ?? null,
    agreeRate: judged ? Math.round((agree / judged) * 100) / 100 : null,
    judged,
    bySpot: [...bySpot.values()].sort((a, b) => b.n - a.n || a.spotId.localeCompare(b.spotId)),
    recent,
    visits,
  };
}

export const CALIBRATION_MIN_SAMPLES = 8;
const STEP = 0.05;
const MIN_NET = 2;
const RANGE: [number, number] = [0.7, 1.4];

/*
 * Bounded self-correction of the shore-wave estimate, per spot:
 *  - a 👎 tagged "wave" on a day we said go/caution = we under-estimated the wave there (+1 step)
 *  - a 👍 on a day we said avoid because of the sea = we over-estimated it (−1 step)
 * Needs at least `minSamples` judged rows and a net of ±2 before anything moves; capped at ±30–40 %.
 * Everything else (wind, crowds, rain) is reported, not auto-applied: those need a human look.
 */
export function calibrate(rows: JoinedRow[], now = new Date(), minSamples = CALIBRATION_MIN_SAMPLES): Calibration {
  const acc = new Map<string, CalibrationEntry>();
  for (const r of rows) {
    if (!r.forecast) continue;
    const e = acc.get(r.spot_id) ?? { waveFactor: 1, samples: 0, waveComplaints: 0, falseAlarms: 0 };
    e.samples += 1;
    const saidOk = r.forecast.verdict === 'go' || r.forecast.verdict === 'caution';
    const saidSea = (r.forecast.verdict === 'avoid' || r.forecast.verdict === 'unsuitable') && r.forecast.problem != null && SEA_KEYS.includes(r.forecast.problem);
    if (r.verdict === 'down' && r.tag === 'wave' && saidOk) e.waveComplaints += 1;
    if (r.verdict === 'up' && saidSea) e.falseAlarms += 1;
    acc.set(r.spot_id, e);
  }
  const spots: Record<string, CalibrationEntry> = {};
  for (const [id, e] of acc) {
    const net = e.waveComplaints - e.falseAlarms;
    if (e.samples < minSamples || Math.abs(net) < MIN_NET) continue;
    const f = Math.min(RANGE[1], Math.max(RANGE[0], 1 + STEP * net));
    spots[id] = { ...e, waveFactor: Math.round(f * 100) / 100 };
  }
  return { updatedAt: now.toISOString(), minSamples, spots };
}

/** Spots with calibration multipliers folded into their waveFactor (no-op without calibration). */
export function applyCalibration(spots: Spot[], calib: Calibration | null | undefined): Spot[] {
  if (!calib || !Object.keys(calib.spots).length) return spots;
  return spots.map((s) => {
    const c = calib.spots[s.id];
    if (!c || c.waveFactor === 1) return s;
    return { ...s, waveFactor: Math.round((s.waveFactor ?? 1) * c.waveFactor * 100) / 100 };
  });
}

/** Daily visit counts and breakdowns from raw visit rows (no personal data involved). */
export function visitStats(rows: { created_at: string; view: string; lang: string | null; profile: string | null }[], days = 30): VisitStats {
  const byView: Record<string, number> = {};
  const byLang: Record<string, number> = {};
  const byProfile: Record<string, number> = {};
  const perDay = new Map<string, number>();
  for (const v of rows) {
    byView[v.view] = (byView[v.view] ?? 0) + 1;
    if (v.lang) byLang[v.lang] = (byLang[v.lang] ?? 0) + 1;
    if (v.profile) byProfile[v.profile] = (byProfile[v.profile] ?? 0) + 1;
    const d = v.created_at.slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
  }
  return {
    days,
    total: rows.length,
    byView,
    byLang,
    byProfile,
    perDay: [...perDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, n]) => ({ date, n })),
  };
}
