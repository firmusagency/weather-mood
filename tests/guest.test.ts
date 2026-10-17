import { describe, expect, it } from 'vitest';
import { SPOTS, spotById } from '../src/data/spots';
import { analyzeDay } from '../src/engine/recommend';
import { guestReasons, guestTips, mainProblem, seaLevel } from '../src/guest/advice';
import { GUEST_LANGS } from '../src/guest/property';
import { DEMO_PROPERTY } from '../src/guest/property';
import { scenario } from './helpers';

const westerly = analyzeDay(SPOTS, scenario({ windKmh: 25, windDir: 270, waveM: 1.2, waveDir: 270 }), 'couple', DEMO_PROPERTY.base);

describe('guest wording', () => {
  it('explains in every language why Falasarna is a bad idea in a westerly', () => {
    for (const lang of GUEST_LANGS) {
      const text = mainProblem(westerly.scores.falasarna, lang);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/); // no unfilled placeholders
    }
  });

  it('gives sheltered beaches positive, filled-in reasons', () => {
    for (const lang of GUEST_LANGS) {
      const lines = guestReasons(westerly.scores.kolymbari, lang);
      expect(lines.some((l) => l.kind === 'pos')).toBe(true);
      for (const l of lines) expect(l.text).not.toMatch(/\{\w+\}|undefined/);
    }
  });

  it('suggests walking shoes and water for a gorge', () => {
    const { scores, conditions } = analyzeDay(SPOTS, scenario({ windKmh: 8, windDir: 0, waveM: 0.2, waveDir: 0 }), 'active', DEMO_PROPERTY.base);
    const tips = guestTips(spotById('samaria')!, scores.samaria, conditions.samaria, 'en');
    expect(tips).toContain('Proper walking shoes');
    expect(tips).toContain('Plenty of water');
  });

  it('maps wave heights to plain words', () => {
    expect([0.1, 0.4, 0.8, 1.5].map(seaLevel)).toEqual([0, 1, 2, 3]);
  });
});
