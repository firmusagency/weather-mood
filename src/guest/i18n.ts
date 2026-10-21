import type { ProfileId, SpotType, Text } from '../engine/types';
import type { GuestLang } from './property';

export type FeedbackDict = {
  title: string;
  intro: string;
  didYouGo: string;
  wentElsewhere: string;
  pickPlace: string;
  whichDay: string;
  yesterday: string;
  daysAgo: string;
  up: string;
  down: string;
  whatWrong: string;
  tags: Record<'wave' | 'wind' | 'crowd' | 'rain' | 'heat' | 'cold' | 'other', string>;
  note: string;
  send: string;
  thanks: string;
  duplicate: string;
  error: string;
  notNow: string;
  rcTitle: string;
  rcIntro: string;
  rcParty: string;
  rcLogged: string;
  rcView: string;
  rcGuestsSaid: string;
  evening: string;
  eveningBtn: string;
};

type Dict = {
  greeting: string;
  whoTravels: string;
  today: string;
  tomorrow: string;
  dayAfter: string;
  forecastFor: string;
  ourPicks: string;
  more: string;
  notTomorrow: string;
  notThisDay: string;
  planB: string;
  bestTime: string;
  byCar: string;
  byBus: string;
  onFoot: string;
  directions: string;
  share: string;
  sharePlan: string;
  copy: string;
  copied: string;
  copyFailed: string;
  details: string;
  close: string;
  why: string;
  bring: string;
  conditions: string;
  sea: string;
  wind: string;
  feels: string;
  rain: string;
  aboutPlace: string;
  disclaimer: string;
  poweredBy: string;
  updated: string;
  scanForYourLanguage: string;
  lobbyTitle: string;
  phoneView: string;
  lobbyView: string;
  demoNote: string;
  noPicks: string;
  seaWords: [string, string, string, string];
  windWords: [string, string, string, string];
  profiles: Record<ProfileId, string>;
  types: Record<SpotType, string>;
  fb: FeedbackDict;
  photo: string;
  compass: string[];
};

