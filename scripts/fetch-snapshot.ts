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
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { fetchRaw, OUTLOOK_DAYS, outlookPlan, planPoints, type RawBundle } from '../src/engine/openmeteo';
import { athensDate } from '../src/engine/dates';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const plan = planPoints(SPOTS, REF_POINTS);
  const dates = [0, 1, 2].map((d) => athensDate(d));
  const days: Record<string, RawBundle> = {};
  for (const date of dates) {
    days[date] = await fetchRaw(plan, date, process.env.OPEN_METEO_API_KEY);
    console.log(`fetched ${date}: ${plan.land.length} land points, ${plan.marine.length} marine points`);
  }
  // 7-day outlook for the stay planner: reference points only, one multi-day request per endpoint
  let outlook: RawBundle | undefined;
  try {
    outlook = await fetchRaw(outlookPlan(REF_POINTS), dates[0], process.env.OPEN_METEO_API_KEY, fetch, athensDate(OUTLOOK_DAYS));
    console.log(`fetched outlook ${dates[0]} → ${athensDate(OUTLOOK_DAYS)} at ${REF_POINTS.length} reference points`);
  } catch (e) {
    console.warn('outlook fetch failed, snapshot keeps the 3 full days only', e);
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
