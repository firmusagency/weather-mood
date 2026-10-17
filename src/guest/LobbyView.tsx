import { useEffect, useMemo, useState } from 'react';
import { SPOTS, spotById } from '../data/spots';
import { REF_POINTS } from '../data/region';
import { athensDate } from '../engine/dates';
import { analyzeDay, recommend } from '../engine/recommend';
import { buildSynopsis } from '../engine/synopsis';
import type { Dataset, ProfileId } from '../engine/types';
import { guestReasons, mainProblem, seaLevel, windLevel } from './advice';
import { compassG, dayName, g, pick } from './i18n';
import { GUEST_LANGS, type GuestLang, type Property } from './property';
import { Qr } from './Qr';

const LOBBY_PROFILES: ProfileId[] = ['family', 'couple', 'active'];
const ROTATE_MS = 12_000;
const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
const COASTS: Record<string, Record<GuestLang, string>> = {
  'ref-north': { el: 'Βόρεια', en: 'North', de: 'Nord', fr: 'Nord' },
  'ref-west': { el: 'Δυτική', en: 'West', de: 'West', fr: 'Ouest' },
  'ref-south': { el: 'Νότια', en: 'South', de: 'Süd', fr: 'Sud' },
};

/** Reception / lobby TV screen: tomorrow's picks for three guest types, languages rotating. */
export function LobbyView({ data, property }: { data: Dataset; property: Property }) {
  const [langIdx, setLangIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const lang: GuestLang = GUEST_LANGS[langIdx];
  const d = g(lang);

  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setLangIdx((i) => (i + 1) % GUEST_LANGS.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const plans = useMemo(() => {
    const today = athensDate(0);
    const daysAhead = Math.max(0, Math.round((Date.parse(data.date) - Date.parse(today)) / 86_400_000));
    return LOBBY_PROFILES.map((p) => {
      const day = analyzeDay(SPOTS, data, p, property.base, { daysAhead });
      return { profile: p, ...day, rec: recommend(SPOTS, day.scores) };
    });
  }, [data, property]);
  const syn = useMemo(() => buildSynopsis(data, REF_POINTS), [data]);
  const avoid = plans[1].rec.avoid.slice(0, 3);
  const isTomorrow = data.date === athensDate(1);

  return (
    <div className="lobby" lang={lang}>
      <header className="lobby-head">
        <div className="lobby-brand">
          <span className="g-monogram" aria-hidden="true">
            {property.name[0]}
          </span>
          <span>{property.name}</span>
        </div>
        <div className="lobby-title-wrap">
          <h1 className="lobby-title">{isTomorrow ? d.lobbyTitle : d.ourPicks}</h1>
          <p className="lobby-date">{dayName(data.date, lang)}</p>
        </div>
        <ul className="lobby-weather">
          <li className="lobby-temp">{syn.town.tMax == null ? '–' : `${Math.round(syn.town.tMax)}°`}</li>
          <li>
            {d.wind}: {d.windWords[windLevel(syn.wind.bf)]} {syn.wind.bf >= 2 ? compassG(syn.wind.dir, lang) : ''}
          </li>
          {syn.coasts.map((c) => (
            <li key={c.id} className={`sea-${seaLevel(c.waveMax ?? 0)}`}>
              {COASTS[c.id]?.[lang]}: {d.seaWords[seaLevel(c.waveMax ?? 0)]}
            </li>
          ))}
        </ul>
      </header>

      <div className="lobby-cols">
        {plans.map((pl) => (
          <section key={pl.profile} className="lobby-col" aria-label={d.profiles[pl.profile]}>
            <h2 className="lobby-profile">{d.profiles[pl.profile]}</h2>
            <ol className="lobby-picks">
              {pl.rec.top.slice(0, 2).map((sc) => {
                const spot = spotById(sc.spotId)!;
                const why = guestReasons(sc, lang)[0];
                return (
                  <li key={sc.spotId}>
                    <p className="lobby-type">{d.types[spot.type]}</p>
                    <p className="lobby-name">{pick(spot.name, lang)}</p>
                    <p className="lobby-time">
                      {pad(sc.window.start)}–{pad(sc.window.end)}
                    </p>
                    {why && <p className="lobby-why">{why.text}</p>}
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <footer className="lobby-foot">
        <div className="lobby-avoid">
          {avoid.length > 0 && (
            <>
              <p className="lobby-avoid-title">{isTomorrow ? d.notTomorrow : d.notThisDay}</p>
              <ul>
                {avoid.map((sc) => (
                  <li key={sc.spotId}>
                    <strong>{pick(spotById(sc.spotId)!.name, lang)}</strong> · {mainProblem(sc, lang)}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="lobby-disclaimer">{d.disclaimer}</p>
        </div>
        <div className="lobby-qr">
          <Qr text={property.guestUrl} size={132} label={d.scanForYourLanguage} />
          <p>{d.scanForYourLanguage}</p>
        </div>
      </footer>

      <div className="lobby-langs" role="group" aria-label="language">
        {GUEST_LANGS.map((l, i) => (
          <button key={l} type="button" className={i === langIdx ? 'is-on' : ''} aria-pressed={i === langIdx} onClick={() => setLangIdx(i)}>
            {l.toUpperCase()}
          </button>
        ))}
        <button type="button" className="lobby-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? '▶' : '❚❚'}
        </button>
      </div>
    </div>
  );
}