const EL: Dict = {
  greeting: 'Καλώς ήρθατε! Αυτές είναι οι προτάσεις μας με βάση τον καιρό.',
  whoTravels: 'Ποιοι ταξιδεύετε;',
  today: 'Σήμερα',
  tomorrow: 'Αύριο',
  dayAfter: 'Μεθαύριο',
  forecastFor: 'Ο καιρός',
  ourPicks: 'Οι προτάσεις μας',
  more: 'Περισσότερες ιδέες',
  notTomorrow: 'Καλύτερα όχι αύριο',
  notThisDay: 'Καλύτερα όχι αυτή τη μέρα',
  planB: 'Δύσκολη μέρα για εκδρομές. Προτείνουμε πόλη, μουσεία ή κάτι κοντινό.',
  bestTime: 'Καλύτερη ώρα',
  byCar: 'με αυτοκίνητο',
  byBus: 'με λεωφορείο',
  onFoot: 'με τα πόδια',
  directions: 'Οδηγίες',
  share: 'Μοιραστείτε',
  sharePlan: 'Μοιραστείτε το πρόγραμμα της μέρας',
  copy: 'Αντιγραφή',
  copied: 'Αντιγράφηκε',
  copyFailed: 'Επιλέξτε και αντιγράψτε το κείμενο',
  details: 'Λεπτομέρειες',
  close: 'Κλείσιμο',
  why: 'Γιατί τώρα',
  bring: 'Τι να πάρετε μαζί',
  conditions: 'Συνθήκες στο σημείο',
  sea: 'Θάλασσα',
  wind: 'Αέρας',
  feels: 'Αίσθηση',
  rain: 'Βροχή',
  aboutPlace: 'Για το μέρος',
  disclaimer: 'Ενδεικτικές προτάσεις με βάση προγνώσεις καιρού. Ακολουθείτε πάντα τις οδηγίες ναυαγοσωστών και αρχών.',
  poweredBy: 'Με την υποστήριξη του Weather Mood',
  updated: 'Ενημέρωση',
  scanForYourLanguage: 'Σκανάρετε για προτάσεις στη γλώσσα σας',
  lobbyTitle: 'Πού να πάτε αύριο',
  phoneView: 'Κινητό επισκέπτη',
  lobbyView: 'Οθόνη reception',
  demoNote: 'Demo με φανταστικό κατάλυμα',
  noPicks: 'Δεν βρήκαμε κατάλληλη πρόταση. Ρωτήστε τη reception.',
  seaWords: ['ήρεμη', 'λίγο κυματάκι', 'κυματάκι', 'κύμα'],
  windWords: ['σχεδόν άπνοια', 'ελαφρύς', 'μέτριος', 'δυνατός'],
  photo: 'Φωτο',
  fb: {
    title: 'Πήγατε; Πώς ήταν;',
    intro: 'Μία απάντηση βοηθάει τον επόμενο επισκέπτη και κάνει τις προτάσεις πιο ακριβείς.',
    didYouGo: 'Σας προτείναμε {spot} ({day}). Πήγατε;',
    wentElsewhere: 'Πήγατε αλλού;',
    pickPlace: 'Διαλέξτε μέρος',
    whichDay: 'Ποια μέρα;',
    yesterday: 'Χθες',
    daysAgo: 'πριν {n} μέρες',
    up: 'Ωραία ήταν',
    down: 'Όχι όπως το είπατε',
    whatWrong: 'Τι δεν πήγε καλά;',
    tags: { wave: 'Κύμα', wind: 'Αέρας', crowd: 'Κόσμος', rain: 'Βροχή', heat: 'Ζέστη', cold: 'Κρύο', other: 'Άλλο' },
    note: 'Σχόλιο (προαιρετικό)',
    send: 'Αποστολή',
    thanks: 'Ευχαριστούμε! Το σημειώσαμε.',
    duplicate: 'Το έχουμε ήδη, ευχαριστούμε.',
    error: 'Δεν στάλθηκε. Δοκιμάστε ξανά αργότερα.',
    notNow: 'Όχι τώρα',
    rcTitle: 'Reception: τι είπαν οι επισκέπτες',
    rcIntro: 'Όταν ένας επισκέπτης γυρίζει και σας λέει πώς ήταν, γράψτε το εδώ. 20 δευτερόλεπτα. Κάθε καταχώρηση βελτιώνει τις προτάσεις για το κατάλυμά σας.',
    rcParty: 'Άτομα',
    rcLogged: 'Καταχωρήθηκαν σήμερα',
    rcView: 'Φόρμα reception',
    rcGuestsSaid: 'Οι επισκέπτες είπαν',
    evening: 'Θέλετε κάθε απόγευμα τις προτάσεις για την επόμενη μέρα στο WhatsApp σας;',
    eveningBtn: 'Ναι, στείλτε μου το βραδινό μήνυμα',
  },
  profiles: {
    family: 'Οικογένεια με παιδιά',
    couple: 'Ζευγάρι',
    solo: 'Μόνος/η',
    active: 'Περιπέτεια & πεζοπορία',
    senior: 'Χαλαρό πρόγραμμα',
    nocar: 'Χωρίς αυτοκίνητο',
  },
  types: {
    beach: 'Παραλία',
    lake: 'Λίμνη',
    gorge: 'Φαράγγι',
    hike: 'Περίπατος',
    boat: 'Εκδρομή με καραβάκι',
    culture: 'Πολιτισμός',
    village: 'Χωριό',
    nature: 'Φύση',
    town: 'Πόλη',
    museum: 'Μουσείο',
  },
  compass: ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'],
};

