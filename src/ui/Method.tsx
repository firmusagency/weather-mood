import type { Lang, Sector, Spot } from '../engine/types';
import { MODEL_LABELS, MODELS } from '../engine/types';
import { windLabel } from './i18n';

const TXT = {
  el: {
    title: 'Πώς φτάνουμε στην πρόταση',
    steps: [
      ['Συλλογή δεδομένων', 'Για κάθε σημείο κατεβάζουμε ωριαία πρόγνωση από 5 ανεξάρτητα μοντέλα καιρού (άνεμος, ριπές), ένα βασικό μοντέλο για θερμοκρασία, αίσθηση, βροχή, UV και συννεφιά, και θαλάσσια πρόγνωση (κύμα, swell, θερμοκρασία νερού) σε σημείο ανοιχτά της ακτής.'],
      ['Συμφωνία μοντέλων', 'Παίρνουμε τη διάμεση τιμή του ανέμου από τα 5 μοντέλα και μετράμε πόσο διαφωνούν. Η διαφωνία γίνεται «βεβαιότητα» (υψηλή/μέτρια/χαμηλή) σε κάθε πρόταση.'],
      ['Γεωμετρία ακτής', 'Κάθε παραλία έχει καταγεγραμμένο προσανατολισμό και τομείς προστασίας. Υπολογίζουμε αν ο άνεμος φυσάει προς την ακτή ή από τη στεριά, και πόσο από το κύμα των ανοιχτών φτάνει πραγματικά στην παραλία. Προσθέτουμε και τοπικά φαινόμενα, όπως τις ριπές από τα βουνά στα Σφακιά με βοριά.'],
      ['Κρίση ανά προφίλ', 'Κάθε ώρα ξεκινά από 100 και χάνει πόντους για κάθε πρόβλημα (κύμα, ριπές, βροχή, ζέστη, κρύο), με διαφορετικές ανοχές ανά προφίλ. Διαλέγουμε το καλύτερο χρονικό παράθυρο της ημέρας. Όλες οι αφαιρέσεις φαίνονται με τους αριθμούς τους.'],
      ['Σειρά πρότασης', 'Στον βαθμό καιρού προσθέτουμε απόσταση από το κατάλυμα, καταλληλότητα για το προφίλ, πόσο αξίζει το μέρος και αν η μέρα είναι «σπάνια ευκαιρία» (π.χ. ήρεμος Μπάλος). Οι τρεις κορυφαίες προτάσεις είναι από διαφορετικές περιοχές.'],
    ],
    sources: 'Πηγές δεδομένων',
    sourceRows: [
      ['Open-Meteo Forecast API', 'Άνεμος/ριπές από ' + MODELS.map((m) => MODEL_LABELS[m]).join(', ') + '. Θερμοκρασία, αίσθηση, βροχή, UV, συννεφιά από το καλύτερο διαθέσιμο μοντέλο.'],
      ['Open-Meteo Marine API', 'Ύψος, διεύθυνση και περίοδος κύματος, swell, θερμοκρασία επιφάνειας θάλασσας.'],
      ['Βάση σημείων (δική μας)', 'Συντεταγμένες, προσανατολισμός ακτής, τομείς προστασίας, όρια κλεισίματος/ακύρωσης, πρόσβαση, χαρακτηριστικά.'],
    ],
    limits: 'Όρια και τι χρειάζεται ακόμη',
    limitRows: [
      'Τα παγκόσμια μοντέλα έχουν ανάλυση 7–25 km· τοπικά φαινόμενα (ριπές σε φαράγγια, θαλάσσια αύρα) τα καλύπτουμε με κανόνες που πρέπει να επαληθευτούν επιτόπου.',
      'Η θαλάσσια πρόγνωση έχει ανάλυση ~5–9 km· για κλειστούς κόλπους το κύμα στην ακτή είναι εκτίμηση.',
      'Όλα τα σημεία είναι αρχική καταγραφή και θέλουν έλεγχο από ντόπιο (προσανατολισμός, όρια, πρόσβαση, λεωφορεία).',
      'Δεν περιλαμβάνονται ακόμη: χάρτης κινδύνου πυρκαγιάς, ανακοινώσεις κλεισίματος φαραγγιών, δρομολόγια πλοίων/λεωφορείων.',
      'Το Open-Meteo είναι δωρεάν μόνο για μη εμπορική χρήση· για πελάτες χρειάζεται συνδρομή API.',
    ],
    tableTitle: 'Πίνακας σημείων για επαλήθευση',
    tableHint: 'Αυτά είναι τα στοιχεία που χρειάζονται έλεγχο από κάποιον που ξέρει την περιοχή.',
    cols: ['Σημείο', 'Τύπος', 'Κοιτάει προς', 'Προστασία από', 'Ριπές βουνού με', 'Επαληθευμένο'],
    yes: 'Ναι',
    no: 'Όχι',
  },
  en: {
    title: 'How we get to a recommendation',
    steps: [
      ['Collect the data', 'For every place we pull an hourly forecast from 5 independent weather models (wind, gusts), one best-match model for temperature, feels-like, rain, UV and cloud, and a marine forecast (waves, swell, sea temperature) at a point offshore.'],
      ['Model agreement', 'We take the median wind of the 5 models and measure how much they disagree. That becomes the confidence level (high/medium/low) shown with every recommendation.'],
      ['Shore geometry', 'Each beach has a recorded orientation and shelter sectors. We work out whether the wind blows onto the shore or off the land, and how much of the offshore wave actually reaches the beach. Local effects are added too, such as mountain gusts in Sfakia under northerlies.'],
      ['Judgement per profile', 'Every hour starts at 100 and loses points for each problem (waves, gusts, rain, heat, cold), with different tolerances per profile. We pick the best time window of the day. Every deduction is shown with its numbers.'],
      ['Recommendation order', 'On top of the weather score we add travel time from the accommodation, fit for the profile, how worthwhile the place is, and whether the day is a rare opportunity (e.g. a calm Balos). The top three picks come from different areas.'],
    ],
    sources: 'Data sources',
    sourceRows: [
      ['Open-Meteo Forecast API', 'Wind/gusts from ' + MODELS.map((m) => MODEL_LABELS[m]).join(', ') + '. Temperature, feels-like, rain, UV, cloud from the best available model.'],
      ['Open-Meteo Marine API', 'Wave height, direction and period, swell, sea surface temperature.'],
      ['Spot database (ours)', 'Coordinates, shore orientation, shelter sectors, closure/cancellation limits, access, traits.'],
    ],
    limits: 'Limits and what is still needed',
    limitRows: [
      'Global models have 7–25 km resolution; local effects (gorge gusts, sea breeze) are covered by rules that must be verified on the ground.',
      'The marine forecast has ~5–9 km resolution; for enclosed bays the wave at the shore is an estimate.',
      'All places are a first draft and need checking by a local (orientation, limits, access, buses).',
      'Not yet included: wildfire risk map, gorge closure notices, ferry/bus timetables.',
      'Open-Meteo is free for non-commercial use only; paying customers need an API subscription.',
    ],
    tableTitle: 'Place list for verification',
    tableHint: 'These are the details that need checking by someone who knows the area.',
    cols: ['Place', 'Type', 'Faces', 'Sheltered from', 'Mountain gusts with', 'Verified'],
    yes: 'Yes',
    no: 'No',
  },
};

