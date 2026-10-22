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
import { NOA_STATIONS, noaUrl, parseNoaaMonthly, verifyDaily, type DailyVerificationRow } from '../src/engine/noa';
import { recheckRecommendations } from '../src/engine/recheck';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const LOG = join(root, 'data/verification/log.jsonl');
const STATIONS_LOG = join(root, 'data/verification/stations.jsonl');
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

function readStationLog(): DailyVerificationRow[] {
  if (!existsSync(STATIONS_LOG)) return [];
  return readFileSync(STATIONS_LOG, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as DailyVerificationRow);
}

/** The NOA monthly file that holds `date` (previous month's file right after the 1st). */
async function fetchNoa(stationId: string, date: string, noaDir?: string): Promise<string> {
  if (noaDir) return readFileSync(join(noaDir, `${stationId}.txt`), 'utf8');
  const today = athensDate(0);
  const prev = date.slice(0, 7) !== today.slice(0, 7);
  const res = await fetch(noaUrl(stationId, prev), { headers: { 'user-agent': 'weather-mood-verify/1.0' } });
  if (!res.ok) throw new Error(`NOA ${stationId} ${res.status}`);
  return res.text();
}

function writeSummary(rows: VerificationRow[], stationRows: DailyVerificationRow[] = readStationLog()) {
  const s = summarize(rows, 30, new Date(), stationRows);
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
    '## Άντεξε η πρόταση; (βόρεια ακτή, με τον μετρημένο άνεμο)',
    '',
    `Ημέρες: ${s.recs.days} · Προτάσεις που άντεξαν: ${s.recs.picksHeld}/${s.recs.picks} (${s.recs.pickHeldRate == null ? '–' : pct(s.recs.pickHeldRate)}) · «Αποφύγετε» που ήταν σωστά: ${s.recs.avoidsRight}/${s.recs.avoids}`,
    '',
    '## Δυτική και νότια ακτή (σταθμοί ΕΑΑ, ημερήσια)',
    '',
    '| Σταθμός | Ημέρες | Σφάλμα ριπής | Ριπή ±10 km/h | Διεύθυνση ±45° | Βροχή | Πρόταση άντεξε |',
    '|---|---|---|---|---|---|---|',
    ...s.stations.map((st) => `| ${st.name} | ${st.days} | ${st.gustMae} km/h | ${pct(st.gustWithin10Rate)} | ${st.dirWithin45Rate == null ? '–' : pct(st.dirWithin45Rate)} | ${pct(st.rainAgreeRate)} | ${st.picksHeld}/${st.picks} |`),
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
  const noaIdx = args.indexOf('--noa-dir');
  const noaDir = noaIdx >= 0 ? args[noaIdx + 1] : undefined;
  const skipMetar = args.includes('--no-metar');
  const skipNoa = args.includes('--no-noa');
  const date = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? athensDate(-1);

  const archive = join(root, `data/archive/${date}.json`);
  if (!existsSync(archive)) throw new Error(`no archived forecast for ${date} (${archive})`);
  const raw = JSON.parse(readFileSync(archive, 'utf8')) as RawBundle;
  const data = datasetFromRaw(raw, 'snapshot');

  let rows = readLog();
  if (!skipMetar) {
    const text = metarFile ? readFileSync(metarFile, 'utf8') : await fetchMetar(72);
    const obs = hourlyObs(parseMetars(text), date);
    const lastHour = Math.max(-1, ...obs.map((o) => o.hour));
    if (obs.length < 12 || lastHour < 20) {
      throw new Error(`station data for ${date} incomplete (${obs.length} hours, last ${lastHour}:00); run again after the day is over`);
    }

    const row = verifyDay(data, raw.plan, obs, date);
    // was the recommendation right? rerun it with the measured wind for the spots near the station
    row.recs = recheckRecommendations(data, raw.plan, obs, SPOTS, BASES[0], ['family', 'couple', 'active']);
    rows = rows.filter((r) => r.date !== date);
    rows.push(row);
    rows.sort((a, b) => a.date.localeCompare(b.date));
    mkdirSync(dirname(LOG), { recursive: true });
    writeFileSync(LOG, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');

    console.log(`${date} · point ${row.point} (${row.pointDistanceKm} km from ${STATION.id}) · ${row.hoursCompared} h compared`);
    console.log(`  wind MAE ${row.wind.mae} km/h, bias ${row.wind.bias}, afternoon bias ${row.wind.afternoonBias}, dir MAE ${row.wind.dirMae}°`);
    console.log(`  gust max fc/obs ${row.gust.forecastMax}/${row.gust.observedMax} · Bf max fc/obs ${row.bf.forecastMax}/${row.bf.observedMax} ${row.bf.within1 ? 'OK' : 'MISS'}`);
    console.log(`  temp MAE ${row.temp.mae} (max fc/obs ${row.temp.forecastMax}/${row.temp.observedMax}) · rain fc ${row.rain.forecastProbMax}%/${row.rain.forecastSumMm}mm obs ${row.rain.observed} ${row.rain.agree ? 'OK' : 'MISS'}`);
    console.log('  per model MAE:', MODELS.map((m) => `${m}=${row.perModel[m]}`).join(' '));
    for (const p of row.recs.profiles) {
      console.log(`  recheck ${p.profile}: picks ${p.picks.map((x) => `${x.spotId} ${x.forecastVerdict}→${x.observedVerdict}${x.held ? '' : ' MISS'}`).join(', ') || '-'} · avoids ${p.avoids.map((x) => `${x.spotId}${x.right ? '' : ' WRONG'}`).join(', ') || '-'}`);
    }
  }

  // west/south coast: the National Observatory stations' daily files
  let stationRows = readStationLog();
  if (!skipNoa) {
    for (const st of NOA_STATIONS) {
      try {
        const monthly = parseNoaaMonthly(await fetchNoa(st.id, date, noaDir));
        const dayNo = Number(date.slice(8, 10));
        const monthOk = monthly.month === Number(date.slice(5, 7)) && monthly.year === Number(date.slice(0, 4));
        const obsDay = monthly.days.find((d) => d.day === dayNo);
        if (!monthOk || !obsDay) {
          console.log(`  ${st.id}: no daily row for ${date} yet`);
          continue;
        }
        const srow = verifyDaily(data, raw.plan, obsDay, st, date, SPOTS, BASES[0]);
        stationRows = stationRows.filter((r) => !(r.date === date && r.station === st.id));
        stationRows.push(srow);
        console.log(
          `  ${st.id}: gust fc/obs ${srow.gust.forecastMax}/${srow.gust.observedMax} km/h (fc ${srow.gust.forecastHour}:00, obs ${srow.gust.observedHour}:00) · avg wind ${srow.wind.forecastAvg}/${srow.wind.observedAvg} · dir ${srow.wind.forecastDir}°/${srow.wind.observedDir}° · temp max ${srow.temp.forecastMax}/${srow.temp.observedMax}` +
            (srow.pick ? ` · pick ${srow.pick.spotId} ${srow.pick.verdict} ${srow.pick.window.start}-${srow.pick.window.end} ${srow.pick.held ? 'held' : 'MISS'}` : ''),
        );
      } catch (e) {
        console.warn(`  ${st.id}: ${(e as Error).message}`);
      }
    }
    stationRows.sort((a, b) => a.date.localeCompare(b.date) || a.station.localeCompare(b.station));
    mkdirSync(dirname(STATIONS_LOG), { recursive: true });
    writeFileSync(STATIONS_LOG, stationRows.map((r) => JSON.stringify(r)).join('\n') + (stationRows.length ? '\n' : ''));
  }
  writeSummary(rows, stationRows);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
