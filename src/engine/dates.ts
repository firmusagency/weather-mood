/** YYYY-MM-DD in Europe/Athens, `offsetDays` from now. */
export function athensDate(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** `date` (YYYY-MM-DD) shifted by whole days, e.g. shiftDate('2026-11-01', -1) → '2026-10-31'. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const monthOf = (date: string) => Number(date.slice(5, 7));

/** Local hour from an Open-Meteo local ISO time, e.g. "2026-10-18T13:00" → 13. */
export const hourOf = (time: string) => Number(time.slice(11, 13));
