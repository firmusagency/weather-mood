import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { REF_POINTS } from '../src/data/region';
import { buildSynopsis } from '../src/engine/synopsis';
import { daySummary, guestReasons, mainProblem, waveText } from '../src/guest/advice';
import { scenario } from './helpers';

const calm = { windKmh: 6, windDir: 20, waveM: 0.2, waveDir: 20 };
/** 11 Nov 2026 in Chania: 21–22° under broken cloud, sea at 21°, sun down at 17:20. */
const november = { ...calm, apparent: 21, sst: 21, cloud: 65, date: '2026-11-11', sunrise: '06:52', sunset: '17:20' };
const july = { ...calm, apparent: 29, sst: 26, cloud: 5, date: '2026-07-15', sunrise: '06:15', sunset: '20:40' };
const day = (s: Parameters<typeof scenario>[0], profile: 'family' | 'couple' | 'senior' = 'family') => analyzeDay(SPOTS, scenario(s), profile, BASES[1], { daysAhead: 1 });
const text = (s: Parameters<typeof scenario>[0], id: string, profile: 'family' | 'couple' | 'senior' = 'family') =>
  guestReasons(day(s, profile).scores[id], 'en').map((l) => l.text).join(' | ');

describe('daylight', () => {
  it('no beach, gorge or ruin window runs past sunset; the town may', () => {
    const { scores } = day(november, 'couple');
    for (const sc of Object.values(scores)) {
      const spot = SPOTS.find((s) => s.id === sc.spotId)!;
      if (sc.window.start < 0 || spot.type === 'town' || spot.type === 'museum') continue;
      expect(sc.window.end, spot.id).toBeLessThanOrEqual(17);
      expect(sc.window.start, spot.id).toBeGreaterThanOrEqual(7);
    }
    // long summer days are untouched, and data without sun times behaves as before
    expect(day(july).scores['agioi-apostoloi'].window.end).toBeLessThanOrEqual(19);
    expect(day({ ...november, sunrise: undefined, sunset: undefined }).scores['agioi-apostoloi'].window.start).toBeGreaterThanOrEqual(8);
  });

  it('late in the afternoon a beach is "too late for today" instead of a visit in the dark', () => {
    const late = analyzeDay(SPOTS, scenario(november), 'couple', BASES[1], { daysAhead: 0, earliestStart: 15 }).scores;
    expect(late['agioi-apostoloi'].verdict).toBe('unsuitable');
    expect(late['agioi-apostoloi'].unsuitableReason).toMatchObject({ key: 'closed', params: { kind: 'tooLate' } });
    expect(late['old-town'].verdict).toBe('go');
  });
});

describe('a mild November day is not a July beach day', () => {
  it('beaches stay a "go" but score below the summer optimum and below the town', () => {
    const nov = day(november).scores;
    const jul = day(july).scores;
    expect(jul['agioi-apostoloi'].score).toBeGreaterThanOrEqual(98);
    expect(nov['agioi-apostoloi'].verdict).toBe('go');
    expect(nov['agioi-apostoloi'].score).toBeLessThan(90);
    expect(nov['agioi-apostoloi'].score).toBeGreaterThanOrEqual(75);
    expect(nov['old-town'].score).toBe(100);
    // the family's first pick in November is not a beach; in July it is
    const firstType = (s: typeof november) => SPOTS.find((x) => x.id === recommend(SPOTS, day(s).scores).top[0].spotId)!.type;
    expect(firstType(november)).not.toBe('beach');
    expect(firstType(july)).toBe('beach');
  });

  it('a warm, sunny late-October day keeps full marks', () => {
    const sc = day({ ...calm, apparent: 25, sst: 23.5, cloud: 20, date: '2026-10-20', sunrise: '07:30', sunset: '18:40' }).scores['agioi-apostoloi'];
    expect(sc.score).toBeGreaterThanOrEqual(98);
  });

  it('says "calm sea" without promising ideal swimming, and warns that it is cool', () => {
    const nov = text(november, 'agioi-apostoloi');
    expect(nov).toMatch(/Calm sea/);
    expect(nov).not.toMatch(/ideal for swimming/);
    expect(nov).toMatch(/Cool for swimming \(21°C\)/);
    expect(text(july, 'agioi-apostoloi')).toMatch(/Calm sea, ideal for swimming/);
  });

  it('does not promise sunbeds and canteens on a beach out of season', () => {
    expect(text(july, 'almyrida')).toMatch(/Sunbeds, food and toilets/);
    expect(text(november, 'almyrida')).not.toMatch(/Sunbeds/);
    expect(text({ ...november, date: '2026-10-31' }, 'almyrida')).toMatch(/Sunbeds/); // October is still season
    // a park has no sunbeds in any month
    expect(text(july, 'botanical-park', 'senior')).toMatch(/Food and toilets on site/);
    expect(text(july, 'botanical-park', 'senior')).not.toMatch(/Sunbeds/);
  });
});

describe('rain and sea wording for guests', () => {
  const warm = { ...calm, apparent: 27, sst: 25, cloud: 30, date: '2026-07-15' };
  const summary = (s: Parameters<typeof scenario>[0]) => daySummary(buildSynopsis(scenario(s), REF_POINTS), 'en').join(' ');

  it('does not call the sea "ideal for swimming" when rain is likely', () => {
    expect(text({ ...warm, precipProb: 20 }, 'agioi-apostoloi')).toMatch(/ideal for swimming/);
    const rainy = text({ ...warm, precipProb: 65 }, 'agioi-apostoloi');
    expect(rainy).toMatch(/Calm sea/);
    expect(rainy).not.toMatch(/ideal for swimming/);
    expect(rainy).toMatch(/Rain likely \(65%\)/);
  });

  it('does not say "calm sea" twice in different words', () => {
    // a light offshore wind on a flat day earns both factors; one line is enough
    const lines = guestReasons(day({ ...warm, windKmh: 18, windDir: 180 }).scores['agioi-apostoloi'], 'en').map((l) => l.text);
    expect(lines.filter((l) => /Calm/.test(l))).toHaveLength(1);
  });

  it('mentions showers from 40%, likely rain from 60%, and drops "a good day everywhere" on a rainy day', () => {
    expect(summary({ ...warm, precipProb: 30 })).not.toMatch(/rain|Showers/i);
    expect(summary({ ...warm, precipProb: 45 })).toMatch(/Showers possible \(45%\): take a rain jacket/);
    expect(summary({ ...warm, precipProb: 45 })).toMatch(/a good day even for the exposed spots/);
    const wet = summary({ ...warm, precipProb: 65 });
    expect(wet).toMatch(/Rain likely \(65%\)/);
    expect(wet).not.toMatch(/a good day even for the exposed spots/);
  });

  it('writes wave heights and water temperature the way a guest reads them', () => {
    expect(waveText(0.89, 'en')).toBe('0.9');
    expect(waveText(0.89, 'el')).toBe('0,9');
    expect(waveText('', 'el')).toBe('');
    const windy = day({ ...warm, windKmh: 30, windDir: 270, waveM: 1.3, waveDir: 270 }, 'couple').scores.falasarna;
    expect(mainProblem(windy, 'el')).toMatch(/~\d,\d m\)/);
    expect(mainProblem(windy, 'en')).toMatch(/~\d\.\d m\)/);
    expect(text({ ...november, apparent: 25, sst: 20.4 }, 'agioi-apostoloi')).toMatch(/Fresh water \(20°C\)/);
  });
});
