import type { ProfileId, Text } from '../engine/types';

export interface Profile {
  id: ProfileId;
  name: Text;
  icon: string;
  /** Wave height at the shore (m): fine below [0], unpleasant/unsafe from [1]. */
  seaTolerance: [number, number];
  /** Travel time (min) where a penalty starts, where it maxes out, and the max penalty. */
  travel: [number, number, number];
  /** Feels-like temperature (°C) from which heat starts to matter for beaches without shade. */
  heatSensitive: boolean;
}

export const PROFILES: Profile[] = [
  {
    id: 'family',
    name: { el: 'Οικογένεια με μικρά παιδιά', en: 'Family with young kids' },
    icon: '👨‍👩‍👧',
    seaTolerance: [0.25, 0.6],
    travel: [40, 110, 25],
    heatSensitive: true,
  },
  {
    id: 'couple',
    name: { el: 'Ζευγάρι', en: 'Couple' },
    icon: '💑',
    seaTolerance: [0.45, 1.0],
    travel: [70, 150, 15],
    heatSensitive: false,
  },
  {
    id: 'solo',
    name: { el: 'Μόνος/η ταξιδιώτης', en: 'Solo traveller' },
    icon: '🎒',
    seaTolerance: [0.45, 1.0],
    travel: [70, 150, 15],
    heatSensitive: false,
  },
  {
    id: 'active',
    name: { el: 'Δραστήριοι / πεζοπόροι', en: 'Active / hikers' },
    icon: '🥾',
    seaTolerance: [0.7, 1.4],
    travel: [90, 180, 10],
    heatSensitive: false,
  },
  {
    id: 'senior',
    name: { el: 'Ηλικιωμένοι / μειωμένη κινητικότητα', en: 'Seniors / reduced mobility' },
    icon: '🧓',
    seaTolerance: [0.3, 0.7],
    travel: [45, 120, 25],
    heatSensitive: true,
  },
  {
    id: 'nocar',
    name: { el: 'Χωρίς αυτοκίνητο (λεωφορείο)', en: 'No car (bus)' },
    icon: '🚌',
    seaTolerance: [0.45, 1.0],
    travel: [35, 130, 25],
    heatSensitive: false,
  },
];

export const profileById = (id: ProfileId) => PROFILES.find((p) => p.id === id)!;
