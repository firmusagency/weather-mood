/*
 * Weekly owner report (Monday morning): page opens, guest votes, what we recommended, how accurate
 * we were, plan-B days. The owner pays for this; they should see it working.
 *
 *   public/data/weekly.json            latest report (dashboard → Μέθοδος)
 *   data/reports/weekly-<weekStart>.md  archive
 *   email to OWNER_EMAIL (or RECEPTION_EMAIL) when SMTP is configured
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run weekly            (last complete week)
 *        npm run weekly -- 2026-10-19                                         (week starting that Monday)
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { PROFILES } from '../src/data/profiles';
import { athensDate } from '../src/engine/dates';
import type { FeedbackTag } from '../src/engine/feedback';
import { shift } from '../src/engine/stay';
import type { VerificationSummary } from '../src/engine/verify';
import { buildWeeklyReport, lastWeek, type WeeklyInputs, type WeeklyReport } from '../src/engine/weekly';
import { DEMO_PROPERTY } from '../src/guest/property';
import { dbEnv, fetchAll } from './db';
import { mailEnv, sendMail } from './mail';
import type { EveningPack } from './evening';
import type { PlanBReport } from './morning-check';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const spotName = (id: string) => SPOTS.find((s) => s.id === id)?.name.el ?? id;
const profileName = (id: string) => PROFILES.find((p) => p.id === id)?.name.el ?? id;
const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);
const delta = (now: number, prev: number) => (prev === 0 ? '' : ` (${now >= prev ? '+' : ''}${now - prev} από την προηγούμενη)`);

export function reportText(r: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`Weather Mood · Εβδομαδιαία αναφορά για ${r.property.name}`);
  lines.push(`Εβδομάδα ${r.weekStart} έως ${r.weekEnd}`);
  lines.push('');
  lines.push('ΧΡΗΣΗ');
  lines.push(`Ανοίγματα σελίδας: ${r.visits.total}${delta(r.visits.total, r.visits.prev)} από ${r.visits.devices} συσκευές.`);
  const views = Object.entries(r.visits.byView).map(([v, n]) => `${{ phone: 'κινητό', lobby: 'οθόνη reception', reception: 'φόρμα reception' }[v] ?? v} ${n}`);
  if (views.length) lines.push(`Πού: ${views.join(', ')}.`);
  const langs = Object.entries(r.visits.byLang).sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l.toUpperCase()} ${n}`);
  if (langs.length) lines.push(`Γλώσσες: ${langs.join(', ')}.`);
  const profs = Object.entries(r.visits.byProfile).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${profileName(p)} ${n}`);
  if (profs.length) lines.push(`Ποιοι: ${profs.join(', ')}.`);
  if (r.pushSubscribers != null) lines.push(`Εγγεγραμμένοι στις βραδινές ειδοποιήσεις: ${r.pushSubscribers}.`);
  lines.push('');
  lines.push('ΤΙ ΕΙΠΑΝ ΟΙ ΕΠΙΣΚΕΠΤΕΣ');
  if (r.votes.total === 0) lines.push('Καμία ψήφος αυτή την εβδομάδα. Το QR στο δωμάτιο και η φόρμα reception τις μαζεύουν.');
  else {
    lines.push(`${r.votes.total} ψήφοι${delta(r.votes.total, r.votes.prev)}: 👍 ${r.votes.up} · 👎 ${r.votes.down} (${r.votes.reception} από τη reception).`);
    if (r.votes.topTags.length) lines.push(`Συχνότερα παράπονα: ${r.votes.topTags.map((t) => `${{ wave: 'κύμα', wind: 'αέρας', crowd: 'κόσμος', rain: 'βροχή', heat: 'ζέστη', cold: 'κρύο', other: 'άλλο' }[t.tag]} ${t.n}`).join(', ')}.`);
    for (const s of r.votes.bySpot) lines.push(`  ${spotName(s.spotId)}: 👍 ${s.up} 👎 ${s.down}`);
  }
  lines.push('');
  lines.push('ΤΙ ΠΡΟΤΕΙΝΑΜΕ');
  if (r.picks.length) lines.push(r.picks.map((p) => `${spotName(p.spotId)} (${p.days} ${p.days === 1 ? 'μέρα' : 'μέρες'})`).join(', ') + '.');
  else lines.push('Δεν υπάρχουν αρχειοθετημένα βραδινά μηνύματα για αυτή την εβδομάδα.');
  lines.push(`Μέρες που άλλαξε το πλάνο το πρωί (Plan B): ${r.planBDays}.`);
  lines.push('');
  lines.push('ΑΚΡΙΒΕΙΑ (κυλιόμενες 30 μέρες)');
  if (r.accuracy) {
    lines.push(`Άνεμος μέσα σε ±1 Beaufort: ${pct(r.accuracy.bfWithin1Rate)} σε ${r.accuracy.days} μέρες · μέσο σφάλμα ${r.accuracy.windMae} km/h.`);
    lines.push(`Προτάσεις που άντεξαν τη μέρα: ${r.accuracy.picksHeld}/${r.accuracy.picks}. Σταθμοί δυτικής/νότιας ακτής: ${r.accuracy.stationDays} ημερήσιες μετρήσεις.`);
  } else lines.push('Δεν υπάρχουν ακόμη δεδομένα επαλήθευσης.');
  lines.push('');
  lines.push('Λεπτομέρειες: ' + (process.env.VITE_DASHBOARD_URL || 'https://firmusagency.github.io/weather-mood/') + ' · Δημόσια σελίδα ακρίβειας: ' + (process.env.VITE_DASHBOARD_URL || 'https://firmusagency.github.io/weather-mood/') + 'accuracy.html');
  return lines.join('\n');
}

function picksFromMessages(weekStart: string, weekEnd: string): Record<string, string[]> {
  const dir = join(root, 'data/messages');
  const out: Record<string, string[]> = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    const date = f.replace('.json', '');
    if (date < weekStart || date > weekEnd) continue;
    try {
      const pack = JSON.parse(readFileSync(join(dir, f), 'utf8')) as EveningPack;
      out[date] = ['couple', 'family'].flatMap((p) => pack.plans[p as 'couple' | 'family']?.picks.map((x) => x.spotId) ?? []);
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

function planBDays(weekStart: string, weekEnd: string): number {
  // only the latest report is kept in public/data; the archive of plan-B verdicts lives in the git history,
  // so we count from the log the morning check appends when present
  const log = join(root, 'data/plan-b-log.jsonl');
  if (!existsSync(log)) {
    const latest = join(root, 'public/data/plan-b.json');
    if (!existsSync(latest)) return 0;
    const r = JSON.parse(readFileSync(latest, 'utf8')) as PlanBReport;
    return r.changed && r.date >= weekStart && r.date <= weekEnd ? 1 : 0;
  }
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as { date: string; changed: boolean })
    .filter((r) => r.changed && r.date >= weekStart && r.date <= weekEnd).length;
}

async function main() {
  const arg = process.argv[2];
  const { weekStart, weekEnd } = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? { weekStart: arg, weekEnd: shift(arg, 6) } : lastWeek(athensDate(0));
  const prevStart = shift(weekStart, -7);
  const db = dbEnv();
  type Visit = WeeklyInputs['visits'][number];
  type Vote = WeeklyInputs['feedback'][number];
  let visits: Visit[] = [];
  let prevVisits = 0;
  let feedback: Vote[] = [];
  let prevFeedback = 0;
  let pushSubscribers: number | null = null;
  if (db) {
    const pid = encodeURIComponent(DEMO_PROPERTY.id);
    const [v, pv, f, pf, subs] = await Promise.all([
      fetchAll<Visit>(db, 'visits', `select=created_at,view,lang,profile,client_id&property_id=eq.${pid}&client_id=not.like.test-*&created_at=gte.${weekStart}T00:00:00Z&created_at=lt.${shift(weekEnd, 1)}T00:00:00Z`),
      fetchAll<Visit>(db, 'visits', `select=created_at&property_id=eq.${pid}&client_id=not.like.test-*&created_at=gte.${prevStart}T00:00:00Z&created_at=lt.${weekStart}T00:00:00Z`),
      fetchAll<Vote>(db, 'feedback', `select=visit_date,spot_id,verdict,tag,source&property_id=eq.${pid}&client_id=not.like.test-*&visit_date=gte.${weekStart}&visit_date=lte.${weekEnd}`),
      fetchAll<Vote>(db, 'feedback', `select=visit_date&property_id=eq.${pid}&client_id=not.like.test-*&visit_date=gte.${prevStart}&visit_date=lt.${weekStart}`),
      fetchAll<{ id: string }>(db, 'push_subscriptions', `select=id&property_id=eq.${pid}`).catch(() => null),
    ]);
    visits = v;
    prevVisits = pv.length;
    feedback = f;
    prevFeedback = pf.length;
    pushSubscribers = subs ? subs.length : null;
  } else {
    console.log('SUPABASE_URL / SUPABASE_SERVICE_KEY not set: usage and votes left empty');
  }

  let accuracy: WeeklyReport['accuracy'] = null;
  const vfile = join(root, 'public/data/verification.json');
  if (existsSync(vfile)) {
    const v = JSON.parse(readFileSync(vfile, 'utf8')) as VerificationSummary;
    accuracy = { days: v.days, bfWithin1Rate: v.bfWithin1Rate, windMae: v.wind.mae, picksHeld: v.recs?.picksHeld ?? 0, picks: v.recs?.picks ?? 0, stationDays: (v.stations ?? []).reduce((s, x) => s + x.days, 0) };
  }

  const report = buildWeeklyReport({
    property: { id: DEMO_PROPERTY.id, name: DEMO_PROPERTY.name },
    weekStart,
    weekEnd,
    visits,
    prevVisits,
    feedback: feedback.map((f) => ({ ...f, tag: (f.tag ?? null) as FeedbackTag | null })),
    prevFeedback,
    picksByDate: picksFromMessages(weekStart, weekEnd),
    planBDays: planBDays(weekStart, weekEnd),
    pushSubscribers,
    accuracy,
  });
  const text = reportText(report);

  writeFileSync(join(root, 'public/data/weekly.json'), JSON.stringify(report, null, 1));
  const archive = join(root, `data/reports/weekly-${weekStart}.md`);
  mkdirSync(dirname(archive), { recursive: true });
  writeFileSync(archive, text + '\n');
  console.log(text);

  const mail = mailEnv();
  const to = process.env.OWNER_EMAIL || DEMO_PROPERTY.email || mail?.to;
  if (mail && to) {
    await sendMail({ ...mail, to }, `Weather Mood · Εβδομαδιαία αναφορά ${weekStart} – ${weekEnd}`, text);
    console.log(`emailed weekly report to ${to}`);
  } else {
    console.log('SMTP not configured: files written, no email sent');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
