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
  /** Sea temperature (°C) from which a swim is comfortable for this guest; below it a beach loses points. */
  waterComfort: number;
  /** Used to cold water (winter swimmers): the cold limits sit lower and cool air costs less. */
  coldAdapted?: boolean;
}

export const PROFILES: Profile[] = [
  {
    id: 'family',
    name: { el: 'Οικογένεια με μικρά παιδιά', en: 'Family with young kids' },
    icon: '👨‍👩‍👧',
    seaTolerance: [0.25, 0.6],
    travel: [40, 110, 25],
    heatSensitive: true,
    waterComfort: 23,
  },
  {
    id: 'couple',
    name: { el: 'Ζευγάρι', en: 'Couple' },
    icon: '💑',
    seaTolerance: [0.45, 1.0],
    travel: [70, 150, 15],
    heatSensitive: false,
    waterComfort: 22,
  },
  {
    id: 'solo',
    name: { el: 'Μόνος/η ταξιδιώτης', en: 'Solo traveller' },
    icon: '🎒',
    seaTolerance: [0.45, 1.0],
    travel: [70, 150, 15],
    heatSensitive: false,
    waterComfort: 22,
  },
  {
    id: 'active',
    name: { el: 'Δραστήριοι / πεζοπόροι', en: 'Active / hikers' },
    icon: '🥾',
    seaTolerance: [0.7, 1.4],
    travel: [90, 180, 10],
    heatSensitive: false,
    waterComfort: 22,
  },
  {
    id: 'senior',
    name: { el: 'Ηλικιωμένοι / μειωμένη κινητικότητα', en: 'Seniors / reduced mobility' },
    icon: '🧓',
    seaTolerance: [0.3, 0.7],
    travel: [45, 120, 25],
    heatSensitive: true,
    waterComfort: 23,
  },
  {
    id: 'nocar',
    name: { el: 'Χωρίς αυτοκίνητο (λεωφορείο)', en: 'No car (bus)' },
    icon: '🚌',
    seaTolerance: [0.45, 1.0],
    travel: [35, 130, 25],
    heatSensitive: false,
    waterComfort: 22,
  },
  {
    // swims all year: judged on the sea state, the wind and the rain, not on how warm it is
    id: 'winter',
    name: { el: 'Χειμερινός κολυμβητής', en: 'Winter swimmer' },
    icon: '🏊',
    // cold water tires a swimmer faster, so waves count a little sooner than for a summer couple
    seaTolerance: [0.4, 0.9],
    travel: [45, 120, 20],
    heatSensitive: false,
    waterComfort: 16,
    coldAdapted: true,
  },
];

export const profileById = (id: ProfileId) => PROFILES.find((p) => p.id === id)!;
