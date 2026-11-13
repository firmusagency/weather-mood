import { athensDate, shiftDate } from './dates';

/*
 * Health check: the things that broke quietly in the first weeks and were found by accident.
 * Push that never sent anything (three weeks), a 7-day outlook missing from every snapshot (four
 * days), an evening message that did not go out. Each of them left a trace in the data files, so
 * the check reads only those files: what should exist at this hour, and how old it may be.
 */

export type HealthLevel = 'ok' | 'warn' | 'error';

export interface HealthItem {
  id: 'snapshot' | 'days' | 'outlook' | 'evening' | 'planB' | 'verification' | 'push' | 'closures';
  level: HealthLevel;
  el: string;
  en: string;
}

export interface Health {
  checkedAt: string;
  /** False when at least one item is an error. */
  ok: boolean;
  errors: number;
  warnings: number;
  items: HealthItem[];
}

/** What the nightly scripts report about the last message they tried to deliver. */
export interface Delivery {
  kind: 'evening' | 'planB';
  date: string;
  at: string;
  push: { state: 'sent' | 'off' | 'failed'; sent?: number; failed?: number; removed?: number; lapsed?: number; reason?: string };
  email: { state: 'sent' | 'off' | 'failed'; reason?: string };
}

export interface HealthInputs {
  snapshot: { generatedAt: string; days: string[]; outlookFetchedAt: string | null } | null;
  evening: { date: string; generatedAt: string } | null;
  planB: { date: string; checkedAt: string } | null;
  verification: { to: string; updatedAt: string } | null;
  closures: { checkedAt: string | null } | null;
  delivery: Delivery | null;
}

export const HEALTH_LIMITS = {
  snapshotWarnH: 10,
  snapshotErrorH: 16,
  outlookMaxH: 30,
  closuresMaxH: 30,
  /** Athens clock: from when each daily output must exist. */
  eveningDueHour: 18.5,
  planBDueHour: 6.5,
  verificationDueHour: 7,
};

const hoursSince = (iso: string | null | undefined, now: Date) => (iso ? (now.getTime() - Date.parse(iso)) / 3_600_000 : Infinity);
const h1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '∞');

export function athensClock(now: Date): number {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(now).split(':').map(Number);
  return h + m / 60;
}

