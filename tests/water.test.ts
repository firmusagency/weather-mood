import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { PROFILES } from '../src/data/profiles';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { SWIM_LIMITS, WATER_BANDS, WINTER_SWIM, waterBand } from '../src/engine/scoring';
import { guestReasons, guestTips, waterLevel } from '../src/guest/advice';
import { g } from '../src/guest/i18n';
import { eveningMessage } from '../src/guest/evening';
import { buildSynopsis } from '../src/engine/synopsis';
import { REF_POINTS } from '../src/data/region';
import type { ProfileId } from '../src/engine/types';
import { scenario } from './helpers';

type S = Parameters<typeof scenario>[0];
const calm = { windKmh: 6, windDir: 20, waveM: 0.2, waveDir: 20 };
const warmAir = { ...calm, apparent: 26, cloud: 10, date: '2026-06-01' };
/** A still, half-cloudy January day in Chania: 14° in the air, 16.5° in the sea. */
const january = { ...calm, apparent: 14, sst: 16.5, cloud: 40, date: '2026-01-20', sunrise: '07:25', sunset: '17:35' };
const BEACH = 'agioi-apostoloi';
const day = (s: S, profile: ProfileId = 'couple') => analyzeDay(SPOTS, scenario(s), profile, BASES[1], { daysAhead: 1 });
const beach = (s: S, profile: ProfileId = 'couple') => day(s, profile).scores[BEACH];
const text = (s: S, profile: ProfileId = 'couple', lang: 'en' | 'el' = 'en') =>
  guestReasons(beach(s, profile), lang).map((l) => l.text).join(' | ');

describe('water temperature bands', () => {
  it('names the water the way the sources do: 22–26° pleasant, 20–22° fresh, 18–20° cold, colder very cold', () => {
    expect(WATER_BANDS).toEqual({ warm: 26, pleasant: 22, fresh: 20, cold: 18, veryCold: 16 });
    expect([27, 26, 24, 22, 21.9, 20, 19.9, 18, 17.9, 15].map(waterBand)).toEqual([4, 4, 3, 3, 2, 2, 1, 1, 0, 0]);
    expect(waterLevel(21)).toBe(2);
    for (const lang of ['el', 'en', 'de', 'fr'] as const) expect(g(lang).waterWords).toHaveLength(5);
    expect(g('en').waterWords[waterBand(19)]).toBe('cold');
    expect(g('el').waterWords[waterBand(23)]).toBe('ευχάριστο');
  });

  it('water at 22° and up costs an ordinary guest nothing; families and older guests want one degree more', () => {
    expect(beach({ ...warmAir, sst: 22 }).factors.some((f) => f.key === 'coldWater')).toBe(false);
    expect(beach({ ...warmAir, sst: 22 }).score).toBeGreaterThanOrEqual(98);
    expect(beach({ ...warmAir, sst: 22 }, 'family').factors.some((f) => f.key === 'coldWater')).toBe(true);
    expect(beach({ ...warmAir, sst: 23 }, 'family').factors.some((f) => f.key === 'coldWater')).toBe(false);
    expect(PROFILES.filter((p) => p.waterComfort === 23).map((p) => p.id)).toEqual(['family', 'senior']);
  });

  it('the colder the water, the lower the beach, and the words follow the band', () => {
    const at = (sst: number) => beach({ ...warmAir, sst }).score;
    expect(at(20.5)).toBeLessThan(at(22));
    expect(at(19)).toBeLessThan(at(20.5));
    expect(at(19)).toBeGreaterThanOrEqual(70); // still a "go": a short dip on a warm day
    expect(text({ ...warmAir, sst: 21 })).toMatch(/Fresh water \(21°C\)/);
    expect(text({ ...warmAir, sst: 19 })).toMatch(/Cold water \(19°C\): a quick dip at most/);
    expect(text({ ...warmAir, sst: 19 }, 'couple', 'el')).toMatch(/Κρύο νερό \(19°C\): για μια σύντομη βουτιά/);
    expect(text({ ...warmAir, sst: 19 })).not.toMatch(/ideal for swimming/);
  });

  it('keeps the hard limits where the open-water rules put them: reservations under 18°, no swim under 16°', () => {
    expect(SWIM_LIMITS).toMatchObject({ sstCaution: 18, sstAvoid: 16 });
    const cool = beach({ ...warmAir, sst: 17.5 });
    expect(cool.verdict).toBe('caution');
    expect(cool.factors[0].key).toBe('coolSwim');
    const cold = beach({ ...warmAir, sst: 15.5 });
    expect(cold.verdict).toBe('avoid');
    expect(cold.factors[0]).toMatchObject({ key: 'coldSwim', params: { capS: 18, minS: 16 } });
  });
});

