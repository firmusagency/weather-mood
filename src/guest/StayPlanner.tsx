import { useEffect, useMemo, useState } from 'react';
import { SPOTS, spotById } from '../data/spots';
import { REF_POINTS } from '../data/region';
import { applyCalibration, type Calibration } from '../engine/feedback';
import { analyzeDay } from '../engine/recommend';
import { planStay, shift, stayDates, type PlannedTrip, type StayDayInput } from '../engine/stay';
import { buildSynopsis } from '../engine/synopsis';
import type { Dataset, ProfileId } from '../engine/types';
import { factorText, windLevel } from './advice';
import { g, pick } from './i18n';
import type { GuestLang, Property } from './property';
import { ShareButton } from './Share';

/*
 * "Which day for Samaria?" The guest says when they leave; we lay the big trips over the days of
 * the stay (full forecasts for the next 3 days, coast-level outlook up to a week ahead).
 */

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
const LOCALE: Record<GuestLang, string> = { el: 'el-GR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' };
const shortDay = (date: string, lang: GuestLang) => new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

function readCheckout(today: string): string {
  try {
    const v = localStorage.getItem('wm:checkout');
    return v && v > today ? v : '';
  } catch {
    return '';
  }
}

function TripLine({ p, lang, property }: { p: PlannedTrip; lang: GuestLang; property: Property }) {
  const d = g(lang);
  const spot = p.pick ? spotById(p.pick.spotId) : undefined;
  const tripName = d.stay.trips[p.trip.id as keyof typeof d.stay.trips] ?? p.trip.id;
  const spotName = spot ? pick(spot.name, lang) : '';
  const fav = spot && property.favourites?.includes(spot.id);
  return (
    <>
      <span className="g-stay-trip">
        {tripName}
        {spot && spotName !== tripName && !tripName.includes(spotName) ? <small> · {spotName}</small> : null}
        {fav ? <small className="g-fav-inline"> ★</small> : null}
      </span>
      {p.pick && p.pick.window.start >= 0 && (
        <span className="g-stay-meta">
          {pad(p.pick.window.start)}–{pad(p.pick.window.end)} · <em className={`g-conf g-conf-${p.pick.confidence}`}>{d.stay.conf[p.pick.confidence]}</em>
          {p.status === 'possible' ? ` · ${d.stay.possible}` : ''}
        </span>
      )}
    </>
  );
}