const EN: Dict = {
  greeting: 'Welcome! Here are our picks, based on the weather.',
  whoTravels: 'Who is travelling?',
  today: 'Today',
  tomorrow: 'Tomorrow',
  dayAfter: 'Day after',
  forecastFor: 'Weather',
  ourPicks: 'Our picks',
  more: 'More ideas',
  notTomorrow: 'Better not tomorrow',
  notThisDay: 'Better not on this day',
  planB: 'A tough day for trips. We suggest the town, museums or something close by.',
  bestTime: 'Best time',
  byCar: 'by car',
  byBus: 'by bus',
  onFoot: 'on foot',
  directions: 'Directions',
  share: 'Share',
  sharePlan: "Share the day's plan",
  copy: 'Copy',
  copied: 'Copied',
  copyFailed: 'Select and copy the text',
  details: 'Details',
  close: 'Close',
  why: 'Why now',
  bring: 'What to bring',
  conditions: 'Conditions there',
  sea: 'Sea',
  wind: 'Wind',
  feels: 'Feels like',
  rain: 'Rain',
  aboutPlace: 'About the place',
  disclaimer: 'Suggestions are based on weather forecasts. Always follow lifeguards and local authorities.',
  poweredBy: 'Powered by Weather Mood',
  updated: 'Updated',
  scanForYourLanguage: 'Scan for tips in your language',
  lobbyTitle: 'Where to go tomorrow',
  phoneView: 'Guest phone',
  lobbyView: 'Reception screen',
  demoNote: 'Demo with a fictional property',
  noPicks: 'No good match found. Please ask at reception.',
  seaWords: ['calm', 'slight ripple', 'small waves', 'rough'],
  windWords: ['almost still', 'light', 'moderate', 'strong'],
  photo: 'Photo',
  fb: {
    title: 'Did you go? How was it?',
    intro: 'One answer helps the next guest and makes our picks more accurate.',
    didYouGo: 'We suggested {spot} ({day}). Did you go?',
    wentElsewhere: 'Went somewhere else?',
    pickPlace: 'Choose a place',
    whichDay: 'Which day?',
    yesterday: 'Yesterday',
    daysAgo: '{n} days ago',
    up: 'It was great',
    down: 'Not as described',
    whatWrong: 'What was off?',
    tags: { wave: 'Waves', wind: 'Wind', crowd: 'Crowds', rain: 'Rain', heat: 'Heat', cold: 'Cold', other: 'Other' },
    note: 'Comment (optional)',
    send: 'Send',
    thanks: 'Thank you! Noted.',
    duplicate: 'Already recorded, thank you.',
    error: 'Could not send. Please try again later.',
    notNow: 'Not now',
    rcTitle: 'Reception: what guests said',
    rcIntro: 'When a guest comes back and tells you how it was, note it here. Twenty seconds. Every entry improves the picks for your property.',
    rcParty: 'Guests',
    rcLogged: 'Logged today',
    rcView: 'Reception form',
    rcGuestsSaid: 'Guests said',
    evening: 'Want tomorrow’s picks on your WhatsApp every afternoon?',
    eveningBtn: 'Yes, send me the evening message',
  },
  profiles: {
    family: 'Family with kids',
    couple: 'Couple',
    solo: 'Solo',
    active: 'Adventure & hiking',
    senior: 'Easy-going pace',
    nocar: 'No car',
  },
  types: {
    beach: 'Beach',
    lake: 'Lake',
    gorge: 'Gorge',
    hike: 'Walk',
    boat: 'Boat trip',
    culture: 'Culture',
    village: 'Village',
    nature: 'Nature',
    town: 'Town',
    museum: 'Museum',
  },
  compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

const DE: Dict = {
  greeting: 'Willkommen! Hier sind unsere Tipps passend zum Wetter.',
  whoTravels: 'Wer reist?',
  today: 'Heute',
  tomorrow: 'Morgen',
  dayAfter: 'Übermorgen',
  forecastFor: 'Wetter',
  ourPicks: 'Unsere Tipps',
  more: 'Weitere Ideen',
  notTomorrow: 'Morgen lieber nicht',
  notThisDay: 'An diesem Tag lieber nicht',
  planB: 'Kein guter Tag für Ausflüge. Wir empfehlen die Stadt, Museen oder etwas in der Nähe.',
  bestTime: 'Beste Zeit',
  byCar: 'mit dem Auto',
  byBus: 'mit dem Bus',
  onFoot: 'zu Fuß',
  directions: 'Route',
  share: 'Teilen',
  sharePlan: 'Tagesplan teilen',
  copy: 'Kopieren',
  copied: 'Kopiert',
  copyFailed: 'Text markieren und kopieren',
  details: 'Details',
  close: 'Schließen',
  why: 'Warum jetzt',
  bring: 'Was mitnehmen',
  conditions: 'Bedingungen vor Ort',
  sea: 'Meer',
  wind: 'Wind',
  feels: 'Gefühlt',
  rain: 'Regen',
  aboutPlace: 'Über den Ort',
  disclaimer: 'Tipps auf Basis von Wettervorhersagen. Folgen Sie immer den Rettungsschwimmern und Behörden.',
  poweredBy: 'Bereitgestellt von Weather Mood',
  updated: 'Aktualisiert',
  scanForYourLanguage: 'Scannen für Tipps in Ihrer Sprache',
  lobbyTitle: 'Wohin morgen?',
  phoneView: 'Gäste-Handy',
  lobbyView: 'Rezeptions-Bildschirm',
  demoNote: 'Demo mit fiktiver Unterkunft',
  noPicks: 'Kein passender Tipp gefunden. Fragen Sie an der Rezeption.',
  seaWords: ['ruhig', 'leicht bewegt', 'kleine Wellen', 'rau'],
  windWords: ['fast windstill', 'leicht', 'mäßig', 'stark'],
  photo: 'Foto',
  fb: {
    title: 'Waren Sie dort? Wie war es?',
    intro: 'Eine Antwort hilft dem nächsten Gast und macht unsere Tipps genauer.',
    didYouGo: 'Wir hatten {spot} vorgeschlagen ({day}). Waren Sie dort?',
    wentElsewhere: 'Woanders gewesen?',
    pickPlace: 'Ort wählen',
    whichDay: 'Welcher Tag?',
    yesterday: 'Gestern',
    daysAgo: 'vor {n} Tagen',
    up: 'Es war toll',
    down: 'Nicht wie beschrieben',
    whatWrong: 'Was stimmte nicht?',
    tags: { wave: 'Wellen', wind: 'Wind', crowd: 'Andrang', rain: 'Regen', heat: 'Hitze', cold: 'Kälte', other: 'Anderes' },
    note: 'Kommentar (optional)',
    send: 'Senden',
    thanks: 'Danke! Notiert.',
    duplicate: 'Schon gespeichert, danke.',
    error: 'Senden fehlgeschlagen. Bitte später erneut versuchen.',
    notNow: 'Jetzt nicht',
    rcTitle: 'Rezeption: was Gäste gesagt haben',
    rcIntro: 'Wenn ein Gast zurückkommt und erzählt, wie es war, tragen Sie es hier ein. Zwanzig Sekunden. Jeder Eintrag verbessert die Tipps für Ihr Haus.',
    rcParty: 'Personen',
    rcLogged: 'Heute eingetragen',
    rcView: 'Rezeptionsformular',
    rcGuestsSaid: 'Gäste sagten',
    evening: 'Möchten Sie jeden Nachmittag die Tipps für morgen per WhatsApp?',
    eveningBtn: 'Ja, Abendnachricht senden',
  },
  profiles: {
    family: 'Familie mit Kindern',
    couple: 'Paar',
    solo: 'Allein',
    active: 'Abenteuer & Wandern',
    senior: 'Gemütliches Tempo',
    nocar: 'Ohne Auto',
  },
  types: {
    beach: 'Strand',
    lake: 'See',
    gorge: 'Schlucht',
    hike: 'Spaziergang',
    boat: 'Bootsausflug',
    culture: 'Kultur',
    village: 'Dorf',
    nature: 'Natur',
    town: 'Stadt',
    museum: 'Museum',
  },
  compass: ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'],
};

const FR: Dict = {
  greeting: 'Bienvenue ! Voici nos suggestions selon la météo.',
  whoTravels: 'Qui voyage ?',
  today: "Aujourd'hui",
  tomorrow: 'Demain',
  dayAfter: 'Après-demain',
  forecastFor: 'Météo',
  ourPicks: 'Nos suggestions',
  more: "Plus d'idées",
  notTomorrow: 'Mieux vaut éviter demain',
  notThisDay: 'Mieux vaut éviter ce jour-là',
  planB: 'Journée difficile pour les excursions. Nous conseillons la ville, les musées ou une sortie proche.',
  bestTime: 'Meilleur moment',
  byCar: 'en voiture',
  byBus: 'en bus',
  onFoot: 'à pied',
  directions: 'Itinéraire',
  share: 'Partager',
  sharePlan: 'Partager le programme du jour',
  copy: 'Copier',
  copied: 'Copié',
  copyFailed: 'Sélectionnez et copiez le texte',
  details: 'Détails',
  close: 'Fermer',
  why: 'Pourquoi maintenant',
  bring: 'À emporter',
  conditions: 'Conditions sur place',
  sea: 'Mer',
  wind: 'Vent',
  feels: 'Ressenti',
  rain: 'Pluie',
  aboutPlace: 'À propos du lieu',
  disclaimer: 'Suggestions basées sur les prévisions météo. Suivez toujours les consignes des sauveteurs et des autorités.',
  poweredBy: 'Propulsé par Weather Mood',
  updated: 'Mis à jour',
  scanForYourLanguage: 'Scannez pour des conseils dans votre langue',
  lobbyTitle: 'Où aller demain',
  phoneView: 'Téléphone du client',
  lobbyView: 'Écran de réception',
  demoNote: 'Démo avec un établissement fictif',
  noPicks: "Aucune suggestion adaptée. Demandez à la réception.",
  seaWords: ['calme', 'peu agitée', 'petites vagues', 'agitée'],
  windWords: ['presque calme', 'léger', 'modéré', 'fort'],
  photo: 'Photo',
  fb: {
    title: 'Vous y êtes allés ? Comment c\'était ?',
    intro: 'Une réponse aide le prochain visiteur et rend nos conseils plus précis.',
    didYouGo: 'Nous avions suggéré {spot} ({day}). Vous y êtes allés ?',
    wentElsewhere: 'Allés ailleurs ?',
    pickPlace: 'Choisir un lieu',
    whichDay: 'Quel jour ?',
    yesterday: 'Hier',
    daysAgo: 'il y a {n} jours',
    up: "C'était super",
    down: 'Pas comme annoncé',
    whatWrong: "Qu'est-ce qui n'allait pas ?",
    tags: { wave: 'Vagues', wind: 'Vent', crowd: 'Monde', rain: 'Pluie', heat: 'Chaleur', cold: 'Froid', other: 'Autre' },
    note: 'Commentaire (facultatif)',
    send: 'Envoyer',
    thanks: 'Merci ! C\'est noté.',
    duplicate: 'Déjà enregistré, merci.',
    error: "Envoi impossible. Réessayez plus tard.",
    notNow: 'Pas maintenant',
    rcTitle: 'Réception : ce que les clients ont dit',
    rcIntro: "Quand un client revient et vous raconte comment c'était, notez-le ici. Vingt secondes. Chaque entrée améliore les conseils pour votre établissement.",
    rcParty: 'Personnes',
    rcLogged: "Enregistrés aujourd'hui",
    rcView: 'Formulaire réception',
    rcGuestsSaid: 'Les clients ont dit',
    evening: 'Vous voulez chaque après-midi les conseils du lendemain sur WhatsApp ?',
    eveningBtn: 'Oui, envoyez-moi le message du soir',
  },
  profiles: {
    family: 'Famille avec enfants',
    couple: 'Couple',
    solo: 'En solo',
    active: 'Aventure & randonnée',
    senior: 'Rythme tranquille',
    nocar: 'Sans voiture',
  },
  types: {
    beach: 'Plage',
    lake: 'Lac',
    gorge: 'Gorges',
    hike: 'Balade',
    boat: 'Excursion en bateau',
    culture: 'Culture',
    village: 'Village',
    nature: 'Nature',
    town: 'Ville',
    museum: 'Musée',
  },
  compass: ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'],
};

const DICTS: Record<GuestLang, Dict> = { el: EL, en: EN, de: DE, fr: FR };
export const g = (lang: GuestLang): Dict => DICTS[lang];

export const LANG_NAMES: Record<GuestLang, string> = { el: 'Ελληνικά', en: 'English', de: 'Deutsch', fr: 'Français' };

/** Place names and notes exist in Greek and English; other languages use the English text. */
export const pick = (t: Text, lang: GuestLang) => (lang === 'el' ? t.el : t.en);

export const compassG = (deg: number, lang: GuestLang) => g(lang).compass[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

export function detectLang(): GuestLang {
  const prefs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : [];
  for (const p of prefs) {
    const code = p.slice(0, 2).toLowerCase();
    if (code === 'el' || code === 'en' || code === 'de' || code === 'fr') return code;
  }
  return 'en';
}

export function dayName(date: string, lang: GuestLang) {
  const locale = { el: 'el-GR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR' }[lang];
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
}
