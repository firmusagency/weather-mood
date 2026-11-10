import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Adjustments } from '../src/engine/adjust';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson<T>(name: string): T | null {
  const file = join(root, 'public/data', `${name}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

/** The same three files the pages load, for the scripts that build messages. */
export function readAdjustments(): Adjustments {
  return { calibration: readJson('calibration'), stations: readJson('station-calibration'), closures: readJson('closures') };
}
