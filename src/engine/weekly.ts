import type { FeedbackTag } from './feedback';

/*
 * The owner's weekly report: what guests did with the page, what they said, what we recommended
 * and how accurate we were. Built every Monday by scripts/weekly-report.ts, emailed to the
 * property and shown in the dashboard (public/data/weekly.json).
 */

export interface WeeklyReport {
  generatedAt: string;
  property: { id: string; name: string };
  weekStart: string;
  weekEnd: string;
  visits: {
    total: number;
    prev: number;
    byView: Record<string, number>;
    byLang: Record<string, number>;
    byProfile: Record<string, number>;
    perDay: { date: string; n: number }[];
    /** Browsers that opened the page at least once (distinct client ids). */
    devices: number;
  };
  votes: {
    total: number;
    prev: number;
    up: number;
    down: number;
    reception: number;
    topTags: { tag: FeedbackTag; n: number }[];
    bySpot: { spotId: string; n: number; up: number; down: number }[];
  };
  /** How often each place was among the top picks that week (couple + family messages). */
  picks: { spotId: string; days: number }[];
  /** Days where the morning check found the evening plan had to change. */
  planBDays: number;
  pushSubscribers: number | null;
  accuracy: {
    days: number;
    bfWithin1Rate: number;
    windMae: number;
    picksHeld: number;
    picks: number;
    stationDays: number;
  } | null;
}

export interface WeeklyInputs {
  property: { id: string; name: string };
  weekStart: string;
  weekEnd: string;
  visits: { created_at: string; view: string; lang: string | null; profile: string | null; client_id: string }[];
  prevVisits: number;
  feedback: { visit_date: string; spot_id: string; verdict: 'up' | 'down'; tag: FeedbackTag | null; source: string }[];
  prevFeedback: number;
  /** Top picks per date from the archived evening messages. */
  picksByDate: Record<string, string[]>;
  planBDays: number;
  pushSubscribers: number | null;
  accuracy: WeeklyReport['accuracy'];
}

export function buildWeeklyReport(x: WeeklyInputs, now = new Date()): WeeklyReport {
  const byView: Record<string, number> = {};
  const byLang: Record<string, number> = {};
  const byProfile: Record<string, number> = {};
  const perDay = new Map<string, number>();
  const devices = new Set<string>();
  for (const v of x.visits) {
    byView[v.view] = (byView[v.view] ?? 0) + 1;
    if (v.lang) byLang[v.lang] = (byLang[v.lang] ?? 0) + 1;
    if (v.profile) byProfile[v.profile] = (byProfile[v.profile] ?? 0) + 1;
    const d = v.created_at.slice(0, 10);
    perDay.set(d, (perDay.get(d) ?? 0) + 1);
    devices.add(v.client_id);
  }
  const tags = new Map<FeedbackTag, number>();
  const bySpot = new Map<string, { spotId: string; n: number; up: number; down: number }>();
  let up = 0;
  let down = 0;
  let reception = 0;
  for (const f of x.feedback) {
    if (f.verdict === 'up') up += 1;
    else down += 1;
    if (f.source === 'reception') reception += 1;
    if (f.tag) tags.set(f.tag, (tags.get(f.tag) ?? 0) + 1);
    const s = bySpot.get(f.spot_id) ?? { spotId: f.spot_id, n: 0, up: 0, down: 0 };
    s.n += 1;
    s[f.verdict] += 1;
    bySpot.set(f.spot_id, s);
  }
  const pickCount = new Map<string, number>();
  for (const ids of Object.values(x.picksByDate)) for (const id of new Set(ids)) pickCount.set(id, (pickCount.get(id) ?? 0) + 1);
  return {
    generatedAt: now.toISOString(),
    property: x.property,
    weekStart: x.weekStart,
    weekEnd: x.weekEnd,
    visits: { total: x.visits.length, prev: x.prevVisits, byView, byLang, byProfile, perDay: [...perDay.entries()].sort().map(([date, n]) => ({ date, n })), devices: devices.size },
    votes: {
      total: x.feedback.length,
      prev: x.prevFeedback,
      up,
      down,
      reception,
      topTags: [...tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag, n]) => ({ tag, n })),
      bySpot: [...bySpot.values()].sort((a, b) => b.n - a.n).slice(0, 8),
    },
    picks: [...pickCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([spotId, days]) => ({ spotId, days })),
    planBDays: x.planBDays,
    pushSubscribers: x.pushSubscribers,
    accuracy: x.accuracy,
  };
}

/** Monday–Sunday of the last complete week before `today` (YYYY-MM-DD). */
export function lastWeek(today: string): { weekStart: string; weekEnd: string } {
  const d = new Date(`${today}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  const monday = new Date(d.getTime() - (dow + 7) * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  return { weekStart: monday.toISOString().slice(0, 10), weekEnd: sunday.toISOString().slice(0, 10) };
}
