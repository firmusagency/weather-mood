/*
 * Official Samaria status: reads the park's ticket page each morning and evening, records whether the
 * National Park is closed (off season or a weather decision by OFYPEKA) and for which dates, and makes
 * it available to the engine: a closed park is "unsuitable" whatever our forecast says.
 *
 *   public/data/closures.json      current closures per spot (the pages and the scripts read this)
 *   data/closures/log.jsonl         one row per check (the authority's notice, verbatim)
 *
 * Usage: npm run samaria:status              (network)   ·   -- --html file.html   (offline)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { athensDate } from '../src/engine/dates';
import { parseSamariaPage, SAMARIA_TICKETS_URL, type Closures } from '../src/engine/closures';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(root, 'public/data/closures.json');
const LOG = join(root, 'data/closures/log.jsonl');

export function readClosures(file = FILE): Closures | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Closures;
  } catch {
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const htmlIdx = args.indexOf('--html');
  const today = athensDate(0);
  let html: string;
  if (htmlIdx >= 0) html = readFileSync(args[htmlIdx + 1], 'utf8');
  else {
    const res = await fetch(SAMARIA_TICKETS_URL, { headers: { 'user-agent': 'Mozilla/5.0 (compatible; weather-mood/1.0; +https://github.com/firmusagency/weather-mood)' }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`samaria tickets page: HTTP ${res.status}`);
    html = await res.text();
  }
  const status = parseSamariaPage(html, today);
  const checkedAt = new Date().toISOString();
  const current = readClosures() ?? { checkedAt: null, spots: {} };
  const closures: Closures = {
    checkedAt,
    spots: { ...current.spots, samaria: { ranges: status.ranges, notice: status.notice, source: SAMARIA_TICKETS_URL, checkedAt } },
  };
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(closures, null, 1));
  mkdirSync(dirname(LOG), { recursive: true });
  appendFileSync(LOG, JSON.stringify({ checkedAt, date: today, spot: 'samaria', notice: status.notice, ranges: status.ranges, firstBookable: status.firstBookable }) + '\n');
  const closedToday = status.ranges.some((r) => today >= r.from && today <= r.to);
  console.log(`samaria ${today}: ${closedToday ? 'CLOSED' : 'open'} · ${status.notice ?? 'no notice'} · first bookable ${status.firstBookable ?? '-'}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
