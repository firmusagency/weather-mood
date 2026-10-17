import type { HourConditions, SpotScore, Verdict } from '../engine/types';
import { verdictOf } from '../engine/scoring';
import { compass } from '../engine/geo';
import type { Lang } from '../engine/types';

/** Arrow pointing the way the wind/waves travel (they come FROM `from`). */
export function FlowArrow({ from, size = 16, title }: { from: number; size?: number; title?: string }) {
  return (
    <svg className="flow-arrow" width={size} height={size} viewBox="-10 -10 20 20" role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <g transform={`rotate(${from + 180})`}>
        <path d="M0 -8 L5 3 L1 1.5 L1 8 L-1 8 L-1 1.5 L-5 3 Z" className="flow-arrow-shape" />
      </g>
    </svg>
  );
}

/** Wind rose for the regional wind: arrow blowing across a compass card. */
export function Compass({ from, bf, kmh, lang }: { from: number; bf: number; kmh: number; lang: Lang }) {
  const ticks = Array.from({ length: 16 }, (_, i) => i * 22.5);
  const labels = [0, 90, 180, 270];
  return (
    <svg className="compass" viewBox="-60 -60 120 120" role="img" aria-label={`${compass(from, lang)} ${bf} Bf`}>
      <circle r="52" className="compass-ring" />
      {ticks.map((t) => (
        <line key={t} x1="0" y1={-52} x2="0" y2={t % 90 === 0 ? -44 : -48} transform={`rotate(${t})`} className="compass-tick" />
      ))}
      {labels.map((t) => {
        const r = 36;
        const x = Math.sin((t * Math.PI) / 180) * r;
        const y = -Math.cos((t * Math.PI) / 180) * r;
        return (
          <text key={t} x={x} y={y + 3.5} className="compass-label" textAnchor="middle">
            {compass(t, lang)}
          </text>
        );
      })}
      <g transform={`rotate(${from})`}>
        {/* tail sits on the side the wind comes from, head points downwind */}
        <line x1="0" y1="-50" x2="0" y2="30" className="compass-shaft" />
        <path d="M0 46 L-8 26 L8 26 Z" className="compass-head" />
      </g>
      <circle r="15" className="compass-hub" />
      <text y="2" textAnchor="middle" className="compass-bf">
        {bf}
      </text>
      <text y="10" textAnchor="middle" className="compass-unit">
        Bf
      </text>
      <title>{`${compass(from, lang)} · ${Math.round(kmh)} km/h`}</title>
    </svg>
  );
}

export const verdictClass = (v: Verdict) => `v-${v}`;

export function ScoreBar({ score, verdict }: { score: number; verdict: Verdict }) {
  return (
    <span className={`scorebar ${verdictClass(verdict)}`} aria-label={`${score}/100`}>
      <span className="scorebar-track">
        <span className="scorebar-fill" style={{ width: `${score}%` }} />
      </span>
      <span className="scorebar-num">{score}</span>
    </span>
  );
}

const W = 680;
const PAD = { l: 34, r: 38, t: 26, b: 34 };

