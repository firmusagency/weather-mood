import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { angleDiff, beaufort, inSector } from '../src/engine/geo';
import { exposureFactor, exposureClass } from '../src/engine/analysis';
import { analyzeDay, recommend } from '../src/engine/recommend';
import type { ProfileId } from '../src/engine/types';
import { scenario, type Scenario } from './helpers';

const chania = BASES[0];
const run = (s: Scenario, profile: ProfileId = 'couple') => analyzeDay(SPOTS, scenario(s), profile, chania);

describe('geometry', () => {
  it('measures angles and sectors across north', () => {
    expect(angleDiff(350, 10)).toBe(20);
    expect(inSector(355, [315, 45])).toBe(true);
    expect(inSector(90, [315, 45])).toBe(false);
  });
  it('converts km/h to Beaufort', () => {
    expect(beaufort(25)).toBe(4);
    expect(beaufort(42)).toBe(6);
  });
  it('treats wind from the sea as onshore and from land as offshore', () => {
    expect(exposureFactor(270, 270)).toBe(1);
    expect(exposureClass(270, 270)).toBe('onshore');
    expect(exposureFactor(90, 270)).toBeLessThan(0.1);
    expect(exposureClass(90, 270)).toBe('offshore');
  });
});

describe('westerly 4 Bf with 1.2 m waves (the Falasarna example)', () => {
  const west = { windKmh: 25, windDir: 270, waveM: 1.2, waveDir: 270 };
  const { scores } = run(west);

  it('advises against Falasarna', () => {
    expect(scores.falasarna.verdict).toBe('avoid');
    expect(scores.falasarna.factors[0].key).toBe('seaRough');
  });
  it('recommends shores sheltered from the west', () => {
    for (const id of ['kolymbari', 'marathi', 'paleochora-pebble']) expect(scores[id].verdict).toBe('go');
  });
  it('knows the two sides of Paleochora differ', () => {
    expect(scores['paleochora-pebble'].score).toBeGreaterThan(scores['paleochora-sandy'].score + 20);
  });
  it('does not assume "south" means sheltered: Elafonisi faces SW', () => {
    expect(scores.elafonisi.score).toBeLessThan(scores.marathi.score);
  });
  it('keeps Falasarna out of the top picks', () => {
    const rec = recommend(SPOTS, scores);
    expect([...rec.top, ...rec.alternatives].map((s) => s.spotId)).not.toContain('falasarna');
  });
});

describe('meltemi: northerly 6 Bf, 1.8 m waves', () => {
  const meltemi = { windKmh: 42, windDir: 350, waveM: 1.8, waveDir: 350 };
  const { scores } = run(meltemi);

  it('rules out the north coast and the Balos cruise', () => {
    for (const id of ['agia-marina', 'platanias', 'kalathas']) expect(scores[id].verdict).toBe('avoid');
    expect(scores['gramvousa-boat'].verdict).toBe('avoid');
    expect(scores['gramvousa-boat'].factors.some((f) => f.key === 'boatCancel')).toBe(true);
  });
  it('flags downslope gusts on the Sfakia coast', () => {
    expect(scores.frangokastello.factors.some((f) => f.key === 'downslopeGusts')).toBe(true);
  });
  it('prefers the south-west coast for a swim', () => {
    expect(scores.sougia.score).toBeGreaterThan(scores['agia-marina'].score + 40);
  });
});

describe('calm day', () => {
  const calm = { windKmh: 6, windDir: 0, waveM: 0.2, waveDir: 300 };
  it('flags exposed favourites as a rare opportunity', () => {
    const { scores } = run(calm);
    expect(scores.balos.fit.some((f) => f.key === 'opportunity')).toBe(true);
    const rec = recommend(SPOTS, scores);
    const picks = [...rec.top, ...rec.alternatives].map((s) => s.spotId);
    expect(picks.some((id) => ['balos', 'gramvousa-boat', 'falasarna', 'elafonisi'].includes(id))).toBe(true);
  });
});

describe('heat and rain', () => {
  it('starts gorges early on a 36 °C day', () => {
    const { scores } = run({ windKmh: 8, windDir: 0, waveM: 0.3, waveDir: 0, apparent: 36 }, 'active');
    expect(scores.samaria.window.start).toBe(7);
    expect(scores.samaria.factors.some((f) => f.key === 'heat')).toBe(true);
  });
  it('turns to museums and town on a rainy day', () => {
    const { scores } = run({ windKmh: 15, windDir: 200, waveM: 0.6, waveDir: 200, precipProb: 85, precip: 3, apparent: 19 }, 'family');
    const rec = recommend(SPOTS, scores);
    expect(rec.badWeatherDay).toBe(true);
    const types = rec.top.map((s) => SPOTS.find((x) => x.id === s.spotId)!.type);
    expect(types).toContain('museum');
  });
});

describe('profiles', () => {
  const nice = { windKmh: 10, windDir: 0, waveM: 0.3, waveDir: 0 };
  it('never sends families with small kids to Samaria or Seitan Limania', () => {
    const { scores } = run(nice, 'family');
    expect(scores.samaria.verdict).toBe('unsuitable');
    expect(scores['seitan-limania'].verdict).toBe('unsuitable');
  });
  it('only suggests bus-reachable places without a car', () => {
    const { scores } = run(nice, 'nocar');
    expect(scores.marathi.verdict).toBe('unsuitable');
    expect(scores['agia-marina'].verdict).not.toBe('unsuitable');
  });
  it('knows Samaria is closed in winter', () => {
    const { scores } = run({ ...nice, date: '2026-12-10' }, 'active');
    expect(scores.samaria.verdict).toBe('unsuitable');
    expect(scores.samaria.unsuitableReason?.key).toBe('closed');
  });
  it('is gentler on waves for families than for active guests', () => {
    const moderate = { windKmh: 18, windDir: 0, waveM: 0.6, waveDir: 0 };
    const fam = run(moderate, 'family').scores['agia-marina'].score;
    const act = run(moderate, 'active').scores['agia-marina'].score;
    expect(act).toBeGreaterThan(fam);
  });
});
