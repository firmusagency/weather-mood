import { describe, expect, it } from 'vitest';
import { REF_POINTS } from '../src/data/region';
import { SPOTS } from '../src/data/spots';
import { datasetFromRaw } from '../src/engine/openmeteo';
import { guestUrlFor, PROPERTIES, resolveProperties, resolvePropertyId, type StoredProperty } from '../src/guest/property';
import { buildEveningAll, eveningPartFor, eveningParts } from '../scripts/evening';
import { buildPlanBAll, planBParts, shouldSendPlanB } from '../scripts/morning-check';
import { planBFor } from '../src/ui/data';
import { manifestFor } from '../scripts/manifests.mjs';

// a second, made-up property on the south coast, next to the demo one in Platanias
const STORED: StoredProperty[] = [
  { id: 'demo-alkyoni', name: 'Alkyoni Suites', tagline: { en: 'Platanias' }, base: { id: 'alkyoni', name: { el: 'Alkyoni', en: 'Alkyoni' }, lat: 35.5172, lon: 23.9105 }, brand: '#2a6f97' },
  { id: 'notos-rooms', name: 'Notos Rooms', tagline: { en: 'Paleochora' }, base: { id: 'notos', name: { el: 'Notos', en: 'Notos' }, lat: 35.231, lon: 23.681 }, brand: '#b45f06', email: 'reception@notos.example', whatsapp: '306900000000' },
];
const env = (name: string) => ({ VITE_GUEST_URL: 'https://example.test/guest.html', VITE_RECEPTION_WHATSAPP: '302821000000', OWNER_EMAIL: 'owner@example.test' })[name];
const PROPS = resolveProperties(STORED, env);

describe('properties', () => {
  it('gives every property but the first its own guest link, and keeps settings apart', () => {
    expect(PROPS[0].guestUrl).toBe('https://example.test/guest.html');
    expect(PROPS[1].guestUrl).toBe('https://example.test/guest.html?p=notos-rooms');
    expect(guestUrlFor('https://x.test/g?lang=de', 'a b', false)).toBe('https://x.test/g?lang=de&p=a%20b');
    // the environment's reception number and owner email belong to the default property only
    expect(PROPS[0].whatsapp).toBe('302821000000');
    expect(PROPS[1].whatsapp).toBe('306900000000');
    expect(PROPS[0].email).toBe('owner@example.test');
    expect(PROPS[1].email).toBe('reception@notos.example');
  });

  it('opens the property of the link, then the one this browser opened before, then the default', () => {
    expect(resolvePropertyId({ query: 'notos-rooms', stored: 'demo-alkyoni' }, PROPS)).toBe('notos-rooms');
    expect(resolvePropertyId({ query: null, stored: 'notos-rooms' }, PROPS)).toBe('notos-rooms');
    expect(resolvePropertyId({ query: 'no-such-hotel', stored: null, env: 'notos-rooms' }, PROPS)).toBe('notos-rooms');
    expect(resolvePropertyId({}, PROPS)).toBe('demo-alkyoni');
  });

  it('installs each property with a manifest that opens its own page', () => {
    const base = { name: 'Weather Mood · Guest guide', short_name: 'Weather Mood', start_url: './guest.html?source=pwa', scope: './', theme_color: '#2a6f97', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] };
    const m = manifestFor(STORED[1], base);
    expect(m.start_url).toBe('../guest.html?p=notos-rooms&source=pwa');
    expect(m.name).toBe('Notos Rooms · Weather Mood');
    expect(m.theme_color).toBe('#b45f06');
    expect(m.icons[0].src).toBe('../icons/icon-192.png');
  });

  it('the shipped configuration is consistent', () => {
    expect(PROPERTIES.length).toBeGreaterThan(0);
    expect(new Set(PROPERTIES.map((p) => p.id)).size).toBe(PROPERTIES.length);
    for (const p of PROPERTIES) for (const id of p.favourites ?? []) expect(SPOTS.some((s) => s.id === id), `${p.id}: favourite ${id}`).toBe(true);
    expect(REF_POINTS.length).toBeGreaterThan(0);
    expect(typeof datasetFromRaw).toBe('function');
  });
});

describe('one evening pack and one morning check for all properties', () => {
  it('each property gets its own picks, its own name and its own link', async () => {
    const { rawBundle } = await import('./raw');
    const calm = rawBundle({ windKmh: 8, windDir: 20, waveM: 0.2, waveDir: 20 });
    const pack = buildEveningAll(calm, '2026-07-15', '2026-07-14T15:40:00Z', PROPS, new Date('2026-07-14T15:40:00Z'));
    expect(eveningParts(pack).map((p) => p.property.id)).toEqual(['demo-alkyoni', 'notos-rooms']);
    // the top level is still the default property, exactly as single-property packs were
    expect(pack.property.name).toBe('Alkyoni Suites');
    const south = eveningPartFor(pack, 'notos-rooms')!;
    expect(south.messages.couple!.en).toContain('Notos Rooms');
    expect(south.messages.couple!.en).toContain('https://example.test/guest.html?p=notos-rooms');
    expect(pack.messages.couple!.en).not.toContain('?p=');
    // forty minutes from Platanias is not forty minutes from Paleochora: the picks are computed per door
    const top = (id: string) => eveningPartFor(pack, id)!.plans.family!.picks.map((p) => p.spotId).join(',');
    expect(top('notos-rooms')).not.toBe(top('demo-alkyoni'));

    // overnight a westerly arrives: both properties are checked against their own evening plan
    const windy = rawBundle({ windKmh: 32, windDir: 270, waveM: 1.4, waveDir: 270 });
    const report = buildPlanBAll(pack, windy, PROPS, new Date('2026-07-15T03:50:00Z'));
    const parts = planBParts(report);
    expect(parts.map((p) => p.property.id)).toEqual(['demo-alkyoni', 'notos-rooms']);
    expect(report.property?.id).toBe('demo-alkyoni');
    expect(parts.some((p) => p.changed)).toBe(true);
    // the dashboard of each property reads its own verdict
    expect(planBFor(report as never, 'notos-rooms', false)?.changed).toBe(report.others!['notos-rooms'].changed);
    expect(planBFor(report as never, 'demo-alkyoni', true)?.changed).toBe(report.changed);
    expect(planBFor(report as never, 'no-such-hotel', false)).toBeNull();
    // one changed property is enough for the 08:30 notification run
    const onlySouth = { ...report, date: '2026-07-15', changed: false, others: { 'notos-rooms': { ...report.others!['notos-rooms'], changed: true } } };
    expect(shouldSendPlanB(onlySouth, new Date('2026-07-15T05:30:00Z')).send).toBe(true);
  });
});
