/*
 * Morning check (~05:50 Athens): rebuild today's plan with the fresh snapshot and compare it with
 * the evening message we sent yesterday (data/messages/<today>.json). If the picture moved in a way
 * a guest would care about, write the "plan B" note and email the reception.
 *
 *   public/data/plan-b.json      today's verdict (dashboard shows a banner when changed)
 *
 * Usage: npm run morning-check     (after npm run snapshot:fetch)
 */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS as BASE_SPOTS } from '../src/data/spots';
import { adjustSpots } from '../src/engine/adjust';
import { readAdjustments } from './adjustments';

// the same corrections the pages apply: guest-feedback waves, station gusts, official closures
const SPOTS = adjustSpots(BASE_SPOTS, readAdjustments());
import { REF_POINTS } from '../src/data/region';
import { PROFILES } from '../src/data/profiles';
import { athensDate } from '../src/engine/dates';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { comparePlans, planSnapshot, type PlanDiff } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import type { ProfileId } from '../src/engine/types';
import { planBMessage } from '../src/guest/evening';
import { DEMO_PROPERTY, GUEST_LANGS, PROPERTIES, propertyById, type GuestLang, type Property } from '../src/guest/property';
import { eveningParts, type EveningPack } from './evening';
import { athensClock, type Delivery } from '../src/engine/health';
import { mailEnv, sendMail } from './mail';
import { notificationFromMessage, pushEnv, pushMissing, sendPush } from './push';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface PlanBReport {
  date: string;
  checkedAt: string;
  eveningGeneratedAt: string | null;
  changed: boolean;
  byProfile: PlanBByProfile;
  /** When the guests' notification went out (08:30 run); absent until then. */
  pushedAt?: string;
  /** The first (default) property, which the top level describes; absent in reports written before Nov 2026. */
  property?: { id: string; name: string };
  /** The other properties, each compared with its own evening message. */
  others?: Record<string, PlanBPart>;
}

export type PlanBByProfile = Partial<Record<ProfileId, { diff: PlanDiff; messages: Record<GuestLang, string> | null }>>;
export interface PlanBPart {
  property: { id: string; name: string };
  changed: boolean;
  byProfile: PlanBByProfile;
}

/** Every property's verdict, the default one first. */
export const planBParts = (r: PlanBReport): PlanBPart[] => [{ property: r.property ?? { id: DEMO_PROPERTY.id, name: DEMO_PROPERTY.name }, changed: r.changed, byProfile: r.byProfile }, ...Object.values(r.others ?? {})];

export function buildPlanB(pack: EveningPack, raw: RawBundle, property = DEMO_PROPERTY, now = new Date()): PlanBReport {
  const data = datasetFromRaw(raw, 'snapshot');
  const syn = buildSynopsis(data, REF_POINTS);
  const report: PlanBReport = { date: pack.date, checkedAt: now.toISOString(), eveningGeneratedAt: pack.generatedAt, changed: false, byProfile: {}, property: { id: property.id, name: property.name } };
  for (const p of PROFILES) {
    const before = pack.plans[p.id];
    if (!before) continue;
    const day = analyzeDay(SPOTS, data, p.id, property.base, { daysAhead: 0 });
    const after = planSnapshot(pack.date, p.id, recommend(SPOTS, day.scores), syn, report.checkedAt);
    const diff = comparePlans(before, after);
    let messages: Record<GuestLang, string> | null = null;
    if (diff.significant) {
      report.changed = true;
      messages = {} as Record<GuestLang, string>;
      for (const lang of GUEST_LANGS) messages[lang] = planBMessage(diff, property, lang);
    }
    report.byProfile[p.id] = { diff, messages };
  }
  return report;
}

/** The check for every property in the evening pack: the default at the top level, the rest under `others`. */
export function buildPlanBAll(pack: EveningPack, raw: RawBundle, properties: Property[] = PROPERTIES, now = new Date()): PlanBReport {
  const report = buildPlanB(pack, raw, properties[0], now);
  for (const part of eveningParts(pack).slice(1)) {
    const property = propertyById(part.property.id, properties);
    if (!property) continue; // a property removed since last night
    const r = buildPlanB({ ...pack, ...part }, raw, property, now);
    (report.others ??= {})[property.id] = { property: part.property, changed: r.changed, byProfile: r.byProfile };
  }
  return report;
}

