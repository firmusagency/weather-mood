import { useEffect, useState } from 'react';
import type { FeedbackSummary } from '../engine/feedback';
import { MODEL_LABELS, type Lang } from '../engine/types';
import type { VerificationSummary } from '../engine/verify';
import { loadFeedback, loadVerification, readPref, writePref } from '../ui/data';
import { StationsTable } from '../ui/Method';

/*
 * Public accuracy page ("Πόσο πέφτουμε μέσα"): the sales argument is a track record, not a promise.
 * Everything here is produced by the nightly verification (forecast vs airport station) and the
 * guest votes; the page only presents it, misses included.
 */

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const LINKS = {
  guest: env.VITE_GUEST_URL || 'https://claude.ai/artifact/M78yRVPLfDAa9sTmgMMHFP',
  dashboard: env.VITE_DASHBOARD_URL || 'https://claude.ai/artifact/1nbrKuJe227f5o3kpWDcbv',
  contact: env.VITE_CONTACT_EMAIL || 'hello@weathermood.gr',
};

const T = {
  el: {
    brand: 'Weather Mood',
    tag: 'Χανιά, Κρήτη',
    eyebrow: 'Δημόσιος έλεγχος ακρίβειας',
    title: 'Λέμε στους επισκέπτες σας πού να πάνε αύριο. Και μετράμε αν είχαμε δίκιο.',
    lede: 'Κάθε πρωί συγκρίνουμε την πρόγνωση που δώσαμε την προηγούμενη μέρα με τις μετρήσεις του μετεωρολογικού σταθμού του αεροδρομίου Χανίων. Τα αποτελέσματα δημοσιεύονται εδώ αυτόματα, καλά και κακά.',
    days: 'ημέρες ελέγχου',
    bf: 'σωστή ένταση ανέμου',
    bfSub: 'μέγιστο Beaufort της ημέρας ±1',
    wind: 'μέσο σφάλμα ανέμου',
    windSub: 'μέση ωριαία ταχύτητα',
    rain: 'βροχή ναι/όχι',
    rainSub: 'σωστή πρόβλεψη',
    temp: 'σφάλμα θερμοκρασίας',
    tempSub: 'μέσο, °C',
    guests: 'συμφωνία επισκεπτών',
    guestsSub: 'ψήφοι 👍/👎 vs πρόταση',
    held: 'η πρόταση άντεξε',
    heldSub: 'ξανατρέχοντας με τον μετρημένο άνεμο',
    early: 'Ο έλεγχος ξεκίνησε στις {from}. Με λίγες ημέρες τα ποσοστά αλλάζουν εύκολα· η σειρά μεγαλώνει κάθε πρωί.',
    period: 'Περίοδος {from} έως {to} · ενημέρωση {updated}',
    howTitle: 'Πώς γίνεται ο έλεγχος',
    how: [
      ['05:17', 'Αποθηκεύουμε την πρόγνωση για την επόμενη μέρα: άνεμος από 5 μοντέλα, κύμα από 4, θερμοκρασία, βροχή. Αυτή είναι η πρόγνωση με την οποία φτιάχνονται οι προτάσεις και το βραδινό μήνυμα.'],
      ['Την επόμενη μέρα', 'Οι επισκέπτες πηγαίνουν στις παραλίες που προτείναμε. Στο κινητό τους, μετά, ρωτάμε «Πήγατε; Ήταν όπως το είπαμε;».'],
      ['05:35 μεθαύριο', 'Συγκρίνουμε ώρα προς ώρα την πρόγνωση με τις μετρήσεις του σταθμού του αεροδρομίου (METAR) και, για τη δυτική και νότια ακτή, με τους σταθμούς του Εθνικού Αστεροσκοπείου σε Φαλάσαρνα, Ελαφονήσι, Παλαιόχωρα και Κίσσαμο. Μετά ξανατρέχουμε την πρόταση με τον άνεμο που μετρήθηκε: άντεξε ή όχι;'],
    ],
    chartTitle: 'Μέγιστο Beaufort ανά ημέρα: τι είπαμε και τι έγινε',
    chartHint: 'Η ένταση του ανέμου είναι αυτό που αποφασίζει αν μια παραλία είναι για μπάνιο ή όχι. Ανοιχτό = πρόγνωση, σκούρο = μέτρηση.',
    said: 'πρόγνωση',
    was: 'μέτρηση',
    tableTitle: 'Όλες οι ημέρες',
    cols: ['Ημέρα', 'Άνεμος: σφάλμα', 'Bf πρόγν./πραγμ.', 'Ριπή πρόγν./πραγμ.', 'Θερμ. max πρόγν./πραγμ.', 'Βροχή'],
    yes: 'ναι',
    no: 'όχι',
    modelsTitle: 'Ποιο μοντέλο πέφτει πιο κοντά',
    modelsHint: 'Δεν βασιζόμαστε σε ένα μοντέλο. Παίρνουμε τη διάμεσο των 5 και μετράμε πόσο διαφωνούν. Όταν διαφωνούν, το λέμε στον επισκέπτη.',
    guestsTitle: 'Τι λένε οι επισκέπτες',
    guestsHint: 'Ο σταθμός μετράει τον καιρό· οι επισκέπτες μετράνε την πρόταση. Κάθε ψήφος δένεται με όσα είχαμε πει για εκείνο το μέρος και εκείνη τη μέρα.',
    guestsNone: 'Οι πρώτες ψήφοι θα εμφανιστούν εδώ μόλις ξεκινήσουν οι επισκέπτες να απαντούν.',
    votes: 'ψήφοι',
    agree: 'συμφωνία με την πρόταση',
    honestTitle: 'Τι δεν μετράμε ακόμη (και το λέμε)',
    honest: [
      'Ο ωριαίος σταθμός είναι στο Ακρωτήρι, στη βόρεια ακτή. Στη δυτική και νότια ακτή οι σταθμοί δίνουν ημερήσια στοιχεία (μέγιστη ριπή και ώρα της), όχι ωριαία. Ο σταθμός του Ελαφονησίου μετράει συστηματικά πολύ χαμηλό άνεμο· τον δείχνουμε, αλλά τον ζυγίζουμε λιγότερο.',
      'Το κύμα στην ακτή είναι εκτίμηση από το κύμα των ανοιχτών και τη γεωμετρία κάθε παραλίας. Διορθώνεται αυτόματα όταν οι επισκέπτες βρίσκουν συστηματικά περισσότερο ή λιγότερο κύμα.',
      'Λίγες ημέρες ελέγχου σημαίνουν ποσοστά που αλλάζουν εύκολα. Δημοσιεύουμε και τις αστοχίες· δεν κρύβεται τίποτα.',
    ],
    ctaTitle: 'Δείτε το σε λειτουργία',
    ctaText: 'Σελίδα επισκέπτη σε 4 γλώσσες, οθόνη reception, dashboard με την πλήρη ανάλυση. Για το κατάλυμά σας: μία συνδρομή, δωρεάν για τους επισκέπτες σας.',
    ctaGuest: 'Σελίδα επισκέπτη',
    ctaDash: 'Dashboard',
    ctaMail: 'Επικοινωνία',
    footer: 'Δεδομένα καιρού: Open-Meteo (CC BY 4.0) · Μετρήσεις: METAR LGSA μέσω aviationweather.gov · Οι προτάσεις είναι ενδεικτικές· ακολουθείτε πάντα τις οδηγίες ναυαγοσωστών και αρχών.',
    loading: 'Φόρτωση…',
    none: 'Δεν υπάρχουν ακόμη ημέρες ελέγχου.',
  },
  en: {
    brand: 'Weather Mood',
    tag: 'Chania, Crete',
    eyebrow: 'Public accuracy check',
    title: 'We tell your guests where to go tomorrow. Then we check whether we were right.',
    lede: 'Every morning we compare the forecast we issued the day before with what the Chania airport weather station actually measured. The results are published here automatically, hits and misses alike.',
    days: 'days verified',
    bf: 'wind strength right',
    bfSub: 'daily max Beaufort within ±1',
    wind: 'mean wind error',
    windSub: 'hourly speed',
    rain: 'rain yes/no',
    rainSub: 'called correctly',
    temp: 'temperature error',
    tempSub: 'mean, °C',
    guests: 'guest agreement',
    guestsSub: '👍/👎 votes vs our pick',
    held: 'recommendation held',
    heldSub: 'rerun with the measured wind',
    early: 'Verification started on {from}. With few days the percentages swing easily; the record grows every morning.',
    period: 'Period {from} to {to} · updated {updated}',
    howTitle: 'How the check works',
    how: [
      ['05:17', 'We store the forecast for the next day: wind from 5 models, waves from 4, temperature, rain. This is the forecast behind the picks and the evening message.'],
      ['The next day', 'Guests go to the beaches we suggested. Afterwards, on their phone, we ask “Did you go? Was it as described?”.'],
      ['05:35 the day after', 'We compare the forecast hour by hour with the airport station (METAR) and, for the west and south coasts, with the National Observatory stations at Falasarna, Elafonisi, Paleochora and Kissamos. Then we rerun the recommendation with the measured wind: did it hold?'],
    ],
    chartTitle: 'Daily max Beaufort: what we said and what happened',
    chartHint: 'Wind strength is what decides whether a beach is swimmable. Light = forecast, dark = measured.',
    said: 'forecast',
    was: 'measured',
    tableTitle: 'Every day',
    cols: ['Day', 'Wind error', 'Bf fcst/obs', 'Gust fcst/obs', 'Max temp fcst/obs', 'Rain'],
    yes: 'yes',
    no: 'no',
    modelsTitle: 'Which model lands closest',
    modelsHint: 'We never rely on one model. We take the median of 5 and measure how much they disagree. When they disagree, we tell the guest.',
    guestsTitle: 'What guests say',
    guestsHint: 'The station measures the weather; guests measure the recommendation. Every vote is tied to what we said about that place on that day.',
    guestsNone: 'The first votes will appear here as soon as guests start answering.',
    votes: 'votes',
    agree: 'agreement with our pick',
    honestTitle: 'What we do not measure yet (and say so)',
    honest: [
      'The hourly station is on Akrotiri, on the north coast. On the west and south coasts the stations publish daily figures (max gust and its time), not hourly ones. The Elafonisi station reads systematically very low wind; we show it but weigh it less.',
      'The wave at the shore is an estimate from the offshore wave and each beach’s geometry. It self-corrects when guests consistently find more or less wave than we said.',
      'Few verified days mean percentages that swing easily. We publish the misses too; nothing is hidden.',
    ],
    ctaTitle: 'See it in action',
    ctaText: 'Guest page in 4 languages, reception screen, dashboard with the full analysis. For your property: one subscription, free for your guests.',
    ctaGuest: 'Guest page',
    ctaDash: 'Dashboard',
    ctaMail: 'Contact',
    footer: 'Weather data: Open-Meteo (CC BY 4.0) · Observations: METAR LGSA via aviationweather.gov · Recommendations are indicative; always follow lifeguards and authorities.',
    loading: 'Loading…',
    none: 'No verified days yet.',
  },
} as const;

