import { RETENTION } from '../engine/retention';
import type { GuestLang } from './property';

/*
 * The privacy note guests can open from the foot of the page. Plain language, and only what the code does:
 * when what is stored, sent or kept changes, change it here in the same commit (tests/privacy.test.ts holds
 * the numbers to src/engine/retention.ts).
 */

export const PRIVACY_UPDATED = '2026-11-13';

/** Who answers data questions for the service itself (set VITE_PRIVACY_CONTACT / VITE_PRIVACY_OPERATOR at build time). */
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
export const PRIVACY_PROVIDER = { operator: env.VITE_PRIVACY_OPERATOR ?? '', contact: env.VITE_PRIVACY_CONTACT ?? '' };

export interface PrivacyNotice {
  title: string;
  link: string;
  intro: string;
  sections: { heading: string; items: string[] }[];
  updated: string;
}

interface Ctx {
  property: string;
  /** E-mail address for data questions, when one is configured. */
  contact?: string;
  /** Legal name of the company that runs the service, when configured. */
  operator?: string;
  /** This browser's random code, so the guest can quote it. */
  code?: string;
}

const P = RETENTION.pushIdleDays;
const V = RETENTION.visitDays;

const dateText = (iso: string, lang: GuestLang) =>
  new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : lang === 'de' ? 'de-DE' : lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));

