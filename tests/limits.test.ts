import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { analyzeDay } from '../src/engine/recommend';
import { scenario } from './helpers';

const calm = { windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 };
const scores = (s: Parameters<typeof scenario>[0], profile: 'couple' | 'active' = 'couple') => analyzeDay(SPOTS, scenario(s), profile, BASES[1], { daysAhead: 1 }).scores;

describe('hard limits above the score', () => {
  it('a sunny, calm but cold day is not a beach day', () => {
    const sc = scores({ ...calm, apparent: 12 });
    expect(sc.falasarna.verdict).toBe('avoid');
    expect(sc.falasarna.factors[0].key).toBe('coldSwim');
    expect(sc.falasarna.score).toBeLessThan(50);
    // the town, villages and culture take over
    expect(sc['old-town'].verdict).toBe('go');
    expect(sc.theriso.verdict).toBe('go');
    // a cool day is "with reservations", a warm one is fine (water at 25° in the fixture)
    const cool = scores({ ...calm, apparent: 17 }).falasarna;
    expect(cool.verdict).toBe('caution');
    expect(cool.factors[0].key).toBe('coolSwim');
    expect(scores({ ...calm, apparent: 24 }).falasarna.verdict).toBe('go');
  });

  it('a boat trip in the cold is cautioned, not forbidden', () => {
    expect(scores({ ...calm, apparent: 12 })['gramvousa-boat'].verdict).toBe('caution');
  });

  it('keeps the real reason first when the weather already says avoid', () => {
    // 5 Bf onshore and 1.8 m waves: Falasarna is out because of the sea, the cool air is a footnote
    const sc = scores({ windKmh: 36, windDir: 280, waveM: 1.8, waveDir: 280, apparent: 17 }).falasarna;
    expect(sc.verdict).toBe('avoid');
    expect(sc.factors[0].key).not.toBe('coolSwim');
    expect(sc.factors.some((f) => f.key === 'coolSwim')).toBe(true);
  });

  it('likely rain rules the sea out', () => {
    const sc = scores({ ...calm, apparent: 26, precipProb: 85, precip: 0.3 });
    expect(sc.falasarna.verdict).toBe('avoid');
    expect(sc.falasarna.factors[0].key).toBe('rainyDay');
    const risky = scores({ ...calm, apparent: 26, precipProb: 65 }).falasarna;
    expect(risky.verdict).toBe('caution');
    expect(risky.factors[0].key).toBe('rainRisk');
    expect(scores({ ...calm, apparent: 26, precipProb: 40 }).falasarna.verdict).toBe('go');
  });

  it('rain in the mountains closes the gorges before the beaches', () => {
    const sc = scores({ ...calm, apparent: 24, precipProb: 55, precip: 0 }, 'active');
    expect(sc.samaria.verdict).toBe('avoid'); // Samaria's own limit is 50%
    expect(sc.samaria.factors[0].key).toBe('floodRisk');
    expect(sc.imbros.verdict).toBe('caution'); // limit 60%, so 55% is "with reservations"
    expect(sc.falasarna.verdict).toBe('go'); // 55% is below the sea limit
    // real rain amounts close every gorge
    expect(scores({ ...calm, apparent: 24, precipProb: 45, precip: 0.4 }, 'active').imbros.verdict).toBe('avoid');
  });
});

describe('rain of the previous days (gorges)', () => {
  const sunny = { ...calm, apparent: 24, precipProb: 5, precip: 0 };

  it('a wet yesterday closes the gorges under a blue sky, and only cautions the coastal walk', () => {
    const sc = scores({ ...sunny, recentRain: { prevDayMm: 30 } }, 'active');
    expect(sc.samaria.verdict).toBe('avoid');
    expect(sc.samaria.factors[0].key).toBe('afterRain');
    expect(sc.samaria.factors[0].params).toEqual({ prevMm: 30, threeMm: 30 });
    expect(sc.imbros.verdict).toBe('avoid');
    expect(sc['gouverneto-katholiko'].verdict).toBe('caution');
    expect(sc['gouverneto-katholiko'].factors[0].key).toBe('afterRain');
    // beaches and the town do not care about yesterday's rain
    expect(sc.falasarna.verdict).toBe('go');
    expect(sc['old-town'].verdict).toBe('go');
  });

  it('moderate rain yesterday, or a wet three days, means "with reservations"', () => {
    expect(scores({ ...sunny, recentRain: { prevDayMm: 12 } }, 'active').samaria.verdict).toBe('caution');
    const wetWeek = scores({ ...sunny, recentRain: { prevDayMm: 4, threeDayMm: 24 } }, 'active').samaria;
    expect(wetWeek.verdict).toBe('caution');
    expect(wetWeek.factors[0].key).toBe('afterRain');
    expect(scores({ ...sunny, recentRain: { prevDayMm: 5 } }, 'active').samaria.verdict).toBe('go');
  });

  it("today's own rain stays the headline reason when both apply", () => {
    const sc = scores({ ...calm, apparent: 24, precipProb: 70, precip: 0, recentRain: { prevDayMm: 30 } }, 'active').samaria;
    expect(sc.verdict).toBe('avoid');
    expect(sc.factors[0].key).toBe('floodRisk');
  });

  it('snapshots without the data behave as before', () => {
    expect(scores(sunny, 'active').samaria.verdict).toBe('go');
  });
});
