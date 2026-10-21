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
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { PROFILES } from '../src/data/profiles';
import { athensDate } from '../src/engine/dates';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { planSnapshot, type PlanSnapshot } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import type { ProfileId } from '../src/engine/types';
import { eveningMessage } from '../src/guest/evening';
import { DEMO_PROPERTY, GUEST_LANGS, type GuestLang } from '../src/guest/property';
import { mailEnv, sendMail } from './mail';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface EveningPack {
  date: string;
  generatedAt: string;
  basedOn: string;
  property: { id: string; name: string };
  plans: Partial<Record<ProfileId, PlanSnapshot>>;
  messages: Partial<Record<ProfileId, Record<GuestLang, string>>>;
}

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

async function main() {
  const date = process.argv[2] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[2]) ? process.argv[2] : athensDate(1);
  const snap = JSON.parse(readFileSync(join(root, 'public/data/snapshot-latest.json'), 'utf8')) as { generatedAt: string; days: Record<string, RawBundle> };
  const raw = snap.days[date];
  if (!raw) throw new Error(`snapshot has no forecast for ${date} (has ${Object.keys(snap.days).join(', ')})`);
  const pack = buildEveningPack(raw, date, snap.generatedAt);

  const latest = join(root, 'public/data/evening.json');
  writeFileSync(latest, JSON.stringify(pack, null, 1));
  const archive = join(root, `data/messages/${date}.json`);
  mkdirSync(dirname(archive), { recursive: true });
  writeFileSync(archive, JSON.stringify(pack, null, 1));
  console.log(`evening pack for ${date} from snapshot ${pack.basedOn}: ${Object.keys(pack.messages).length} profiles × ${GUEST_LANGS.length} languages`);
  console.log('---');
  console.log(pack.messages.couple?.el);

  const mail = mailEnv();
  if (mail) {
    const body = PROFILES.map((p) => `=== ${p.name.el} ===\n${pack.messages[p.id]?.el}\n`).join('\n');
    await sendMail(mail, `Weather Mood · Βραδινό μήνυμα για ${date}`, `Έτοιμα κείμενα για αποστολή στους επισκέπτες (αντιγραφή/επικόλληση σε WhatsApp ή email).\n\n${body}`);
    console.log(`emailed reception digest to ${mail.to}`);
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