const pct = (x: number | null | undefined) => (x == null ? '–' : `${Math.round(x * 100)}%`);

function BfChart({ rows, lang }: { rows: VerificationSummary['recent']; lang: Lang }) {
  const t = T[lang];
  const data = [...rows].sort((a, b) => a.date.localeCompare(b.date)).slice(-14);
  const max = Math.max(4, ...data.flatMap((r) => [r.bf.forecastMax, r.bf.observedMax]));
  const w = 40;
  const gap = 14;
  const h = 150;
  const width = data.length * (w + gap) + gap;
  const y = (v: number) => h - (v / max) * (h - 20);
  return (
    <div className="chart-scroll">
      <svg className="bf-chart" viewBox={`0 0 ${width} ${h + 34}`} width={width} height={h + 34} role="img" aria-label={t.chartTitle}>
        {[1, 2, 3, 4, 5, 6, 7, 8].filter((v) => v <= max).map((v) => (
          <g key={v}>
            <line x1={0} x2={width} y1={y(v)} y2={y(v)} className="bf-grid" />
            <text x={2} y={y(v) - 2} className="bf-tick">
              {v}
            </text>
          </g>
        ))}
        {data.map((r, i) => {
          const x = gap + i * (w + gap);
          return (
            <g key={r.date}>
              <rect x={x} y={y(r.bf.forecastMax)} width={w / 2 - 1} height={h - y(r.bf.forecastMax)} className="bf-fc" />
              <rect x={x + w / 2 + 1} y={y(r.bf.observedMax)} width={w / 2 - 1} height={h - y(r.bf.observedMax)} className="bf-obs" />
              <circle cx={x + w / 2} cy={h + 10} r={4} className={r.bf.within1 ? 'bf-hit' : 'bf-miss'} />
              <text x={x + w / 2} y={h + 28} className="bf-label" textAnchor="middle">
                {r.date.slice(8, 10)}/{r.date.slice(5, 7)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="bf-legend">
        <span className="bf-swatch bf-fc" /> {t.said} <span className="bf-swatch bf-obs" /> {t.was}
      </p>
    </div>
  );
}

export function AccuracyApp() {
  const [lang, setLang] = useState<Lang>(() => readPref('acc-lang', ['el', 'en'] as const, 'el'));
  const [v, setV] = useState<VerificationSummary | null | undefined>(undefined);
  const [f, setF] = useState<FeedbackSummary | null>(null);
  useEffect(() => {
    loadVerification().then(setV);
    loadFeedback().then(setF);
  }, []);
  useEffect(() => {
    writePref('acc-lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);
  const t = T[lang];
  const fmt = (iso: string) => new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'long', timeZone: 'Europe/Athens' }).format(new Date(iso));
  const updated = v?.updatedAt ? new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Athens' }).format(new Date(v.updatedAt)) : '';

  return (
    <div className="acc">
      <header className="acc-top">
        <div className="acc-wrap acc-topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <p className="brand-name">{t.brand}</p>
              <p className="brand-sub">{t.tag}</p>
            </div>
          </div>
          <div className="lang-toggle" role="group" aria-label="language">
            {(['el', 'en'] as const).map((l) => (
              <button key={l} type="button" className={lang === l ? 'is-on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="acc-wrap acc-hero">
          <p className="acc-eyebrow">{t.eyebrow}</p>
          <h1 className="acc-title">{t.title}</h1>
          <p className="acc-lede">{t.lede}</p>
        </div>
      </header>

      <main className="acc-wrap">
        {v === undefined && <p className="hint">{t.loading}</p>}
        {v === null || (v && v.days === 0) ? <p className="callout callout-muted">{t.none}</p> : null}
        {v && v.days > 0 && (
          <>
            <section className="acc-stats" aria-label={t.eyebrow}>
              <div className="acc-stat acc-stat-hero">
                <p className="acc-stat-value">{pct(v.bfWithin1Rate)}</p>
                <p className="acc-stat-label">{t.bf}</p>
                <p className="acc-stat-sub">{t.bfSub}</p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">{v.days}</p>
                <p className="acc-stat-label">{t.days}</p>
                <p className="acc-stat-sub">
                  {v.from} → {v.to}
                </p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">
                  {v.wind.mae} <small>km/h</small>
                </p>
                <p className="acc-stat-label">{t.wind}</p>
                <p className="acc-stat-sub">{t.windSub}</p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">{pct(v.rainAgreeRate)}</p>
                <p className="acc-stat-label">{t.rain}</p>
                <p className="acc-stat-sub">{t.rainSub}</p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">
                  {v.temp.mae ?? '–'} <small>°C</small>
                </p>
                <p className="acc-stat-label">{t.temp}</p>
                <p className="acc-stat-sub">{t.tempSub}</p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">{f && f.judged > 0 ? pct(f.agreeRate) : '–'}</p>
                <p className="acc-stat-label">{t.guests}</p>
                <p className="acc-stat-sub">{f && f.judged > 0 ? `${f.judged} ${t.votes}` : t.guestsSub}</p>
              </div>
              <div className="acc-stat">
                <p className="acc-stat-value">{v.recs?.picks ? pct(v.recs.pickHeldRate) : '–'}</p>
                <p className="acc-stat-label">{t.held}</p>
                <p className="acc-stat-sub">{v.recs?.picks ? `${v.recs.picksHeld}/${v.recs.picks} · ${v.recs.days} ${t.days}` : t.heldSub}</p>
              </div>
            </section>
            {v.days < 14 && <p className="callout callout-muted">{t.early.replace('{from}', fmt(v.from))}</p>}
            <p className="hint">{t.period.replace('{from}', v.from).replace('{to}', v.to).replace('{updated}', updated)}</p>

            <section className="panel acc-panel">
              <h2 className="panel-title">{t.chartTitle}</h2>
              <p className="hint">{t.chartHint}</p>
              <BfChart rows={v.recent} lang={lang} />
            </section>

            <section className="acc-how">
              <h2 className="section-title">{t.howTitle}</h2>
              <ol className="steps">
                {t.how.map(([h, p]) => (
                  <li key={h}>
                    <h3>{h}</h3>
                    <p>{p}</p>
                  </li>
                ))}
              </ol>
            </section>

            <div className="acc-cols">
              <section className="panel acc-panel">
                <h2 className="panel-title">{t.tableTitle}</h2>
                <div className="table-scroll">
                  <table className="data-table compact">
                    <thead>
                      <tr>
                        {t.cols.map((c, i) => (
                          <th key={c} scope="col" className={i > 0 && i < 5 ? 'num' : undefined}>
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...v.recent]
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map((r) => (
                          <tr key={r.date}>
                            <th scope="row">{r.date}</th>
                            <td className="num">{r.wind.mae} km/h</td>
                            <td className="num">
                              {r.bf.forecastMax}/{r.bf.observedMax} <span className={r.bf.within1 ? 'v-go conf' : 'v-avoid conf'} />
                            </td>
                            <td className="num">
                              {r.gust.forecastMax}/{r.gust.observedMax}
                            </td>
                            <td className="num">
                              {r.temp.forecastMax ?? '–'}/{r.temp.observedMax ?? '–'}
                            </td>
                            <td>
                              {r.rain.observed ? t.yes : t.no} <span className={r.rain.agree ? 'v-go conf' : 'v-avoid conf'} />
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="panel acc-panel">
                <h2 className="panel-title">{t.modelsTitle}</h2>
                <p className="hint">{t.modelsHint}</p>
                <ul className="model-rank">
                  {v.perModel.map((m, i) => (
                    <li key={m.model}>
                      <span className="model-rank-pos">{i + 1}</span>
                      <span className="model-rank-name">{MODEL_LABELS[m.model]}</span>
                      <span className="model-rank-val">{m.mae == null ? '–' : `${m.mae} km/h`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className="panel acc-panel">
              <StationsTable stations={v.stations ?? []} lang={lang} />
            </section>

            <section className="panel acc-panel">
              <h2 className="panel-title">{t.guestsTitle}</h2>
              <p className="hint">{t.guestsHint}</p>
              {f && f.total > 0 ? (
                <dl className="stat-row">
                  <div>
                    <dt>{t.votes}</dt>
                    <dd>{f.total}</dd>
                  </div>
                  <div>
                    <dt>{t.agree}</dt>
                    <dd>{pct(f.agreeRate)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="hint">{t.guestsNone}</p>
              )}
            </section>
          </>
        )}

        <section className="acc-honest">
          <h2 className="section-title">{t.honestTitle}</h2>
          <ul className="limits">
            {t.honest.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>

        <section className="acc-cta">
          <h2 className="acc-cta-title">{t.ctaTitle}</h2>
          <p>{t.ctaText}</p>
          <div className="acc-cta-actions">
            <a className="btn btn-primary" href={LINKS.guest} target="_blank" rel="noreferrer">
              {t.ctaGuest}
            </a>
            <a className="btn" href={LINKS.dashboard} target="_blank" rel="noreferrer">
              {t.ctaDash}
            </a>
            <a className="btn" href={`mailto:${LINKS.contact}`}>
              {t.ctaMail}
            </a>
          </div>
        </section>
      </main>
      <footer className="footer">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
}