/** Hour-by-hour chart: wind bars + gust ticks, wave line, per-hour score strip, best window. */
export function HourlyChart({ conditions, score, labels }: { conditions: HourConditions[]; score: SpotScore; labels: Record<string, string> }) {
  if (!conditions.length) return null;
  const H = 230;
  const hours = conditions.map((c) => c.hour);
  const h0 = hours[0];
  const n = hours.length;
  const plotW = W - PAD.l - PAD.r;
  const colW = plotW / n;
  const x = (h: number) => PAD.l + (h - h0) * colW;
  const stripH = 12;
  const plotBottom = H - PAD.b - stripH - 8;
  const plotH = plotBottom - PAD.t;

  const maxWind = Math.max(40, ...conditions.map((c) => c.effectiveGust));
  const windTop = Math.ceil(maxWind / 10) * 10;
  const yW = (v: number) => plotBottom - (v / windTop) * plotH;

  const waves = conditions.map((c) => c.sea?.effectiveWave ?? null);
  const hasWave = waves.some((w) => w != null);
  const waveTop = Math.max(1, Math.ceil(Math.max(...waves.map((w) => w ?? 0)) * 2) / 2);
  const yS = (v: number) => plotBottom - (v / waveTop) * plotH;
  const wavePath = conditions
    .map((c, i) => (c.sea ? `${i === 0 || !conditions[i - 1].sea ? 'M' : 'L'}${x(c.hour) + colW / 2},${yS(c.sea.effectiveWave)}` : ''))
    .join(' ');

  const windTicks = Array.from({ length: windTop / 10 + 1 }, (_, i) => i * 10).filter((v) => v % (windTop > 60 ? 20 : 10) === 0);
  const waveTicks = Array.from({ length: waveTop * 2 + 1 }, (_, i) => i / 2);
  const scoreByHour = new Map(score.hourly.map((h) => [h.hour, h.score]));

  return (
    <figure className="hourly">
      <div className="chart-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="hourly-svg" role="img" aria-label={labels.hourByHour}>
          {score.window.start >= 0 && (
            <rect x={x(score.window.start)} y={PAD.t - 18} width={(score.window.end - score.window.start) * colW} height={plotBottom - PAD.t + 18 + stripH + 8} className="window-band" rx="4" />
          )}
          {windTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yW(v)} y2={yW(v)} className="grid" />
              <text x={PAD.l - 6} y={yW(v) + 3.5} textAnchor="end" className="axis">
                {v}
              </text>
            </g>
          ))}
          {hasWave &&
            waveTicks.map((v) => (
              <text key={v} x={W - PAD.r + 6} y={yS(v) + 3.5} className="axis axis-wave">
                {v.toFixed(1)}
              </text>
            ))}
          {conditions.map((c) => (
            <g key={c.hour}>
              <rect x={x(c.hour) + colW * 0.2} y={yW(c.wind.speed)} width={colW * 0.6} height={plotBottom - yW(c.wind.speed)} className="bar-wind" rx="2" />
              <line x1={x(c.hour) + colW * 0.15} x2={x(c.hour) + colW * 0.85} y1={yW(c.effectiveGust)} y2={yW(c.effectiveGust)} className="tick-gust" />
              <g transform={`translate(${x(c.hour) + colW / 2}, ${PAD.t - 10})`}>
                <g transform={`rotate(${c.wind.dir + 180})`}>
                  <path d="M0 -6 L4 2 L0.8 1 L0.8 6 L-0.8 6 L-0.8 1 L-4 2 Z" className="flow-arrow-shape" />
                </g>
              </g>
              <rect
                x={x(c.hour) + 1}
                y={plotBottom + 8}
                width={colW - 2}
                height={stripH}
                rx="2"
                className={`strip ${verdictClass(verdictOf(scoreByHour.get(c.hour) ?? 0))}`}
              >
                <title>{`${c.hour}:00 · ${scoreByHour.get(c.hour)}/100`}</title>
              </rect>
              {c.hour % 3 === 0 && (
                <text x={x(c.hour) + colW / 2} y={H - 8} textAnchor="middle" className="axis">
                  {String(c.hour).padStart(2, '0')}
                </text>
              )}
            </g>
          ))}
          {hasWave && <path d={wavePath} className="line-wave" />}
          {hasWave &&
            conditions.map((c) => (c.sea ? <circle key={c.hour} cx={x(c.hour) + colW / 2} cy={yS(c.sea.effectiveWave)} r="2.6" className="dot-wave" /> : null))}
          <text x={PAD.l - 6} y={PAD.t - 18} textAnchor="end" className="axis">
            km/h
          </text>
          {hasWave && (
            <text x={W - PAD.r + 6} y={PAD.t - 18} className="axis axis-wave">
              m
            </text>
          )}
        </svg>
      </div>
      <figcaption className="legend">
        <span>
          <i className="sw sw-wind" /> {labels.legendWind}
        </span>
        <span>
          <i className="sw sw-gust" /> {labels.legendGust}
        </span>
        {hasWave && (
          <span>
            <i className="sw sw-wave" /> {labels.legendWave}
          </span>
        )}
        <span>
          <i className="sw sw-strip" /> {labels.legendScore}
        </span>
      </figcaption>
    </figure>
  );
}

/** Compact regional wind-by-hour chart for the overview. */
export function WindHours({ hours }: { hours: { hour: number; speed: number; gust: number; dir: number }[] }) {
  if (!hours.length) return null;
  const Wd = 520;
  const Hd = 150;
  const l = 30;
  const r = 8;
  const t = 24;
  const b = 22;
  const n = hours.length;
  const colW = (Wd - l - r) / n;
  const top = Math.max(30, Math.ceil(Math.max(...hours.map((h) => h.gust)) / 10) * 10);
  const y = (v: number) => Hd - b - (v / top) * (Hd - t - b);
  const ticks = Array.from({ length: top / 10 + 1 }, (_, i) => i * 10).filter((v) => v % (top > 50 ? 20 : 10) === 0);
  return (
    <div className="chart-scroll">
      <svg viewBox={`0 0 ${Wd} ${Hd}`} className="windhours" role="img" aria-label="wind by hour">
        {ticks.map((v) => (
          <g key={v}>
            <line x1={l} x2={Wd - r} y1={y(v)} y2={y(v)} className="grid" />
            <text x={l - 5} y={y(v) + 3.5} textAnchor="end" className="axis">
              {v}
            </text>
          </g>
        ))}
        {hours.map((h, i) => (
          <g key={h.hour}>
            <rect x={l + i * colW + colW * 0.18} y={y(h.speed)} width={colW * 0.64} height={Hd - b - y(h.speed)} rx="2" className="bar-wind" />
            <line x1={l + i * colW + colW * 0.12} x2={l + i * colW + colW * 0.88} y1={y(h.gust)} y2={y(h.gust)} className="tick-gust" />
            <g transform={`translate(${l + i * colW + colW / 2}, 11)`}>
              <g transform={`rotate(${h.dir + 180})`}>
                <path d="M0 -6 L4 2 L0.8 1 L0.8 6 L-0.8 6 L-0.8 1 L-4 2 Z" className="flow-arrow-shape" />
              </g>
            </g>
            {h.hour % 3 === 0 && (
              <text x={l + i * colW + colW / 2} y={Hd - 6} textAnchor="middle" className="axis">
                {String(h.hour).padStart(2, '0')}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
