import type { Spot } from './types';

/*
 * Official closures: when the authority says a place is shut, no forecast of ours can open it.
 * Today only the Samaria National Park publishes a machine-readable notice (the ticket page shows
 * one alert sentence and the first bookable date); the structure is generic so other places can
 * follow. Ranges are ISO dates, inclusive, Europe/Athens.
 */

export interface ClosureRange {
  from: string;
  to: string;
}

export interface SpotClosure {
  ranges: ClosureRange[];
  /** The sentence the authority showed, verbatim, for the dashboard and the log. */
  notice: string | null;
  source: string;
  checkedAt: string;
}

export interface Closures {
  checkedAt: string | null;
  spots: Record<string, SpotClosure>;
}

export const SAMARIA_TICKETS_URL = 'https://samaria-tickets.necca.gov.gr/checkout';

export const isClosedOn = (spot: Pick<Spot, 'closures'>, date: string) => !!spot.closures?.some((r) => date >= r.from && date <= r.to);

/** Spots with the official closure ranges attached (no-op without data). */
export function applyClosures(spots: Spot[], closures: Closures | null | undefined): Spot[] {
  if (!closures || !Object.keys(closures.spots).length) return spots;
  return spots.map((s) => {
    const c = closures.spots[s.id];
    return c?.ranges.length ? { ...s, closures: c.ranges } : s;
  });
}

const dmy = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
const toIso = (d: string, m: string, y: string) => `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
const shift = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

export interface SamariaStatus {
  notice: string | null;
  ranges: ClosureRange[];
  /** First date the ticket form accepts (the `min`/`value` of its date field), when present. */
  firstBookable: string | null;
}

/**
 * Reads the ticket page HTML. The closure notice sits in a Bootstrap alert ("The Samaria National Park
 * will remain closed between 01/11/2026 and 09/04/2027 due to off season"); in season the same alert
 * carries the weather closures ("...will remain closed on 23/09/2026..."). Rules, most specific first:
 * two dates → range; one date → that day; "today"/"tomorrow" (EN/EL) → that day; a closure sentence with
 * no date at all → today only (conservative). No closure sentence → open.
 */
export function parseSamariaPage(html: string, today: string): SamariaStatus {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ');
  const alerts = [...html.matchAll(/role="alert"[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const lines = [...alerts, ...text.split('\n').map((l) => l.trim())].filter(Boolean);
  const notice = lines.find((l) => /\b(remain|remains|will be|is|stay|stays)\s+closed\b|\bclosed\s+(between|from|on|until|for)\b|κλειστ/i.test(l)) ?? null;

  const valueMatch = html.match(/name="dateRange\.start"[^>]*value="(\d{4}-\d{2}-\d{2})"/) ?? html.match(/value="(\d{4}-\d{2}-\d{2})"[^>]*name="dateRange\.start"/);
  const firstBookable = valueMatch?.[1] ?? null;

  const ranges: ClosureRange[] = [];
  if (notice) {
    const dates = [...notice.matchAll(dmy)].map((m) => toIso(m[1], m[2], m[3])).sort();
    if (dates.length >= 2) ranges.push({ from: dates[0], to: dates[dates.length - 1] });
    else if (dates.length === 1) ranges.push({ from: dates[0], to: dates[0] });
    else if (/tomorrow|αύριο/i.test(notice)) ranges.push({ from: shift(today, 1), to: shift(today, 1) });
    else ranges.push({ from: today, to: today });
  }
  // the booking form's first accepted date is the authority's own "open from": trust it when it says later than today
  if (firstBookable && firstBookable > today && !ranges.some((r) => r.from <= today && r.to >= shift(firstBookable, -1))) {
    ranges.push({ from: today, to: shift(firstBookable, -1) });
  }
  return { notice, ranges: mergeRanges(ranges), firstBookable };
}

function mergeRanges(rs: ClosureRange[]): ClosureRange[] {
  const sorted = [...rs].sort((a, b) => a.from.localeCompare(b.from));
  const out: ClosureRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.from <= shift(last.to, 1)) last.to = r.to > last.to ? r.to : last.to;
    else out.push({ ...r });
  }
  return out;
}
