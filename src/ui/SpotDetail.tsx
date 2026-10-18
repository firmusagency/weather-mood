import { useEffect, useRef } from 'react';
import { MODELS, MODEL_LABELS, type Base, type Dataset, type Factor, type HourConditions, type Lang, type Spot, type SpotScore } from '../engine/types';
import { scoreSpot } from '../engine/scoring';
import { PROFILES } from '../data/profiles';
import { hourOf } from '../engine/dates';
import { FlowArrow, HourlyChart, ScoreBar } from './charts';
import { expoLabel, midWindow, pad } from './AnalysisTable';
import { factorText, strings, windLabel } from './i18n';

function FactorList({ factors, lang, empty }: { factors: Factor[]; lang: Lang; empty?: string }) {
  if (!factors.length) return empty ? <p className="hint">{empty}</p> : null;
  const maxAbs = Math.max(10, ...factors.map((f) => Math.abs(f.impact)));
  return (
    <ul className="factors">
      {factors.map((f) => (
        <li key={f.key} className={f.impact < 0 ? 'neg' : f.impact > 0 ? 'pos' : 'neutral'}>
          <span className="factor-text">{factorText(f, lang)}</span>
          <span className="factor-impact">
            <span className="impact-bar" style={{ width: `${(Math.abs(f.impact) / maxAbs) * 100}%` }} />
            <span className="impact-num">{f.impact > 0 ? `+${Math.round(f.impact)}` : f.impact < 0 ? Math.round(f.impact) : '·'}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function SpotDetail({
  spot,
  score,
  conditions,
  data,
  base,
  daysAhead,
  lang,
  onClose,
}: {
  spot: Spot;
  score: SpotScore;
  conditions: HourConditions[];
  data: Dataset;
  base: Base;
  daysAhead: number;
  lang: Lang;
  onClose: () => void;
}) {
  const s = strings(lang);
  const ref = useRef<HTMLDivElement>(null);
  const mid = midWindow(conditions, score);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const k = mid ? data.land[spot.id]?.atmos.findIndex((a) => hourOf(a.time) === mid.hour) : -1;
  const byProfile = PROFILES.map((p) => ({ p, sc: p.id === score.profile ? score : scoreSpot(spot, conditions, p.id, base, data.date, { daysAhead }) }));
  const confLabel = { high: s.confHigh, medium: s.confMedium, low: s.confLow }[score.confidence];

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sd-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="drawer-head">
          <div>
            <p className="eyebrow">
              {s.types[spot.type]} · {spot.area}
            </p>
            <h2 id="sd-title" className="drawer-title">
              {spot.name[lang]}
            </h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label={s.close}>
            ✕
          </button>
        </header>

        <dl className="sd-summary">
          <div>
            <dt>{s.weatherScore}</dt>
            <dd>
              {score.verdict === 'unsuitable' ? <span className="pill v-unsuitable">{s.verdict.unsuitable}</span> : <ScoreBar score={score.score} verdict={score.verdict} />}
            </dd>
          </div>
          <div>
            <dt>{s.bestWindow}</dt>
            <dd>{score.window.start >= 0 ? `${pad(score.window.start)}–${pad(score.window.end)}` : '–'}</dd>
          </div>
          <div>
            <dt>{s.travel}</dt>
            <dd>
              {score.travelMinutes}
              {s.min}
            </dd>
          </div>
          <div>
            <dt>{s.confidence}</dt>
            <dd>
              <span className={`conf conf-${score.confidence}`}>{confLabel}</span>
            </dd>
          </div>
        </dl>
        {score.unsuitableReason && <p className="callout callout-muted">{factorText(score.unsuitableReason, lang)}</p>}

        <section className="sd-step">
          <h3 className="step-title">{s.hourByHour}</h3>
          <HourlyChart conditions={conditions} score={score} labels={s as unknown as Record<string, string>} />
        </section>

        {mid && (
          <section className="sd-step">
            <h3 className="step-title">
              {s.stepData} <span className="step-at">({pad(mid.hour)})</span>
            </h3>
            <dl className="kv kv-2">
              <div>
                <dt>{s.windConsensus}</dt>
                <dd>
                  <span className="dir-cell">
                    <FlowArrow from={mid.wind.dir} size={14} /> {windLabel(mid.wind.dir, lang)} {Math.round(mid.wind.dir)}° · {Math.round(mid.wind.speed)} km/h ({mid.bf} Bf)
                  </span>
                </dd>
              </div>
              <div>
                <dt>{s.gust}</dt>
                <dd>
                  {Math.round(mid.effectiveGust)} km/h{mid.gustyNow && <span className="pill pill-warn">{lang === 'el' ? 'ριπές βουνού' : 'mountain gusts'}</span>}
                </dd>
              </div>
              <div>
                <dt>{s.feels}</dt>
                <dd>{mid.apparent == null ? '–' : `${Math.round(mid.apparent)}°C`}</dd>
              </div>
              <div>
                <dt>{s.rain}</dt>
                <dd>
                  {mid.precipProb ?? 0}% · {(mid.precip ?? 0).toFixed(1)} mm
                </dd>
              </div>
              <div>
                <dt>{s.uv}</dt>
                <dd>{mid.uv == null ? '–' : mid.uv.toFixed(0)}</dd>
              </div>
              {mid.sea && (
                <div>
                  <dt>{s.waveOffshore}</dt>
                  <dd>
                    <span className="dir-cell">
                      <FlowArrow from={mid.sea.waveDir} size={14} /> {mid.sea.offshoreWave.toFixed(1)} m {lang === 'el' ? 'από' : 'from'} {windLabel(mid.sea.waveDir, lang)}
                      {mid.sea.period != null && ` · ${mid.sea.period.toFixed(0)} s`}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
            {k != null && k >= 0 && (
              <details className="models-detail">
                <summary>{s.modelsAtWindow}</summary>
                <div className="table-scroll">
                  <table className="data-table compact">
                    <tbody>
                      {MODELS.map((m) => {
                        const w = data.land[spot.id].models[m][k];
                        return (
                          <tr key={m}>
                            <th scope="row">{MODEL_LABELS[m]}</th>
                            <td className="num">{w?.wind == null ? '–' : `${Math.round(w.wind)} km/h`}</td>
                            <td>{w?.dir == null ? '–' : windLabel(w.dir, lang)}</td>
                            <td className="num">{w?.gust == null ? '–' : `${Math.round(w.gust)} km/h`}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </section>
        )}

        {mid && (spot.facing !== undefined || spot.exposedFrom) && (
          <section className="sd-step">
            <h3 className="step-title">{s.stepGeometry}</h3>
            {spot.facing !== undefined ? (
              <p className="geo-line">
                {s.shoreFaces} <strong>{windLabel(spot.facing, lang)}</strong> ({spot.facing}°), {s.windFrom} <strong>{windLabel(mid.wind.dir, lang)}</strong> ({Math.round(mid.wind.dir)}°) →{' '}
                <span className={`expo expo-${mid.exposureClass}`}>{expoLabel(mid.exposureClass ?? 'cross', mid.shelteredNow, lang)}</span>, {s.windExposure}{' '}
                <strong>{Math.round(mid.windExposure * 100)}%</strong>.
              </p>
            ) : (
              <p className="geo-line">
                {lang === 'el' ? 'Η διαδρομή είναι εκτεθειμένη σε ανέμους από' : 'The route is exposed to winds from'}{' '}
                {spot.exposedFrom!.map(([a, b]) => (lang === 'el' ? `${windLabel(a, lang)} έως ${windLabel(b, lang)}` : `${windLabel(a, lang)} to ${windLabel(b, lang)}`)).join(', ')}.
              </p>
            )}
            {mid.sea && spot.facing !== undefined && (
              <div className="wave-calc" aria-label={s.waveAtShore}>
                <span>
                  {s.waveOffshore} <strong>{mid.sea.offshoreWave.toFixed(2)} m</strong>
                </span>
                <span className="op">×</span>
                <span>
                  {s.waveExposure} <strong>{Math.round(mid.sea.waveExposure * 100)}%</strong>
                </span>
                {spot.waveFactor && spot.waveFactor !== 1 && (
                  <>
                    <span className="op">×</span>
                    <span>
                      {lang === 'el' ? 'μορφή ακτής' : 'shore shape'} <strong>{spot.waveFactor}</strong>
                    </span>
                  </>
                )}
                {mid.sea.localWindSea > mid.sea.offshoreWave * mid.sea.waveExposure && (
                  <span className="hint">
                    ({s.localWindSea}: {mid.sea.localWindSea.toFixed(2)} m)
                  </span>
                )}
                <span className="op">=</span>
                <span className="result">
                  {s.waveAtShore} <strong>{mid.sea.effectiveWave.toFixed(2)} m</strong>
                </span>
              </div>
            )}
          </section>
        )}

        <section className="sd-step">
          <h3 className="step-title">{s.stepJudgement}</h3>
          <FactorList factors={score.factors} lang={lang} empty={s.noFactors} />
        </section>

        <section className="sd-step">
          <h3 className="step-title">
            {s.stepFit} <span className="step-at">({s.rankScore} {Math.round(score.rank)})</span>
          </h3>
          <FactorList factors={score.fit} lang={lang} />
        </section>

        <section className="sd-step">
          <h3 className="step-title">{s.compareProfiles}</h3>
          <p className="hint">{s.compareHint}</p>
          <ul className="compare">
            {byProfile.map(({ p, sc }) => (
              <li key={p.id} className={p.id === score.profile ? 'is-current' : ''}>
                <span className="compare-name">
                  <span aria-hidden="true">{p.icon}</span> {p.name[lang]}
                </span>
                {sc.verdict === 'unsuitable' ? <span className="pill v-unsuitable">{s.verdict.unsuitable}</span> : <ScoreBar score={sc.score} verdict={sc.verdict} />}
              </li>
            ))}
          </ul>
        </section>

        <section className="sd-step">
          <h3 className="step-title">{s.notes}</h3>
          <p>{spot.notes[lang]}</p>
          {!spot.verified && <p className="callout callout-warn">{s.unverified}</p>}
        </section>
      </aside>
    </div>
  );
}
