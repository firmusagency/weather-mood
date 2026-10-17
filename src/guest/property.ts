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
}

export const GUEST_LANGS = ['el', 'en', 'de', 'fr'] as const;
export type GuestLang = (typeof GUEST_LANGS)[number];

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
  guestUrl: import.meta.env.VITE_GUEST_URL || 'https://weather-mood.example/g/demo-alkyoni',
};
