/*
 * Nightly feedback export: pulls guest/reception votes and anonymous visit pings from the database
 * (service key, read-only use), joins each vote with the forecast we had issued for that place and
 * day (data/archive/<date>.json), and writes:
 *   data/feedback/rows.jsonl          every vote with its forecast join (the training set)
 *   public/data/feedback.json         aggregates for the dashboard ("what guests said")
 *   public/data/calibration.json      bounded per-spot wave adjustments (see src/engine/feedback.ts)
 *
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_KEY=... npm run feedback:export
 *        npm run feedback:export -- --from-file rows.json   # offline: rows already fetched
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { calibrate, forecastAtVisit, summarizeFeedback, visitStats, type FeedbackRow, type JoinedRow } from '../src/engine/feedback';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { analyzeDay } from '../src/engine/recommend';
import type { Dataset, ProfileId } from '../src/engine/types';
import { PROFILES } from '../src/data/profiles';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROWS = join(root, 'data/feedback/rows.jsonl');
const SUMMARY = join(root, 'public/data/feedback.json');
const CALIB = join(root, 'public/data/calibration.json');
const VISIT_DAYS = 30;

interface VisitRow {
  created_at: string;
  view: string;
  lang: string | null;
  profile: string | null;
}

async function fetchAll<T>(table: string, query: string): Promise<T[]> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, authorization: `Bearer ${key}`, range: `${from}-${from + page - 1}`, 'range-unit': 'items' },
    });
    if (!res.ok) throw new Error(`${table} ${res.status}: ${await res.text()}`);
    const rows = (await res.json()) as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const PROFILE_IDS = new Set<string>(PROFILES.map((p) => p.id));
const datasets = new Map<string, Dataset | null>();

function datasetFor(date: string): Dataset | null {
  if (datasets.has(date)) return datasets.get(date)!;
  const file = join(root, `data/archive/${date}.json`);
  let ds: Dataset | null = null;
  if (existsSync(file)) {
    try {
      ds = datasetFromRaw(JSON.parse(readFileSync(file, 'utf8')) as RawBundle, 'snapshot');
    } catch (e) {
      console.warn(`archive ${date} unreadable`, e);
    }
  }
  datasets.set(date, ds);
  return ds;
}

const analyses = new Map<string, ReturnType<typeof analyzeDay>>();

/** What we said about that spot on that day, as the next-day forecast for that profile. */
export function joinRow(r: FeedbackRow): JoinedRow {
  const ds = datasetFor(r.visit_date);
  if (!ds) return { ...r, forecast: null };
  const profile: ProfileId = r.profile && PROFILE_IDS.has(r.profile) ? r.profile : 'couple';
  const key = `${r.visit_date}:${profile}`;
  let day = analyses.get(key);
  if (!day) {
    day = analyzeDay(SPOTS, ds, profile, BASES[0], { daysAhead: 1 });
    analyses.set(key, day);
  }
  const sc = day.scores[r.spot_id];
  const conds = day.conditions[r.spot_id];
  if (!sc || !conds) return { ...r, forecast: null };
  const inWindow = conds.filter((c) => c.hour >= sc.window.start && c.hour <= sc.window.end);
  const seaHours = inWindow.filter((c) => c.sea);
  const maxWave = seaHours.length ? Math.round(Math.max(...seaHours.map((c) => c.sea!.effectiveWave)) * 100) / 100 : null;
  const maxGust = inWindow.length ? Math.round(Math.max(...inWindow.map((c) => c.effectiveGust))) : null;
  return { ...r, forecast: forecastAtVisit(sc, maxWave, maxGust) };
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--from-file');
  let feedback: FeedbackRow[];
  let visits: VisitRow[];
  if (fileIdx >= 0) {
    const j = JSON.parse(readFileSync(args[fileIdx + 1], 'utf8')) as { feedback: FeedbackRow[]; visits?: VisitRow[] };
    feedback = j.feedback;
    visits = j.visits ?? [];
  } else {
    const since = new Date(Date.now() - VISIT_DAYS * 86_400_000).toISOString();
    [feedback, visits] = await Promise.all([
      fetchAll<FeedbackRow>('feedback', 'select=id,created_at,property_id,source,visit_date,spot_id,verdict,tag,profile,lang,note,party_size&client_id=not.like.test-*&order=created_at.asc'),
      fetchAll<VisitRow>('visits', `select=created_at,view,lang,profile&created_at=gte.${since}&order=created_at.asc`),
    ]);
  }

  const known = new Set(SPOTS.map((s) => s.id));
  const rows = feedback.filter((r) => known.has(r.spot_id)).map(joinRow);
  const summary = summarizeFeedback(rows, visitStats(visits, VISIT_DAYS));
  const calib = calibrate(rows);

  mkdirSync(dirname(ROWS), { recursive: true });
  writeFileSync(ROWS, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  writeFileSync(SUMMARY, JSON.stringify(summary, null, 1));
  writeFileSync(CALIB, JSON.stringify(calib, null, 1));

  const joined = rows.filter((r) => r.forecast).length;
  console.log(`${rows.length} votes (${joined} joined with a forecast), ${visits.length} visits in ${VISIT_DAYS} days`);
  console.log(`agreement guest/forecast: ${summary.agreeRate == null ? '–' : Math.round(summary.agreeRate * 100) + '%'} over ${summary.judged} judged votes`);
  for (const s of summary.bySpot.slice(0, 10)) console.log(`  ${s.spotId}: ${s.n} votes, 👍 ${s.up} 👎 ${s.down}, disagree ${s.disagree}/${s.judged}`);
  const adj = Object.entries(calib.spots);
  console.log(adj.length ? `calibration: ${adj.map(([id, c]) => `${id}×${c.waveFactor}`).join(', ')}` : 'calibration: nothing to adjust yet');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
