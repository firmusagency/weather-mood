import { useCallback, useEffect, useMemo, useState } from 'react';
import { SPOTS } from '../data/spots';
import { BASES, REF_POINTS } from '../data/region';
import { PROFILES, profileById } from '../data/profiles';
import { athensDate } from '../engine/dates';
import { analyzeDay, recommend } from '../engine/recommend';
import { buildSynopsis } from '../engine/synopsis';
import { dayGlance } from '../engine/glance';
import type { Dataset, Lang, ProfileId } from '../engine/types';
import { AnalysisTable } from './AnalysisTable';
import { Method } from './Method';
import { Overview } from './Overview';
import { Recommendations } from './Recommendations';
import { SpotDetail } from './SpotDetail';
import { EMBEDDED, datasetsFromSnapshot, fetchLive, loadCalibration, loadFeedback, loadSnapshot, loadVerification, readPref, writePref } from './data';
import { applyCalibration, type Calibration, type FeedbackSummary } from '../engine/feedback';
import type { VerificationSummary } from '../engine/verify';
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
  const [verification, setVerification] = useState<VerificationSummary | null>(null);
  const [feedback, setFeedback] = useState<FeedbackSummary | null>(null);
  const [calibration, setCalibration] = useState<Calibration | null>(null);
  useEffect(() => {
    loadVerification().then(setVerification);
    loadFeedback().then(setFeedback);
    loadCalibration().then(setCalibration);
  }, []);
  // Spot geometry with the guest-feedback wave corrections folded in (no-op until there is data).
  const spots = useMemo(() => applyCalibration(SPOTS, calibration), [calibration]);
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
    const day = analyzeDay(spots, data, profileId, base, { daysAhead, earliestStart: date === today ? nowHour + 1 : 0 });
    return { ...day, syn: buildSynopsis(data, REF_POINTS), rec: recommend(spots, day.scores), glance: dayGlance(spots, day.scores), daysAhead };
  }, [data, date, today, profileId, base, spots]);

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
  const fetchedAtMs = data ? Date.parse(data.source === 'live' ? data.fetchedAt : generatedAt || data.fetchedAt) : NaN;
  const ageHours = Number.isNaN(fetchedAtMs) ? 0 : Math.floor((Date.now() - fetchedAtMs) / 3_600_000);
  const stale = ageHours >= 12;
  const fetchedLabel = data
    ? new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' }).format(
        new Date(data.source === 'live' ? data.fetchedAt : generatedAt || data.fetchedAt),
      )
    : '';

  const spot = openSpot ? spots.find((x) => x.id === openSpot) : undefined;

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
              <span className={`data-badge ${data.source} ${stale ? 'is-stale' : ''}`} title={data.source}>
                {stale ? `${s.staleData} · ${s.hoursAgo.replace('{h}', String(ageHours))}` : `${s.dataFrom} · ${s.fetched} ${fetchedLabel}`}
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
            {tab === 'overview' && <Overview syn={analysis.syn} glance={analysis.glance} lang={lang} onAnalysis={() => go('analysis')} onOpen={setOpenSpot} />}
            {tab === 'analysis' && <AnalysisTable spots={spots} scores={analysis.scores} conditions={analysis.conditions} lang={lang} onOpen={setOpenSpot} />}
            {tab === 'recs' && (
              <Recommendations
                rec={analysis.rec}
                syn={analysis.syn}
                spots={spots}
                profile={profileById(profileId)}
                lang={lang}
                dayTitle={dayTitle}
                onOpen={setOpenSpot}
              />
            )}
            {tab === 'method' && <Method spots={spots} lang={lang} types={s.types} verification={verification} feedback={feedback} calibration={calibration} />}
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
        <SpotDetail
          spot={spot}
          score={analysis.scores[spot.id]}
          conditions={analysis.conditions[spot.id]}
          data={data}
          base={base}
          daysAhead={analysis.daysAhead}
          lang={lang}
          onClose={() => setOpenSpot(null)}
        />
      )}
    </div>
  );
}
