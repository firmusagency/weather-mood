import { useMemo, useState } from 'react';
import type { HourConditions, Lang, Spot, SpotScore, SpotType } from '../engine/types';
import { FlowArrow, ScoreBar } from './charts';
import { strings, windLabel } from './i18n';

type SortKey = 'rank' | 'score' | 'name';

/** Conditions at the middle of the chosen window — what the row summarises. */
export function midWindow(conds: HourConditions[], sc: SpotScore): HourConditions | undefined {
  const mid = Math.floor((sc.window.start + sc.window.end - 1) / 2);
  return conds.find((c) => c.hour === mid) ?? conds[0];
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function windowStats(conds: HourConditions[], sc: SpotScore) {
  const w = conds.filter((c) => c.hour >= sc.window.start && c.hour < sc.window.end);
  return {
    gust: Math.max(...w.map((c) => c.effectiveGust)),
    apparent: avg(w.map((c) => c.apparent ?? NaN).filter((x) => !Number.isNaN(x))),
    rain: Math.max(0, ...w.map((c) => c.precipProb ?? 0)),
    wave: w.some((c) => c.sea) ? Math.max(...w.map((c) => c.sea?.effectiveWave ?? 0)) : null,
  };
}

export function AnalysisTable({
  spots,
  scores,
  conditions,
  lang,
  onOpen,
}: {
  spots: Spot[];
  scores: Record<string, SpotScore>;
  conditions: Record<string, HourConditions[]>;
  lang: Lang;
  onOpen: (id: string) => void;
}) {
  const s = strings(lang);
  const [filter, setFilter] = useState<SpotType | 'all'>('all');
  const [sort, setSort] = useState<SortKey>('rank');
  const types = useMemo(() => [...new Set(spots.map((x) => x.type))], [spots]);

  const rows = spots
    .filter((x) => filter === 'all' || x.type === filter)
    .map((spot) => ({ spot, sc: scores[spot.id] }))
    .sort((a, b) => {
      if (sort === 'name') return a.spot.name[lang].localeCompare(b.spot.name[lang], lang);
      const unA = a.sc.verdict === 'unsuitable' ? 1 : 0;
      const unB = b.sc.verdict === 'unsuitable' ? 1 : 0;
      if (unA !== unB) return unA - unB;
      return sort === 'score' ? b.sc.score - a.sc.score : b.sc.rank - a.sc.rank;
    });

  const confLabel = { high: s.confHigh, medium: s.confMedium, low: s.confLow };

  return (
    <section className="analysis" aria-labelledby="an-title">
      <div className="an-head">
        <h2 id="an-title" className="section-title">
          {s.tabAnalysis}
        </h2>
        <p className="hint">{s.analysisHint}</p>
      </div>
      <div className="toolbar">
        <div className="chips" role="group" aria-label="filter">
          <button type="button" className={`chip ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')} aria-pressed={filter === 'all'}>
            {s.filterAll} <span className="chip-count">{spots.length}</span>
          </button>
          {types.map((t) => (
            <button key={t} type="button" className={`chip ${filter === t ? 'is-on' : ''}`} onClick={() => setFilter(t)} aria-pressed={filter === t}>
              {s.types[t]} <span className="chip-count">{spots.filter((x) => x.type === t).length}</span>
            </button>
          ))}
        </div>
        <label className="field-inline" htmlFor="an-sort">
          {s.sortBy}
          <select id="an-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="rank">{s.sortRank}</option>
            <option value="score">{s.sortScore}</option>
            <option value="name">{s.sortName}</option>
          </select>
        </label>
      </div>

      <div className="table-scroll">
        <table className="data-table spots-table">
          <thead>
            <tr>
              <th scope="col">{s.colPlace}</th>
              <th scope="col">{s.colWeather}</th>
              <th scope="col" className="num">
                {s.colSea}
              </th>
              <th scope="col">{s.colWind}</th>
              <th scope="col" className="num">
                {s.colGust}
              </th>
              <th scope="col" className="num">
                {s.colTemp}
              </th>
              <th scope="col" className="num">
                {s.colRain}
              </th>
              <th scope="col">{s.colWindow}</th>
              <th scope="col" className="num">
                {s.colTravel}
              </th>
              <th scope="col">{s.colConf}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ spot, sc }) => {
              const conds = conditions[spot.id] ?? [];
              const mid = midWindow(conds, sc);
              const st = windowStats(conds, sc);
              const unsuitable = sc.verdict === 'unsuitable';
              return (
                <tr key={spot.id} className={unsuitable ? 'is-muted' : ''}>
                  <th scope="row">
                    <button type="button" className="row-link" onClick={() => onOpen(spot.id)}>
                      <span className="row-name">{spot.name[lang]}</span>
                      <span className="row-type">{s.types[spot.type]}</span>
                    </button>
                  </th>
                  <td>
                    {unsuitable ? <span className="pill v-unsuitable">{s.verdict.unsuitable}</span> : <ScoreBar score={sc.score} verdict={sc.verdict} />}
                  </td>
                  <td className="num">{st.wave == null ? <span className="muted">–</span> : `${st.wave.toFixed(1)} m`}</td>
                  <td>
                    {mid && (
                      <span className="dir-cell">
                        <FlowArrow from={mid.wind.dir} size={14} />
                        {windLabel(mid.wind.dir, lang)} {mid.bf} Bf
                        {mid.exposureClass && <span className={`expo expo-${mid.exposureClass}`}>{expoLabel(mid.exposureClass, mid.shelteredNow, lang)}</span>}
                      </span>
                    )}
                  </td>
                  <td className={`num ${st.gust >= 50 ? 'warn-text' : ''}`}>{Math.round(st.gust)}</td>
                  <td className="num">{Number.isNaN(st.apparent) ? '–' : `${Math.round(st.apparent)}°`}</td>
                  <td className={`num ${st.rain >= 50 ? 'warn-text' : ''}`}>{st.rain}%</td>
                  <td className="nowrap">{sc.window.start >= 0 ? `${pad(sc.window.start)}–${pad(sc.window.end)}` : '–'}</td>
                  <td className="num">
                    {sc.travelMinutes}
                    {s.min}
                  </td>
                  <td>
                    <span className={`conf conf-${sc.confidence}`}>{confLabel[sc.confidence]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function expoLabel(cls: string, sheltered: boolean, lang: Lang): string {
  if (sheltered) return lang === 'el' ? 'υπήνεμο' : 'sheltered';
  const el: Record<string, string> = {
    onshore: 'προς ακτή',
    'cross-onshore': 'πλάγια προς ακτή',
    cross: 'παράλληλα',
    'cross-offshore': 'πλάγια από στεριά',
    offshore: 'από στεριά',
  };
  const en: Record<string, string> = {
    onshore: 'onshore',
    'cross-onshore': 'cross-onshore',
    cross: 'cross-shore',
    'cross-offshore': 'cross-offshore',
    offshore: 'offshore',
  };
  return (lang === 'el' ? el : en)[cls] ?? cls;
}
