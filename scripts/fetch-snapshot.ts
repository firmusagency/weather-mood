/*
 * Fetches today / tomorrow / day-after forecasts for every Chania point and stores the raw
 * Open-Meteo responses:
 *   public/data/snapshot-latest.json      – what the demo app loads when live fetch is unavailable
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
import { fetchRaw, planPoints, type RawBundle } from '../src/engine/openmeteo';
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
  const snapshot = { generatedAt: new Date().toISOString(), days };

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
