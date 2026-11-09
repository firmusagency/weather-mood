import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES } from '../src/data/region';
import { applyClosures, isClosedOn, parseSamariaPage, type Closures } from '../src/engine/closures';
import { analyzeDay } from '../src/engine/recommend';
import { factorText } from '../src/guest/advice';
import { scenario } from './helpers';

// the real markup of samaria-tickets.necca.gov.gr/checkout on 9 Nov 2026 (off season)
const OFF_SEASON = `<label>Date *</label><input min="2026-11-09" required="" aria-invalid="false" type="date" id="dateRange.start" class="form-control" name="dateRange.start" value="2027-04-10"></div></div></div><div class="mb-4"><div role="alert" class="fade alert alert-warning show"><p class="m-0">The Samaria National Park will remain closed between 01/11/2026 and 09/04/2027 due to off season</p></div></div><div class="mb-4">`;
const alert = (text: string, value = '2026-09-22') => `<input type="date" name="dateRange.start" value="${value}"><div role="alert" class="alert alert-warning"><p>${text}</p></div>`;

describe('Samaria ticket page', () => {
  it('reads the off-season notice and its range', () => {
    const s = parseSamariaPage(OFF_SEASON, '2026-11-09');
    expect(s.notice).toMatch(/remain closed between 01\/11\/2026 and 09\/04\/2027/);
    expect(s.ranges).toEqual([{ from: '2026-11-01', to: '2027-04-09' }]);
    expect(s.firstBookable).toBe('2027-04-10');
  });

  it('reads a one-day weather closure, "tomorrow", a Greek notice, and nothing when there is no notice', () => {
    expect(parseSamariaPage(alert('The Samaria National Park will remain closed on 23/09/2026 due to the weather forecast.'), '2026-09-22').ranges).toEqual([{ from: '2026-09-23', to: '2026-09-23' }]);
    expect(parseSamariaPage(alert('The National Park will remain closed tomorrow due to heavy rainfall.'), '2026-09-22').ranges).toEqual([{ from: '2026-09-23', to: '2026-09-23' }]);
    expect(parseSamariaPage(alert('Ο Εθνικός Δρυμός θα παραμείνει κλειστός λόγω επικείμενων βροχοπτώσεων.'), '2026-09-22').ranges).toEqual([{ from: '2026-09-22', to: '2026-09-22' }]);
    const open = parseSamariaPage('<input type="date" name="dateRange.start" value="2026-09-22"><p>Tickets are mandatory.</p>', '2026-09-22');
    expect(open.notice).toBeNull();
    expect(open.ranges).toEqual([]);
  });

  it('trusts the first bookable date when the form itself refuses today', () => {
    const s = parseSamariaPage('<input type="date" name="dateRange.start" value="2026-09-24"><p>Tickets are mandatory.</p>', '2026-09-22');
    expect(s.ranges).toEqual([{ from: '2026-09-22', to: '2026-09-23' }]);
  });
});

describe('official closures in the engine', () => {
  const closures: Closures = { checkedAt: '2026-07-14T15:00:00Z', spots: { samaria: { ranges: [{ from: '2026-07-15', to: '2026-07-15' }], notice: 'closed', source: 'test', checkedAt: '2026-07-14T15:00:00Z' } } };

  it('attaches ranges only to the spots named', () => {
    const spots = applyClosures(SPOTS, closures);
    expect(isClosedOn(spots.find((s) => s.id === 'samaria')!, '2026-07-15')).toBe(true);
    expect(isClosedOn(spots.find((s) => s.id === 'samaria')!, '2026-07-16')).toBe(false);
    expect(spots.find((s) => s.id === 'imbros')!.closures).toBeUndefined();
    expect(applyClosures(SPOTS, null)).toBe(SPOTS);
  });

  it('a closed park is unsuitable on a perfect day, and open again the day after', () => {
    const calm = { windKmh: 6, windDir: 20, waveM: 0.2, waveDir: 20, apparent: 26 };
    const spots = applyClosures(SPOTS, closures);
    const closed = analyzeDay(spots, scenario({ ...calm, date: '2026-07-15' }), 'active', BASES[0], { daysAhead: 1 }).scores.samaria;
    expect(closed.verdict).toBe('unsuitable');
    expect(closed.unsuitableReason).toMatchObject({ key: 'closed', params: { kind: 'official' } });
    expect(factorText(closed.unsuitableReason, 'en')).toMatch(/decision of the park/);
    expect(factorText(closed.unsuitableReason, 'el')).toMatch(/απόφαση του Πάρκου/);
    const open = analyzeDay(spots, scenario({ ...calm, date: '2026-07-16' }), 'active', BASES[0], { daysAhead: 2 }).scores.samaria;
    expect(open.verdict).not.toBe('unsuitable');
  });
});
