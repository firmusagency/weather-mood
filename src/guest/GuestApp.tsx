import { useEffect, useState } from 'react';
import { PROFILES } from '../data/profiles';
import type { ProfileId } from '../engine/types';
import { EMBEDDED, readPref, writePref } from '../ui/data';
import { detectLang, g } from './i18n';
import { LobbyView } from './LobbyView';
import { PhoneView } from './PhoneView';
import { ReceptionView } from './ReceptionView';
import { QrCard } from './QrCard';
import { logVisit } from './feedback';
import { SPOTS } from '../data/spots';
import { applyCalibration } from '../engine/feedback';
import { athensDate } from '../engine/dates';
import { DEMO_PROPERTY, GUEST_LANGS, type GuestLang } from './property';
import { defaultDate, useDatasets, useDayPlan } from './useGuestData';

type View = 'phone' | 'lobby' | 'reception' | 'qr';
const PROFILE_IDS = PROFILES.map((p) => p.id);

const initialView = (): View => {
  const h = typeof location !== 'undefined' ? location.hash : '';
  return h === '#lobby' ? 'lobby' : h === '#reception' ? 'reception' : h === '#qr' ? 'qr' : 'phone';
};

export function GuestApp() {
  const property = DEMO_PROPERTY;
  const [lang, setLang] = useState<GuestLang>(() => readPref('g-lang', GUEST_LANGS, detectLang()));
  const [profile, setProfile] = useState<ProfileId>(() => readPref('g-profile', PROFILE_IDS, 'couple'));
  const [view, setView] = useState<View>(initialView);
  const { datasets, generatedAt, status, dates, calibration } = useDatasets();
  const [date, setDate] = useState('');
  const effectiveDate = date || defaultDate(dates);
  const data = datasets[effectiveDate];
  const plan = useDayPlan(data, profile, property.base, calibration);
  const d = g(lang);

  useEffect(() => writePref('g-lang', lang), [lang]);
  useEffect(() => writePref('g-profile', profile), [profile]);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  useEffect(() => {
    document.body.dataset.view = view;
  }, [view]);
  useEffect(() => {
    if (status === 'ready' && view !== 'qr') void logVisit(property.id, view, lang, view === 'phone' ? profile : null, view === 'reception' ? null : effectiveDate || null);
    // one ping per view and browser session; lang/profile are just what was on screen at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, status]);

  const switchView = (v: View) => {
    setView(v);
    try {
      history.replaceState(null, '', v === 'phone' ? '#guest' : `#${v}`);
    } catch {
      /* ignore */
    }
  };

  // The lobby always shows tomorrow (the planning day) when it is in the data.
  const lobbyData = datasets[defaultDate(dates)];

  return (
    <div className={`guest-root view-${view}`} style={{ ['--brand-base' as string]: property.brand }}>
      {EMBEDDED && (
        <nav className="demo-bar" aria-label="demo">
          <span className="demo-note">{d.demoNote}</span>
          <div className="demo-switch" role="group">
            <button type="button" className={view === 'phone' ? 'is-on' : ''} aria-pressed={view === 'phone'} onClick={() => switchView('phone')}>
              {d.phoneView}
            </button>
            <button type="button" className={view === 'lobby' ? 'is-on' : ''} aria-pressed={view === 'lobby'} onClick={() => switchView('lobby')}>
              {d.lobbyView}
            </button>
            <button type="button" className={view === 'reception' ? 'is-on' : ''} aria-pressed={view === 'reception'} onClick={() => switchView('reception')}>
              {d.fb.rcView}
            </button>
            <button type="button" className={view === 'qr' ? 'is-on' : ''} aria-pressed={view === 'qr'} onClick={() => switchView('qr')}>
              {d.qrView}
            </button>
          </div>
        </nav>
      )}
      {status === 'loading' && <p className="g-status">…</p>}
      {status === 'error' && <p className="g-status">{d.noPicks}</p>}
      {view === 'phone' && plan && (
        <PhoneView
          plan={plan}
          property={property}
          lang={lang}
          setLang={setLang}
          profile={profile}
          setProfile={setProfile}
          dates={dates}
          date={effectiveDate}
          setDate={setDate}
          updatedAt={generatedAt}
        />
      )}
      {view === 'lobby' && lobbyData && <LobbyView data={lobbyData} property={property} spots={applyCalibration(SPOTS, calibration)} />}
      {view === 'qr' && <QrCard property={property} lang={lang} />}
      {view === 'reception' && (
        <ReceptionView
          property={property}
          lang={lang}
          setLang={setLang}
          today={athensDate(0)}
          hourNow={Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date()))}
        />
      )}
    </div>
  );
}
