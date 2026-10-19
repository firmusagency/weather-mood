import type { Base, Text } from '../engine/types';

/** Hotel / accommodation bases the demo can compute travel times from. */
export const BASES: Base[] = [
  { id: 'chania', name: { el: 'Χανιά (πόλη)', en: 'Chania town' }, lat: 35.5138, lon: 24.018 },
  { id: 'platanias', name: { el: 'Πλατανιάς / Αγ. Μαρίνα', en: 'Platanias / Agia Marina' }, lat: 35.517, lon: 23.915 },
  { id: 'kissamos', name: { el: 'Κίσσαμος', en: 'Kissamos' }, lat: 35.494, lon: 23.656 },
  { id: 'almyrida', name: { el: 'Αλμυρίδα / Κάλυβες', en: 'Almyrida / Kalyves' }, lat: 35.447, lon: 24.165 },
  { id: 'paleochora', name: { el: 'Παλαιόχωρα', en: 'Paleochora' }, lat: 35.23, lon: 23.682 },
];

/** Reference sea/land points used for the regional overview. */
export interface RefPoint {
  id: string;
  name: Text;
  lat: number;
  lon: number;
  /** Which way this stretch of coast faces. */
  facing?: number;
}

export const REF_POINTS: RefPoint[] = [
  { id: 'ref-north', name: { el: 'Βόρεια ακτή (κόλπος Χανίων)', en: 'North coast (Gulf of Chania)' }, lat: 35.6, lon: 23.92, facing: 0 },
  { id: 'ref-west', name: { el: 'Δυτική ακτή (Φαλάσαρνα)', en: 'West coast (Falasarna)' }, lat: 35.47, lon: 23.5, facing: 270 },
  { id: 'ref-south', name: { el: 'Νότια ακτή (Λιβυκό, Σφακιά)', en: 'South coast (Libyan Sea, Sfakia)' }, lat: 35.16, lon: 24.05, facing: 180 },
  { id: 'ref-town', name: { el: 'Χανιά (πόλη)', en: 'Chania town' }, lat: 35.5138, lon: 24.018 },
  // the only weather station with public observations nearby: used to verify forecasts
  { id: 'ref-airport', name: { el: 'Αεροδρόμιο Χανίων (σταθμός)', en: 'Chania airport (station)' }, lat: 35.5317, lon: 24.1497 },
];

export const TIMEZONE = 'Europe/Athens';
