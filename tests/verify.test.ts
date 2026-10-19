import { describe, expect, it } from 'vitest';
import { hourlyObs, parseMetar, parseMetars } from '../src/engine/metar';
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { planPoints } from '../src/engine/openmeteo';
import { nearestLandPoint, summarize, verifyDay } from '../src/engine/verify';
import { scenario } from './helpers';

const REF = new Date(Date.UTC(2026, 9, 19, 12, 0)); // 19 Oct 2026 12:00Z

describe('METAR parsing', () => {
  it('reads wind, gusts, temperature and rain', () => {
    const o = parseMetar('METAR LGSA 171320Z 33010G20KT 9999 -RA FEW012 FEW018TCU BKN025 17/10 Q1015', REF)!;
    expect(o.windDir).toBe(330);
    expect(o.windKmh).toBeCloseTo(18.5, 1);
    expect(o.gustKmh).toBeCloseTo(37, 0);
    expect(o.tempC).toBe(17);
    expect(o.rain).toBe(true);
    expect(o.localDate).toBe('2026-10-17');
    expect(o.localHour).toBe(16); // 13:20Z = 16:20 Athens (UTC+3)
  });
  it('handles calm, variable wind and corrected reports', () => {
    const calm = parseMetar('METAR LGSA 181320Z 00000KT 9999 FEW020 BKN090 20/10 Q1019', REF)!;
    expect(calm.windKmh).toBe(0);
    expect(calm.windDir).toBeNull();
    expect(calm.rain).toBe(false);
    const vrb = parseMetar('METAR LGSA 180520Z COR VRB03KT 9999 FEW020 SCT090 13/10 Q1019', REF)!;
    expect(vrb.windDir).toBeNull();
    expect(vrb.windKmh).toBeCloseTo(5.6, 1);
  });
  it('resolves a day number above today into the previous month', () => {
    const o = parseMetar('METAR LGSA 301220Z 00000KT 9999 FEW020 20/10 Q1019', new Date(Date.UTC(2026, 10, 2)))!;
    expect(o.localDate).toBe('2026-10-30');
  });
  it('aggregates to local hours with max gust and any-rain', () => {
    const text = ['METAR LGSA 171320Z 33010G20KT 9999 -RA FEW012 17/10 Q1015', 'METAR LGSA 171350Z 34007G17KT 9999 FEW012 17/10 Q1015'].join('\n');
    const h = hourlyObs(parseMetars(text, REF), '2026-10-17');
    expect(h).toHaveLength(1);
    expect(h[0].hour).toBe(16);
    expect(h[0].count).toBe(2);
    expect(h[0].gustKmh).toBeCloseTo(37, 0);
    expect(h[0].rain).toBe(true);
  });
});

describe('verification', () => {
  const plan = planPoints(SPOTS, REF_POINTS);
  it('compares against the forecast point nearest the airport', () => {
    expect(nearestLandPoint(plan).point.id).toBe('ref-airport');
  });
  it('scores a perfect day as zero error', () => {
    const data = scenario({ windKmh: 20, windDir: 330, waveM: 0.5, waveDir: 330, apparent: 24 });
    const obs = Array.from({ length: 16 }, (_, i) => ({ hour: 6 + i, windKmh: 20, windDir: 330, gustKmh: 28, tempC: 24, rain: false, count: 2 }));
    const row = verifyDay(data, plan, obs, data.date);
    expect(row.hoursCompared).toBe(16);
    expect(row.wind.mae).toBe(0);
    expect(row.wind.dirMae).toBe(0);
    expect(row.temp.mae).toBe(0);
    expect(row.bf.within1).toBe(true);
    expect(row.rain.agree).toBe(true);
  });
  it('measures an under-forecast afternoon as a negative bias', () => {
    const data = scenario({ windKmh: 10, windDir: 270, waveM: 0.3, waveDir: 270 });
    const obs = Array.from({ length: 16 }, (_, i) => {
      const hour = 6 + i;
      const strong = hour >= 13 && hour <= 18;
      return { hour, windKmh: strong ? 25 : 10, windDir: 270, gustKmh: strong ? 40 : 14, tempC: 28, rain: false, count: 2 };
    });
    const row = verifyDay(data, plan, obs, data.date);
    expect(row.wind.afternoonBias).toBeLessThan(-10);
    expect(row.bf.forecastMax).toBeLessThan(row.bf.observedMax);
    const s = summarize([row]);
    expect(s.days).toBe(1);
    expect(s.perModel[0].mae).not.toBeNull();
  });
});