/** Athens hours between which the plan-B notification may go out (a delayed job must not send it at noon or at night). */
export const SEND_WINDOW = { from: 7.5, to: 11, label: '08:30' };

/** Should the 08:30 run notify the guests? Pure, so the rules are tested. */
export function shouldSendPlanB(report: PlanBReport | null, now = new Date()): { send: boolean; why: string } {
  if (!report) return { send: false, why: 'there is no plan-B report' };
  if (report.date !== athensDate(0, now)) return { send: false, why: `the last check is for ${report.date}, not today` };
  if (!planBParts(report).some((p) => p.changed)) return { send: false, why: 'the weather did not change: nothing to tell the guests' };
  if (report.pushedAt) return { send: false, why: `already sent at ${report.pushedAt}` };
  const clock = athensClock(now);
  if (clock < SEND_WINDOW.from || clock >= SEND_WINDOW.to) return { send: false, why: `it is ${clock.toFixed(1)} h in Athens, outside ${SEND_WINDOW.from}–${SEND_WINDOW.to}` };
  return { send: true, why: 'plan B found this morning and not yet sent' };
}

/** The 08:30 run: notify the guests about the plan B the 05:50 check found. */
async function sendPlanB() {
  const out = join(root, 'public/data/plan-b.json');
  const report = existsSync(out) ? (JSON.parse(readFileSync(out, 'utf8')) as PlanBReport) : null;
  const decision = shouldSendPlanB(report);
  console.log(`plan-B notification: ${decision.send ? 'sending' : 'not sending'} (${decision.why})`);
  if (!decision.send || !report) return;
  const delivery: Delivery = { kind: 'planB', date: report.date, at: new Date().toISOString(), push: { state: 'off', reason: pushMissing().join('; ') || 'not configured' }, email: { state: 'off', reason: 'the reception email goes with the 05:50 check' } };
  const push = pushEnv();
  if (push) {
    try {
      const r = { sent: 0, failed: 0, removed: 0, lapsed: 0 };
      for (const part of planBParts(report).filter((p) => p.changed)) {
        const property = propertyById(part.property.id);
        if (!property) continue;
        const one = await sendPush(push, property.id, (sub) => {
          const lang = (GUEST_LANGS as readonly string[]).includes(sub.lang ?? '') ? (sub.lang as GuestLang) : 'en';
          const profile = (sub.profile && part.byProfile[sub.profile as ProfileId] ? sub.profile : 'couple') as ProfileId;
          const msg = part.byProfile[profile]?.messages?.[lang];
          return msg ? { title: `${property.name} · Plan B`, body: notificationFromMessage(msg), url: property.guestUrl, tag: `planb-${report.date}` } : null;
        });
        r.sent += one.sent;
        r.failed += one.failed;
        r.removed += one.removed;
        r.lapsed += one.lapsed;
      }
      console.log(`push: ${r.sent} sent, ${r.failed} failed, ${r.removed} removed`);
      delivery.push = { state: 'sent', ...r };
      // marked as sent even with zero subscribers, so a re-run does not try again
      writeFileSync(out, JSON.stringify({ ...report, pushedAt: delivery.at } satisfies PlanBReport, null, 1));
    } catch (e) {
      delivery.push = { state: 'failed', reason: (e as Error).message };
      console.error(`push FAILED: ${(e as Error).message}`);
    }
  } else {
    console.log(`push NOT sent, missing: ${pushMissing().join(', ')}`);
  }
  writeFileSync(join(root, 'public/data/delivery.json'), JSON.stringify(delivery, null, 1));
}

