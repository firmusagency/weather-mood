import { applyClosures, type Closures } from './closures';
import { applyCalibration, type Calibration } from './feedback';
import { applyStationCalibration, type StationCalibration } from './stationcal';
import type { Spot } from './types';

/*
 * Everything measured or announced that changes how the static spot list is read on a given day:
 * guest-feedback wave factors, station gust factors and official closures. Every page and every
 * script goes through adjustSpots, so the guest page, the lobby, the dashboard and the evening
 * message can never disagree about a spot.
 */
export interface Adjustments {
  calibration: Calibration | null;
  stations: StationCalibration | null;
  closures: Closures | null;
}

export const NO_ADJUSTMENTS: Adjustments = { calibration: null, stations: null, closures: null };

export function adjustSpots(spots: Spot[], adj: Adjustments | null | undefined): Spot[] {
  if (!adj) return spots;
  return applyClosures(applyStationCalibration(applyCalibration(spots, adj.calibration), adj.stations), adj.closures);
}
