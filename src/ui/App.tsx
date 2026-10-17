import { useCallback, useEffect, useMemo, useState } from 'react';
import { SPOTS, spotById } from '../data/spots';
import { BASES, REF_POINTS } from '../data/region';
import { PROFILES, profileById } from '../data/profiles';
import { athensDate } from '../engine/dates';
import { analyzeDay, recommend } from '../engine/recommend';
import { buildSynopsis } from '../engine/synopsis';
import type { Dataset, Lang, ProfileId } from '../engine/types';
import { AnalysisTable } from './AnalysisTable';
import { Method } from './Method';
import { Overview } from './Overview';
import { Recommendations } from './Recommendations';
import { SpotDetail } from './SpotDetail';
import { EMBEDDED, datasetsFromSnapshot, fetchLive, loadSnapshot, readPref, writePref } from './data';
import { relativeDayLabel, strings } from './i18n';

const TABS = ['overview', 'analysis', 'recs', 'method'] as const;
type Tab = (typeof TABS)[number];
const LANGS = ['el', 'en'] as const;
const PROFILE_IDS = PROFILES.map((p) => p.id);
const BASE_IDS = BASES.map((b) => b.id);

function initialTab(): Tab {
  const h = typeof location !== 'undefined' ? location.hash.slice(1) : '';
  return (TABS as readonly string[]).includes(h) ? (h as Tab) : readPref('tab', TABS, 'overview');
}