const NOTICES: Record<GuestLang, (c: Ctx) => Omit<PrivacyNotice, 'updated'> & { updatedWord: string }> = {
  el: (c) => ({
    title: 'Απόρρητο',
    link: 'Απόρρητο',
    intro: `Η σελίδα σάς προτείνει πού να πάτε ανάλογα με τον καιρό. Την προσφέρει το ${c.property} με την υπηρεσία Weather Mood${c.operator ? ` (${c.operator})` : ''}. Δεν χρειάζεται λογαριασμό και δεν ζητά όνομα, email ή τηλέφωνο.`,
    sections: [
      {
        heading: 'Τι δεν κάνουμε',
        items: ['Δεν χρησιμοποιούμε cookies διαφήμισης ή παρακολούθησης.', 'Δεν ζητάμε και δεν διαβάζουμε την τοποθεσία σας.', 'Δεν πουλάμε και δεν δίνουμε δεδομένα σε διαφημιστές.'],
      },
      {
        heading: 'Τι μένει στο κινητό σας',
        items: [
          'Η γλώσσα και το «ποιοι ταξιδεύετε» που διαλέξατε, η ημερομηνία αναχώρησης αν τη δώσετε, οι προτάσεις που είδατε τις τελευταίες 7 μέρες και ένας τυχαίος κωδικός που δεν λέει ποιοι είστε.',
          'Σβήνονται όταν διαγράψετε τα δεδομένα της σελίδας από τον browser σας.',
        ],
      },
      {
        heading: 'Τι φτάνει σε εμάς',
        items: [
          `Κάθε άνοιγμα της σελίδας: το κατάλυμα, η γλώσσα, το «ποιοι ταξιδεύετε», η ώρα και ο τυχαίος κωδικός. Έτσι βλέπει το κατάλυμα πόσο χρησιμοποιείται η σελίδα. Σβήνονται μετά από ${V} μέρες.`,
          'Αν πείτε πώς ήταν ένα μέρος: η ψήφος, ο λόγος και το σχόλιό σας. Διορθώνουν τις προτάσεις μας, τα βλέπει το κατάλυμα και κρατιούνται χωρίς όνομα. Μη γράφετε προσωπικά στοιχεία στο σχόλιο· διευθύνσεις email, σύνδεσμοι και τηλέφωνα σβήνονται αυτόματα.',
          `Αν ενεργοποιήσετε τις ειδοποιήσεις: η διεύθυνση που δίνει ο browser σας για να σας φτάνει το μήνυμα, η γλώσσα και το «ποιοι ταξιδεύετε». Τις σταματάτε από το «Να μη λαμβάνω ειδοποιήσεις»· σταματούν και μόνες τους αν δεν ανοίξετε τη σελίδα για ${P} μέρες.`,
        ],
      },
      {
        heading: 'Ποιοι άλλοι εμπλέκονται',
        items: [
          'Η σελίδα φιλοξενείται στο GitHub Pages και η βάση δεδομένων στο Supabase (Φρανκφούρτη, Ευρωπαϊκή Ένωση). Όπως σε κάθε ιστοσελίδα, βλέπουν τη διεύθυνση IP σας όταν τη φορτώνετε.',
          'Οι ειδοποιήσεις περνούν από την υπηρεσία του browser σας (Apple, Google ή Mozilla).',
          'Τα κουμπιά «Οδηγίες» και WhatsApp ανοίγουν τους Χάρτες Google και το WhatsApp, που έχουν τους δικούς τους όρους.',
        ],
      },
      {
        heading: 'Τα δικαιώματά σας',
        items: [
          `Μπορείτε να ζητήσετε να δείτε ή να σβήσουμε ό,τι αντιστοιχεί στον κωδικό σας: ρωτήστε στη reception του ${c.property}${c.contact ? ` ή γράψτε στο ${c.contact}` : ''}.${c.code ? ` Ο κωδικός σας: ${c.code}` : ''}`,
          'Μπορείτε επίσης να απευθυνθείτε στην Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα (dpa.gr).',
        ],
      },
    ],
    updatedWord: 'Τελευταία ενημέρωση',
  }),
  en: (c) => ({
    title: 'Privacy',
    link: 'Privacy',
    intro: `This page suggests where to go depending on the weather. ${c.property} offers it with the Weather Mood service${c.operator ? ` (${c.operator})` : ''}. It needs no account and asks for no name, e-mail or phone number.`,
    sections: [
      {
        heading: 'What we do not do',
        items: ['We use no advertising or tracking cookies.', 'We do not ask for or read your location.', 'We do not sell data or pass it to advertisers.'],
      },
      {
        heading: 'What stays on your phone',
        items: [
          'The language and "who is travelling" you chose, your departure date if you gave it, the suggestions you were shown in the last 7 days, and a random code that does not say who you are.',
          'They are removed when you clear this site’s data in your browser.',
        ],
      },
      {
        heading: 'What reaches us',
        items: [
          `Each time the page is opened: the property, the language, "who is travelling", the time and the random code. This is how the property sees how much the page is used. Deleted after ${V} days.`,
          'If you tell us how a place was: your vote, the reason and your comment. They correct our suggestions, the property sees them and they are kept without a name. Please do not write personal details in the comment; e-mail addresses, links and phone numbers are removed automatically.',
          `If you turn notifications on: the address your browser provides so the message can reach you, the language and "who is travelling". You stop them with "Stop notifications"; they also stop by themselves when the page has not been opened for ${P} days.`,
        ],
      },
      {
        heading: 'Who else is involved',
        items: [
          'The page is hosted on GitHub Pages and the database at Supabase (Frankfurt, European Union). As with any website, they see your IP address when you load it.',
          'Notifications pass through your browser’s own service (Apple, Google or Mozilla).',
          'The "Directions" and WhatsApp buttons open Google Maps and WhatsApp, which have their own terms.',
        ],
      },
      {
        heading: 'Your rights',
        items: [
          `You can ask to see or delete whatever belongs to your code: ask at the reception of ${c.property}${c.contact ? ` or write to ${c.contact}` : ''}.${c.code ? ` Your code: ${c.code}` : ''}`,
          'You may also contact the Hellenic Data Protection Authority (dpa.gr).',
        ],
      },
    ],
    updatedWord: 'Last updated',
  }),
  de: (c) => ({
    title: 'Datenschutz',
    link: 'Datenschutz',
    intro: `Diese Seite schlägt Ihnen je nach Wetter vor, wohin Sie fahren können. ${c.property} bietet sie mit dem Dienst Weather Mood an${c.operator ? ` (${c.operator})` : ''}. Sie brauchen kein Konto; Name, E-Mail oder Telefonnummer werden nicht abgefragt.`,
    sections: [
      {
        heading: 'Was wir nicht tun',
        items: ['Wir verwenden keine Werbe- oder Tracking-Cookies.', 'Wir fragen Ihren Standort nicht ab und lesen ihn nicht aus.', 'Wir verkaufen keine Daten und geben sie nicht an Werbetreibende weiter.'],
      },
      {
        heading: 'Was auf Ihrem Handy bleibt',
        items: [
          'Die gewählte Sprache und „Wer reist?“, Ihr Abreisedatum, falls Sie es angegeben haben, die Vorschläge, die Ihnen in den letzten 7 Tagen gezeigt wurden, und ein zufälliger Code, der nichts über Ihre Person verrät.',
          'Sie werden gelöscht, wenn Sie die Daten dieser Seite in Ihrem Browser löschen.',
        ],
      },
      {
        heading: 'Was bei uns ankommt',
        items: [
          `Bei jedem Öffnen der Seite: die Unterkunft, die Sprache, „Wer reist?“, die Uhrzeit und der zufällige Code. So sieht die Unterkunft, wie oft die Seite genutzt wird. Nach ${V} Tagen gelöscht.`,
          'Wenn Sie uns sagen, wie ein Ort war: Ihre Stimme, der Grund und Ihr Kommentar. Sie verbessern unsere Vorschläge, die Unterkunft sieht sie, und sie werden ohne Namen aufbewahrt. Bitte schreiben Sie keine persönlichen Daten in den Kommentar; E-Mail-Adressen, Links und Telefonnummern werden automatisch entfernt.',
          `Wenn Sie Benachrichtigungen einschalten: die Adresse, die Ihr Browser dafür bereitstellt, die Sprache und „Wer reist?“. Sie beenden sie mit „Benachrichtigungen beenden“; sie enden auch von selbst, wenn die Seite ${P} Tage lang nicht geöffnet wurde.`,
        ],
      },
      {
        heading: 'Wer sonst beteiligt ist',
        items: [
          'Die Seite liegt bei GitHub Pages, die Datenbank bei Supabase (Frankfurt, Europäische Union). Wie bei jeder Website sehen diese Anbieter Ihre IP-Adresse, wenn Sie die Seite laden.',
          'Benachrichtigungen laufen über den Dienst Ihres Browsers (Apple, Google oder Mozilla).',
          'Die Schaltflächen „Route“ und WhatsApp öffnen Google Maps und WhatsApp, für die deren eigene Bedingungen gelten.',
        ],
      },
      {
        heading: 'Ihre Rechte',
        items: [
          `Sie können Auskunft über alles verlangen, was zu Ihrem Code gehört, oder es löschen lassen: Fragen Sie an der Rezeption von ${c.property}${c.contact ? ` oder schreiben Sie an ${c.contact}` : ''}.${c.code ? ` Ihr Code: ${c.code}` : ''}`,
          'Sie können sich auch an die griechische Datenschutzbehörde wenden (dpa.gr).',
        ],
      },
    ],
    updatedWord: 'Zuletzt aktualisiert',
  }),
  fr: (c) => ({
    title: 'Confidentialité',
    link: 'Confidentialité',
    intro: `Cette page vous suggère où aller selon la météo. ${c.property} la propose avec le service Weather Mood${c.operator ? ` (${c.operator})` : ''}. Elle ne demande ni compte, ni nom, ni e-mail, ni numéro de téléphone.`,
    sections: [
      {
        heading: 'Ce que nous ne faisons pas',
        items: ['Nous n’utilisons aucun cookie publicitaire ou de suivi.', 'Nous ne demandons pas et ne lisons pas votre position.', 'Nous ne vendons pas de données et n’en transmettons pas à des annonceurs.'],
      },
      {
        heading: 'Ce qui reste sur votre téléphone',
        items: [
          'La langue et « qui voyage » que vous avez choisis, votre date de départ si vous l’avez indiquée, les suggestions qui vous ont été montrées ces 7 derniers jours et un code aléatoire qui ne dit pas qui vous êtes.',
          'Ils sont effacés lorsque vous supprimez les données de ce site dans votre navigateur.',
        ],
      },
      {
        heading: 'Ce qui nous parvient',
        items: [
          `À chaque ouverture de la page : l’établissement, la langue, « qui voyage », l’heure et le code aléatoire. L’établissement voit ainsi combien la page est utilisée. Supprimé après ${V} jours.`,
          'Si vous nous dites comment était un lieu : votre vote, la raison et votre commentaire. Ils corrigent nos suggestions, l’établissement les voit et ils sont conservés sans nom. N’écrivez pas de données personnelles dans le commentaire ; les adresses e-mail, les liens et les numéros de téléphone sont retirés automatiquement.',
          `Si vous activez les notifications : l’adresse fournie par votre navigateur pour que le message vous parvienne, la langue et « qui voyage ». Vous les arrêtez avec « Ne plus recevoir de notifications » ; elles s’arrêtent aussi d’elles-mêmes si la page n’a pas été ouverte pendant ${P} jours.`,
        ],
      },
      {
        heading: 'Qui d’autre intervient',
        items: [
          'La page est hébergée chez GitHub Pages et la base de données chez Supabase (Francfort, Union européenne). Comme pour tout site web, ils voient votre adresse IP lorsque vous la chargez.',
          'Les notifications passent par le service de votre navigateur (Apple, Google ou Mozilla).',
          'Les boutons « Itinéraire » et WhatsApp ouvrent Google Maps et WhatsApp, qui ont leurs propres conditions.',
        ],
      },
      {
        heading: 'Vos droits',
        items: [
          `Vous pouvez demander à voir ou à faire supprimer ce qui correspond à votre code : adressez-vous à la réception de ${c.property}${c.contact ? ` ou écrivez à ${c.contact}` : ''}.${c.code ? ` Votre code : ${c.code}` : ''}`,
          'Vous pouvez aussi vous adresser à l’autorité grecque de protection des données (dpa.gr).',
        ],
      },
    ],
    updatedWord: 'Dernière mise à jour',
  }),
};

export function privacyNotice(lang: GuestLang, ctx: Ctx): PrivacyNotice {
  const { updatedWord, ...n } = NOTICES[lang](ctx);
  return { ...n, updated: `${updatedWord}: ${dateText(PRIVACY_UPDATED, lang)}` };
}
