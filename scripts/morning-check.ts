/*
 * Morning check (~05:50 Athens): rebuild today's plan with the fresh snapshot and compare it with
 * the evening message we sent yesterday (data/messages/<today>.json). If the picture moved in a way
 * a guest would care about, write the "plan B" note and email the reception.
 *
 *   public/data/plan-b.json      today's verdict (dashboard shows a banner when changed)
 *
 * Usage: npm run morning-check     (after npm run snapshot:fetch)
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { PROFILES } from '../src/data/profiles';
import { athensDate } from '../src/engine/dates';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { comparePlans, planSnapshot, type PlanDiff } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import type { ProfileId } from '../src/engine/types';
import { planBMessage } from '../src/guest/evening';
import { DEMO_PROPERTY, GUEST_LANGS, type GuestLang } from '../src/guest/property';
import type { EveningPack } from './evening';
import { mailEnv, sendMail } from './mail';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export interface PlanBReport {
  date: string;
  checkedAt: string;
  eveningGeneratedAt: string | null;
  changed: boolean;
  byProfile: Partial<Record<ProfileId, { diff: PlanDiff; messages: Record<GuestLang, string> | null }>>;
}

export function buildPlanB(pack: EveningPack, raw: RawBundle, property = DEMO_PROPERTY, now = new Date()): PlanBReport {
  const data = datasetFromRaw(raw, 'snapshot');
  const syn = buildSynopsis(data, REF_POINTS);
  const report: PlanBReport = { date: pack.date, checkedAt: now.toISOString(), eveningGeneratedAt: pack.generatedAt, changed: false, byProfile: {} };
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

async function main() {
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
  const report = buildPlanB(pack, raw);
  writeFileSync(out, JSON.stringify(report, null, 1));

  for (const [profile, r] of Object.entries(report.byProfile)) {
    console.log(`${profile}: ${r.diff.significant ? 'CHANGED' : 'same'} ${r.diff.changes.map((c) => c.kind).join(',') || '-'}`);
  }
  const mail = mailEnv();
  if (report.changed && mail) {
    const body = Object.entries(report.byProfile)
      .filter(([, r]) => r.messages)
      .map(([profile, r]) => `=== ${PROFILES.find((p) => p.id === profile)?.name.el} ===\n${r.messages!.el}\n`)
      .join('\n');
    await sendMail(mail, `Weather Mood · Plan B για σήμερα ${date}`, `Ο καιρός άλλαξε σε σχέση με το βραδινό μήνυμα. Έτοιμα κείμενα:\n\n${body}`);
    console.log(`emailed plan B to ${mail.to}`);
  } else if (report.changed) {
    console.log('plan B needed, SMTP not configured: file written only');
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
