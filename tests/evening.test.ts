import { describe, expect, it } from 'vitest';
import { SPOTS } from '../src/data/spots';
import { BASES, REF_POINTS } from '../src/data/region';
import { comparePlans, planSnapshot, type PlanSnapshot } from '../src/engine/planchange';
import { analyzeDay, recommend } from '../src/engine/recommend';
import { buildSynopsis } from '../src/engine/synopsis';
import { daySummary } from '../src/guest/advice';
import { eveningMessage, planBMessage, weatherLine } from '../src/guest/evening';
import { scenario } from './helpers';

const property = { name: 'Alkyoni Suites', guestUrl: 'https://example.test/g' };

function plan(s: Parameters<typeof scenario>[0], profile: 'family' | 'couple' = 'couple') {
  const data = scenario(s);
  const day = analyzeDay(SPOTS, data, profile, BASES[0], { daysAhead: 1 });
  const rec = recommend(SPOTS, day.scores);
  const syn = buildSynopsis(data, REF_POINTS);
  return { data, day, rec, syn, snap: planSnapshot(data.date, profile, rec, syn, '2026-07-14T15:40:00Z') };
}

describe('evening message', () => {
  it('names the day, the weather, three picks with times and the guest link, in each language', () => {
    const { day, rec, syn } = plan({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 }, 'family');
    for (const lang of ['el', 'en', 'de', 'fr'] as const) {
      const text = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'family', lang);
      expect(text).toContain('Alkyoni Suites');
      expect(text).toContain(property.guestUrl);
      expect(text).toMatch(/1\. .+ · \d{2}:00–\d{2}:00/);
      expect(text).toMatch(/3\. /);
      expect(text.split('\n').length).toBeLessThan(26);
    }
    const el = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'family', 'el');
    expect(el).toContain('Οικογένεια με παιδιά');
  });

  it('lists what to avoid on a windy day and says so coast by coast', () => {
    const { day, rec, syn } = plan({ windKmh: 30, windDir: 270, waveM: 1.3, waveDir: 270 });
    const text = eveningMessage({ rec, syn, scores: day.scores, conditions: day.conditions }, property, 'couple', 'en');
    expect(text).toContain('Better not tomorrow');
    // reasons sit inside brackets as plain words: no nested brackets, no wave heights
    const avoidLine = text.split('\n').find((l) => l.startsWith('Better not tomorrow'))!;
    expect(avoidLine).not.toMatch(/\([^)]*\(/);
    expect(avoidLine).not.toMatch(/\d m\b/);
    expect(weatherLine(syn, 'en')).toMatch(/wind from the W/);
  });
});

describe('rain that sits on one coast', () => {
  // A southerly day: 8% in town, 78% at the west-coast reference. The town figure alone would say
  // "dry" while Elafonisi is ruled out for rain, which confused the message of 1 Nov 2026.
  const local = plan({ windKmh: 12, windDir: 190, waveM: 0.3, waveDir: 190, precipProb: 8, precipProbByPoint: { 'ref-west': 78 }, precipByPoint: { 'ref-west': 2.4 } });
  const regional = plan({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20, precipProb: 70, precip: 3 });

  it('is named with its coast in the synopsis and the takeaways', () => {
    expect(local.syn.town.rainProbMax).toBe(8);
    expect(local.syn.rain).toEqual({ probMax: 78, sum: 2.4 * 13, coast: 'ref-west' });
    const keys = local.syn.takeaways.map((x) => x.key);
    expect(keys).toContain('rainCoast');
    expect(keys).not.toContain('rain');
  });

  it('is said in the guest summary and the evening message, in every language', () => {
    expect(daySummary(local.syn, 'en').join(' ')).toMatch(/Rain likely on the west coast \(78%\)/);
    expect(daySummary(local.syn, 'el').join(' ')).toMatch(/βροχή στη δυτική ακτή \(78%\)/);
    for (const lang of ['el', 'en', 'de', 'fr'] as const) {
      const text = eveningMessage({ rec: local.rec, syn: local.syn, scores: local.day.scores, conditions: local.day.conditions }, property, 'couple', lang);
      expect(text).toMatch(/78 ?%/); // French writes "78 %"
    }
  });

  it('regional rain keeps the plain wording without a coast', () => {
    expect(regional.syn.rain.coast).toBeNull();
    expect(regional.syn.rain.probMax).toBe(70);
    expect(regional.syn.takeaways.map((x) => x.key)).toContain('rain');
    expect(daySummary(regional.syn, 'en').join(' ')).toContain('Rain likely (70%)');
  });

  it('triggers the morning plan B when rain arrives on a coast, but not against an older town-only plan', () => {
    const dry = plan({ windKmh: 12, windDir: 190, waveM: 0.3, waveDir: 190 });
    const diff = comparePlans(dry.snap, local.snap);
    const rainUp = diff.changes.find((c) => c.kind === 'rainUp');
    expect(rainUp?.params).toEqual({ pp: 78, coast: 'ref-west' });
    expect(diff.significant).toBe(true);
    // an evening pack archived before this field existed compares town vs town (8% → no alarm)
    const { rainProbMaxRegion: _r, rainCoast: _c, ...legacy } = dry.snap;
    expect(comparePlans(legacy as PlanSnapshot, local.snap).changes.map((c) => c.kind)).not.toContain('rainUp');
  });
});

