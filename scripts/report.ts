/*
 * Text report of the engine output for a stored snapshot — quick sanity check without the UI.
 * Usage: npm run report -- [date] [profile] [base]
 */
import { readFileSync } from 'node:fs';
import { SPOTS } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import { datasetFromRaw, type RawBundle } from '../src/engine/openmeteo';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import { compass } from '../src/engine/geo';
import type { ProfileId } from '../src/engine/types';

const snap = JSON.parse(readFileSync('public/data/snapshot-latest.json', 'utf8')) as { days: Record<string, RawBundle> };
const dates = Object.keys(snap.days).sort();
const date = process.argv[2] ?? dates[1];
const profile = (process.argv[3] ?? 'couple') as ProfileId;
const base = BASES.find((b) => b.id === (process.argv[4] ?? 'chania'))!;

const data = datasetFromRaw(snap.days[date], 'snapshot');
const syn = buildSynopsis(data, REF_POINTS);
console.log(`\n=== ${date} · profile ${profile} · base ${base.id} ===`);
console.log(
  `Wind (open sea N): ${compass(syn.wind.dir, 'en')} ${syn.wind.dir}° ${syn.wind.speed} km/h (Bf ${syn.wind.bf}), gusts ${syn.wind.gust}, agreement ${syn.agreement} (spread ${syn.wind.speedSpread} km/h / ${syn.wind.dirSpread}°)`,
);
for (const m of syn.models) console.log(`   ${m.model.padEnd(22)} ${m.speed} km/h from ${m.dir}°  gust ${m.gust}`);
for (const c of syn.coasts) console.log(`Coast ${c.id}: wind ${c.wind.speed} km/h ${c.wind.dir}°, waves mean ${c.waveMean} max ${c.waveMax} m from ${c.waveDir}°, sst ${c.sst}, ${c.exposure}`);
console.log('Town:', syn.town);
console.log('Takeaways:', syn.takeaways.map((t) => `${t.key}${JSON.stringify(t.params)}`).join(' | '));

const { scores, conditions } = analyzeDay(SPOTS, data, profile, base, { daysAhead: dates.indexOf(date) });
const rows = Object.values(scores).sort((a, b) => b.rank - a.rank);
console.log('\n rank score verdict  conf   window  travel  spot / top factors');
for (const s of rows) {
  const c = conditions[s.spotId].find((x) => x.hour === s.window.start + 1);
  const sea = c?.sea ? ` eff ${c.sea.effectiveWave.toFixed(2)}m (off ${c.sea.offshoreWave}m @${Math.round(c.sea.waveDir)}° x${c.sea.waveExposure.toFixed(2)})` : '';
  console.log(
    `${String(Math.round(s.rank)).padStart(5)} ${String(s.score).padStart(5)} ${s.verdict.padEnd(10)} ${s.confidence.padEnd(6)} ${String(s.window.start).padStart(2)}-${String(s.window.end).padEnd(3)} ${String(s.travelMinutes).padStart(4)}'  ${s.spotId}${sea}\n` +
      `        ${[...s.factors.slice(0, 3), ...s.fit.slice(0, 3)].map((f) => `${f.key}(${f.impact} ${JSON.stringify(f.params)})`).join('  ')}${s.unsuitableReason ? '  UNSUITABLE ' + JSON.stringify(s.unsuitableReason) : ''}`,
  );
}
const rec = recommend(SPOTS, scores);
console.log('\nTOP:', rec.top.map((s) => `${s.spotId} ${s.score}`).join(', '));
console.log('ALT:', rec.alternatives.map((s) => `${s.spotId} ${s.score}`).join(', '));
console.log('AVOID:', rec.avoid.map((s) => `${s.spotId} ${s.score}`).join(', '));
console.log('badWeatherDay:', rec.badWeatherDay);
