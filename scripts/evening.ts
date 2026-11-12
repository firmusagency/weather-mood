/*
 * Evening run (~18:30 Athens): build tomorrow's plan for every guest profile from the latest
 * snapshot, write the ready-to-send messages in 4 languages, and email the reception a digest
 * when SMTP is configured.
 *
 *   public/data/evening.json       latest evening pack (dashboard "Βραδινό μήνυμα" shows the same text live)
 *   data/messages/<date>.json      archive; the morning check compares against it
 *
 * Usage: npm run evening            (after npm run snapshot:fetch)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
import { planSnapshot, type PlanSnapshot } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import type { ProfileId } from '../src/engine/types';
import { eveningMessage } from '../src/guest/evening';
import { DEMO_PROPERTY, GUEST_LANGS, PROPERTIES, propertyById, type GuestLang, type Property } from '../src/guest/property';
import type { Delivery } from '../src/engine/health';
import { mailEnv, sendMail } from './mail';
import { notificationFromMessage, pushEnv, pushMissing, sendPush } from './push';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Oldest forecast an evening message or a plan-B check may be built on. */
export const MAX_FORECAST_AGE_H = 20;

/** What one property gets: its own picks (travel times start at its door) and its own texts. */
export interface EveningPart {
  property: { id: string; name: string };
  plans: Partial<Record<ProfileId, PlanSnapshot>>;
  messages: Partial<Record<ProfileId, Record<GuestLang, string>>>;
}

/** The top level is the first (default) property, as it always was; the others sit in `others`. */
export interface EveningPack extends EveningPart {
  date: string;
  generatedAt: string;
  basedOn: string;
  others?: Record<string, EveningPart>;
}

/** Every property's part of a pack, the default one first. */
export const eveningParts = (pack: EveningPack): EveningPart[] => [{ property: pack.property, plans: pack.plans, messages: pack.messages }, ...Object.values(pack.others ?? {})];
export const eveningPartFor = (pack: EveningPack, propertyId: string) => eveningParts(pack).find((p) => p.property.id === propertyId);

export function buildEveningPack(raw: RawBundle, date: string, basedOn: string, property = DEMO_PROPERTY, now = new Date()): EveningPack {
  const data = datasetFromRaw(raw, 'snapshot');
  const syn = buildSynopsis(data, REF_POINTS);
  const pack: EveningPack = { date, generatedAt: now.toISOString(), basedOn, property: { id: property.id, name: property.name }, plans: {}, messages: {} };
  for (const p of PROFILES) {
    const day = analyzeDay(SPOTS, data, p.id, property.base, { daysAhead: 1 });
    const rec = recommend(SPOTS, day.scores);
    pack.plans[p.id] = planSnapshot(date, p.id, rec, syn, pack.generatedAt);
    const msgs = {} as Record<GuestLang, string>;
    for (const lang of GUEST_LANGS) msgs[lang] = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, p.id, lang);
    pack.messages[p.id] = msgs;
  }
  return pack;
}

/** One pack for all properties: the first at the top level, the rest under `others`. */
export function buildEveningAll(raw: RawBundle, date: string, basedOn: string, properties: Property[] = PROPERTIES, now = new Date()): EveningPack {
  const [first, ...rest] = properties;
  const pack = buildEveningPack(raw, date, basedOn, first, now);
  if (rest.length) {
    pack.others = {};
    for (const p of rest) {
      const { property, plans, messages } = buildEveningPack(raw, date, basedOn, p, now);
      pack.others[p.id] = { property, plans, messages };
    }
  }
  return pack;
}

