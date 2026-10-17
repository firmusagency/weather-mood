import { useState } from 'react';
import type { Recommendation } from '../engine/recommend';
import type { Synopsis } from '../engine/synopsis';
import type { Factor, Lang, Spot, SpotScore } from '../engine/types';
import type { Profile } from '../data/profiles';
import { ScoreBar } from './charts';
import { pad } from './AnalysisTable';
import { factorText, longDate, strings, takeawayText } from './i18n';

/** The 1–2 reasons a guest needs: best positives first, plus the main caveat if it matters. */
function reasons(sc: SpotScore): Factor[] {
  const positives = [...sc.fit.filter((f) => f.key === 'opportunity'), ...sc.factors.filter((f) => f.impact > 0), ...sc.fit.filter((f) => f.key === 'trait')];
  const caveat = sc.factors.find((f) => f.impact <= -5);
  return [...positives.slice(0, 2), ...(caveat ? [caveat] : [])];
}

function buildMessage(rec: Recommendation, syn: Synopsis, spots: Map<string, Spot>, lang: Lang, dayTitle: string): string {
  const s = strings(lang);
  const lines: string[] = [];
  lines.push(`${dayTitle}, ${longDate(syn.date, lang)}`);
  const weather = syn.takeaways.slice(0, 2).map((t) => takeawayText(t, lang)).join(' ');
  lines.push(weather, '');
  rec.top.forEach((sc, i) => {
    const spot = spots.get(sc.spotId)!;
    const why = reasons(sc).slice(0, 2).map((f) => factorText(f, lang)).join('; ');
    lines.push(`${i + 1}. ${spot.name[lang]} · ${pad(sc.window.start)}–${pad(sc.window.end)}`);
    if (why) lines.push(`   ${why}`);
  });
  if (rec.avoid.length) {
    lines.push('');
    lines.push(
      `${s.avoid}: ` +
        rec.avoid
          .map((sc) => {
            const main = sc.factors.find((f) => f.impact < 0);
            return `${spots.get(sc.spotId)!.name[lang]}${main ? ` (${factorText(main, lang).toLowerCase()})` : ''}`;
          })
          .join('; '),
    );
  }
  lines.push('', s.disclaimer);
  return lines.join('\n');
}

function PickCard({ sc, spot, lang, onOpen, primary }: { sc: SpotScore; spot: Spot; lang: Lang; onOpen: () => void; primary?: boolean }) {
  const s = strings(lang);
  return (
    <li className={`pick ${primary ? 'pick-primary' : ''}`}>
      <div className="pick-head">
        <span className="pick-type">{s.types[spot.type]}</span>
        <ScoreBar score={sc.score} verdict={sc.verdict} />
      </div>
      <h4 className="pick-name">{spot.name[lang]}</h4>
      <p className="pick-meta">
        <span>
          {s.when}: <strong>{pad(sc.window.start)}–{pad(sc.window.end)}</strong>
        </span>
        <span>
          {s.travel}: <strong>{sc.travelMinutes}{s.min}</strong>
        </span>
      </p>
      <ul className="pick-reasons">
        {reasons(sc).map((f) => (
          <li key={f.key} className={f.impact < 0 ? 'neg' : 'pos'}>
            {factorText(f, lang)}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-link" onClick={onOpen}>
        {s.details} →
      </button>
    </li>
  );
}

export function Recommendations({
  rec,
  syn,
  spots,
  profile,
  lang,
  dayTitle,
  onOpen,
}: {
  rec: Recommendation;
  syn: Synopsis;
  spots: Spot[];
  profile: Profile;
  lang: Lang;
  dayTitle: string;
  onOpen: (id: string) => void;
}) {
  const s = strings(lang);
  const byId = new Map(spots.map((x) => [x.id, x]));
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const message = buildMessage(rec, syn, byId, lang, dayTitle);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
      const ta = document.getElementById('rec-message') as HTMLTextAreaElement | null;
      ta?.select();
    }
    window.setTimeout(() => setCopyState('idle'), 2500);
  };

  return (
    <section className="recs" aria-labelledby="rec-title">
      <header className="rec-head">
        <p className="eyebrow">
          {s.recsFor} {profile.name[lang].toLowerCase()} · {longDate(syn.date, lang)}
        </p>
        <h2 id="rec-title" className="section-title">
          {dayTitle}
        </h2>
        {rec.badWeatherDay && <p className="callout callout-warn">{s.badDay}</p>}
      </header>

      <h3 className="group-title">{s.topPicks}</h3>
      {rec.top.length ? (
        <ol className="picks">
          {rec.top.map((sc, i) => (
            <PickCard key={sc.spotId} sc={sc} spot={byId.get(sc.spotId)!} lang={lang} onOpen={() => onOpen(sc.spotId)} primary={i === 0} />
          ))}
        </ol>
      ) : (
        <p className="hint">{s.noTop}</p>
      )}

      {rec.alternatives.length > 0 && (
        <>
          <h3 className="group-title">{s.alternatives}</h3>
          <ul className="alt-list">
            {rec.alternatives.map((sc) => {
              const spot = byId.get(sc.spotId)!;
              const r = reasons(sc)[0];
              return (
                <li key={sc.spotId}>
                  <button type="button" className="alt" onClick={() => onOpen(sc.spotId)}>
                    <span className="alt-name">{spot.name[lang]}</span>
                    <span className="alt-meta">
                      {s.types[spot.type]} · {pad(sc.window.start)}–{pad(sc.window.end)} · {sc.travelMinutes}
                      {s.min}
                    </span>
                    {r && <span className="alt-why">{factorText(r, lang)}</span>}
                    <ScoreBar score={sc.score} verdict={sc.verdict} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {rec.avoid.length > 0 && (
        <>
          <h3 className="group-title group-title-avoid">{s.avoid}</h3>
          <ul className="avoid-list">
            {rec.avoid.map((sc) => {
              const spot = byId.get(sc.spotId)!;
              const main = sc.factors.filter((f) => f.impact < 0).slice(0, 2);
              return (
                <li key={sc.spotId}>
                  <button type="button" className="avoid" onClick={() => onOpen(sc.spotId)}>
                    <span className="avoid-name">{spot.name[lang]}</span>
                    <span className="avoid-why">{main.map((f) => factorText(f, lang)).join(' · ')}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section className="panel message" aria-labelledby="msg-title">
        <div className="message-head">
          <div>
            <h3 id="msg-title" className="panel-title">
              {s.message}
            </h3>
            <p className="hint">{s.messageHint}</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={copy}>
            {copyState === 'copied' ? s.copied : s.copy}
          </button>
        </div>
        {copyState === 'failed' && <p className="hint warn-text">{s.copyFailed}</p>}
        <textarea id="rec-message" className="message-text" readOnly value={message} rows={Math.min(18, message.split('\n').length + 1)} />
      </section>
    </section>
  );
}
