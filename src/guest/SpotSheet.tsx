import { useEffect, useRef } from 'react';
import type { HourConditions, ProfileId, Spot, SpotScore } from '../engine/types';
import { guestReasons, guestTips, mainProblem, mapsUrl, seaLevel, shareSpotText, travelLabel, windLevel } from './advice';
import { ShareButton } from './Share';
import { compassG, g, pick } from './i18n';
import type { GuestLang, Property } from './property';
import { SpotPhoto } from '../ui/Photo';

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function SpotSheet({
  spot,
  sc,
  conds,
  property,
  profile,
  lang,
  dayLabel,
  onClose,
}: {
  spot: Spot;
  sc: SpotScore;
  conds: HourConditions[];
  property: Property;
  profile: ProfileId;
  lang: GuestLang;
  dayLabel: string;
  onClose: () => void;
}) {
  const d = g(lang);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const w = conds.filter((c) => c.hour >= sc.window.start && c.hour < sc.window.end);
  const mid = w[Math.floor(w.length / 2)] ?? conds[0];
  const wave = w.some((c) => c.sea) ? Math.max(...w.map((c) => c.sea?.effectiveWave ?? 0)) : null;
  const bfMax = Math.max(0, ...w.map((c) => c.bf));
  const feels = w.length ? Math.round(w.reduce((s, c) => s + (c.apparent ?? 0), 0) / w.length) : null;
  const rain = Math.max(0, ...w.map((c) => c.precipProb ?? 0));
  const avoid = sc.verdict === 'avoid' || sc.verdict === 'unsuitable';
  const lines = avoid ? [] : guestReasons(sc, lang);
  const problem = avoid ? mainProblem(sc, lang) : undefined;
  const tips = guestTips(spot, sc, conds, lang);

  return (
    <div className="g-sheet-backdrop" onClick={onClose}>
      <div className="g-sheet" role="dialog" aria-modal="true" aria-labelledby="g-sheet-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="g-sheet-grip" aria-hidden="true" />
        <SpotPhoto spotId={spot.id} alt={pick(spot.name, lang)} variant="hero" creditWord={d.photo} />
        <header className="g-sheet-head">
          <div>
            <p className="g-eyebrow">{d.types[spot.type]}</p>
            <h2 id="g-sheet-title" className="g-sheet-title">
              {pick(spot.name, lang)}
            </h2>
          </div>
          <button type="button" className="g-close" onClick={onClose} aria-label={d.close}>
            ✕
          </button>
        </header>

        {problem && <p className="g-note g-note-avoid">{problem}</p>}

        {!avoid && sc.window.start >= 0 && (
          <p className="g-card-meta">
            <span>
              {d.bestTime} <strong>{pad(sc.window.start)}–{pad(sc.window.end)}</strong>
            </span>
            <span>{travelLabel(spot, sc, property.base, profile, d, lang)}</span>
          </p>
        )}

        {lines.length > 0 && (
          <section>
            <h3 className="g-h3">{d.why}</h3>
            <ul className="g-lines">
              {lines.map((l) => (
                <li key={l.text} className={`g-line g-${l.kind}`}>
                  {l.text}
                </li>
              ))}
            </ul>
          </section>
        )}

        {mid && (
          <section>
            <h3 className="g-h3">{d.conditions}</h3>
            <dl className="g-facts">
              {wave != null && (
                <div>
                  <dt>{d.sea}</dt>
                  <dd>
                    {d.seaWords[seaLevel(wave)]}
                    <small>~{wave.toFixed(1)} m</small>
                  </dd>
                </div>
              )}
              <div>
                <dt>{d.wind}</dt>
                <dd>
                  {d.windWords[windLevel(bfMax)]}
                  <small>
                    {bfMax} Bf {bfMax >= 2 ? compassG(mid.wind.dir, lang) : ''}
                  </small>
                </dd>
              </div>
              {feels != null && (
                <div>
                  <dt>{d.feels}</dt>
                  <dd>{feels}°C</dd>
                </div>
              )}
              <div>
                <dt>{d.rain}</dt>
                <dd>{rain}%</dd>
              </div>
            </dl>
          </section>
        )}

        {tips.length > 0 && (
          <section>
            <h3 className="g-h3">{d.bring}</h3>
            <ul className="g-tips">
              {tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="g-h3">{d.aboutPlace}</h3>
          <p className="g-about">{pick(spot.notes, lang)}</p>
        </section>

        <div className="g-sheet-actions">
          <a className="g-btn g-btn-brand g-btn-wide" href={mapsUrl(spot, profile)} target="_blank" rel="noreferrer">
            {d.directions}
          </a>
          <ShareButton text={shareSpotText(spot, sc, lines, property.name, dayLabel, profile, lang)} title={pick(spot.name, lang)} lang={lang} wide />
        </div>
      </div>
    </div>
  );
}
