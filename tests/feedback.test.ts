import { describe, expect, it } from 'vitest';
import { SPOTS, spotById } from '../src/data/spots';
import { applyCalibration, calibrate, disagrees, headlineProblem, summarizeFeedback, visitStats, type JoinedRow } from '../src/engine/feedback';
import { askableDates, shiftDate } from '../src/guest/feedback';
import type { SpotScore } from '../src/engine/types';

const base = (over: Partial<JoinedRow>): JoinedRow => ({
  id: Math.random().toString(36).slice(2),
  created_at: '2026-07-10T18:00:00Z',
  property_id: 'demo',
  source: 'guest',
  visit_date: '2026-07-10',
  spot_id: 'falasarna',
  verdict: 'up',
  tag: null,
  profile: 'family',
  lang: 'en',
  note: null,
  party_size: null,
  forecast: { verdict: 'go', score: 85, problem: null, effectiveWaveM: 0.3, gustKmh: 20 },
  ...over,
});

describe('feedback aggregation', () => {
  it('counts votes, tags and disagreement per spot', () => {
    const rows = [
      base({}),
      base({ verdict: 'down', tag: 'wave' }),
      base({ spot_id: 'balos', verdict: 'up', forecast: { verdict: 'avoid', score: 30, problem: 'seaRough', effectiveWaveM: 1.2, gustKmh: 40 } }),
      base({ spot_id: 'balos', verdict: 'down', tag: 'wind', forecast: null }),
    ];
    const s = summarizeFeedback(rows, visitStats([]));
    expect(s.total).toBe(4);
    expect(s.judged).toBe(3);
    expect(s.agreeRate).toBe(0.33);
    const fal = s.bySpot.find((x) => x.spotId === 'falasarna')!;
    expect(fal).toMatchObject({ n: 2, up: 1, down: 1, disagree: 1, judged: 2 });
    expect(fal.tags.wave).toBe(1);
    const bal = s.bySpot.find((x) => x.spotId === 'balos')!;
    expect(bal).toMatchObject({ n: 2, disagree: 1, judged: 1 });
    expect(s.recent[0]).not.toHaveProperty('id');
  });

  it('"caution" days are not counted as agreement or disagreement', () => {
    const r = base({ verdict: 'down', forecast: { verdict: 'caution', score: 60, problem: 'gusts', effectiveWaveM: 0.4, gustKmh: 35 } });
    expect(disagrees(r)).toBe(false);
    expect(summarizeFeedback([r], visitStats([])).judged).toBe(0);
  });

  it('headline problem is the largest penalty', () => {
    const sc = { factors: [{ key: 'sheltered', impact: 5, params: {} }, { key: 'gusts', impact: -8, params: {} }, { key: 'seaRough', impact: -25, params: {} }] } as unknown as SpotScore;
    expect(headlineProblem(sc)).toBe('seaRough');
    expect(headlineProblem({ factors: [] } as unknown as SpotScore)).toBeNull();
  });
});

describe('calibration', () => {
  const complaints = (n: number, spot = 'falasarna') => Array.from({ length: n }, () => base({ spot_id: spot, verdict: 'down', tag: 'wave' }));
  const fine = (n: number, spot = 'falasarna') => Array.from({ length: n }, () => base({ spot_id: spot }));
  const falseAlarms = (n: number, spot = 'falasarna') =>
    Array.from({ length: n }, () => base({ spot_id: spot, verdict: 'up', forecast: { verdict: 'avoid', score: 30, problem: 'seaRough', effectiveWaveM: 1.1, gustKmh: 30 } }));

  it('does nothing below the minimum sample size', () => {
    expect(calibrate([...complaints(4), ...fine(3)]).spots).toEqual({});
  });

  it('raises the wave factor when guests keep finding more wave than we said', () => {
    const c = calibrate([...complaints(4), ...fine(6)]);
    expect(c.spots.falasarna.waveFactor).toBe(1.2);
    expect(c.spots.falasarna.waveComplaints).toBe(4);
  });

  it('lowers it when we warn about the sea and guests say it was fine', () => {
    const c = calibrate([...falseAlarms(3), ...fine(6)]);
    expect(c.spots.falasarna.waveFactor).toBe(0.85);
  });

  it('needs a net of at least two before moving, and is capped', () => {
    expect(calibrate([...complaints(3), ...falseAlarms(2), ...fine(5)]).spots).toEqual({});
    expect(calibrate(complaints(30)).spots.falasarna.waveFactor).toBe(1.4);
  });

  it('wind or crowd complaints never move the wave factor', () => {
    const rows = Array.from({ length: 10 }, () => base({ verdict: 'down', tag: 'wind' }));
    expect(calibrate(rows).spots).toEqual({});
  });

  it('applies to spots as a multiplier, leaving others untouched', () => {
    const c = calibrate([...complaints(4), ...fine(6)]);
    const spots = applyCalibration(SPOTS, c);
    const before = spotById('falasarna')!.waveFactor ?? 1;
    expect(spots.find((s) => s.id === 'falasarna')!.waveFactor).toBeCloseTo(before * 1.2, 2);
    expect(spots.find((s) => s.id === 'balos')).toBe(spotById('balos'));
    expect(applyCalibration(SPOTS, null)).toBe(SPOTS);
  });
});

describe('visit stats and askable dates', () => {
  it('aggregates visits per day, view, language and profile', () => {
    const v = visitStats([
      { created_at: '2026-07-10T08:00:00Z', view: 'phone', lang: 'de', profile: 'family' },
      { created_at: '2026-07-10T09:00:00Z', view: 'phone', lang: 'en', profile: 'couple' },
      { created_at: '2026-07-11T09:00:00Z', view: 'lobby', lang: null, profile: null },
    ]);
    expect(v.total).toBe(3);
    expect(v.byView).toEqual({ phone: 2, lobby: 1 });
    expect(v.byLang).toEqual({ de: 1, en: 1 });
    expect(v.perDay).toEqual([
      { date: '2026-07-10', n: 2 },
      { date: '2026-07-11', n: 1 },
    ]);
  });

  it('asks about the last three days, and about today only from the afternoon', () => {
    expect(askableDates('2026-07-10', 9)).toEqual(['2026-07-07', '2026-07-08', '2026-07-09']);
    expect(askableDates('2026-07-10', 16)).toEqual(['2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']);
    expect(shiftDate('2026-08-01', -1)).toBe('2026-07-31');
  });
});
