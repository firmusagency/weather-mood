import { describe, expect, it } from 'vitest';
import { SPOTS, spotById } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import { MODELS, type Dataset } from '../src/engine/types';
import { analyzeDay } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import { guestReasons } from '../src/guest/advice';
import { eveningMessage, weatherLine } from '../src/guest/evening';
import { recommend } from '../src/engine/recommend';
import { scenario } from './helpers';

/** Calm morning everywhere, then a southerly 4–5 Bf on the west coast from 14:00 (the 22 Oct 2026 case). */
function afternoonSoutherly(): Dataset {
  const d = scenario({ windKmh: 6, windDir: 20, waveM: 0.3, waveDir: 300 });
  const west = new Set(['ref-west', ...SPOTS.filter((s) => s.lon < 23.75).flatMap((s) => [s.id, `${s.id}:wind`])]);
  for (const [id, p] of Object.entries(d.land)) {
    if (!west.has(id)) continue;
    for (const m of MODELS) p.models[m].forEach((w, h) => { if (h >= 14) { w.wind = id === 'ref-west' ? 32 : 24; w.dir = 195; w.gust = w.wind * 1.6; } });
    p.atmos.forEach((a, h) => { if (h >= 14) { a.wind = 24; a.windDir = 195; a.gust = 38; } });
  }
  return d;
}

describe('wind that arrives in the afternoon', () => {
  const data = afternoonSoutherly();
  const day = analyzeDay(SPOTS, data, 'couple', BASES[0], { daysAhead: 1 });
  const fal = day.scores.falasarna;

  it('keeps the calm morning window at Falasarna but tells the guest when to leave', () => {
    expect(fal.verdict).toBe('go');
    expect(fal.window.end).toBeLessThanOrEqual(14);
    expect(fal.laterWind).toBeDefined();
    expect(fal.laterWind!.fromHour).toBe(14);
    expect(fal.laterWind!.bf).toBeGreaterThanOrEqual(4);
    const lines = guestReasons(fal, 'el');
    expect(lines.some((l) => l.kind === 'warn' && /Από τις 14:00/.test(l.text))).toBe(true);
    const en = guestReasons(fal, 'en').find((l) => l.kind === 'warn')!.text;
    expect(en).toMatch(/leave by 1[0-4]:00/);
  });

  it('is not a "rare opportunity" when the afternoon blows', () => {
    expect(fal.fit.some((f) => f.key === 'opportunity')).toBe(false);
    expect(spotById('falasarna')!.calmDayGem).toBe(true);
  });

  it('headlines the windiest coast, not the calm north, and says so', () => {
    const syn = buildSynopsis(data, REF_POINTS);
    expect(syn.windRef).toBe('ref-west');
    expect(syn.wind.bf).toBeGreaterThanOrEqual(3);
    expect(syn.takeaways.some((t) => t.key === 'windCoast')).toBe(true);
    const line = weatherLine(syn, 'en');
    expect(line).toMatch(/west coast from 14:00/);
    const rec = recommend(SPOTS, day.scores);
    const msg = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, { name: 'X', guestUrl: 'u' }, 'couple', 'el');
    expect(msg).toMatch(/δυτική ακτή από τις 14:00/);
  });
});

describe('a strong offshore wind is still a windy beach', () => {
  it('penalises Elafonisi under a 30 km/h ESE wind even though the water stays flat', () => {
    const data = scenario({ windKmh: 30, windDir: 120, waveM: 0.3, waveDir: 120 });
    const day = analyzeDay(SPOTS, data, 'family', BASES[0]);
    const el = day.scores.elafonisi;
    expect(el.factors.some((f) => f.key === 'windy' && f.impact <= -5)).toBe(true);
    expect(el.score).toBeLessThan(85);
    expect(el.fit.some((f) => f.key === 'opportunity')).toBe(false);
    const calm = analyzeDay(SPOTS, scenario({ windKmh: 8, windDir: 120, waveM: 0.3, waveDir: 120 }), 'family', BASES[0]).scores.elafonisi;
    expect(calm.score).toBeGreaterThan(el.score);
  });
});