export function checkHealth(inp: HealthInputs, now = new Date()): Health {
  const items: HealthItem[] = [];
  const add = (id: HealthItem['id'], level: HealthLevel, el: string, en: string) => items.push({ id, level, el, en });
  const today = athensDate(0, now);
  const tomorrow = shiftDate(today, 1);
  const yesterday = shiftDate(today, -1);
  const clock = athensClock(now);
  const L = HEALTH_LIMITS;

  // forecast data
  const age = hoursSince(inp.snapshot?.generatedAt, now);
  if (!inp.snapshot) add('snapshot', 'error', 'Δεν υπάρχει αρχείο πρόγνωσης.', 'There is no forecast file.');
  else if (age > L.snapshotErrorH) add('snapshot', 'error', `Η πρόγνωση είναι ${h1(age)} ωρών: οι λήψεις αποτυγχάνουν.`, `The forecast is ${h1(age)} h old: fetching is failing.`);
  else if (age > L.snapshotWarnH) add('snapshot', 'warn', `Η πρόγνωση είναι ${h1(age)} ωρών.`, `The forecast is ${h1(age)} h old.`);
  else add('snapshot', 'ok', `Πρόγνωση ${h1(age)} ωρών.`, `Forecast ${h1(age)} h old.`);

  if (inp.snapshot) {
    if (!inp.snapshot.days.includes(tomorrow)) add('days', 'error', 'Η πρόγνωση δεν περιέχει την αυριανή μέρα.', 'The forecast does not contain tomorrow.');
    else add('days', 'ok', `Μέρες με πλήρη πρόγνωση: ${inp.snapshot.days.length}.`, `Days with a full forecast: ${inp.snapshot.days.length}.`);
    const oAge = hoursSince(inp.snapshot.outlookFetchedAt, now);
    if (!inp.snapshot.outlookFetchedAt) add('outlook', 'warn', 'Λείπει η 7ήμερη πρόγνωση: το πλάνο διαμονής βλέπει μόνο 3 μέρες.', 'The 7-day outlook is missing: the stay planner sees only 3 days.');
    else if (oAge > L.outlookMaxH) add('outlook', 'warn', `Η 7ήμερη πρόγνωση είναι ${h1(oAge)} ωρών.`, `The 7-day outlook is ${h1(oAge)} h old.`);
    else add('outlook', 'ok', '7ήμερη πρόγνωση διαθέσιμη.', '7-day outlook available.');
  }

  // the evening message: by 18:30 it must be the one for tomorrow; before that, the one for today
  const eveningWanted = clock >= L.eveningDueHour ? tomorrow : today;
  if (!inp.evening || inp.evening.date < eveningWanted) {
    add('evening', 'error', `Δεν έχει βγει το βραδινό μήνυμα για ${eveningWanted} (τελευταίο: ${inp.evening?.date ?? '–'}).`, `The evening message for ${eveningWanted} has not been made (latest: ${inp.evening?.date ?? '–'}).`);
  } else add('evening', 'ok', `Βραδινό μήνυμα για ${inp.evening.date}.`, `Evening message for ${inp.evening.date}.`);

  if (clock >= L.planBDueHour) {
    if (inp.planB?.date !== today) add('planB', 'warn', `Ο πρωινός έλεγχος Plan B δεν έγινε σήμερα (τελευταίος: ${inp.planB?.date ?? '–'}).`, `The morning plan-B check did not run today (latest: ${inp.planB?.date ?? '–'}).`);
    else add('planB', 'ok', 'Πρωινός έλεγχος Plan B έγινε.', 'Morning plan-B check done.');
  }

  if (clock >= L.verificationDueHour) {
    if (!inp.verification || inp.verification.to < yesterday) add('verification', 'warn', `Η επαλήθευση δεν έχει τη χθεσινή μέρα (φτάνει ως ${inp.verification?.to ?? '–'}).`, `Verification does not include yesterday (it reaches ${inp.verification?.to ?? '–'}).`);
    else add('verification', 'ok', `Επαλήθευση ως ${inp.verification.to}.`, `Verification up to ${inp.verification.to}.`);
  }

  // notifications: say why when they are off or failing
  const p = inp.delivery?.push;
  if (!p) add('push', 'warn', 'Δεν υπάρχει ακόμη αναφορά αποστολής ειδοποιήσεων.', 'No notification delivery report yet.');
  else if (p.state === 'off') add('push', 'warn', `Οι ειδοποιήσεις είναι ανενεργές: ${p.reason ?? '–'}.`, `Notifications are off: ${p.reason ?? '–'}.`);
  else if (p.state === 'failed') add('push', 'warn', `Η αποστολή ειδοποιήσεων απέτυχε: ${p.reason ?? '–'}.`, `Sending notifications failed: ${p.reason ?? '–'}.`);
  else if ((p.failed ?? 0) > 0 && (p.sent ?? 0) === 0) add('push', 'warn', `Καμία ειδοποίηση δεν παραδόθηκε (${p.failed} αποτυχίες).`, `No notification was delivered (${p.failed} failures).`);
  else add('push', 'ok', `Ειδοποιήσεις: ${p.sent ?? 0} στάλθηκαν (${inp.delivery!.date}).`, `Notifications: ${p.sent ?? 0} sent (${inp.delivery!.date}).`);

  const cAge = hoursSince(inp.closures?.checkedAt, now);
  if (cAge > L.closuresMaxH) add('closures', 'warn', `Η επίσημη κατάσταση της Σαμαριάς δεν έχει ελεγχθεί εδώ και ${h1(cAge)} ώρες.`, `The official Samaria status has not been checked for ${h1(cAge)} h.`);
  else add('closures', 'ok', 'Επίσημα κλεισίματα ελεγμένα.', 'Official closures checked.');

  const errors = items.filter((i) => i.level === 'error').length;
  const warnings = items.filter((i) => i.level === 'warn').length;
  return { checkedAt: now.toISOString(), ok: errors === 0, errors, warnings, items };
}