async function main() {
  if (process.argv.includes('--send')) return sendPlanB();
  const date = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : athensDate(0);
  const out = join(root, 'public/data/plan-b.json');
  const packFile = join(root, `data/messages/${date}.json`);
  if (!existsSync(packFile)) {
    writeFileSync(out, JSON.stringify({ date, checkedAt: new Date().toISOString(), eveningGeneratedAt: null, changed: false, byProfile: {} } satisfies PlanBReport, null, 1));
    console.log(`no evening message was made for ${date}; nothing to compare`);
    return;
  }
  const pack = JSON.parse(readFileSync(packFile, 'utf8')) as EveningPack;
  const snap = JSON.parse(readFileSync(join(root, 'public/data/snapshot-latest.json'), 'utf8')) as { generatedAt: string; days: Record<string, RawBundle> };
  const raw = snap.days[date];
  if (!raw) throw new Error(`snapshot has no forecast for ${date}`);
  const ageH = (Date.now() - Date.parse(snap.generatedAt)) / 3_600_000;
  console.log(`using the forecast fetched ${ageH.toFixed(1)} h ago (${snap.generatedAt})`);
  // A check against the very forecast the evening message used would always say "no change". Write
  // nothing in that case: plan-b.json keeps yesterday's date, so the second-chance run tries again.
  if (Date.parse(snap.generatedAt) <= Date.parse(pack.basedOn)) {
    console.warn('no forecast newer than the evening message (the fetch failed?): plan B not checked');
    return;
  }
  const report = buildPlanBAll(pack, raw);
  writeFileSync(out, JSON.stringify(report, null, 1));
  const others = Object.fromEntries(Object.entries(report.others ?? {}).map(([id, p]) => [id, p.changed]));
  appendFileSync(join(root, 'data/plan-b-log.jsonl'), JSON.stringify({ date: report.date, checkedAt: report.checkedAt, changed: report.changed, ...(Object.keys(others).length ? { properties: others } : {}) }) + '\n');
  for (const part of planBParts(report).slice(1)) console.log(`${part.property.name}: ${part.changed ? 'CHANGED' : 'same'}`);

  for (const [profile, r] of Object.entries(report.byProfile)) {
    console.log(`${profile}: ${r.diff.significant ? 'CHANGED' : 'same'} ${r.diff.changes.map((c) => c.kind).join(',') || '-'}`);
  }
  // Guests are not woken at 05:50: the check is early so the reception sees the change on the dashboard,
  // and the notification goes out with the 08:30 run (`--send`, see sendPlanB below).
  if (planBParts(report).some((p) => p.changed)) console.log(`plan B needed: the guests' notification goes out at ${SEND_WINDOW.label}`);

  const mail = mailEnv();
  if (report.changed && mail) {
    const body = Object.entries(report.byProfile)
      .filter(([, r]) => r.messages)
      .map(([profile, r]) => `=== ${PROFILES.find((p) => p.id === profile)?.name.el} ===\n${r.messages!.el}\n`)
      .join('\n');
    try {
      await sendMail(mail, `Weather Mood · Plan B για σήμερα ${date}`, `Ο καιρός άλλαξε σε σχέση με το βραδινό μήνυμα. Έτοιμα κείμενα:\n\n${body}`);
      console.log(`emailed plan B to ${mail.to}`);
    } catch (e) {
      console.error(`email FAILED, plan B still published: ${(e as Error).message}`);
    }
  } else if (report.changed) {
    console.log('plan B needed, SMTP not configured: file written only');
  }
  if (mail) {
    for (const part of planBParts(report).slice(1).filter((p) => p.changed)) {
      const to = propertyById(part.property.id)?.email;
      if (!to) continue;
      const body = Object.entries(part.byProfile)
        .filter(([, r]) => r.messages)
        .map(([profile, r]) => `=== ${PROFILES.find((p) => p.id === profile)?.name.el} ===\n${r.messages!.el}\n`)
        .join('\n');
      try {
        await sendMail({ ...mail, to }, `Weather Mood · Plan B για σήμερα ${date} · ${part.property.name}`, `Ο καιρός άλλαξε σε σχέση με το βραδινό μήνυμα. Έτοιμα κείμενα:\n\n${body}`);
        console.log(`emailed plan B to ${to}`);
      } catch (e) {
        console.error(`email FAILED for ${part.property.name}: ${(e as Error).message}`);
      }
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
