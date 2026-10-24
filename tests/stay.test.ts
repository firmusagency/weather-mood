import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import { analyzeDay } from '../src/engine/recommend';
import { outlookPlan, proxyDataset, sliceDay } from '../src/engine/openmeteo';
import { planStay, stayConfidence, stayDates, type StayDayInput } from '../src/engine/stay';
import { MODELS, WAVE_MODELS, type Dataset } from '../src/engine/types';
import { scenario, type Scenario } from './helpers';

const day = (date: string, daysAhead: number, s: Omit<Scenario, 'date'>, detail: 'full' | 'outlook' = 'full'): StayDayInput => {
  const data = scenario({ ...s, date });
  return { date, daysAhead, detail, scores: analyzeDay(SPOTS, data, 'couple', BASES[1], { daysAhead }).scores };
};

describe('stay planner', () => {
  it('gives the scarce trip its only calm day and spreads the rest', () => {
    // Mon: strong northerly (west coast rough), Tue: calm everywhere, Wed: fresh southerly
    const days = [
      day('2026-07-13', 1, { windKmh: 34, windDir: 350, waveM: 1.4, waveDir: 340 }),
      day('2026-07-14', 2, { windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 }),
      day('2026-07-15', 3, { windKmh: 26, windDir: 180, waveM: 0.4, waveDir: 20 }),
    ];
    const plan = planStay(days, 'couple', SPOTS);
    const balos = plan.trips.find((t) => t.trip.id === 'balos')!;
    expect(balos.status).toBe('planned');
    expect(balos.pick?.date).toBe('2026-07-14');
    // one trip per day
    const dates = plan.trips.filter((t) => t.pick).map((t) => t.pick!.date);
    expect(new Set(dates).size).toBe(dates.length);
    expect(plan.days.filter((d) => d.trip).length).toBeGreaterThanOrEqual(2);
    // more fitting trips than days: the leftovers are alternatives, not "impossible"
    const one = planStay(days.slice(1, 2), 'couple', SPOTS);
    expect(one.trips.filter((t) => t.status === 'unplaced').length).toBeGreaterThan(0);
    expect(one.trips.filter((t) => t.status === 'notThisStay' && t.trip.priority === 1).every((t) => t.reasons.length > 0 || t.options.every((o) => o === null))).toBe(true);
  });

  it('says why a trip does not fit the stay', () => {
    const days = [day('2026-07-13', 1, { windKmh: 40, windDir: 350, waveM: 2.0, waveDir: 340, gustKmh: 65 })];
    const plan = planStay(days, 'couple', SPOTS);
    const balos = plan.trips.find((t) => t.trip.id === 'balos')!;
    expect(balos.status).toBe('notThisStay');
    expect(balos.reasons[0]?.impact).toBeLessThan(0);
  });

  it('lowers confidence with distance and coarse data', () => {
    const sc = day('2026-07-14', 1, { windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 }).scores.falasarna;
    expect(stayConfidence(sc, { daysAhead: 1, detail: 'full' })).toBe('high');
    expect(stayConfidence(sc, { daysAhead: 3, detail: 'outlook' })).toBe('medium');
    expect(stayConfidence(sc, { daysAhead: 6, detail: 'outlook' })).toBe('low');
  });

  it('uses today only in the morning and stops the night before check-out', () => {
    const avail = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'];
    expect(stayDates('2026-07-13', 8, '2026-07-16', avail)).toEqual(['2026-07-13', '2026-07-14', '2026-07-15']);
    expect(stayDates('2026-07-13', 14, '2026-07-16', avail)).toEqual(['2026-07-14', '2026-07-15']);
  });
});

describe('outlook proxy dataset', () => {
  it('slices one day out of a multi-day reference dataset and maps every spot onto a reference', () => {
    const a = scenario({ windKmh: 30, windDir: 350, waveM: 1.2, waveDir: 340, date: '2026-07-13' });
    const b = scenario({ windKmh: 6, windDir: 20, waveM: 0.2, waveDir: 20, date: '2026-07-14' });
    const plan = outlookPlan(REF_POINTS);
    const multi: Dataset = { ...a, land: {}, marine: {}, waveModels: {} };
    for (const p of plan.land) {
      const models = {} as Dataset['land'][string]['models'];
      for (const m of MODELS) models[m] = [...a.land[p.id].models[m], ...b.land[p.id].models[m]];
      multi.land[p.id] = { atmos: [...a.land[p.id].atmos, ...b.land[p.id].atmos], models };
    }
    for (const p of plan.marine) {
      multi.marine[p.id] = [...a.marine[p.id], ...b.marine[p.id]];
      const per = {} as NonNullable<Dataset['waveModels']>[string];
      for (const m of WAVE_MODELS) per[m] = [...a.waveModels![p.id][m], ...b.waveModels![p.id][m]];
      multi.waveModels![p.id] = per;
    }
    const tue = sliceDay(multi, '2026-07-14');
    expect(tue.land['ref-north'].atmos).toHaveLength(24);
    expect(tue.land['ref-north'].atmos[12].wind).toBe(6);
    const proxy = proxyDataset(tue, SPOTS, REF_POINTS);
    expect(proxy.land.falasarna).toBe(tue.land['ref-west']);
    expect(proxy.marine.balos).toBeDefined();
    expect(proxy.marine['samaria:dep']).toBeDefined();
    const scores = analyzeDay(SPOTS, proxy, 'couple', BASES[1], { daysAhead: 4 }).scores;
    expect(scores.falasarna.verdict).toBe('go');
    const mon = proxyDataset(sliceDay(multi, '2026-07-13'), SPOTS, REF_POINTS);
    expect(analyzeDay(SPOTS, mon, 'couple', BASES[1], { daysAhead: 3 }).scores.falasarna.verdict).not.toBe('go');
  });
});