const sectors = (xs: Sector[] | undefined, lang: Lang) => (xs?.length ? xs.map(([a, b]) => `${windLabel(a, lang)}→${windLabel(b, lang)}`).join(', ') : '–');

export function Method({ spots, lang, types }: { spots: Spot[]; lang: Lang; types: Record<string, string> }) {
  const t = TXT[lang];
  return (
    <section className="method" aria-labelledby="m-title">
      <h2 id="m-title" className="section-title">
        {t.title}
      </h2>
      <ol className="steps">
        {t.steps.map(([h, p]) => (
          <li key={h}>
            <h3>{h}</h3>
            <p>{p}</p>
          </li>
        ))}
      </ol>

      <div className="method-cols">
        <article className="panel">
          <h3 className="panel-title">{t.sources}</h3>
          <dl className="sources">
            {t.sourceRows.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </article>
        <article className="panel">
          <h3 className="panel-title">{t.limits}</h3>
          <ul className="limits">
            {t.limitRows.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </article>
      </div>

      <h3 className="group-title">{t.tableTitle}</h3>
      <p className="hint">{t.tableHint}</p>
      <div className="table-scroll">
        <table className="data-table compact">
          <thead>
            <tr>
              {t.cols.map((c) => (
                <th key={c} scope="col">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spots.map((s) => (
              <tr key={s.id}>
                <th scope="row">{s.name[lang]}</th>
                <td>{types[s.type]}</td>
                <td>{s.facing !== undefined ? `${windLabel(s.facing, lang)} (${s.facing}°)` : '–'}</td>
                <td>{sectors(s.shelteredFrom, lang)}</td>
                <td>{sectors(s.gustyFrom, lang)}</td>
                <td>{s.verified ? t.yes : <span className="warn-text">{t.no}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