describe('plan B comparison', () => {
  const calm = plan({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 });
  const windy = plan({ windKmh: 32, windDir: 270, waveM: 1.4, waveDir: 270 });

  it('is quiet when nothing moved', () => {
    const diff = comparePlans(calm.snap, { ...calm.snap, generatedAt: '2026-07-15T02:50:00Z' });
    expect(diff.significant).toBe(false);
    expect(diff.changes).toEqual([]);
  });

  it('flags a wind jump, rough sea and dropped picks when a westerly arrives overnight', () => {
    const diff = comparePlans(calm.snap, windy.snap);
    expect(diff.significant).toBe(true);
    const kinds = diff.changes.map((c) => c.kind);
    expect(kinds).toContain('windUp');
    expect(kinds).toContain('seaUp');
    expect(kinds.some((k) => k === 'pickDropped' || k === 'pickDowngraded')).toBe(true);
    const text = planBMessage(diff, property, 'en');
    expect(text).toContain('Good morning');
    expect(text).toMatch(/wind picked up/);
    expect(text).toContain(property.guestUrl);
    const el = planBMessage(diff, property, 'el');
    expect(el).toContain('Καλημέρα');
  });

  it('a better morning (wind dropped) is reported but not alarmed', () => {
    const diff = comparePlans(windy.snap, calm.snap);
    expect(diff.changes.map((c) => c.kind)).toContain('windDown');
    expect(diff.significant).toBe(false);
  });

  it('a pick merely outranked by a new one is not a change', () => {
    const before: PlanSnapshot = { ...calm.snap, picks: [calm.snap.picks[1], calm.snap.picks[0], calm.snap.picks[2]].filter(Boolean) };
    const diff = comparePlans(before, calm.snap);
    expect(diff.significant).toBe(false);
  });
});

describe('push key hygiene', () => {
  it('finds the key inside pasted text, checks it against the public key, and never prints it', async () => {
    const webpush = (await import('web-push')).default;
    const { cleanVapidKey, extractPrivateKey, privateKeyProblem, publicKeyFor, pushEnv, pushMissing } = await import('../scripts/push');
    const pair = webpush.generateVAPIDKeys();
    const other = webpush.generateVAPIDKeys();
    expect(publicKeyFor(pair.privateKey)).toBe(pair.publicKey);

    // paste damage: quotes, padding, newline
    expect(cleanVapidKey(` "${pair.privateKey}=" \n`)).toBe(pair.privateKey);
    // the generator's whole output, a JSON object, a labelled line
    const whole = `=======================================\n\nPublic Key:\n${pair.publicKey}\n\nPrivate Key:\n${pair.privateKey}\n\n=======================================`;
    expect(extractPrivateKey(whole)).toBe(pair.privateKey);
    expect(extractPrivateKey(JSON.stringify(pair))).toBe(pair.privateKey);
    expect(extractPrivateKey(`VAPID_PRIVATE_KEY=${pair.privateKey}`)).toBe(pair.privateKey);
    expect(privateKeyProblem(whole, pair.publicKey)).toBeNull();

    // what cannot be used, described by shape
    expect(privateKeyProblem(pair.publicKey)).toMatch(/PUBLIC key/);
    expect(privateKeyProblem('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJlc2lnbmF0dXJl')).toMatch(/JWT/);
    expect(privateKeyProblem('hello world')).toMatch(/not a VAPID private key/);
    expect(privateKeyProblem(pair.privateKey, other.publicKey)).toMatch(/does not belong to the public key/);

    const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_KEY: 'k', VAPID_PUBLIC_KEY: pair.publicKey };
    expect(pushEnv({ ...env, VAPID_PRIVATE_KEY: whole }, '')?.privateKey).toBe(pair.privateKey);
    expect(pushEnv({ ...env, VAPID_PRIVATE_KEY: other.privateKey }, '')).toBeNull();
    // the key the page uses (.env) wins over a stale repository variable
    expect(pushEnv({ ...env, VAPID_PUBLIC_KEY: other.publicKey, VAPID_PRIVATE_KEY: pair.privateKey }, pair.publicKey)?.publicKey).toBe(pair.publicKey);
    const said = pushMissing({ ...env, VAPID_PRIVATE_KEY: other.privateKey }, '').join(' ');
    expect(said).not.toContain(other.privateKey);
    expect(said).not.toContain(pair.publicKey);
  });
});
