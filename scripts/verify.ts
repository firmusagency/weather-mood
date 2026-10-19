/*
 * Nightly forecast verification: compares the forecast issued the day before (data/archive/<date>.json)
 * with what Chania airport (LGSA) actually measured, appends one row to data/verification/log.jsonl
 * and refreshes the rolling summary (public/data/verification.json + data/verification/summary.md).
 *
 * Usage:
 *   npm run verify                      # yesterday (Europe/Athens)
 *   npm run verify -- 2026-10-18        # a specific day (needs data/archive/2026-10-18.json)
 *   npm run verify -- 2026-10-18 --metar-file path.txt   # use saved METAR text instead of fetching
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { athensDate } from '../src/engine/dates';
import { hourlyObs, parseMetars } from '../src/engine/metar';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { MODEL_LABELS, MODELS } from '../src/engine/types';
import { STATION, summarize, verifyDay, type VerificationRow } from '../src/engine/verify';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = join(root, 'data/verification/log.jsonl');
const SUMMARY_JSON = join(root, 'public/data/verification.json');
const SUMMARY_MD = join(root, 'data/verification/summary.md');

async function fetchMetar(hours: number): Promise<string> {
  const url = `https://aviationweather.gov/api/data/metar?ids=${STATION.id}&hours=${hours}&format=raw`;
  const res = await fetch(url, { headers: { 'user-agent': 'weather-mood-verify/1.0' } });
  if (!res.ok) throw new Error(`METAR ${res.status}`);
  return res.text();
}

function readLog(): VerificationRow[] {
  if (!existsSync(LOG)) return [];
  return readFileSync(LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as VerificationRow);
}

function writeSummary(rows: VerificationRow[]) {
  const s = summarize(rows);
  mkdirSync(dirname(SUMMARY_JSON), { recursive: true });
  writeFileSync(SUMMARY_JSON, JSON.stringify(s, null, 1));
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const md = [
    `# Έλεγχος πρόγνωσης vs σταθμός ${STATION.id} (${STATION.name})`,
    '',
    `Ενημέρωση: ${s.updatedAt} · ${s.days} ημέρες (${s.from} → ${s.to})`,
    '',
    '| Μέτρο | Τιμή |',
    '|---|---|',
    `| Μέσο σφάλμα ανέμου | ${s.wind.mae} km/h (bias ${s.wind.bias >= 0 ? '+' : ''}${s.wind.bias}) |`,
    `| Bias ανέμου 13:00–18:00 | ${s.wind.afternoonBias ?? '–'} km/h |`,
    `| Μέσο σφάλμα διεύθυνσης (άνεμος ≥ 8 km/h) | ${s.wind.dirMae ?? '–'}° |`,
    `| Μέσο σφάλμα μέγιστης ριπής | ${s.gustMaeMax} km/h |`,
    `| Μέσο σφάλμα θερμοκρασίας | ${s.temp.mae ?? '–'} °C (bias ${s.temp.bias ?? '–'}) |`,
    `| Μέγιστο Beaufort σωστό ±1 | ${pct(s.bfWithin1Rate)} |`,
    `| Βροχή ναι/όχι σωστά | ${pct(s.rainAgreeRate)} |`,
    '',
    '## Ποιο μοντέλο ανέμου πέφτει πιο κοντά',
    '',
    '| Μοντέλο | Μέσο σφάλμα | Ημέρες |',
    '|---|---|---|',
    ...s.perModel.map((m) => `| ${MODEL_LABELS[m.model]} | ${m.mae ?? '–'} km/h | ${m.days} |`),
    '',
    '## Τελευταίες ημέρες',
    '',
    '| Ημέρα | Σφάλμα ανέμου | Bf πρόγν./πραγμ. | Ριπή πρόγν./πραγμ. | Θερμ. max πρόγν./πραγμ. | Βροχή |',
    '|---|---|---|---|---|---|',
    ...s.recent.map(
      (r) =>
        `| ${r.date} | ${r.wind.mae} km/h | ${r.bf.forecastMax}/${r.bf.observedMax} ${r.bf.within1 ? '✓' : '✗'} | ${r.gust.forecastMax}/${r.gust.observedMax} | ${r.temp.forecastMax ?? '–'}/${r.temp.observedMax ?? '–'} | ${r.rain.observed ? 'ναι' : 'όχι'} ${r.rain.agree ? '✓' : '✗'} |`,
    ),
    '',
  ].join('\n');
  writeFileSync(SUMMARY_MD, md);
}

async function main() {
  const args = process.argv.slice(2);
  const fileIdx = args.indexOf('--metar-file');
  const metarFile = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? athensDate(-1);

  const archive = join(root, `data/archive/${date}.json`);
  if (!existsSync(archive)) throw new Error(`no archived forecast for ${date} (${archive})`);
  const raw = JSON.parse(readFileSync(archive, 'utf8')) as RawBundle;
  const data = datasetFromRaw(raw, 'snapshot');

  const text = metarFile ? readFileSync(metarFile, 'utf8') : await fetchMetar(72);
  const obs = hourlyObs(parseMetars(text), date);
  const lastHour = Math.max(-1, ...obs.map((o) => o.hour));
  if (obs.length < 12 || lastHour < 20) {
    throw new Error(`station data for ${date} incomplete (${obs.length} hours, last ${lastHour}:00); run again after the day is over`);
  }

  const row = verifyDay(data, raw.plan, obs, date);
  const rows = readLog().filter((r) => r.date !== date);
  rows.push(row);
  rows.sort((a, b) => a.date.localeCompare(b.date));
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeSummary(rows);

  console.log(`${date} · point ${row.point} (${row.pointDistanceKm} km from ${STATION.id}) · ${row.hoursCompared} h compared`);
  console.log(`  wind MAE ${row.wind.mae} km/h, bias ${row.wind.bias}, afternoon bias ${row.wind.afternoonBias}, dir MAE ${row.wind.dirMae}°`);
  console.log(`  gust max fc/obs ${row.gust.forecastMax}/${row.gust.observedMax} · Bf max fc/obs ${row.bf.forecastMax}/${row.bf.observedMax} ${row.bf.within1 ? 'OK' : 'MISS'}`);
  console.log(`  temp MAE ${row.temp.mae} (max fc/obs ${row.temp.forecastMax}/${row.temp.observedMax}) · rain fc ${row.rain.forecastProbMax}%/${row.rain.forecastSumMm}mm obs ${row.rain.observed} ${row.rain.agree ? 'OK' : 'MISS'}`);
  console.log('  per model MAE:', MODELS.map((m) => `${m}=${row.perModel[m]}`).join(' '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
