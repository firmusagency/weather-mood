/** YYYY-MM-DD in Europe/Athens, `offsetDays` from now. */
export function athensDate(offsetDays = 0, now = new Date()): string {
  const d = new Date(now.getTime() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export const monthOf = (date: string) => Number(date.slice(5, 7));

/** Local hour from an Open-Meteo local ISO time, e.g. "2026-10-18T13:00" → 13. */
export const hourOf = (time: string) => Number(time.slice(11, 13));
