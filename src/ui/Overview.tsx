import type { Synopsis } from '../engine/synopsis';
import { MODEL_LABELS, type Lang } from '../engine/types';
import { REF_POINTS } from '../data/region';
import { Compass, FlowArrow, WindHours } from './charts';
import { longDate, strings, takeawayText, windLabel } from './i18n';

const fmtTime = (iso?: string) => (iso ? iso.slice(11, 16) : '–');
const fmt = (v: number | null | undefined, digits = 0, unit = '') => (v == null || Number.isNaN(v) ? '–' : `${v.toFixed(digits)}${unit}`);

export function Overview({ syn, lang, onAnalysis }: { syn: Synopsis; lang: Lang; onAnalysis: () => void }) {
  const s = strings(lang);
  const agreeLabel = { high: s.agreeHigh, medium: s.agreeMedium, low: s.agreeLow }[syn.agreement];
  const [headline, ...rest] = syn.takeaways.map((t) => takeawayText(t, lang)).filter(Boolean);

  return (
    <section className="overview" aria-labelledby="ov-title">
      <header className="ov-head">
        <p className="eyebrow">{longDate(syn.date, lang)}</p>
        <h2 id="ov-title" className="ov-headline">
          {headline}
        </h2>
      </header>

      <div className="ov-grid">
        <article className="panel ov-wind">
          <h3 className="panel-title">{s.openSeaWind}</h3>
          <div className="ov-wind-body">
            <Compass from={syn.wind.dir} bf={syn.wind.bf} kmh={syn.wind.speed} lang={lang} />
            <dl className="kv">
              <div>
                <dt>{s.direction}</dt>
                <dd>
                  {windLabel(syn.wind.dir, lang)} · {syn.wind.dir}°
                </dd>
              </div>
              <div>
                <dt>{s.speed}</dt>
                <dd>
                  {Math.round(syn.wind.speed)} km/h · {syn.wind.bf} Bf
                </dd>
              </div>
              <div>
                <dt>{s.gust}</dt>
                <dd>{Math.round(syn.wind.gust)} km/h</dd>
              </div>
              <div>
                <dt>{s.agreement}</dt>
                <dd>
                  <span className={`pill conf-${syn.agreement}`}>{agreeLabel}</span>
                </dd>
              </div>
            </dl>
          </div>
          <h4 className="sub-title">{s.hourlyWind}</h4>
          <WindHours hours={syn.hourlyWind} />
        </article>

        <article className="panel ov-coasts">
          <h3 className="panel-title">{s.coasts}</h3>
          <ul className="coast-list">
            {syn.coasts.map((c) => {
              const ref = REF_POINTS.find((r) => r.id === c.id)!;
              const rough = (c.waveMax ?? 0) >= 1;
              const calm = (c.waveMax ?? 0) < 0.5;
              return (
                <li key={c.id} className={`coast ${rough ? 'coast-rough' : calm ? 'coast-calm' : 'coast-mid'}`}>
                  <div className="coast-name">{ref.name[lang]}</div>
                  <div className="coast-wave">
                    <span className="big-num">{fmt(c.waveMax, 1)}</span>
                    <span className="unit">m</span>
                    {c.waveDir != null && <FlowArrow from={c.waveDir} size={18} title={windLabel(c.waveDir, lang)} />}
                  </div>
                  <div className="coast-meta">
                    {s.waveMean} {fmt(c.waveMean, 1, ' m')}
                    {c.waveDir != null && <> · {lang === 'el' ? 'από' : 'from'} {windLabel(c.waveDir, lang)}</>}
                  </div>
                  <div className="coast-meta">
                    {windLabel(c.wind.dir, lang)} {c.wind.bf} Bf · {s.sst} {fmt(c.sst, 1, '°C')}
                  </div>
                  {rough ? (
                    <span className="pill pill-warn">{s.roughSea}</span>
                  ) : (
                    <span className={`pill ${c.exposure === 'exposed' ? 'pill-warn' : 'pill-ok'}`}>{{ exposed: s.exposed, sheltered: s.shelteredCoast, calm: s.calmWind }[c.exposure]}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </article>

        <article className="panel ov-models">
          <h3 className="panel-title">{s.models}</h3>
          <p className="hint">{s.modelsHint}</p>
          <div className="table-scroll">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th scope="col">{s.model}</th>
                  <th scope="col" className="num">
                    {s.speed}
                  </th>
                  <th scope="col">{s.direction}</th>
                  <th scope="col" className="num">
                    {s.gust}
                  </th>
                </tr>
              </thead>
              <tbody>
                {syn.models.map((m) => (
                  <tr key={m.model}>
                    <th scope="row">{MODEL_LABELS[m.model]}</th>
                    <td className="num">{fmt(m.speed, 0, ' km/h')}</td>
                    <td>
                      {m.dir != null && (
                        <span className="dir-cell">
                          <FlowArrow from={m.dir} size={14} /> {windLabel(m.dir, lang)}
                        </span>
                      )}
                    </td>
                    <td className="num">{fmt(m.gust, 0, ' km/h')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {lang === 'el' ? 'Εύρος έντασης' : 'Speed spread'}: {syn.wind.speedSpread} km/h · {lang === 'el' ? 'απόκλιση διεύθυνσης' : 'direction spread'}: {syn.wind.dirSpread}°
          </p>
        </article>

        <article className="panel ov-town">
          <h3 className="panel-title">{s.town}</h3>
          <dl className="stat-row">
            <div>
              <dt>{s.maxTemp}</dt>
              <dd>{fmt(syn.town.tMax, 0, '°C')}</dd>
            </div>
            <div>
              <dt>{s.feels}</dt>
              <dd>{fmt(syn.town.apparentMax, 0, '°C')}</dd>
            </div>
            <div>
              <dt>{s.uv}</dt>
              <dd>{fmt(syn.town.uvMax, 0)}</dd>
            </div>
            <div>
              <dt>{s.rain}</dt>
              <dd>{fmt(syn.town.rainProbMax, 0, '%')}</dd>
            </div>
            <div>
              <dt>{s.sunrise}</dt>
              <dd>{fmtTime(syn.town.sunrise)}</dd>
            </div>
            <div>
              <dt>{s.sunset}</dt>
              <dd>{fmtTime(syn.town.sunset)}</dd>
            </div>
          </dl>
        </article>

        <article className="panel ov-points">
          <h3 className="panel-title">{s.keyPoints}</h3>
          <ul className="takeaways">
            {rest.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={onAnalysis}>
            {s.seeAnalysis} →
          </button>
        </article>
      </div>
    </section>
  );
}
