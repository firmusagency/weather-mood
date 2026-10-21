import { useMemo, useState } from 'react';
import { SPOTS, spotById } from '../data/spots';
import { FEEDBACK_TAGS, type FeedbackTag, type FeedbackVerdict } from '../engine/feedback';
import type { ProfileId } from '../engine/types';
import { askableDates, doneKey, feedbackEnabled, markDone, readDone, readPlans, submitFeedback, type SubmitResult } from './feedback';
import { dayName, g, pick } from './i18n';
import type { GuestLang, Property } from './property';

/*
 * "Did you go? How was it?" One tap for 👍, two for 👎 (what was off). Shown on the guest page
 * for places we recommended on a past day (remembered in the browser), with a fallback picker
 * for guests who went somewhere else or opened the page for the first time.
 */

export function relDayLabel(date: string, today: string, lang: GuestLang): string {
  const d = g(lang);
  const diff = Math.round((Date.parse(today) - Date.parse(date)) / 86_400_000);
  if (diff === 0) return d.today;
  if (diff === 1) return d.fb.yesterday;
  return `${dayName(date, lang)} (${d.fb.daysAgo.replace('{n}', String(diff))})`;
}

const SPOT_OPTIONS = (lang: GuestLang) => [...SPOTS].sort((a, b) => pick(a.name, lang).localeCompare(pick(b.name, lang), lang));

interface VoteFormProps {
  property: Property;
  lang: GuestLang;
  profile: ProfileId;
  date: string;
  spotId: string;
  source: 'guest' | 'reception';
  partySize?: number | null;
  onDone: (r: SubmitResult, verdict: FeedbackVerdict) => void;
  onCancel?: () => void;
}

