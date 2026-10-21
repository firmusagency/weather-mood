import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import { comparePlans, planSnapshot, type PlanSnapshot } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import { eveningMessage, planBMessage, weatherLine } from '../src/guest/evening';
import { scenario } from './helpers';

const property = { name: 'Alkyoni Suites', guestUrl: 'https://example.test/g' };

function plan(s: Parameters<typeof scenario>[0], profile: 'family' | 'couple' = 'couple') {
  const data = scenario(s);
  const day = analyzeDay(SPOTS, data, profile, BASES[0], { daysAhead: 1 });
  const rec = recommend(SPOTS, day.scores);
  const syn = buildSynopsis(data, REF_POINTS);
  return { data, day, rec, syn, snap: planSnapshot(data.date, profile, rec, syn, '2026-07-14T15:40:00Z') };
}

describe('evening message', () => {
  it('names the day, the weather, three picks with times and the guest link, in each language', () => {
    const { day, rec, syn } = plan({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 }, 'family');
    for (const lang of ['el', 'en', 'de', 'fr'] as const) {
      const text = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'family', lang);
      expect(text).toContain('Alkyoni Suites');
      expect(text).toContain(property.guestUrl);
      expect(text).toMatch(/1\. .+ · \d{2}:00–\d{2}:00/);
      expect(text).toMatch(/3\. /);
      expect(text.split('\n').length).toBeLessThan(26);
    }
    const el = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'family', 'el');
    expect(el).toContain('Οικογένεια με παιδιά');
  });

  it('lists what to avoid on a windy day and says so coast by coast', () => {
    const { day, rec, syn } = plan({ windKmh: 30, windDir: 270, waveM: 1.3, waveDir: 270 });
    const text = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'couple', 'en');
    expect(text).toContain('Better not tomorrow');
    expect(weatherLine(syn, 'en')).toMatch(/wind from the W/);
  });
});

describe('plan B comparison', () => {
  const calm = plan({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 });
  const windy = plan({ windKmh: 32, windDir: 270, waveM: 1.4, waveDir: 270 });

  it('is quiet when nothing moved', () => {
    const diff = comparePlans(calm.snap, { ...calm.snap, generatedAt: '2026-07-15T02:50:00Z' });
    expect(diff.significant).toBe(false);
    expect(diff.changes).toEqual([]);
  });

  it('flags a wind jump, rough sea and dropped picks when a westerly arrives overnight', () => {
    const diff = comparePlans(calm.snap, windy.snap);
    expect(diff.significant).toBe(true);
    const kinds = diff.changes.map((c) => c.kind);
    expect(kinds).toContain('windUp');
    expect(kinds).toContain('seaUp');
    expect(kinds.some((k) => k === 'pickDropped' || k === 'pickDowngraded')).toBe(true);
    const text = planBMessage(diff, property, 'en');
    expect(text).toContain('Good morning');
    expect(text).toMatch(/wind picked up/);
    expect(text).toContain(property.guestUrl);
    const el = planBMessage(diff, property, 'el');
    expect(el).toContain('Καλημέρα');
  });

  it('a better morning (wind dropped) is reported but not alarmed', () => {
    const diff = comparePlans(windy.snap, calm.snap);
    expect(diff.changes.map((c) => c.kind)).toContain('windDown');
    expect(diff.significant).toBe(false);
  });

  it('a pick merely outranked by a new one is not a change', () => {
    const before: PlanSnapshot = { ...calm.snap, picks: [calm.snap.picks[1], calm.snap.picks[0], calm.snap.picks[2]].filter(Boolean) };
    const diff = comparePlans(before, calm.snap);
    expect(diff.significant).toBe(false);
  });
});
