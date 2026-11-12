import { describe, expect, it } from 'vitest';
import { checkHealth, type HealthInputs } from '../src/engine/health';

// 12 Nov 2026, 19:00 Athens (17:00Z): after the evening message is due
const EVENING = new Date('2026-11-12T17:00:00Z');
const MORNING = new Date('2026-11-12T05:00:00Z'); // 07:00 Athens
const good: HealthInputs = {
  snapshot: { generatedAt: '2026-11-12T15:40:00Z', days: ['2026-11-12', '2026-11-13', '2026-11-14'], outlookFetchedAt: '2026-11-12T15:40:00Z' },
  evening: { date: '2026-11-13', generatedAt: '2026-11-12T15:41:00Z' },
  planB: { date: '2026-11-12', checkedAt: '2026-11-12T03:50:00Z' },
  verification: { to: '2026-11-11', updatedAt: '2026-11-12T03:35:00Z' },
  closures: { checkedAt: '2026-11-12T15:40:00Z' },
  delivery: { kind: 'evening', date: '2026-11-13', at: '2026-11-12T15:41:00Z', push: { state: 'sent', sent: 3, failed: 0, removed: 0 }, email: { state: 'off', reason: 'SMTP not configured' } },
};
const level = (inp: HealthInputs, id: string, now = EVENING) => checkHealth(inp, now).items.find((i) => i.id === id)?.level;

describe('health check', () => {
  it('is quiet when everything that should exist does', () => {
    const h = checkHealth(good, EVENING);
    expect(h.ok).toBe(true);
    expect(h.errors + h.warnings).toBe(0);
    expect(h.items.every((i) => i.el && i.en)).toBe(true);
  });

  it('raises an error when the evening message did not go out (12 Nov 2026, 17:40)', () => {
    const missed = { ...good, evening: { date: '2026-11-12', generatedAt: '2026-11-11T15:41:00Z' } };
    expect(level(missed, 'evening')).toBe('error');
    expect(checkHealth(missed, EVENING).ok).toBe(false);
    // the same file is fine in the morning: today's message was made last night
    expect(level(missed, 'evening', MORNING)).toBe('ok');
  });

  it('warns about a missing 7-day outlook (8–12 Nov 2026) and about notifications that are off (25 Oct–11 Nov)', () => {
    expect(level({ ...good, snapshot: { ...good.snapshot!, outlookFetchedAt: null } }, 'outlook')).toBe('warn');
    const off = { ...good, delivery: { ...good.delivery!, push: { state: 'off' as const, reason: 'secret VAPID_PRIVATE_KEY is not a VAPID private key' } } };
    expect(level(off, 'push')).toBe('warn');
    expect(checkHealth(off, EVENING).items.find((i) => i.id === 'push')!.en).toContain('VAPID_PRIVATE_KEY');
    expect(level({ ...good, delivery: { ...good.delivery!, push: { state: 'sent', sent: 0, failed: 2, removed: 0 } } }, 'push')).toBe('warn');
    // warnings do not turn the run red
    expect(checkHealth(off, EVENING).ok).toBe(true);
  });

  it('judges the forecast by its age, and needs tomorrow in it', () => {
    expect(level({ ...good, snapshot: { ...good.snapshot!, generatedAt: '2026-11-12T05:30:00Z' } }, 'snapshot')).toBe('warn'); // 11.5 h
    expect(level({ ...good, snapshot: { ...good.snapshot!, generatedAt: '2026-11-11T22:00:00Z' } }, 'snapshot')).toBe('error'); // 19 h
    expect(level({ ...good, snapshot: { ...good.snapshot!, days: ['2026-11-11', '2026-11-12'] } }, 'days')).toBe('error');
    expect(level({ ...good, snapshot: null }, 'snapshot')).toBe('error');
  });

  it('expects the morning outputs only once their hour has come', () => {
    const before = new Date('2026-11-12T03:00:00Z'); // 05:00 Athens
    const stale = { ...good, planB: { date: '2026-11-11', checkedAt: '2026-11-11T03:50:00Z' }, verification: { to: '2026-11-10', updatedAt: '' }, evening: { date: '2026-11-12', generatedAt: '' } };
    expect(checkHealth(stale, before).items.map((i) => i.id)).not.toContain('planB');
    expect(level(stale, 'planB', MORNING)).toBe('warn');
    expect(level(stale, 'verification', MORNING)).toBe('warn');
  });
});