export function StayPlanner({
  datasets,
  outlook,
  profile,
  property,
  calibration,
  lang,
  today,
  hourNow,
  onSeeDay,
}: {
  datasets: Record<string, Dataset>;
  outlook: Record<string, Dataset>;
  profile: ProfileId;
  property: Property;
  calibration: Calibration | null;
  lang: GuestLang;
  today: string;
  hourNow: number;
  onSeeDay: (date: string) => void;
}) {
  const d = g(lang);
  const [checkout, setCheckout] = useState(() => readCheckout(today));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    try {
      if (checkout) localStorage.setItem('wm:checkout', checkout);
    } catch {
      /* not remembered */
    }
  }, [checkout]);

  const available = useMemo(() => [...new Set([...Object.keys(datasets), ...Object.keys(outlook)])].sort(), [datasets, outlook]);
  const dates = useMemo(() => (checkout ? stayDates(today, hourNow, checkout, available) : []), [checkout, today, hourNow, available]);

  const plan = useMemo(() => {
    if (!dates.length) return null;
    const spots = applyCalibration(SPOTS, calibration);
    const days: StayDayInput[] = dates.map((date) => {
      const full = datasets[date];
      const ds = full ?? outlook[date];
      const daysAhead = Math.max(0, Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000));
      const scores = analyzeDay(spots, ds, profile, property.base, { daysAhead, earliestStart: date === today ? hourNow + 1 : 0 }).scores;
      return { date, daysAhead, detail: full ? 'full' : 'outlook', scores };
    });
    const heads = Object.fromEntries(
      dates.map((date) => {
        const syn = buildSynopsis(datasets[date] ?? outlook[date], REF_POINTS);
        return [date, { tMax: syn.town.tMax, bf: syn.wind.bf, rain: syn.town.rainProbMax ?? 0 }];
      }),
    );
    return { plan: planStay(days, profile, spots), heads };
  }, [dates, datasets, outlook, profile, property.base, calibration, today, hourNow]);

  const options = Array.from({ length: 8 }, (_, i) => shift(today, i + 1));
  const selector = (
    <label className="g-field g-stay-field">
      <span className="g-field-label">{d.stay.checkoutQ}</span>
      <select
        className="g-select"
        value={checkout}
        onChange={(e) => {
          setCheckout(e.target.value);
          setEditing(false);
        }}
      >
        <option value="">–</option>
        {options.map((x) => (
          <option key={x} value={x}>
            {shortDay(x, lang)}
          </option>
        ))}
      </select>
    </label>
  );

  const shareText =
    plan &&
    [
      `${d.stay.shareTitle} · ${property.name}`,
      ...plan.plan.days.map((day) => {
        const t = day.trip;
        const name = t ? d.stay.trips[t.trip.id as keyof typeof d.stay.trips] : d.stay.free;
        const win = t?.pick && t.pick.window.start >= 0 ? ` ${pad(t.pick.window.start)}–${pad(t.pick.window.end)}` : '';
        return `${shortDay(day.date, lang)}: ${name}${win}`;
      }),
      property.guestUrl,
    ].join('\n');

  return (
    <section className="g-stay" aria-labelledby="g-stay-title">
      <h2 id="g-stay-title" className="g-h2">
        {d.stay.title}
      </h2>
      {(!checkout || editing) && (
        <>
          <p className="g-fb-intro">{d.stay.intro}</p>
          {selector}
        </>
      )}
      {checkout && !editing && (
        <p className="g-stay-until">
          {d.stay.checkoutQ} <strong>{shortDay(checkout, lang)}</strong>{' '}
          <button type="button" className="g-link" onClick={() => setEditing(true)}>
            {d.stay.change}
          </button>
        </p>
      )}
      {checkout && plan && (
        <>
          <ol className="g-stay-days">
            {plan.plan.days.map((day) => {
              const h = plan.heads[day.date];
              const canOpen = !!datasets[day.date];
              return (
                <li key={day.date} className={`g-stay-day ${day.trip ? '' : 'is-free'} ${day.detail === 'outlook' ? 'is-outlook' : ''}`}>
                  <div className="g-stay-date">
                    <span>{shortDay(day.date, lang)}</span>
                    <small>
                      {h.tMax != null ? `${Math.round(h.tMax)}°` : ''} · {d.windWords[windLevel(h.bf)]}
                      {h.rain >= 30 ? ` · ${d.rain} ${h.rain}%` : ''}
                    </small>
                  </div>
                  <div className="g-stay-body">
                    {day.trip ? <TripLine p={day.trip} lang={lang} property={property} /> : <span className="g-stay-free">{d.stay.free}</span>}
                  </div>
                  {canOpen && (
                    <button type="button" className="g-link g-stay-open" onClick={() => onSeeDay(day.date)}>
                      {d.stay.seeDay} ›
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {plan.plan.days.length === 0 && <p className="g-note">{d.stay.noDays}</p>}
          {plan.plan.trips.some((t) => t.status === 'unplaced') && (
            <p className="g-stay-not">
              <strong>{d.stay.alsoFine}:</strong>{' '}
              {plan.plan.trips
                .filter((t) => t.status === 'unplaced')
                .map((t) => {
                  const days = t.options.filter((o) => o && o.verdict === 'go').map((o) => shortDay(o!.date, lang));
                  return `${d.stay.trips[t.trip.id as keyof typeof d.stay.trips]}${days.length ? ` (${days.join(', ')})` : ''}`;
                })
                .join(' · ')}
            </p>
          )}
          {plan.plan.trips.some((t) => t.status === 'notThisStay' && t.trip.priority === 1) && (
            <p className="g-stay-not">
              <strong>{d.stay.notThisStay}:</strong>{' '}
              {plan.plan.trips
                .filter((t) => t.status === 'notThisStay' && t.trip.priority === 1)
                .map((t) => {
                  const why = t.reasons.map((f) => factorText(f, lang)).find(Boolean);
                  return `${d.stay.trips[t.trip.id as keyof typeof d.stay.trips]}${why ? ` (${why.toLowerCase()})` : ''}`;
                })
                .join(' · ')}
            </p>
          )}
          {plan.plan.days.some((x) => x.detail === 'outlook' || x.daysAhead >= 3) && <p className="g-stay-horizon">{d.stay.horizon}</p>}
          {shareText && plan.plan.days.length > 0 && (
            <div className="g-plan-share">
              <ShareButton text={shareText} title={d.stay.shareTitle} lang={lang} wide />
              <span className="g-plan-share-label">{d.stay.share}</span>
            </div>
          )}
        </>
      )}
    </section>
  );
}
