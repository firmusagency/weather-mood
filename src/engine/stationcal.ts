import { NOA_STATIONS, type DailyVerificationRow, type NoaStation } from './noa';
import type { Spot } from './types';

/*
 * Gust correction from the coastal stations. The verification compares, every day, the strongest
 * gust we forecast at a station's point with the strongest gust the station measured. When a
 * station shows, over a month, that the gusts come in clearly and consistently stronger than the
 * forecast, the spots it covers get their forecast gust scaled up.
 *
 * Only upward: a station that reads LOWER than the forecast is usually a sheltered station
 * (Elafonisi and Kissamos sit inland of the beach), and a recommendation engine must not relax a
 * wind forecast on the word of one sheltered anemometer. Average wind is not corrected: on the
 * stations where gusts are under-forecast, the daily mean is not.
 */

export const STATION_CAL = {
  /** Days with a meaningful forecast gust needed before anything is applied. */
  minDays: 30,
  /** Rolling window of days considered. */
  windowDays: 60,
  /** Days with a forecast gust below this (km/h) say nothing about a ratio. */
  minForecastGust: 15,
  /** Median observed/forecast ratio that counts as "clearly stronger". */
  minRatio: 1.1,
  /** Share of days the station must have exceeded the forecast. */
  minUnderShare: 0.7,
  /** Forecast and station must move together; otherwise the station measures something else. */
  minCorr: 0.6,
  maxFactor: 1.25,
} as const;

export type StationCalStatus = 'applied' | 'collecting' | 'reads-low' | 'no-bias' | 'inconsistent';

export interface StationCalEntry {
  station: string;
  name: string;
  days: number;
  /** Median of observed max gust / forecast max gust. */
  medianRatio: number | null;
  /** Share of days the observed gust exceeded the forecast. */
  underShare: number | null;
  corr: number | null;
  status: StationCalStatus;
  /** 1 unless status is 'applied'. */
  gustFactor: number;
  spots: string[];
}

export interface StationCalibration {
  updatedAt: string;
  minDays: number;
  stations: StationCalEntry[];
  /** Spot id → factor, only for applied stations. */
  spots: Record<string, { gustFactor: number; station: string }>;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function correlation(x: number[], y: number[]): number {
  const mx = mean(x);
  const my = mean(y);
  let n = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i += 1) {
    n += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? n / Math.sqrt(dx * dy) : 0;
}
const r2 = (x: number) => Math.round(x * 100) / 100;

export function buildStationCalibration(rows: DailyVerificationRow[], now = new Date(), stations: NoaStation[] = NOA_STATIONS): StationCalibration {
  const out: StationCalibration = { updatedAt: now.toISOString(), minDays: STATION_CAL.minDays, stations: [], spots: {} };
  for (const st of stations) {
    const rs = rows
      .filter((r) => r.station === st.id && r.gust.forecastMax >= STATION_CAL.minForecastGust)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-STATION_CAL.windowDays);
    const spots = st.covers ?? [st.spotId];
    const entry: StationCalEntry = { station: st.id, name: st.name, days: rs.length, medianRatio: null, underShare: null, corr: null, status: 'collecting', gustFactor: 1, spots };
    if (rs.length >= 3) {
      const ratios = rs.map((r) => r.gust.observedMax / r.gust.forecastMax);
      entry.medianRatio = r2(median(ratios));
      entry.underShare = r2(ratios.filter((x) => x > 1).length / ratios.length);
      entry.corr = r2(correlation(rs.map((r) => r.gust.forecastMax), rs.map((r) => r.gust.observedMax)));
    }
    if (rs.length >= STATION_CAL.minDays && entry.medianRatio != null) {
      if (entry.medianRatio < 0.9) entry.status = 'reads-low';
      else if (entry.medianRatio < STATION_CAL.minRatio) entry.status = 'no-bias';
      else if ((entry.underShare ?? 0) < STATION_CAL.minUnderShare || (entry.corr ?? 0) < STATION_CAL.minCorr) entry.status = 'inconsistent';
      else {
        entry.status = 'applied';
        entry.gustFactor = Math.min(STATION_CAL.maxFactor, entry.medianRatio);
        for (const id of spots) out.spots[id] = { gustFactor: entry.gustFactor, station: st.id };
      }
    }
    out.stations.push(entry);
  }
  return out;
}

/** Spots with the station gust factors attached (no-op without applied stations). */
export function applyStationCalibration(spots: Spot[], cal: StationCalibration | null | undefined): Spot[] {
  if (!cal || !Object.keys(cal.spots).length) return spots;
  return spots.map((s) => {
    const c = cal.spots[s.id];
    return c && c.gustFactor !== 1 ? { ...s, gustFactor: c.gustFactor } : s;
  });
}
