import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RETENTION } from '../src/engine/retention';
import { maskPersonal } from '../src/engine/feedback';
import { privacyNotice } from '../src/guest/privacy';
import { g } from '../src/guest/i18n';
import { LAST_CALL, PUSH_IDLE, idleDays, pushAudience, withLastCall } from '../scripts/push';

const LANGS = ['el', 'en', 'de', 'fr'] as const;
const read = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

describe('privacy note', () => {
  it('says the same things in every language, with the real retention numbers', () => {
    const shape = (lang: (typeof LANGS)[number]) => privacyNotice(lang, { property: 'Alkyoni Suites' }).sections.map((s) => s.items.length);
    for (const lang of LANGS) {
      const n = privacyNotice(lang, { property: 'Alkyoni Suites' });
      const all = [n.title, n.link, n.intro, n.updated, ...n.sections.flatMap((s) => [s.heading, ...s.items])].join('\n');
      expect(shape(lang), lang).toEqual(shape('el'));
      expect(all, lang).toContain('Alkyoni Suites');
      expect(all, lang).toMatch(new RegExp(`\\b${RETENTION.visitDays}\\b`));
      expect(all, lang).toMatch(new RegExp(`\\b${RETENTION.pushIdleDays}\\b`));
      expect(all, lang).toContain(g(lang).push.stop); // the button it points to exists under that name
      expect(all, lang).toContain(g(lang).directions);
      expect(all, lang).toContain('dpa.gr');
      expect(all, lang).not.toMatch(/undefined|\{|\}|NaN/);
    }
    expect(privacyNotice('el', { property: 'X' }).updated).toBe('Τελευταία ενημέρωση: 13 Νοεμβρίου 2026');
  });

  it('names the contact, the operator and the guest’s own code only when there is one', () => {
    const bare = JSON.stringify(privacyNotice('en', { property: 'X' }));
    expect(bare).not.toMatch(/write to|Your code/);
    const full = JSON.stringify(privacyNotice('en', { property: 'X', contact: 'privacy@example.test', operator: 'Example Ltd', code: 'abc-123' }));
    expect(full).toContain('or write to privacy@example.test');
    expect(full).toContain('Weather Mood service (Example Ltd)');
    expect(full).toContain('Your code: abc-123');
  });

  it('page opens are really deleted after the days the note promises', () => {
    expect(read('supabase/migrations/0007_visits_retention.sql')).toContain(`interval '${RETENTION.visitDays} days'`);
    expect(PUSH_IDLE).toEqual({ days: RETENTION.pushIdleDays, noticeDays: RETENTION.pushNoticeDays });
  });

  it('the live pages load their fonts from the site itself, not from Google', () => {
    for (const page of ['index.html', 'guest.html', 'accuracy.html']) expect(read(page), page).not.toMatch(/googleapis|gstatic/);
    expect(read('src/fonts.css')).toMatch(/@fontsource-variable\/commissioner/);
    for (const main of ['src/main.tsx', 'src/guest/main.tsx', 'src/accuracy/main.tsx']) expect(read(main), main).toMatch(/fonts\.css'/);
  });
});

describe('comments are published without contact details', () => {
  it('blanks e-mail addresses, links and phone numbers and keeps the rest', () => {
    expect(maskPersonal('Πολύ κύμα στα Φαλάσαρνα στις 12:30, 2026-11-13')).toBe('Πολύ κύμα στα Φαλάσαρνα στις 12:30, 2026-11-13');
    expect(maskPersonal('call me +30 694 123 4567 or maria@example.com')).toBe('call me [phone] or [email]');
    expect(maskPersonal('photos at https://example.com/a?b=1 and www.example.org')).toBe('photos at [link] and [link]');
    expect(maskPersonal('6941234567')).toBe('[phone]');
    expect(maskPersonal('room 204, 3 of us')).toBe('room 204, 3 of us');
    expect(maskPersonal('  ')).toBeNull();
    expect(maskPersonal(null)).toBeNull();
  });

  it('the comment field asks for no personal details in every language', () => {
    expect(g('el').fb.note).toMatch(/χωρίς προσωπικά στοιχεία/);
    expect(g('en').fb.note).toMatch(/no personal details/);
    expect(g('de').fb.note).toMatch(/keine persönlichen Daten/);
    expect(g('fr').fb.note).toMatch(/sans données personnelles/);
  });
});

describe('notifications end with the stay', () => {
  const now = new Date('2026-11-20T15:40:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000 - 3_600_000).toISOString();

  it('counts idle days from the subscription or the last page open, whichever is later', () => {
    expect(idleDays({ created_at: daysAgo(3), client_id: 'a' }, new Map(), now)).toBe(3);
    expect(idleDays({ created_at: daysAgo(30), client_id: 'a' }, new Map([['a', daysAgo(1)]]), now)).toBe(1);
    expect(idleDays({ created_at: daysAgo(2), client_id: 'a' }, new Map([['a', daysAgo(8)]]), now)).toBe(2);
    expect(idleDays({ created_at: daysAgo(30), client_id: 'a' }, new Map([['b', daysAgo(1)]]), now)).toBe(30);
    // a row that cannot be dated is kept rather than dropped
    expect(idleDays({ created_at: null, client_id: null }, new Map(), now)).toBe(0);
  });

  it('keeps guests who are here, warns the quiet ones, drops those who left', () => {
    const subs = [
      { id: 'here', created_at: daysAgo(20), client_id: 'here' },
      { id: 'new', created_at: daysAgo(0), client_id: 'new' },
      { id: 'quiet', created_at: daysAgo(PUSH_IDLE.days - 1), client_id: 'quiet' },
      { id: 'gone', created_at: daysAgo(PUSH_IDLE.days), client_id: 'gone' },
      { id: 'long-gone', created_at: daysAgo(60), client_id: 'long-gone' },
    ];
    const { keep, lapsed } = pushAudience(subs, new Map([['here', daysAgo(1)]]), now);
    expect(lapsed.map((s) => s.id)).toEqual(['gone', 'long-gone']);
    expect(keep.map((s) => [s.id, s.lastCall])).toEqual([
      ['here', false],
      ['new', false],
      ['quiet', true],
    ]);
  });

  it('the last messages say so in the guest’s language', () => {
    expect(withLastCall('Tomorrow: Stavros', { lastCall: false, lang: 'en' })).toBe('Tomorrow: Stavros');
    expect(withLastCall('Αύριο: Σταυρός', { lastCall: true, lang: 'el' })).toBe(`Αύριο: Σταυρός\n${LAST_CALL.el}`);
    expect(withLastCall('Morgen', { lastCall: true, lang: null })).toBe(`Morgen\n${LAST_CALL.en}`);
    expect(Object.keys(LAST_CALL).sort()).toEqual(['de', 'el', 'en', 'fr']);
  });
});
