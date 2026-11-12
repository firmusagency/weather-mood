import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { REF_POINTS } from '../src/data/region';
import { shiftDate } from '../src/engine/dates';
import { buildUrls, datasetFromRaw, outlookPlan, planPoints, type RawBundle } from '../src/engine/openmeteo';

describe('previous-days rain request', () => {
  it('asks for the three days before the forecast day, for the gorge and hike points only', () => {
    const plan = planPoints(SPOTS, REF_POINTS);
    expect(plan.recentRain?.map((p) => p.id).sort()).toEqual(['agia-irini', 'gouverneto-katholiko', 'imbros', 'samaria']);
    const url = new URL(buildUrls(plan, '2026-11-01').recentRain!);
    expect(url.searchParams.get('daily')).toBe('precipitation_sum');
    expect(url.searchParams.get('start_date')).toBe('2026-10-29');
    expect(url.searchParams.get('end_date')).toBe('2026-10-31');
    expect(url.searchParams.get('latitude')!.split(',')).toHaveLength(4);
    // the reference-points outlook has no gorges, so no request
    expect(buildUrls(outlookPlan(REF_POINTS), '2026-11-01', undefined, '2026-11-07').recentRain).toBeUndefined();
  });

  it('shifts dates across month and year ends', () => {
    expect(shiftDate('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDate('2026-01-01', -3)).toBe('2025-12-29');
    expect(shiftDate('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('turns the daily sums into previous-day and three-day totals, and tolerates its absence', () => {
    const hourly = { time: ['2026-11-01T10:00'], temperature_2m: [20], precipitation: [0] };
    const base: RawBundle = {
      date: '2026-11-01',
      fetchedAt: '2026-10-31T18:00:00Z',
      plan: { land: [{ id: 'samaria', lat: 35.3, lon: 23.96 }], marine: [{ id: 'x', lat: 35.6, lon: 23.9 }], recentRain: [{ id: 'samaria', lat: 35.3, lon: 23.96 }] },
      atmos: { hourly },
      models: { hourly: { time: hourly.time, wind_speed_10m_icon_seamless: [12], precipitation_icon_seamless: [0.7] } },
      marine: { hourly: { time: hourly.time } },
    };
    const withRain = datasetFromRaw({ ...base, recentRain: { daily: { time: ['2026-10-29', '2026-10-30', '2026-10-31'], precipitation_sum: [1.2, null, 18.4] } } }, 'snapshot');
    expect(withRain.recentRain).toEqual({ samaria: { prevDayMm: 18.4, threeDayMm: 19.6 } });
    expect(datasetFromRaw(base, 'snapshot').recentRain).toBeUndefined();
  });

  it('keeps rain per model next to the wind, and leaves it null for models without it', () => {
    const hourly = { time: ['2026-11-01T10:00'], temperature_2m: [20], precipitation: [0] };
    const ds = datasetFromRaw(
      {
        date: '2026-11-01',
        fetchedAt: '2026-10-31T18:00:00Z',
        plan: { land: [{ id: 'p', lat: 35.3, lon: 23.96 }], marine: [{ id: 'x', lat: 35.6, lon: 23.9 }] },
        atmos: { hourly },
        models: { hourly: { time: hourly.time, wind_speed_10m_icon_seamless: [12], precipitation_icon_seamless: [0.7], wind_speed_10m_gfs_seamless: [10] } },
        marine: { hourly: { time: hourly.time } },
      },
      'snapshot',
    );
    expect(ds.land.p.models.icon_seamless[0]).toMatchObject({ wind: 12, precip: 0.7 });
    expect(ds.land.p.models.gfs_seamless[0].precip).toBeNull();
  });
});

describe('patience with the weather provider', () => {
  const ok = (body: unknown) => ({ ok: true, status: 200, statusText: 'OK', json: async () => body }) as Response;
  const bad = (status: number, reason: string) => ({ ok: false, status, statusText: reason, json: async () => ({ error: true, reason }) }) as Response;
  const run = async (responses: (Response | Error)[], retries = 2) => {
    const waits: number[] = [];
    let calls = 0;
    const fetchImpl = (async () => {
      const r = responses[Math.min(calls, responses.length - 1)];
      calls += 1;
      if (r instanceof Error) throw r;
      return r;
    }) as unknown as typeof fetch;
    const { getWithRetry } = await import('../src/engine/openmeteo');
    const result = await getWithRetry('https://marine-api.open-meteo.com/v1/marine?x=1', fetchImpl, { retries, sleep: async (ms) => void waits.push(ms) }).then(
      (v) => ({ v }),
      (e: Error) => ({ e }),
    );
    return { ...result, calls, waits } as { v?: unknown; e?: Error; calls: number; waits: number[] };
  };

  it('retries a connect timeout and a 5xx, then succeeds', async () => {
    const r = await run([new TypeError('fetch failed'), bad(502, 'Bad Gateway'), ok({ hourly: {} })]);
    expect(r.v).toEqual({ hourly: {} });
    expect(r.calls).toBe(3);
    expect(r.waits).toHaveLength(2);
  });

  it('waits a full minute after "too many requests"', async () => {
    const { RATE_LIMIT_WAIT_MS } = await import('../src/engine/openmeteo');
    const r = await run([bad(429, 'Minutely API request limit exceeded'), ok({ hourly: {} })]);
    expect(r.v).toEqual({ hourly: {} });
    expect(r.waits).toEqual([RATE_LIMIT_WAIT_MS]);
  });

  it('does not retry a request that is simply wrong, and gives up after the last attempt', async () => {
    const wrong = await run([bad(400, 'Cannot initialize WeatherVariable')]);
    expect(wrong.e?.message).toMatch(/400/);
    expect(wrong.calls).toBe(1);
    const down = await run([new TypeError('fetch failed')], 2);
    expect(down.e?.message).toMatch(/fetch failed/);
    expect(down.calls).toBe(3);
  });
});

describe('outlook carry-over', () => {
  it('keeps a recent outlook and drops an old or missing one', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { previousOutlook } = await import('../scripts/fetch-snapshot');
    const dir = mkdtempSync(join(tmpdir(), 'wm-'));
    const now = Date.parse('2026-11-12T16:00:00Z');
    const file = (outlook: unknown) => {
      const f = join(dir, `${Math.random()}.json`);
      writeFileSync(f, JSON.stringify({ generatedAt: '2026-11-12T10:00:00Z', days: {}, ...(outlook ? { outlook } : {}) }));
      return f;
    };
    expect(previousOutlook(file({ fetchedAt: '2026-11-12T10:00:00Z', date: '2026-11-12' }), 30, now)?.fetchedAt).toBe('2026-11-12T10:00:00Z');
    expect(previousOutlook(file({ fetchedAt: '2026-11-10T10:00:00Z', date: '2026-11-10' }), 30, now)).toBeUndefined();
    expect(previousOutlook(file(null), 30, now)).toBeUndefined();
    expect(previousOutlook(join(dir, 'missing.json'), 30, now)).toBeUndefined();
  });
});