export function App() {
  const [lang, setLang] = useState<Lang>(() => readPref('lang', LANGS, 'el'));
  const [profileId, setProfileId] = useState<ProfileId>(() => readPref('profile', PROFILE_IDS, 'couple'));
  const [baseId, setBaseId] = useState(() => readPref('base', BASE_IDS, 'chania'));
  const [tab, setTab] = useState<Tab>(initialTab);
  const [datasets, setDatasets] = useState<Record<string, Dataset>>({});
  const [generatedAt, setGeneratedAt] = useState<string>('');
  const [date, setDate] = useState<string>('');
  const [openSpot, setOpenSpot] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [live, setLive] = useState<'idle' | 'busy' | 'failed'>('idle');
  const s = strings(lang);
  const today = athensDate(0);

  useEffect(() => {
    loadSnapshot()
      .then((snap) => {
        const ds = datasetsFromSnapshot(snap);
        const dates = Object.keys(ds).sort();
        if (!dates.length) throw new Error('empty snapshot');
        setDatasets(ds);
        setGeneratedAt(snap.generatedAt);
        // default to tomorrow (the planning day) when the snapshot has it
        const tomorrow = athensDate(1);
        setDate(dates.includes(tomorrow) ? tomorrow : dates.find((d) => d >= today) ?? dates[dates.length - 1]);
        setStatus('ready');
      })
      .catch((e) => {
        console.error(e);
        setStatus('error');
      });
  }, [today]);

  useEffect(() => writePref('lang', lang), [lang]);
  useEffect(() => writePref('profile', profileId), [profileId]);
  useEffect(() => writePref('base', baseId), [baseId]);
  useEffect(() => writePref('tab', tab), [tab]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const data = datasets[date];
  const base = BASES.find((b) => b.id === baseId) ?? BASES[0];
  const dates = Object.keys(datasets).sort();

  const analysis = useMemo(() => {
    if (!data) return null;
    const daysAhead = Math.max(0, Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000));
    const nowHour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date()));
    const day = analyzeDay(SPOTS, data, profileId, base, { daysAhead, earliestStart: date === today ? nowHour + 1 : 0 });
    return { ...day, syn: buildSynopsis(data, REF_POINTS), rec: recommend(SPOTS, day.scores) };
  }, [data, date, today, profileId, base]);

  const refreshLive = useCallback(async () => {
    if (!date) return;
    setLive('busy');
    try {
      const fresh = await fetchLive(date);
      setDatasets((d) => ({ ...d, [date]: fresh }));
      setLive('idle');
    } catch (e) {
      console.warn(e);
      setLive('failed');
    }
  }, [date]);

  const go = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, '', `#${t}`);
    } catch {
      /* ignore */
    }
  };

  const dayTitle = date === today ? s.recsTitleToday : date === athensDate(1) ? s.recsTitleTomorrow : s.recsTitleOther;
  const fetchedLabel = data
    ? new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' }).format(
        new Date(data.source === 'live' ? data.fetchedAt : generatedAt || data.fetchedAt),
      )
    : '';

  const spot = openSpot ? spotById(openSpot) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <h1 className="brand-name">Weather Mood</h1>
              <p className="brand-sub">
                {s.region} · {s.brandTag}
              </p>
            </div>
          </div>
          <div className="topbar-right">
            {data && (
              <span className={`data-badge ${data.source}`} title={data.source}>
                {s.dataFrom} · {s.fetched} {fetchedLabel}
              </span>
            )}
            {!EMBEDDED && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={refreshLive} disabled={live === 'busy' || !date}>
                {live === 'busy' ? s.refreshing : s.refresh}
              </button>
            )}
            <div className="lang-toggle" role="group" aria-label="language">
              {LANGS.map((l) => (
                <button key={l} type="button" className={lang === l ? 'is-on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="controls">
          <div className="field">
            <span className="field-label" id="day-label">
              {s.day}
            </span>
            <div className="segmented" role="group" aria-labelledby="day-label">
              {dates.map((d) => (
                <button key={d} type="button" className={d === date ? 'is-on' : ''} aria-pressed={d === date} onClick={() => setDate(d)}>
                  {relativeDayLabel(d, today, lang)}
                </button>
              ))}
            </div>
          </div>
          <label className="field" htmlFor="profile">
            <span className="field-label">{s.profile}</span>
            <select id="profile" value={profileId} onChange={(e) => setProfileId(e.target.value as ProfileId)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name[lang]}
                </option>
              ))}
            </select>
          </label>
          <label className="field" htmlFor="base">
            <span className="field-label">{s.base}</span>
            <select id="base" value={baseId} onChange={(e) => setBaseId(e.target.value)}>
              {BASES.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name[lang]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <nav className="tabs" aria-label="sections">
          {TABS.map((t) => (
            <button key={t} type="button" className={`tab ${tab === t ? 'is-on' : ''}`} aria-current={tab === t ? 'page' : undefined} onClick={() => go(t)}>
              {{ overview: s.tabOverview, analysis: s.tabAnalysis, recs: s.tabRecs, method: s.tabMethod }[t]}
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {live === 'failed' && <p className="callout callout-warn">{s.liveFailed}</p>}
        {status === 'loading' && <p className="hint">{s.loading}</p>}
        {status === 'error' && <p className="callout callout-warn">{s.loadFailed}</p>}
        {analysis && data && (
          <>
            {tab === 'overview' && <Overview syn={analysis.syn} lang={lang} onAnalysis={() => go('analysis')} />}
            {tab === 'analysis' && <AnalysisTable spots={SPOTS} scores={analysis.scores} conditions={analysis.conditions} lang={lang} onOpen={setOpenSpot} />}
            {tab === 'recs' && (
              <Recommendations
                rec={analysis.rec}
                syn={analysis.syn}
                spots={SPOTS}
                profile={profileById(profileId)}
                lang={lang}
                dayTitle={dayTitle}
                onOpen={setOpenSpot}
              />
            )}
            {tab === 'method' && <Method spots={SPOTS} lang={lang} types={s.types} />}
          </>
        )}
      </main>

      <footer className="footer">
        <p>{s.disclaimer}</p>
        <p>
          Weather data:{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
            Open-Meteo.com
          </a>{' '}
          (CC BY 4.0) · MVP demo · {s.region}
        </p>
      </footer>

      {spot && analysis && data && (
        <SpotDetail spot={spot} score={analysis.scores[spot.id]} conditions={analysis.conditions[spot.id]} data={data} lang={lang} onClose={() => setOpenSpot(null)} />
      )}
    </div>
  );
}
