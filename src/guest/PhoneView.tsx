import { useEffect, useState } from 'react';
import { spotById } from '../data/spots';
import { athensDate } from '../engine/dates';
import type { ProfileId, Spot, SpotScore } from '../engine/types';
import { PROFILES } from '../data/profiles';
import { daySummary, dedupeReasons, mainProblem, mapsUrl, seaLevel, sharePlanText, travelLabel, windLevel, type GuestLine } from './advice';
import { ShareButton } from './Share';
import { compassG, dayName, g, LANG_NAMES, pick } from './i18n';
import { GUEST_LANGS, type GuestLang, type Property } from './property';
import { SpotSheet } from './SpotSheet';
import { FeedbackPanel, pendingPrompt } from './Feedback';
import { rememberPlan } from './feedback';
import { askEveningText, whatsappTo } from './evening';
import { SpotPhoto } from '../ui/Photo';
import type { DayPlan } from './useGuestData';

const COASTS: Record<string, Record<GuestLang, string>> = {
  'ref-north': { el: 'Βόρεια', en: 'North', de: 'Nord', fr: 'Nord' },
  'ref-west': { el: 'Δυτική', en: 'West', de: 'West', fr: 'Ouest' },
  'ref-south': { el: 'Νότια', en: 'South', de: 'Süd', fr: 'Sud' },
};
const COAST_LABEL: Record<GuestLang, string> = { el: 'Θάλασσα ανά ακτή', en: 'Sea by coast', de: 'Meer nach Küste', fr: 'Mer par côte' };

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

function PickCard({ sc, spot, lines, property, profile, lang, onOpen }: { sc: SpotScore; spot: Spot; lines: GuestLine[]; property: Property; profile: ProfileId; lang: GuestLang; onOpen: () => void }) {
  const d = g(lang);
  return (
    <li className="g-card">
      <SpotPhoto spotId={spot.id} alt={pick(spot.name, lang)} variant="card" creditWord={d.photo} />
      <p className="g-eyebrow">{d.types[spot.type]}</p>
      <h3 className="g-card-name">{pick(spot.name, lang)}</h3>
      <p className="g-card-meta">
        <span>
          {d.bestTime} <strong>{pad(sc.window.start)}–{pad(sc.window.end)}</strong>
        </span>
        <span>{travelLabel(spot, sc, property.base, profile, d, lang)}</span>
      </p>
      <ul className="g-lines">
        {[...lines.filter((l) => l.kind === 'pos').slice(0, 1), ...lines.filter((l) => l.kind === 'warn').slice(0, 1)].map((l) => (
          <li key={l.text} className={`g-line g-${l.kind}`}>
            {l.text}
          </li>
        ))}
      </ul>
      <div className="g-actions">
        <a className="g-btn g-btn-brand" href={mapsUrl(spot, profile)} target="_blank" rel="noreferrer">
          {d.directions}
        </a>
        <button type="button" className="g-btn" onClick={onOpen}>
          {d.details} ›
        </button>
      </div>
    </li>
  );
}

