import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { dayGlance, glanceGroupOf } from '../src/engine/glance';
import { analyzeDay } from '../src/engine/recommend';
import { dedupeReasons, guestReasons } from '../src/guest/advice';
import { scenario } from './helpers';

describe('day at a glance', () => {
  it('sorts beaches by the coast they face', () => {
    const by = (id: string) => glanceGroupOf(SPOTS.find((s) => s.id === id)!);
    expect(by('agia-marina')).toBe('north');
    expect(by('falasarna')).toBe('west');
    expect(by('sougia')).toBe('south');
    expect(by('marathi')).toBe('east');
    expect(by('samaria')).toBe('trails');
    expect(by('maritime-museum')).toBeUndefined();
  });

  it('calls the west coast off and the bays fine in a westerly', () => {
    const { scores } = analyzeDay(SPOTS, scenario({ windKmh: 25, windDir: 270, waveM: 1.2, waveDir: 270 }), 'couple', BASES[0]);
    const g = Object.fromEntries(dayGlance(SPOTS, scores).map((x) => [x.id, x]));
    expect(g.west.verdict).not.toBe('go');
    expect(g.west.avoid).toBeGreaterThan(0);
    expect(g.east.verdict).toBe('go');
    expect(g.east.go).toBeGreaterThan(0);
  });
});

describe('guest reason de-duplication', () => {
  it('does not repeat the same line on consecutive cards', () => {
    const { scores } = analyzeDay(SPOTS, scenario({ windKmh: 6, windDir: 0, waveM: 0.2, waveDir: 300 }), 'couple', BASES[0]);
    const lists = dedupeReasons(['gramvousa-boat', 'falasarna', 'elafonisi'].map((id) => scores[id]), 'en');
    const firstLines = lists.map((l) => l[0].text);
    expect(new Set(firstLines).size).toBe(firstLines.length);
    for (const l of lists) expect(l.length).toBeGreaterThan(0);
    // on its own, each card still leads with its strongest reason
    expect(guestReasons(scores.falasarna, 'en')[0].text).toMatch(/rare chance/);
  });
});