async function main() {
  const date = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : athensDate(1);
  const snap = JSON.parse(readFileSync(join(root, 'public/data/snapshot-latest.json'), 'utf8')) as { generatedAt: string; days: Record<string, RawBundle> };
  const raw = snap.days[date];
  if (!raw) throw new Error(`snapshot has no forecast for ${date} (has ${Object.keys(snap.days).join(', ')})`);
  // when the fresh fetch failed the workflow carries on with the last snapshot: fine for a few hours, not for a day
  const ageH = (Date.now() - Date.parse(snap.generatedAt)) / 3_600_000;
  console.log(`using the forecast fetched ${ageH.toFixed(1)} h ago (${snap.generatedAt})`);
  if (ageH > MAX_FORECAST_AGE_H) throw new Error(`the newest forecast is ${ageH.toFixed(0)} h old (limit ${MAX_FORECAST_AGE_H} h): no message is better than a stale one`);
  const pack = buildEveningAll(raw, date, snap.generatedAt);

  const latest = join(root, 'public/data/evening.json');
  writeFileSync(latest, JSON.stringify(pack, null, 1));
  const archive = join(root, `data/messages/${date}.json`);
  mkdirSync(dirname(archive), { recursive: true });
  writeFileSync(archive, JSON.stringify(pack, null, 1));
  console.log(`evening pack for ${date} from snapshot ${pack.basedOn}: ${eveningParts(pack).length} propert${eveningParts(pack).length === 1 ? 'y' : 'ies'} × ${Object.keys(pack.messages).length} profiles × ${GUEST_LANGS.length} languages`);
  console.log('---');
  console.log(pack.messages.couple?.el);

  const delivery: Delivery = { kind: 'evening', date, at: new Date().toISOString(), push: { state: 'off', reason: pushMissing().join('; ') || 'not configured' }, email: { state: 'off', reason: 'SMTP not configured' } };
  const push = pushEnv();
  if (push) {
    // notifications are a courtesy: whatever goes wrong here, the message files must still be committed
    try {
      // each property's subscribers get that property's picks and a link back to its own page
      const total = { sent: 0, failed: 0, removed: 0 };
      for (const part of eveningParts(pack)) {
        const property = propertyById(part.property.id);
        if (!property) continue;
        const r = await sendPush(push, property.id, (sub) => {
          const lang = (GUEST_LANGS as readonly string[]).includes(sub.lang ?? '') ? (sub.lang as GuestLang) : 'en';
          const profile = (sub.profile && part.messages[sub.profile as ProfileId] ? sub.profile : 'couple') as ProfileId;
          const msg = part.messages[profile]?.[lang];
          return msg ? { title: `${property.name} · ${lang === 'el' ? 'Αύριο' : lang === 'de' ? 'Morgen' : lang === 'fr' ? 'Demain' : 'Tomorrow'}`, body: notificationFromMessage(msg), url: property.guestUrl, tag: `evening-${date}` } : null;
        });
        total.sent += r.sent;
        total.failed += r.failed;
        total.removed += r.removed;
      }
      const r = total;
      console.log(`push: ${r.sent} sent, ${r.failed} failed, ${r.removed} removed`);
      delivery.push = { state: 'sent', ...r };
    } catch (e) {
      delivery.push = { state: 'failed', reason: (e as Error).message };
      console.error(`push FAILED, message still published: ${(e as Error).message}`);
    }
  } else {
    console.log(`push NOT sent, missing: ${pushMissing().join(', ')}`);
  }

  const mail = mailEnv();
  if (mail) {
    const body = PROFILES.map((p) => `=== ${p.name.el} ===\n${pack.messages[p.id]?.el}\n`).join('\n');
    try {
      await sendMail(mail, `Weather Mood · Βραδινό μήνυμα για ${date}`, `Έτοιμα κείμενα για αποστολή στους επισκέπτες (αντιγραφή/επικόλληση σε WhatsApp ή email).\n\n${body}`);
      console.log(`emailed reception digest to ${mail.to}`);
      // the other properties' receptions get their own texts at their own address
      for (const part of eveningParts(pack).slice(1)) {
        const to = propertyById(part.property.id)?.email;
        if (!to) continue;
        const own = PROFILES.map((p) => `=== ${p.name.el} ===\n${part.messages[p.id]?.el}\n`).join('\n');
        await sendMail({ ...mail, to }, `Weather Mood · Βραδινό μήνυμα για ${date} · ${part.property.name}`, `Έτοιμα κείμενα για αποστολή στους επισκέπτες (αντιγραφή/επικόλληση σε WhatsApp ή email).\n\n${own}`);
        console.log(`emailed ${part.property.name} at ${to}`);
      }
      delivery.email = { state: 'sent' };
    } catch (e) {
      delivery.email = { state: 'failed', reason: (e as Error).message };
      console.error(`email FAILED, message still published: ${(e as Error).message}`);
    }
  } else {
    console.log('SMTP not configured: files written, no email sent');
  }
  // what happened to the notifications, for the health check (names and counts only)
  writeFileSync(join(root, 'public/data/delivery.json'), JSON.stringify(delivery, null, 1));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
