import type { Base } from '../engine/types';
import propertiesJson from '../data/properties.json';

export const GUEST_LANGS = ['el', 'en', 'de', 'fr'] as const;
export type GuestLang = (typeof GUEST_LANGS)[number];
export const LANG_NAMES_SHORT: Record<GuestLang, string> = { el: 'EL', en: 'EN', de: 'DE', fr: 'FR' };

export type LText = Partial<Record<GuestLang, string>>;
/** Text in the guest's language, falling back to English, then Greek. */
export const lt = (x: LText | undefined, lang: GuestLang) => x?.[lang] ?? x?.en ?? x?.el ?? '';

/** Something the property wants every guest to know: its taverna, car hire partner, boat tickets. */
export interface PropertyTip {
  icon?: string;
  title: LText;
  text?: LText;
  url?: string;
  /** International format; rendered as a tap-to-call button. */
  phone?: string;
}

/** What each accommodation customises on its guest pages (src/data/properties.json). */
export interface Property {
  id: string;
  name: string;
  /** Short line under the name, per language (falls back to English). */
  tagline: LText;
  base: Base;
  /** Brand colour used for buttons, highlights and the monogram. */
  brand: string;
  /** Logo image (URL or path under public/); the monogram is used when absent. */
  logo?: string;
  /** Where the guest QR code points to. */
  guestUrl: string;
  /** Reception WhatsApp number (international, digits only). Guests tap to ask for the evening message. */
  whatsapp?: string;
  /** Where the weekly report and reception digests go. */
  email?: string;
  /** Shown in the privacy note as the address for data questions (the reception is named when absent). */
  privacyContact?: string;
  /** Spots the property especially recommends: shown with a badge. */
  favourites?: string[];
  tips?: PropertyTip[];
}

/** Build-time (Vite) or process env, so the same module works in the browser and in the nightly scripts. */
function envVar(name: string): string | undefined {
  const vite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (vite && vite[name]) return vite[name];
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

export type StoredProperty = Omit<Property, 'guestUrl'> & { guestUrl?: string };
const STORED = propertiesJson as StoredProperty[];

const DEFAULT_GUEST_URL = 'https://firmusagency.github.io/weather-mood/guest.html';

/** The link a property hands to its guests: every property but the first carries its id (`?p=<id>`). */
export function guestUrlFor(baseUrl: string, id: string, isDefault: boolean): string {
  if (isDefault || /[?&]p=/.test(baseUrl)) return baseUrl;
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}p=${encodeURIComponent(id)}`;
}

/**
 * Stored properties with the environment folded in. The first one is the default: it owns the bare
 * guest link and the environment's WhatsApp number and email; the others use their own settings.
 */
export function resolveProperties(stored: StoredProperty[], env: (name: string) => string | undefined = envVar): Property[] {
  return stored.map((p, i) => {
    const first = i === 0;
    const guestUrl = guestUrlFor(p.guestUrl || env('VITE_GUEST_URL') || DEFAULT_GUEST_URL, p.id, first);
    return { ...p, guestUrl, whatsapp: p.whatsapp || (first ? env('VITE_RECEPTION_WHATSAPP') : undefined) || undefined, email: p.email || (first ? env('OWNER_EMAIL') : undefined) };
  });
}

export const PROPERTIES: Property[] = resolveProperties(STORED);
export const propertyById = (id: string | null | undefined, all: Property[] = PROPERTIES) => all.find((p) => p.id === id);

const REMEMBER_KEY = 'wm:property';

/** Which property a page is for: the link wins, then what this browser opened before, then the build's default. */
export function resolvePropertyId(src: { query?: string | null; stored?: string | null; env?: string | null }, all: Property[] = PROPERTIES): string {
  for (const id of [src.query, src.stored, src.env]) if (id && all.some((p) => p.id === id)) return id;
  return all[0].id;
}

/**
 * The property this page is for: `?p=<id>` in the URL, else the one this browser opened last (a guest
 * who scanned the hotel's QR and comes back through a bookmark), else VITE_PROPERTY_ID, else the first.
 */
export function currentProperty(): Property {
  let query: string | null = null;
  let stored: string | null = null;
  if (typeof location !== 'undefined') query = new URLSearchParams(location.search).get('p');
  try {
    if (typeof localStorage !== 'undefined') {
      if (query && PROPERTIES.some((p) => p.id === query)) localStorage.setItem(REMEMBER_KEY, query);
      stored = localStorage.getItem(REMEMBER_KEY);
    }
  } catch {
    /* private mode */
  }
  return propertyById(resolvePropertyId({ query, stored, env: envVar('VITE_PROPERTY_ID') }))!;
}

/** The first (default) property; a fictional demo one until the first customer's details replace it. */
export const DEMO_PROPERTY: Property = PROPERTIES[0];
export const isDefaultProperty = (p: Property) => p.id === PROPERTIES[0].id;
