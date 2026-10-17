import { SPOTS } from '../data/spots';
import { REF_POINTS } from '../data/region';
import { datasetFromRaw, fetchRaw, planPoints, type RawBundle } from '../engine/openmeteo';
import type { Dataset } from '../engine/types';

export interface Snapshot {
  generatedAt: string;
  days: Record<string, RawBundle>;
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
