import type { ProfileId } from '../engine/types';
import type { FeedbackSource, FeedbackTag, FeedbackVerdict } from '../engine/feedback';

/*
 * Browser side of the feedback loop. Writes go straight to the database over its REST API with the
 * public (anon) key, which can only INSERT (row-level security). Nothing is ever read from here;
 * the dashboard shows aggregates produced nightly by scripts/export-feedback.ts.
 */

export const APP_VERSION = '0.2.0';

export const FEEDBACK_API = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '',
  key: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
};
export const feedbackEnabled = () => Boolean(FEEDBACK_API.url && FEEDBACK_API.key);

/** Anonymous, per-browser id so one guest can't vote twice for the same place and day. */
export function clientId(): string {
  const KEY = 'wm:cid';
  try {
    const v = localStorage.getItem(KEY);
    if (v && v.length >= 8) return v;
    const fresh = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 12)}`;
  }
}

export interface FeedbackInput {
  propertyId: string;
  source: FeedbackSource;
  visitDate: string;
  spotId: string;
  verdict: FeedbackVerdict;
  tag?: FeedbackTag | null;
  profile?: ProfileId | null;
  lang?: string | null;
  note?: string | null;
  partySize?: number | null;
}

export type SubmitResult = 'ok' | 'duplicate' | 'offline' | 'error';

async function post(table: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${FEEDBACK_API.url}/rest/v1/${table}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: FEEDBACK_API.key, authorization: `Bearer ${FEEDBACK_API.key}`, prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
}

export async function submitFeedback(f: FeedbackInput): Promise<SubmitResult> {
  if (!feedbackEnabled()) return 'offline';
  try {
    const res = await post('feedback', {
      property_id: f.propertyId,
      source: f.source,
      visit_date: f.visitDate,
      spot_id: f.spotId,
      verdict: f.verdict,
      tag: f.tag ?? null,
      profile: f.profile ?? null,
      lang: f.lang ?? null,
      note: f.note?.trim().slice(0, 280) || null,
      party_size: f.partySize ?? null,
      client_id: clientId(),
      app_version: APP_VERSION,
    });
    if (res.status === 409) return 'duplicate';
    return res.ok ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}

/** One anonymous "page opened" per browser session and view, for the property's usage report. */
export async function logVisit(propertyId: string, view: 'phone' | 'lobby' | 'reception', lang: string, profile: ProfileId | null, planDate: string | null) {
  if (!feedbackEnabled()) return;
  const KEY = `wm:visit:${view}`;
  try {
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* no session storage: log anyway */
  }
  try {
    await post('visits', { property_id: propertyId, view, lang, profile, plan_date: planDate, client_id: clientId(), app_version: APP_VERSION });
  } catch {
    /* best effort */
  }
}

/* ---- Remembering which picks a guest saw, so we can ask about them the next day ---- */

export interface SeenPlan {
  date: string;
  profile: ProfileId;
  spotIds: string[];
}

const PLANS_KEY = 'wm:plans';

export function readPlans(): SeenPlan[] {
  try {
    const v = JSON.parse(localStorage.getItem(PLANS_KEY) ?? '[]');
    return Array.isArray(v) ? (v as SeenPlan[]).filter((p) => p && typeof p.date === 'string' && Array.isArray(p.spotIds)) : [];
  } catch {
    return [];
  }
}

/** Keep the last plan shown per date (latest profile wins), max 7 days. */
export function rememberPlan(plan: SeenPlan) {
  if (!plan.spotIds.length) return;
  try {
    const rest = readPlans().filter((p) => p.date !== plan.date);
    const next = [...rest, plan].sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
    localStorage.setItem(PLANS_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

const DONE_KEY = 'wm:fb-done';

export function readDone(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DONE_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markDone(key: string) {
  try {
    localStorage.setItem(DONE_KEY, JSON.stringify([...new Set([...readDone(), key])].slice(-50)));
  } catch {
    /* ignore */
  }
}

export const doneKey = (date: string, spotId: string) => `${date}:${spotId}`;

/** Dates worth asking about: today (afternoon onwards) and the last 3 days. */
export function askableDates(today: string, hourNow: number): string[] {
  const out: string[] = [];
  for (let i = 3; i >= 1; i--) out.push(shiftDate(today, -i));
  if (hourNow >= 15) out.push(today);
  return out;
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
