/*
 * Fetches today / tomorrow / day-after forecasts for every Chania point and stores the raw
 * Open-Meteo responses:
 *   public/data/snapshot-latest.json      – what the demo app loads when live fetch is unavailable
 *                                           (days 0–2 in full, plus a 7-day outlook at the reference points)
 *   data/archive/YYYY-MM-DD.json          – one forecast per day (the next-day forecast), kept so
 *                                           we can later compare forecasts with what really happened
 *
 * Usage: npm run snapshot:fetch            (needs internet access to open-meteo.com)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { fetchRaw, OUTLOOK_DAYS, outlookPlan, planPoints, type RawBundle } from '../src/engine/openmeteo';
import { athensDate } from '../src/engine/dates';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The outlook of the snapshot already on disk, when it is at most `maxAgeH` hours old. */
export function previousOutlook(file: string, maxAgeH = 30, now = Date.now()): RawBundle | undefined {
  try {
    const prev = JSON.parse(readFileSync(file, 'utf8')) as { outlook?: RawBundle };
    const at = Date.parse(prev.outlook?.fetchedAt ?? '');
    return prev.outlook && Number.isFinite(at) && now - at <= maxAgeH * 3_600_000 ? prev.outlook : undefined;
  } catch {
    return undefined;
  }
}

async function main() {
  const plan = planPoints(SPOTS, REF_POINTS);
  const dates = [0, 1, 2].map((d) => athensDate(d));
  const days: Record<string, RawBundle> = {};
  // Open-Meteo's free tier counts requests per minute (every location and every 10 variables×models
  // count), and one day of ours is close to half that budget: fired back to back, the last request
  // of the run (the 7-day outlook) was refused with 429 on every run from 8 to 12 Nov 2026. So the
  // days are spaced out, and every request retries.
  const pace = Number(process.env.SNAPSHOT_PACE_MS ?? 25_000);
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const opts = { retries: 6, log: (m: string) => console.warn(`  ${m}`) };
  for (const [i, date] of dates.entries()) {
    if (i > 0 && pace > 0) await sleep(pace);
    days[date] = await fetchRaw(plan, date, process.env.OPEN_METEO_API_KEY, fetch, date, opts);
    console.log(`fetched ${date}: ${plan.land.length} land points, ${plan.marine.length} marine points`);
  }
  // 7-day outlook for the stay planner: reference points only, one multi-day request per endpoint
  let outlook: RawBundle | undefined;
  try {
    if (pace > 0) await sleep(pace);
    outlook = await fetchRaw(outlookPlan(REF_POINTS), dates[0], process.env.OPEN_METEO_API_KEY, fetch, athensDate(OUTLOOK_DAYS), opts);
    console.log(`fetched outlook ${dates[0]} → ${athensDate(OUTLOOK_DAYS)} at ${REF_POINTS.length} reference points`);
  } catch (e) {
    // days 4–7 change slowly: an outlook from an earlier run today is far better than none
    const kept = previousOutlook(join(root, 'public/data/snapshot-latest.json'));
    if (kept) {
      outlook = kept;
      console.warn(`outlook fetch failed (${(e as Error).message}); keeping the outlook fetched at ${kept.fetchedAt}`);
    } else {
      console.warn('outlook fetch failed and there is no recent one to keep: the snapshot has the 3 full days only', e);
    }
  }
  const snapshot = { generatedAt: new Date().toISOString(), days, ...(outlook ? { outlook } : {}) };

  const latest = join(root, 'public/data/snapshot-latest.json');
  mkdirSync(dirname(latest), { recursive: true });
  writeFileSync(latest, JSON.stringify(snapshot));

  const archive = join(root, `data/archive/${dates[1]}.json`);
  mkdirSync(dirname(archive), { recursive: true });
  writeFileSync(archive, JSON.stringify(days[dates[1]]));
  console.log(`wrote ${latest} and ${archive}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