/** The vote itself: 👍 sends at once, 👎 asks what was off first. */
export function VoteForm({ property, lang, profile, date, spotId, source, partySize, onDone, onCancel }: VoteFormProps) {
  const d = g(lang).fb;
  const [verdict, setVerdict] = useState<FeedbackVerdict | null>(null);
  const [tag, setTag] = useState<FeedbackTag | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (v: FeedbackVerdict, t: FeedbackTag | null, n: string) => {
    setBusy(true);
    const r = await submitFeedback({ propertyId: property.id, source, visitDate: date, spotId, verdict: v, tag: t, profile, lang, note: n, partySize: partySize ?? null });
    setBusy(false);
    if (r === 'ok' || r === 'duplicate') markDone(doneKey(date, spotId));
    onDone(r, v);
  };

  return (
    <div className="g-vote">
      <div className="g-vote-row" role="group">
        <button type="button" className={`g-vote-btn g-vote-up ${verdict === 'up' ? 'is-on' : ''}`} disabled={busy} onClick={() => send('up', null, '')}>
          <span aria-hidden="true">👍</span> {d.up}
        </button>
        <button type="button" className={`g-vote-btn g-vote-down ${verdict === 'down' ? 'is-on' : ''}`} disabled={busy} onClick={() => setVerdict('down')}>
          <span aria-hidden="true">👎</span> {d.down}
        </button>
      </div>
      {verdict === 'down' && (
        <form
          className="g-vote-why"
          onSubmit={(e) => {
            e.preventDefault();
            void send('down', tag, note);
          }}
        >
          <p className="g-vote-q">{d.whatWrong}</p>
          <div className="g-tags" role="group" aria-label={d.whatWrong}>
            {FEEDBACK_TAGS.map((t) => (
              <button key={t} type="button" className={tag === t ? 'is-on' : ''} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
                {d.tags[t]}
              </button>
            ))}
          </div>
          <label className="g-field">
            <span className="sr-only">{d.note}</span>
            <textarea className="g-textarea" rows={2} maxLength={280} placeholder={d.note} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="g-actions">
            <button type="submit" className="g-btn g-btn-brand" disabled={busy}>
              {d.send}
            </button>
            {onCancel && (
              <button type="button" className="g-btn" onClick={onCancel}>
                {d.notNow}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

export function ResultLine({ r, lang }: { r: SubmitResult; lang: GuestLang }) {
  const d = g(lang).fb;
  const text = r === 'ok' ? d.thanks : r === 'duplicate' ? d.duplicate : d.error;
  return (
    <p className={`g-vote-result ${r === 'error' ? 'is-error' : ''}`} role="status">
      {text}
    </p>
  );
}

/** Date + place picker for guests who went somewhere we did not suggest (or saw the page for the first time). */
export function PickerVote({ property, lang, profile, today, hourNow, onDone }: { property: Property; lang: GuestLang; profile: ProfileId; today: string; hourNow: number; onDone: (r: SubmitResult) => void }) {
  const d = g(lang).fb;
  const dates = useMemo(() => askableDates(today, hourNow).reverse(), [today, hourNow]);
  const [date, setDate] = useState(dates[0]);
  const [spotId, setSpotId] = useState('');
  const options = useMemo(() => SPOT_OPTIONS(lang), [lang]);
  return (
    <div className="g-picker">
      <label className="g-field">
        <span className="g-field-label">{d.whichDay}</span>
        <select className="g-select" value={date} onChange={(e) => setDate(e.target.value)}>
          {dates.map((x) => (
            <option key={x} value={x}>
              {relDayLabel(x, today, lang)}
            </option>
          ))}
        </select>
      </label>
      <label className="g-field">
        <span className="g-field-label">{d.pickPlace}</span>
        <select className="g-select" value={spotId} onChange={(e) => setSpotId(e.target.value)}>
          <option value="">–</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {pick(s.name, lang)}
            </option>
          ))}
        </select>
      </label>
      {spotId && <VoteForm key={`${date}:${spotId}`} property={property} lang={lang} profile={profile} date={date} spotId={spotId} source="guest" onDone={(r) => onDone(r)} />}
    </div>
  );
}

export function FeedbackPanel({ property, lang, profile, today, hourNow }: { property: Property; lang: GuestLang; profile: ProfileId; today: string; hourNow: number }) {
  const d = g(lang).fb;
  const [hidden, setHidden] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [doneTick, setDoneTick] = useState(0);

  // Oldest unanswered recommended place within the askable window.
  const prompt = useMemo(() => {
    const askable = new Set(askableDates(today, hourNow));
    const done = new Set(readDone());
    for (const p of readPlans()) {
      if (!askable.has(p.date)) continue;
      const spotId = p.spotIds.find((id) => !done.has(doneKey(p.date, id)) && spotById(id));
      if (spotId) return { date: p.date, spotId };
    }
    return null;
    // doneTick forces a re-read after a vote
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, hourNow, doneTick]);

  if (!feedbackEnabled() || hidden) return null;
  const compact = !prompt && !pickerOpen;

  return (
    <section className={`g-fb ${compact ? 'is-compact' : ''}`} aria-labelledby="g-fb-title">
      <h2 id="g-fb-title" className="g-h2">
        {d.title}
      </h2>
      {result && <ResultLine r={result} lang={lang} />}
      {prompt && !pickerOpen && (
        <>
          <p className="g-fb-ask">{d.didYouGo.replace('{spot}', pick(spotById(prompt.spotId)!.name, lang)).replace('{day}', relDayLabel(prompt.date, today, lang))}</p>
          <VoteForm
            key={`${prompt.date}:${prompt.spotId}`}
            property={property}
            lang={lang}
            profile={profile}
            date={prompt.date}
            spotId={prompt.spotId}
            source="guest"
            onDone={(r) => {
              setResult(r);
              setDoneTick((t) => t + 1);
            }}
            onCancel={() => setHidden(true)}
          />
          <div className="g-fb-links">
            <button type="button" className="g-link" onClick={() => setPickerOpen(true)}>
              {d.wentElsewhere}
            </button>
            <button type="button" className="g-link" onClick={() => setHidden(true)}>
              {d.notNow}
            </button>
          </div>
        </>
      )}
      {!prompt && !pickerOpen && (
        <div className="g-fb-links">
          <p className="g-fb-intro">{d.intro}</p>
          <button type="button" className="g-btn" onClick={() => setPickerOpen(true)}>
            {d.pickPlace}
          </button>
        </div>
      )}
      {pickerOpen && (
        <>
          <PickerVote
            property={property}
            lang={lang}
            profile={profile}
            today={today}
            hourNow={hourNow}
            onDone={(r) => {
              setResult(r);
              setPickerOpen(false);
              setDoneTick((t) => t + 1);
            }}
          />
          <div className="g-fb-links">
            <button type="button" className="g-link" onClick={() => setPickerOpen(false)}>
              {d.notNow}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
