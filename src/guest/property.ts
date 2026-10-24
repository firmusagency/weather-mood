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

type StoredProperty = Omit<Property, 'guestUrl'> & { guestUrl?: string };
const STORED = propertiesJson as StoredProperty[];

const DEFAULT_GUEST_URL = 'https://firmusagency.github.io/weather-mood/guest.html';

function withEnv(p: StoredProperty): Property {
  const guestUrl = envVar('VITE_GUEST_URL') || p.guestUrl || DEFAULT_GUEST_URL;
  return { ...p, guestUrl, whatsapp: envVar('VITE_RECEPTION_WHATSAPP') || p.whatsapp || undefined, email: envVar('OWNER_EMAIL') || p.email };
}

export const PROPERTIES: Property[] = STORED.map(withEnv);

/** The property this build / page is for: `?p=<id>` in the URL, else VITE_PROPERTY_ID, else the first (demo) one. */
export function currentProperty(): Property {
  let id = envVar('VITE_PROPERTY_ID');
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('p');
    if (q) id = q;
  }
  return PROPERTIES.find((p) => p.id === id) ?? PROPERTIES[0];
}

/** Fictional demo property — replaced by the customer's own details in production. */
export const DEMO_PROPERTY: Property = PROPERTIES[0];
