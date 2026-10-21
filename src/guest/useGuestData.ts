import { useEffect, useMemo, useState } from 'react';
import { SPOTS } from '../data/spots';
import { REF_POINTS } from '../data/region';
import { athensDate } from '../engine/dates';
import { analyzeDay, recommend } from '../engine/recommend';
import { buildSynopsis } from '../engine/synopsis';
import type { Base, Dataset, ProfileId } from '../engine/types';
import { datasetsFromSnapshot, loadCalibration, loadSnapshot } from '../ui/data';
import { applyCalibration, type Calibration } from '../engine/feedback';

export function useDatasets() {
  const [datasets, setDatasets] = useState<Record<string, Dataset>>({});
  const [generatedAt, setGeneratedAt] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  useEffect(() => {
    loadCalibration().then(setCalibration);
    loadSnapshot()
      .then((snap) => {
        setDatasets(datasetsFromSnapshot(snap));
        setGeneratedAt(snap.generatedAt);
        setStatus('ready');
      })
      .catch((e) => {
        console.error(e);
        setStatus('error');
      });
  }, []);
  return { datasets, generatedAt, status, dates: Object.keys(datasets).sort(), calibration };
}

/** Pick tomorrow when available, otherwise the nearest future day in the data. */
export function defaultDate(dates: string[]): string {
  const today = athensDate(0);
  const tomorrow = athensDate(1);
  return dates.includes(tomorrow) ? tomorrow : dates.find((d) => d >= today) ?? dates[dates.length - 1] ?? '';
}

export function useDayPlan(data: Dataset | undefined, profile: ProfileId, base: Base, calibration: Calibration | null = null) {
  return useMemo(() => {
    if (!data) return null;
    const spots = applyCalibration(SPOTS, calibration);
    const today = athensDate(0);
    const daysAhead = Math.max(0, Math.round((Date.parse(data.date) - Date.parse(today)) / 86_400_000));
    const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date()));
    const day = analyzeDay(spots, data, profile, base, { daysAhead, earliestStart: data.date === today ? nowHour + 1 : 0 });
    return { ...day, rec: recommend(spots, day.scores), syn: buildSynopsis(data, REF_POINTS) };
  }, [data, profile, base, calibration]);
}

export type DayPlan = NonNullable<ReturnType<typeof useDayPlan>>;
