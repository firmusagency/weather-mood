/*
 * Health check over the data files (see src/engine/health.ts). Writes public/data/health.json for
 * the dashboard and prints one line per check. With --strict it exits 1 when something is an
 * error, which turns the workflow red and makes GitHub notify the owner: that is the alarm.
 *
 * Usage: npm run health [-- --strict]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkHealth, type Delivery, type HealthInputs } from '../src/engine/health';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = <T>(name: string): T | null => {
  const f = join(root, 'public/data', `${name}.json`);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8')) as T;
  } catch {
    return null;
  }
};

export function readHealthInputs(): HealthInputs {
  const snap = read<{ generatedAt: string; days: Record<string, unknown>; outlook?: { fetchedAt?: string } }>('snapshot-latest');
  return {
    snapshot: snap ? { generatedAt: snap.generatedAt, days: Object.keys(snap.days ?? {}), outlookFetchedAt: snap.outlook?.fetchedAt ?? null } : null,
    evening: read('evening'),
    planB: read('plan-b'),
    verification: read('verification'),
    closures: read('closures'),
    delivery: read<Delivery>('delivery'),
  };
}

function main() {
  const strict = process.argv.includes('--strict');
  const health = checkHealth(readHealthInputs());
  writeFileSync(join(root, 'public/data/health.json'), JSON.stringify(health, null, 1));
  for (const i of health.items) console.log(`${i.level === 'ok' ? 'ok   ' : i.level === 'warn' ? 'WARN ' : 'ERROR'} ${i.id.padEnd(12)} ${i.en}`);
  console.log(`health: ${health.errors} error(s), ${health.warnings} warning(s)`);
  if (strict && !health.ok) process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