describe('winter swimmers', () => {
  it('is a profile of its own in every language', () => {
    expect(PROFILES.map((p) => p.id)).toContain('winter');
    for (const lang of ['el', 'en', 'de', 'fr'] as const) expect(g(lang).profiles.winter).toBeTruthy();
  });

  it('a still January day is a swimming day for them and for nobody else', () => {
    for (const p of ['couple', 'family', 'senior', 'solo'] as const) expect(beach(january, p).verdict, p).toBe('avoid');
    const sc = beach(january, 'winter');
    expect(sc.verdict).toBe('go');
    expect(sc.score).toBeGreaterThanOrEqual(90);
    const first = recommend(SPOTS, day(january, 'winter').scores).top[0];
    expect(SPOTS.find((s) => s.id === first.spotId)!.type).toBe('beach');
    expect(SPOTS.find((s) => s.id === recommend(SPOTS, day(january, 'couple').scores).top[0].spotId)!.type).not.toBe('beach');
  });

  it('the card gives the water temperature and the cold-water advice, never "ideal for swimming"', () => {
    const en = text(january, 'winter');
    expect(en).toMatch(/Sea at 17°C: only if you are used to it\. Get in slowly, never alone/);
    expect(en).toMatch(/Calm sea/);
    expect(en).not.toMatch(/ideal for swimming/);
    expect(text(january, 'winter', 'el')).toMatch(/Νερό 17°C: μόνο για συνηθισμένους/);
    const d = day(january, 'winter');
    const tips = guestTips(SPOTS.find((s) => s.id === BEACH)!, d.scores[BEACH], d.conditions[BEACH], 'en');
    expect(tips[0]).toBe('Warm clothes and a hot drink for after the swim');
    // from 20° up the water needs no note
    expect(text({ ...january, apparent: 20, sst: 20.9 }, 'winter')).not.toMatch(/only if you are used to it/);
    expect(beach({ ...january, apparent: 20, sst: 20.9 }, 'winter').factors.some((f) => f.key === 'winterSwim')).toBe(false);
  });

  it('the evening message for them names a beach and what to bring', () => {
    const data = scenario(january);
    const d = analyzeDay(SPOTS, data, 'winter', BASES[1], { daysAhead: 1 });
    const msg = eveningMessage({ rec: recommend(SPOTS, d.scores), syn: buildSynopsis(data, REF_POINTS), scores: d.scores, conditions: d.conditions }, { name: 'Demo', guestUrl: 'https://example.test/' }, 'winter', 'el');
    expect(msg).toMatch(/Χειμερινός κολυμβητής/);
    expect(msg).toMatch(/Νερό 17°C: μόνο για συνηθισμένους/);
    expect(msg).toMatch(/ζεστά ρούχα/);
  });

  it('the sea, the wind and the rain limits do not move for them', () => {
    // 1.5 m onshore waves with a 5 Bf northerly: nobody swims
    const rough = beach({ ...january, windKmh: 30, windDir: 350, waveM: 1.5, waveDir: 350 }, 'winter');
    expect(rough.verdict).toBe('avoid');
    expect(rough.factors[0].key).toBe('seaRough');
    const wet = beach({ ...january, precipProb: 85, precip: 0.5 }, 'winter');
    expect(wet.verdict).toBe('avoid');
    expect(wet.factors[0].key).toBe('rainyDay');
    expect(beach({ ...january, precipProb: 65 }, 'winter').verdict).toBe('caution');
    // their wave tolerance is a little below a summer couple's
    const [ok, bad] = PROFILES.find((p) => p.id === 'winter')!.seaTolerance;
    const [cOk, cBad] = PROFILES.find((p) => p.id === 'couple')!.seaTolerance;
    expect(ok).toBeLessThan(cOk);
    expect(bad).toBeLessThan(cBad);
  });

  it('even they have a floor: reservations under 14° water or 10° air, no swim under 10° water or 5° air', () => {
    expect(WINTER_SWIM.limits).toEqual({ apparentCaution: 10, apparentAvoid: 5, sstCaution: 14, sstAvoid: 10 });
    expect(beach({ ...january, sst: 15 }, 'winter').verdict).toBe('go');
    const cool = beach({ ...january, sst: 13 }, 'winter');
    expect(cool.verdict).toBe('caution');
    expect(cool.factors[0]).toMatchObject({ key: 'coolSwim', params: { capS: 14, minS: 10 } });
    expect(beach({ ...january, sst: 9 }, 'winter').verdict).toBe('avoid');
    expect(beach({ ...january, apparent: 8 }, 'winter').verdict).toBe('caution');
    expect(beach({ ...january, apparent: 4 }, 'winter').verdict).toBe('avoid');
  });

  it('a boat trip in the cold is cautioned for them like for everybody', () => {
    expect(day({ ...calm, apparent: 12 }, 'winter').scores['gramvousa-boat'].verdict).toBe('caution');
  });

  it('in summer the profile behaves like a keen swimmer: beaches first, no cold-water note', () => {
    const july = { ...calm, apparent: 29, sst: 26, cloud: 5, date: '2026-07-15' };
    expect(beach(july, 'winter').score).toBeGreaterThanOrEqual(98);
    expect(text(july, 'winter')).toMatch(/Calm sea, ideal for swimming/);
    expect(text(july, 'winter')).not.toMatch(/used to it/);
  });
});
