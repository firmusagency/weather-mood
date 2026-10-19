// Core domain types for the weather → local decision engine.

export type Lang = 'el' | 'en';
export type Text = { el: string; en: string };

/** A compass sector of "wind/waves coming FROM" directions, clockwise from `from` to `to` (degrees). */
export type Sector = [from: number, to: number];

export type SpotType =
  | 'beach'
  | 'lake'
  | 'gorge'
  | 'hike'
  | 'boat'
  | 'culture' // outdoor archaeological sites, monasteries
  | 'village'
  | 'nature' // parks, gardens
  | 'town'
  | 'museum'; // indoor

export type BusAccess = 'yes' | 'seasonal' | 'no';
export type Suitability = 'great' | 'ok' | 'no';

export interface Spot {
  id: string;
  name: Text;
  area: string;
  type: SpotType;
  lat: number;
  lon: number;
  /** Direction the shore faces, i.e. the direction you look at when standing on the beach facing the sea (deg). */
  facing?: number;
  /** Wind directions (FROM) where the spot gets extra shelter from headlands/terrain beyond what `facing` implies. */
  shelteredFrom?: Sector[];
  /** Wind directions (FROM) that produce strong downslope gusts at this spot (e.g. south coast under northerlies). */
  gustyFrom?: Sector[];
  /** For boats: wind/wave directions (FROM) the route is exposed to. */
  exposedFrom?: Sector[];
  /** Marine forecast point (offshore). Defaults to a point ~5 km out in the `facing` direction. */
  seaPoint?: { lat: number; lon: number };
  /** Multiplier for how much offshore waves reach the shore (lagoons < 1, funnelling inlets > 1). */
  waveFactor?: number;
  /** Fetch length (km) for locally generated wind waves when the wind is onshore. */
  localFetchKm?: number;
  /** Strong waves create dangerous currents here. */
  ripRisk?: boolean;
  /** Road distance ≈ straight-line × roadFactor (mountain roads are slower). */
  roadFactor?: number;
  /** Extra minutes on top of driving: dirt road, walk from parking, boat transfer. */
  extraMinutes?: number;
  /** Typical visit duration in hours (used to pick the best time window). */
  visitHours: number;
  /** Curated "how much is this worth a day" (0–8). Only affects ranking, never the weather score. */
  appeal: number;
  /** Usually exposed to the prevailing winds — a calm day here is a rare opportunity worth flagging. */
  calmDayGem?: boolean;
  access: {
    bus: BusAccess;
    difficulty: 'easy' | 'moderate' | 'hard';
    dirtRoad?: boolean;
    boatRequired?: boolean;
  };
  traits: {
    kids: Suitability;
    seniors: Suitability;
    sandy?: boolean;
    shallow?: boolean;
    shade?: boolean;
    facilities?: boolean;
    snorkeling?: boolean;
    scenic?: boolean;
    sunset?: boolean;
    crowded?: boolean;
    popular?: boolean;
  };
  /** Months (1-12) the place operates; omitted = all year. */
  season?: { from: number; to: number };
  /** Hard limits beyond which the place is likely closed / the trip cancelled. */
  limits?: { maxGustKmh?: number; maxWindKmh?: number; maxWaveM?: number; maxPrecipProb?: number };
  /** Another spot whose sea conditions also matter (e.g. Samaria's return boat). */
  dependsOnSea?: { lat: number; lon: number; exposedFrom: Sector[]; label: Text };
  notes: Text;
  /** False until a local expert has checked orientation, thresholds and access info. */
  verified: boolean;
}

export type ProfileId = 'family' | 'couple' | 'solo' | 'active' | 'senior' | 'nocar';

export interface Base {
  id: string;
  name: Text;
  lat: number;
  lon: number;
}

// ---------- Weather data ----------

export const MODELS = ['ecmwf_ifs025', 'icon_seamless', 'gfs_seamless', 'meteofrance_seamless', 'ukmo_seamless'] as const;
export type ModelId = (typeof MODELS)[number];

export const WAVE_MODELS = ['meteofrance_wave', 'ecmwf_wam025', 'gwam', 'ewam'] as const;
export type WaveModelId = (typeof WAVE_MODELS)[number];
export const WAVE_MODEL_LABELS: Record<WaveModelId, string> = {
  meteofrance_wave: 'Météo-France MFWAM',
  ecmwf_wam025: 'ECMWF WAM',
  gwam: 'DWD GWAM',
  ewam: 'DWD EWAM',
};

/** Waves from one wave model for one hour. */
export interface ModelWave {
  wave: number | null;
  dir: number | null;
  period: number | null;
}

/** Consensus sea state for one hour across the wave models. */
export interface WaveConsensus {
  wave: number; // m, median
  dir: number; // deg, vector mean
  period: number | null; // s, median
  spread: number; // m, max-min across models
  modelCount: number;
}