export function PhoneView({
  plan,
  property,
  lang,
  setLang,
  profile,
  setProfile,
  dates,
  date,
  setDate,
  updatedAt,
}: {
  plan: DayPlan;
  property: Property;
  lang: GuestLang;
  setLang: (l: GuestLang) => void;
  profile: ProfileId;
  setProfile: (p: ProfileId) => void;
  dates: string[];
  date: string;
  setDate: (d: string) => void;
  updatedAt: string;
}) {
  const d = g(lang);
  const [open, setOpen] = useState<string | null>(null);
  const { syn, rec, scores, conditions } = plan;
  const today = athensDate(0);
  const hourNow = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Europe/Athens' }).format(new Date()));
  const hasPrompt = pendingPrompt(today, hourNow) != null;
  // Remember what we recommended, so we can ask "did you go?" afterwards.
  useEffect(() => {
    rememberPlan({ date, profile, spotIds: rec.top.map((sc) => sc.spotId) });
  }, [date, profile, rec.top]);
  const rel = (x: string) => {
    const diff = Math.round((Date.parse(x) - Date.parse(today)) / 86_400_000);
    return diff === 0 ? d.today : diff === 1 ? d.tomorrow : diff === 2 ? d.dayAfter : dayName(x, lang);
  };
  const isTomorrow = date === athensDate(1);
  const openSpot = open ? spotById(open) : undefined;
  const allLines = dedupeReasons([...rec.top, ...rec.alternatives], lang);
  const pickLines = allLines.slice(0, rec.top.length);
  const altLines = allLines.slice(rec.top.length);
  const futureDates = dates.filter((x) => x >= today);
  const summary = daySummary(syn, lang);
  const sst = syn.coasts.map((c) => c.sst).filter((x): x is number => x != null);
  const seaTemp = sst.length ? Math.round(sst.reduce((a, b) => a + b, 0) / sst.length) : null;
  const ageHours = updatedAt ? Math.floor((Date.now() - Date.parse(updatedAt)) / 3_600_000) : 0;
  const dayLabel = dayName(date, lang);
  const planText = sharePlanText(
    rec.top.map((sc, i) => ({ spot: spotById(sc.spotId)!, sc, lines: pickLines[i] })),
    property.name,
    dayLabel,
    summary,
    lang,
  );
  const locale = { el: 'el-GR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' }[lang];
  const updated = updatedAt
    ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' }).format(new Date(updatedAt))
    : '';

  return (
    <div className="g-phone">
      <header className="g-head">
        <div className="g-brand">
          <span className="g-monogram" aria-hidden="true">
            {property.name[0]}
          </span>
          <div>
            <p className="g-prop-name">{property.name}</p>
            <p className="g-prop-tag">{property.tagline[lang] ?? property.tagline.en}</p>
          </div>
        </div>
        <label className="g-lang" htmlFor="g-lang">
          <span className="sr-only">Language</span>
          <select id="g-lang" value={lang} onChange={(e) => setLang(e.target.value as GuestLang)}>
            {GUEST_LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p className="g-greeting">{d.greeting}</p>

      <div className="g-days" role="group" aria-label="day">
        {futureDates.map((x) => (
          <button key={x} type="button" className={x === date ? 'is-on' : ''} aria-pressed={x === date} onClick={() => setDate(x)}>
            {rel(x)}
          </button>
        ))}
      </div>

      <section className="g-who" aria-labelledby="g-who">
        <span id="g-who" className="g-field-label">
          {d.whoTravels}
        </span>
        <div className="g-profiles" role="group" aria-labelledby="g-who">
          {PROFILES.map((p) => (
            <button key={p.id} type="button" className={profile === p.id ? 'is-on' : ''} aria-pressed={profile === p.id} onClick={() => setProfile(p.id)}>
              {d.profiles[p.id]}
            </button>
          ))}
        </div>
      </section>

      <section className="g-weather" aria-label={d.forecastFor}>
        <div className="g-weather-top">
          <div>
            <p className="g-eyebrow">
              {d.forecastFor} · {dayName(date, lang)}
            </p>
            <p className="g-temp">{syn.town.tMax == null ? '–' : `${Math.round(syn.town.tMax)}°`}</p>
          </div>
          <ul className="g-chips">
            <li>
              {d.wind}: {d.windWords[windLevel(syn.wind.bf)]} {syn.wind.bf >= 2 ? compassG(syn.wind.dir, lang) : ''}
            </li>
            <li>
              {d.rain}: {syn.town.rainProbMax ?? 0}%
            </li>
            {seaTemp != null && (
              <li>
                {d.sea}: {seaTemp}°
              </li>
            )}
            {syn.town.uvMax != null && <li>UV {Math.round(syn.town.uvMax)}</li>}
          </ul>
        </div>
        {summary.length > 0 && <p className="g-summary">{summary.join(' ')}</p>}
        <div className="g-coasts" aria-label={COAST_LABEL[lang]}>
          {syn.coasts.map((c) => {
            const lvl = seaLevel(c.waveMax ?? 0);
            return (
              <div key={c.id} className={`g-coast sea-${lvl}`}>
                <span className="g-coast-name">{COASTS[c.id]?.[lang] ?? c.id}</span>
                <span className="g-coast-word">{d.seaWords[lvl]}</span>
              </div>
            );
          })}
        </div>
      </section>

      {hasPrompt && <FeedbackPanel property={property} lang={lang} profile={profile} today={today} hourNow={hourNow} />}

      <section aria-labelledby="g-picks">
        <h2 id="g-picks" className="g-h2">
          {d.ourPicks}
        </h2>
        {rec.badWeatherDay && <p className="g-note">{d.planB}</p>}
        {rec.top.length ? (
          <ul className="g-cards">
            {rec.top.map((sc, i) => (
              <PickCard key={sc.spotId} sc={sc} spot={spotById(sc.spotId)!} lines={pickLines[i]} property={property} profile={profile} lang={lang} onOpen={() => setOpen(sc.spotId)} />
            ))}
          </ul>
        ) : (
          <p className="g-note">{d.noPicks}</p>
        )}
        {rec.top.length > 0 && (
          <div className="g-plan-share">
            <ShareButton text={planText} title={`${d.ourPicks} · ${dayLabel}`} lang={lang} wide />
            <span className="g-plan-share-label">{d.sharePlan}</span>
          </div>
        )}
        <div className="g-evening">
          <p>{d.fb.evening}</p>
          <a className="g-btn g-btn-wa" href={whatsappTo(property.whatsapp, askEveningText(lang))} target="_blank" rel="noreferrer">
            {d.fb.eveningBtn}
          </a>
        </div>
      </section>

      {rec.alternatives.length > 0 && (
        <section aria-labelledby="g-more">
          <h2 id="g-more" className="g-h2">
            {d.more}
          </h2>
          <ul className="g-rows">
            {rec.alternatives.map((sc, i) => {
              const spot = spotById(sc.spotId)!;
              const first = altLines[i]?.[0];
              return (
                <li key={sc.spotId}>
                  <button type="button" className="g-row" onClick={() => setOpen(sc.spotId)}>
                    <span className="g-row-name">{pick(spot.name, lang)}</span>
                    <span className="g-row-meta">
                      {d.types[spot.type]} · {pad(sc.window.start)}–{pad(sc.window.end)}
                    </span>
                    {first && <span className="g-row-why">{first.text}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {rec.avoid.length > 0 && (
        <section aria-labelledby="g-avoid">
          <h2 id="g-avoid" className="g-h2 g-h2-avoid">
            {isTomorrow ? d.notTomorrow : d.notThisDay}
          </h2>
          <ul className="g-rows">
            {rec.avoid.map((sc) => {
              const spot = spotById(sc.spotId)!;
              return (
                <li key={sc.spotId}>
                  <button type="button" className="g-row g-row-avoid" onClick={() => setOpen(sc.spotId)}>
                    <span className="g-row-name">{pick(spot.name, lang)}</span>
                    <span className="g-row-why">{mainProblem(sc, lang)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!hasPrompt && <FeedbackPanel property={property} lang={lang} profile={profile} today={today} hourNow={hourNow} />}

      <footer className="g-foot">
        <p>{d.disclaimer}</p>
        <p className={ageHours >= 12 ? 'g-stale' : ''}>
          {d.updated} {updated} · {d.poweredBy}
        </p>
      </footer>

      {openSpot && (
        <SpotSheet
          spot={openSpot}
          sc={scores[openSpot.id]}
          conds={conditions[openSpot.id]}
          property={property}
          profile={profile}
          lang={lang}
          dayLabel={dayLabel}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

