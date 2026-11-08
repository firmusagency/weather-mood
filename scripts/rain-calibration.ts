/*
 * Rain threshold check: how well "rain yes/no" forecasts did against the airport (METAR, 10:00–18:00)
 * and the four National Observatory stations (daily rain ≥ 0.5 mm), for every candidate threshold.
 * Reads data/verification/log.jsonl and stations.jsonl; prints a contingency table per rule so the
 * hard limits (caution ≥ 60%, avoid ≥ 80%) can be judged on measured days, not on gut feeling.
 *
 * Usage: npm run rain:calibration            (text table)
 *        npm run rain:calibration -- --md    (markdown, for docs/)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

interface RainRow {
  date: string;
  station: string;
  pp: number;
  mm: number;
  observed: boolean;
  /** Rain sum per model (mm), when the archived forecast carried it (from Nov 2026). */
  perModel?: Record<string, number | null>;
}

export function loadRainRows(dir = join(root, 'data/verification')): RainRow[] {
  const read = (file: string) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);
  const rows: RainRow[] = [];
  for (const r of [...read('log.jsonl'), ...read('stations.jsonl')]) {
    rows.push({ date: r.date, station: r.station, pp: r.rain.forecastProbMax, mm: r.rain.forecastSumMm, observed: r.rain.observed, perModel: r.rainPerModel });
  }
  return rows;
}

export interface RuleScore {
  rule: string;
  hits: number;
  misses: number;
  falseAlarms: number;
  correctNegatives: number;
  /** Share of rainy days we warned about (recall). */
  caught: number;
  /** Share of warnings that were right (precision). */
  right: number;
  accuracy: number;
}

export function scoreRule(rows: RainRow[], rule: string, predict: (r: RainRow) => boolean): RuleScore {
  let hits = 0;
  let misses = 0;
  let falseAlarms = 0;
  let correctNegatives = 0;
  for (const r of rows) {
    const p = predict(r);
    if (p && r.observed) hits += 1;
    else if (!p && r.observed) misses += 1;
    else if (p && !r.observed) falseAlarms += 1;
    else correctNegatives += 1;
  }
  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
  return { rule, hits, misses, falseAlarms, correctNegatives, caught: pct(hits, hits + misses), right: pct(hits, hits + falseAlarms), accuracy: pct(hits + correctNegatives, rows.length) };
}

export const RULES: { rule: string; predict: (r: RainRow) => boolean }[] = [
  ...[20, 30, 40, 50, 60, 70, 80].map((t) => ({ rule: `prob ≥ ${t}%`, predict: (r: RainRow) => r.pp >= t })),
  ...[0.1, 0.5, 1, 3].map((m) => ({ rule: `sum ≥ ${m} mm`, predict: (r: RainRow) => r.mm >= m })),
  { rule: 'prob ≥ 50% or ≥ 1 mm (verify rule)', predict: (r) => r.pp >= 50 || r.mm >= 1 },
  { rule: 'prob ≥ 60% or ≥ 1 mm (hard limit: caution)', predict: (r) => r.pp >= 60 || r.mm >= 1 },
  { rule: 'prob ≥ 80% or ≥ 3 mm (hard limit: avoid)', predict: (r) => r.pp >= 80 || r.mm >= 3 },
  { rule: 'prob ≥ 40% or ≥ 0.5 mm', predict: (r) => r.pp >= 40 || r.mm >= 0.5 },
  { rule: 'prob ≥ 30% or ≥ 0.1 mm', predict: (r) => r.pp >= 30 || r.mm >= 0.1 },
];

const modelVals = (r: RainRow) => Object.values(r.perModel ?? {}).filter((x): x is number => x != null);
const hasModels = (r: RainRow) => modelVals(r).length >= 3;

/** Rules that need rain per model (rows from Nov 2026 on). */
export const MODEL_RULES: { rule: string; predict: (r: RainRow) => boolean }[] = [
  { rule: 'any model ≥ 0.5 mm', predict: (r) => modelVals(r).some((x) => x >= 0.5) },
  { rule: 'majority of models ≥ 0.5 mm', predict: (r) => modelVals(r).filter((x) => x >= 0.5).length * 2 > modelVals(r).length },
  { rule: 'all models ≥ 0.5 mm', predict: (r) => modelVals(r).every((x) => x >= 0.5) },
  { rule: 'best-match ≥ 60% or ≥ 1 mm (for comparison)', predict: (r) => r.pp >= 60 || r.mm >= 1 },
];

function table(rows: RainRow[], md: boolean, rules = RULES): string {
  const scores = rules.map((x) => scoreRule(rows, x.rule, x.predict));
  const head = ['Rule', 'Hits', 'Misses', 'False alarms', 'Dry OK', 'Caught', 'Right', 'Accuracy'];
  const lines = scores.map((s) => [s.rule, s.hits, s.misses, s.falseAlarms, s.correctNegatives, `${s.caught}%`, `${s.right}%`, `${s.accuracy}%`].map(String));
  if (md) return [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...lines.map((l) => `| ${l.join(' | ')} |`)].join('\n');
  const w = head.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  return [head, ...lines].map((l) => l.map((c, i) => c.padEnd(w[i])).join('  ')).join('\n');
}

function main() {
  const md = process.argv.includes('--md');
  const rows = loadRainRows();
  const rainy = rows.filter((r) => r.observed).length;
  const dates = new Set(rows.map((r) => r.date));
  console.log(md ? `**${rows.length} station-days** (${dates.size} days, ${rainy} with rain) · ${[...dates].sort()[0]} → ${[...dates].sort().at(-1)}\n` : `${rows.length} station-days, ${dates.size} days, ${rainy} with rain\n`);
  console.log(table(rows, md));
  const withModels = rows.filter(hasModels);
  if (withModels.length) {
    console.log(md ? `\n**Rain per model** (${withModels.length} station-days with per-model rain, ${withModels.filter((r) => r.observed).length} with rain):\n` : `\nRain per model (${withModels.length} station-days with per-model rain):\n`);
    console.log(table(withModels, md, MODEL_RULES));
  }
  const misses = rows.filter((r) => r.observed && !(r.pp >= 60 || r.mm >= 1));
  console.log(md ? '\n**Rain we did not warn about (below the caution limit):**\n' : '\nRain below the caution limit (prob < 60% and < 1 mm):');
  for (const r of misses) console.log(`${md ? '- ' : '  '}${r.date} ${r.station}: forecast ${r.pp}% / ${r.mm} mm`);
  const fa = rows.filter((r) => !r.observed && (r.pp >= 60 || r.mm >= 1));
  console.log(md ? '\n**Warnings on dry days:**\n' : '\nCaution or worse, but dry:');
  for (const r of fa) console.log(`${md ? '- ' : '  '}${r.date} ${r.station}: forecast ${r.pp}% / ${r.mm} mm`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
