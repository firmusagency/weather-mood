/*
 * METAR parsing for forecast verification.
 *
 * Chania airport (LGSA, Akrotiri) reports every 30 minutes; aviationweather.gov serves the last
 * ~3 days as raw text, e.g.  "METAR LGSA 181320Z 33010G20KT 9999 -RA FEW020 BKN090 20/10 Q1019".
 * We only need wind, gusts, temperature and whether it rained.
 */

export interface MetarObs {
  /** UTC time of the observation. */
  timeUtc: Date;
  /** Local (Europe/Athens) date and hour the observation falls in. */
  localDate: string;
  localHour: number;
  /** km/h; direction in degrees FROM, null when variable or calm. */
  windKmh: number;
  windDir: number | null;
  gustKmh: number | null;
  tempC: number | null;
  rain: boolean;
  raw: string;
}

const KT_TO_KMH = 1.852;

/** Local date (YYYY-MM-DD) and hour in Europe/Athens for a UTC instant. */
export function athensParts(d: Date): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Athens',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
}

/**
 * Parse one METAR line. `reference` (UTC) resolves the day-of-month into a full date: the report
 * is assumed to be the most recent such day at or before the reference.
 */
export function parseMetar(line: string, reference: Date): MetarObs | undefined {
  const m = line.match(/\b(\d{2})(\d{2})(\d{2})Z\b/);
  if (!m) return undefined;
  const [, dd, hh, mm] = m.map(Number);
  let y = reference.getUTCFullYear();
  let mo = reference.getUTCMonth();
  if (dd > reference.getUTCDate()) {
    // a day number above today's belongs to the previous month
    mo -= 1;
    if (mo < 0) {
      mo = 11;
      y -= 1;
    }
  }
  const timeUtc = new Date(Date.UTC(y, mo, dd, hh, mm));
  if (Number.isNaN(timeUtc.getTime())) return undefined;

  const w = line.match(/\b(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT\b/);
  const windKmh = w ? Number(w[2]) * KT_TO_KMH : 0;
  const windDir = w && w[1] !== 'VRB' && Number(w[2]) > 0 ? Number(w[1]) : null;
  const gustKmh = w?.[3] ? Number(w[3]) * KT_TO_KMH : null;
  const t = line.match(/\s(M?\d{2})\/(M?\d{2})\s/);
  const tempC = t ? Number(t[1].replace('M', '-')) : null;
  // precipitation groups: RA DZ SN SH TS GR, with optional intensity/proximity prefix
  const rain = /\s[-+]?(VC)?(TS|SH)?(RA|DZ|SN|GR|GS)\b/.test(line) || /\bTS\b/.test(line);
  const { date, hour } = athensParts(timeUtc);
  return { timeUtc, localDate: date, localHour: hour, windKmh, windDir, gustKmh, tempC, rain, raw: line.trim() };
}

export function parseMetars(text: string, reference = new Date()): MetarObs[] {
  return text
    .split('\n')
    .map((l) => parseMetar(l, reference))
    .filter((x): x is MetarObs => !!x)
    .sort((a, b) => a.timeUtc.getTime() - b.timeUtc.getTime());
}

export interface HourObs {
  hour: number;
  windKmh: number;
  windDir: number | null;
  gustKmh: number;
  tempC: number | null;
  rain: boolean;
  count: number;
}

/** One record per local hour for a given local date: mean wind/temp, max gust, any rain. */
export function hourlyObs(obs: MetarObs[], localDate: string): HourObs[] {
  const byHour = new Map<number, MetarObs[]>();
  for (const o of obs) if (o.localDate === localDate) byHour.set(o.localHour, [...(byHour.get(o.localHour) ?? []), o]);
  return [...byHour.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, list]) => {
      const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
      const temps = list.map((o) => o.tempC).filter((x): x is number => x != null);
      const dirs = list.filter((o) => o.windDir != null);
      // direction: vector mean weighted by speed
      let x = 0;
      let y = 0;
      for (const o of dirs) {
        x += o.windKmh * Math.cos((o.windDir! * Math.PI) / 180);
        y += o.windKmh * Math.sin((o.windDir! * Math.PI) / 180);
      }
      const dir = dirs.length ? (((Math.atan2(y, x) * 180) / Math.PI + 360) % 360) : null;
      return {
        hour,
        windKmh: mean(list.map((o) => o.windKmh)),
        windDir: dir,
        gustKmh: Math.max(...list.map((o) => o.gustKmh ?? o.windKmh)),
        tempC: temps.length ? mean(temps) : null,
        rain: list.some((o) => o.rain),
        count: list.length,
      };
    });
}
