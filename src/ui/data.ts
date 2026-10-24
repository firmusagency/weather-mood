import { SPOTS } from '../data/spots';
import { REF_POINTS } from '../data/region';
import { dailySun, datasetFromRaw, fetchRaw, planPoints, proxyDataset, sliceDay, type RawBundle } from '../engine/openmeteo';
import type { Dataset } from '../engine/types';
import type { VerificationSummary } from '../engine/verify';
import type { Calibration, FeedbackSummary } from '../engine/feedback';
import type { WeeklyReport } from '../engine/weekly';

export interface Snapshot {
  generatedAt: string;
  days: Record<string, RawBundle>;
  /** Multi-day bundle at the reference points (see outlookPlan); absent in older snapshots. */
  outlook?: RawBundle;
}

/** True for the single-file demo build, which ships its data inside the page. */
export const EMBEDDED = import.meta.env.MODE === 'single';

export async function loadSnapshot(): Promise<Snapshot> {
  if (EMBEDDED) {
    const mod = await import('../../public/data/snapshot-latest.json');
    return (mod.default ?? mod) as unknown as Snapshot;
  }
  const res = await fetch(`${import.meta.env.BASE_URL}data/snapshot-latest.json`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`snapshot ${res.status}`);
  return res.json();
}

/** Fetch fresh forecasts straight from Open-Meteo in the browser (no server needed). */
export async function fetchLive(date: string): Promise<Dataset> {
  const raw = await fetchRaw(planPoints(SPOTS, REF_POINTS), date);
  return datasetFromRaw(raw, 'live');
}

import type { PlanDiff } from '../engine/planchange';
import type { ProfileId } from '../engine/types';

export interface PlanBReport {
  date: string;
  checkedAt: string;
  eveningGeneratedAt: string | null;
  changed: boolean;
  byProfile: Partial<Record<ProfileId, { diff: PlanDiff; messages: Record<string, string> | null }>>;
}

async function loadJson<T>(name: 'verification' | 'feedback' | 'calibration' | 'plan-b' | 'weekly'): Promise<T | null> {
  try {
    if (EMBEDDED) {
      // static import paths so the bundler can inline them
      const mod =
        name === 'verification'
          ? await import('../../public/data/verification.json')
          : name === 'feedback'
            ? await import('../../public/data/feedback.json')
            : name === 'plan-b'
              ? await import('../../public/data/plan-b.json')
              : name === 'weekly'
                ? await import('../../public/data/weekly.json')
                : await import('../../public/data/calibration.json');
      return (mod.default ?? mod) as unknown as T;
    }
    const res = await fetch(`${import.meta.env.BASE_URL}data/${name}.json`, { cache: 'no-cache' });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const loadVerification = () => loadJson<VerificationSummary>('verification');
export const loadFeedback = () => loadJson<FeedbackSummary>('feedback');
export const loadCalibration = () => loadJson<Calibration>('calibration');
export const loadPlanB = () => loadJson<PlanBReport>('plan-b');
export const loadWeekly = () => loadJson<WeeklyReport>('weekly');

export function datasetsFromSnapshot(s: Snapshot): Record<string, Dataset> {
  const out: Record<string, Dataset> = {};
  for (const [date, raw] of Object.entries(s.days)) {
    try {
      out[date] = datasetFromRaw(raw, 'snapshot');
    } catch (e) {
      console.warn(`skipping ${date}`, e);
    }
  }
  return out;
}

/**
 * Outlook days (beyond the fully fetched ones) as spot-level datasets built from the reference
 * points. Keys are dates not already present in `days`.
 */
export function outlookFromSnapshot(s: Snapshot, full: Record<string, Dataset>): Record<string, Dataset> {
  const out: Record<string, Dataset> = {};
  if (!s.outlook) return out;
  try {
    const multi = datasetFromRaw(s.outlook, 'snapshot');
    const sun = dailySun(s.outlook, s.outlook.plan.land.findIndex((p) => p.id === 'ref-town'));
    const dates = new Set(Object.values(multi.land)[0]?.atmos.map((a) => a.time.slice(0, 10)) ?? []);
    for (const date of [...dates].sort()) {
      if (full[date]) continue;
      const day = sliceDay(multi, date);
      for (const pw of Object.values(day.land)) {
        pw.sunrise = sun[date]?.sunrise;
        pw.sunset = sun[date]?.sunset;
      }
      out[date] = proxyDataset(day, SPOTS, REF_POINTS);
    }
  } catch (e) {
    console.warn('outlook unreadable', e);
  }
  return out;
}

export function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(`wm:${key}`);
    return v && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: string) {
  try {
    localStorage.setItem(`wm:${key}`, value);
  } catch {
    /* storage unavailable: preference just isn't remembered */
  }
}