export const MODEL_LABELS: Record<ModelId, string> = {
  ecmwf_ifs025: 'ECMWF IFS',
  icon_seamless: 'DWD ICON',
  gfs_seamless: 'NOAA GFS',
  meteofrance_seamless: 'Météo-France',
  ukmo_seamless: 'UK Met Office',
};

/** One hour of atmospheric data at a land point (best-match model). */
export interface AtmosHour {
  time: string; // local ISO, e.g. 2026-10-18T13:00
  temp: number | null;
  apparent: number | null;
  precipProb: number | null;
  precip: number | null;
  cloud: number | null;
  uv: number | null;
  code: number | null;
  wind: number | null;
  windDir: number | null;
  gust: number | null;
}

/** Wind from one model for one hour. */
export interface ModelWind {
  wind: number | null;
  dir: number | null;
  gust: number | null;
}

export interface MarineHour {
  time: string;
  wave: number | null;
  waveDir: number | null;
  wavePeriod: number | null;
  windWave: number | null;
  swell: number | null;
  swellDir: number | null;
  swellPeriod: number | null;
  sst: number | null;
}

export interface PointWeather {
  atmos: AtmosHour[];
  models: Record<ModelId, ModelWind[]>;
  sunrise?: string;
  sunset?: string;
}

/** Everything the engine needs for one day, keyed by point id. */
export interface Dataset {
  date: string; // YYYY-MM-DD (Europe/Athens)
  fetchedAt: string; // ISO
  source: 'live' | 'snapshot';
  land: Record<string, PointWeather>;
  marine: Record<string, MarineHour[]>;
  /** Per marine point, waves from each wave model (absent in snapshots taken before this was added). */
  waveModels?: Record<string, Record<WaveModelId, ModelWave[]>>;
}

// ---------- Analysis output ----------

export type Exposure = 'onshore' | 'cross-onshore' | 'cross' | 'cross-offshore' | 'offshore';

/** Consensus wind for one hour, combining all available models. */
export interface WindConsensus {
  speed: number; // km/h, median across models
  dir: number; // deg, vector mean
  gust: number; // km/h, median
  speedSpread: number; // km/h, max-min across models
  dirSpread: number; // deg, max deviation from mean (only meaningful when wind > ~10 km/h)
  modelCount: number;
}

/** Fully analysed conditions for one spot at one hour. */
export interface HourConditions {
  time: string;
  hour: number;
  wind: WindConsensus;
  bf: number;
  windExposure: number; // 0..1
  exposureClass?: Exposure;
  shelteredNow: boolean;
  gustyNow: boolean;
  effectiveGust: number;
  sea?: {
    offshoreWave: number;
    waveDir: number;
    swell: number | null;
    period: number | null;
    swellPeriod: number | null;
    /** Long-period swell breaks higher than its offshore height when it shoals (1 = no effect). */
    periodFactor: number;
    waveExposure: number;
    localWindSea: number;
    effectiveWave: number; // estimated at the shore
    /** Disagreement between wave models on the offshore height (m); 0 when only one model is available. */
    waveSpread: number;
    waveModelCount: number;
    sst: number | null;
  };
  temp: number | null;
  apparent: number | null;
  precipProb: number | null;
  precip: number | null;
  cloud: number | null;
  uv: number | null;
  thunder: boolean;
  depSea?: { wave: number; wind: number; exposure: number };
}

export type FactorKey =
  | 'seaRough'
  | 'seaCalm'
  | 'longSwell'
  | 'onshoreWind'
  | 'offshoreWind'
  | 'sheltered'
  | 'gusts'
  | 'downslopeGusts'
  | 'rain'
  | 'thunder'
  | 'cool'
  | 'cold'
  | 'coldWater'
  | 'heat'
  | 'heatEarlyStart'
  | 'uvHigh'
  | 'cloudy'
  | 'ripCurrents'
  | 'boatCancel'
  | 'boatRough'
  | 'returnBoat'
  | 'closureRisk'
  | 'drive'
  | 'bus'
  | 'goodForBadWeather'
  | 'trait'
  | 'crowds'
  | 'dirtRoad'
  | 'pleasant'
  | 'indoor'
  | 'appeal'
  | 'typePref'
  | 'opportunity'
  | 'closed'
  | 'notForProfile';

export interface Factor {
  key: FactorKey;
  /** Score impact (negative = penalty). */
  impact: number;
  params: Record<string, string | number>;
}

export type Verdict = 'go' | 'caution' | 'avoid' | 'unsuitable';

export interface SpotScore {
  spotId: string;
  profile: ProfileId;
  /** Weather/sea suitability for this profile in the best window (0..100). Drives the verdict. */
  score: number;
  /** Ordering value: weather score + fit (travel, appeal, profile preferences, opportunity). */
  rank: number;
  verdict: Verdict;
  window: { start: number; end: number }; // local hours
  hourly: { hour: number; score: number }[];
  factors: Factor[]; // weather factors, sorted by |impact|
  fit: Factor[]; // non-weather ranking factors
  unsuitableReason?: Factor;
  confidence: 'high' | 'medium' | 'low';
  travelMinutes: number;
}
