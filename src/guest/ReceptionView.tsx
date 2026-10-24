import { useMemo, useState } from 'react';
import { SPOTS, spotById } from '../data/spots';
import { PROFILES } from '../data/profiles';
import type { ProfileId } from '../engine/types';
import { askableDates, type SubmitResult } from './feedback';
import { relDayLabel, ResultLine, VoteForm } from './Feedback';
import { g, LANG_NAMES, pick } from './i18n';
import { GUEST_LANGS, type GuestLang, type Property } from './property';

/*
 * Reception form (guest.html#reception): staff log what returning guests told them.
 * Same database row as the guest vote, with source = 'reception' and the party size.
 */

interface Logged {
  key: string;
  date: string;
  spotId: string;
  verdict: 'up' | 'down';
  result: SubmitResult;
}

export function ReceptionView({ property, lang, setLang, today, hourNow }: { property: Property; lang: GuestLang; setLang: (l: GuestLang) => void; today: string; hourNow: number }) {
  const d = g(lang);
  const dates = useMemo(() => askableDates(today, Math.max(hourNow, 15)).reverse(), [today, hourNow]);
  const [date, setDate] = useState(dates[0]);
  const [spotId, setSpotId] = useState('');
  const [profile, setProfile] = useState<ProfileId>('couple');
  const [party, setParty] = useState(2);
  const [logged, setLogged] = useState<Logged[]>([]);
  const [formKey, setFormKey] = useState(0);
  const options = useMemo(() => [...SPOTS].sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang), lang)), [lang]);

  return (
    <div className="g-phone g-reception">
      <header className="g-head">
        <div className="g-brand">
          {property.logo ? (
            <img className="g-logo" src={property.logo} alt="" />
          ) : (
            <span className="g-monogram" aria-hidden="true">
              {property.name[0]}
            </span>
          )}
          <div>
            <p className="g-prop-name">{property.name}</p>
            <p className="g-prop-tag">{d.fb.rcView}</p>
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

      <h1 className="g-h2 g-rc-title">{d.fb.rcTitle}</h1>
      <p className="g-fb-intro">{d.fb.rcIntro}</p>

      <section className="g-fb g-rc-form" aria-label={d.fb.rcTitle}>
        <div className="g-rc-grid">
          <label className="g-field">
            <span className="g-field-label">{d.fb.whichDay}</span>
            <select className="g-select" value={date} onChange={(e) => setDate(e.target.value)}>
              {dates.map((x) => (
                <option key={x} value={x}>
                  {relDayLabel(x, today, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="g-field">
            <span className="g-field-label">{d.fb.pickPlace}</span>
            <select className="g-select" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
              <option value="">–</option>
              {options.map((s) => (
                <option key={s.id} value={s.id}>
                  {pick(s.name, lang)}
                </option>
              ))}
            </select>
          </label>
          <label className="g-field">
            <span className="g-field-label">{d.whoTravels}</span>
            <select className="g-select" value={profile} onChange={(e) => setProfile(e.target.value as ProfileId)}>
              {PROFILES.map((p) => (
                <option key={p.id} value={p.id}>
                  {d.profiles[p.id]}
                </option>
              ))}
            </select>
          </label>
          <label className="g-field">
            <span className="g-field-label">{d.fb.rcParty}</span>
            <input className="g-select" type="number" min={1} max={50} value={party} onChange={(e) => setParty(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </label>
        </div>
        {spotId ? (
          <VoteForm
            key={`${formKey}:${date}:${spotId}`}
            property={property}
            lang={lang}
            profile={profile}
            date={date}
            spotId={spotId}
            source="reception"
            partySize={party}
            onDone={(result, verdict) => {
              setLogged((l) => [{ key: `${Date.now()}`, date, spotId, verdict, result }, ...l]);
              setSpotId('');
              setFormKey((k) => k + 1);
            }}
          />
        ) : (
          <p className="g-note">{d.fb.pickPlace}</p>
        )}
      </section>

      {logged.length > 0 && (
        <section aria-labelledby="g-rc-log">
          <h2 id="g-rc-log" className="g-h2">
            {d.fb.rcLogged}
          </h2>
          <ul className="g-rows">
            {logged.map((l) => (
              <li key={l.key} className="g-row g-rc-row">
                <span className="g-row-name">
                  {l.verdict === 'up' ? '👍' : '👎'} {pick(spotById(l.spotId)!.name, lang)}
                </span>
                <span className="g-row-meta">{relDayLabel(l.date, today, lang)}</span>
                <ResultLine r={l.result} lang={lang} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="g-foot">
        <p>{d.poweredBy}</p>
      </footer>
    </div>
  );
}
