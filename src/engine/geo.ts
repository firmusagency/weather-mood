import type { Lang, Sector } from './types';

const R_EARTH_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export const norm360 = (d: number) => ((d % 360) + 360) % 360;

/** Smallest absolute difference between two bearings, 0..180. */
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(norm360(a) - norm360(b));
  return d > 180 ? 360 - d : d;
}

/** True if bearing `d` lies in the clockwise sector [from, to]. */
export function inSector(d: number, [from, to]: Sector): boolean {
  const x = norm360(d);
  const f = norm360(from);
  const t = norm360(to);
  return f <= t ? x >= f && x <= t : x >= f || x <= t;
}

export const inAnySector = (d: number, sectors?: Sector[]) => !!sectors?.some((s) => inSector(d, s));

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
}

/** Point `km` away from (lat, lon) along `bearing`. */
export function offsetPoint(lat: number, lon: number, bearing: number, km: number) {
  const dLat = (km / 111.2) * Math.cos(toRad(bearing));
  const dLon = (km / (111.2 * Math.cos(toRad(lat)))) * Math.sin(toRad(bearing));
  return { lat: round(lat + dLat, 4), lon: round(lon + dLon, 4) };
}

export const round = (x: number, digits = 1) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

/** Vector mean of directions, optionally weighted (e.g. by wind speed). */
export function circularMean(dirs: number[], weights?: number[]): number {
  let x = 0;
  let y = 0;
  dirs.forEach((d, i) => {
    const w = weights?.[i] ?? 1;
    x += w * Math.cos(toRad(d));
    y += w * Math.sin(toRad(d));
  });
  if (x === 0 && y === 0) return dirs[0] ?? 0;
  return norm360(toDeg(Math.atan2(y, x)));
}

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const BF_LIMITS_KMH = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
export function beaufort(kmh: number): number {
  const i = BF_LIMITS_KMH.findIndex((lim) => kmh < lim);
  return i === -1 ? 12 : i;
}

/** Linear 0→1 ramp between lo and hi. */
export function ramp(x: number, lo: number, hi: number): number {
  if (x <= lo) return 0;
  if (x >= hi) return 1;
  return (x - lo) / (hi - lo);
}

const COMPASS: Record<Lang, string[]> = {
  el: ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'],
  en: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};
/** Traditional Greek names of the eight winds. */
const WIND_NAMES_EL = ['Τραμουντάνα', 'Γραίγος', 'Λεβάντες', 'Σιρόκος', 'Όστρια', 'Γαρμπής', 'Πουνέντες', 'Μαΐστρος'];

export const compassIndex = (deg: number) => Math.round(norm360(deg) / 45) % 8;
export const compass = (deg: number, lang: Lang) => COMPASS[lang][compassIndex(deg)];
export const windNameEl = (deg: number) => WIND_NAMES_EL[compassIndex(deg)];
