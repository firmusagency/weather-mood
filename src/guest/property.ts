import type { Base } from '../engine/types';

/** What each accommodation customises on its guest pages. */
export interface Property {
  id: string;
  name: string;
  /** Short line under the name, per language (falls back to English). */
  tagline: Partial<Record<GuestLang, string>>;
  base: Base;
  /** Brand colour used for buttons, highlights and the monogram. */
  brand: string;
  /** Where the guest QR code points to. */
  guestUrl: string;
  /** Reception WhatsApp number (international, digits only). Guests tap to ask for the evening message. */
  whatsapp?: string;
}

export const GUEST_LANGS = ['el', 'en', 'de', 'fr'] as const;
export type GuestLang = (typeof GUEST_LANGS)[number];
export const LANG_NAMES_SHORT: Record<GuestLang, string> = { el: 'EL', en: 'EN', de: 'DE', fr: 'FR' };

/** Build-time (Vite) or process env, so the same module works in the browser and in the nightly scripts. */
function envVar(name: string): string | undefined {
  const vite = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  if (vite && vite[name]) return vite[name];
  return typeof process !== 'undefined' ? process.env?.[name] : undefined;
}

/** Fictional demo property — replaced by the customer's own details in production. */
export const DEMO_PROPERTY: Property = {
  id: 'demo-alkyoni',
  name: 'Alkyoni Suites',
  tagline: {
    el: 'Πλατανιάς, Χανιά',
    en: 'Platanias, Chania',
    de: 'Platanias, Chania',
    fr: 'Platanias, La Canée',
  },
  base: { id: 'alkyoni', name: { el: 'Alkyoni Suites', en: 'Alkyoni Suites' }, lat: 35.5172, lon: 23.9105 },
  brand: '#2a6f97',
  guestUrl: envVar('VITE_GUEST_URL') || 'https://weather-mood.example/g/demo-alkyoni',
  whatsapp: envVar('VITE_RECEPTION_WHATSAPP') || undefined,
};
