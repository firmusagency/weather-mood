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
  qrView: string;
  qrTitle: string;
  qrLine: string;
  qrPrint: string;
  qrHint: string;
  water: string;
  waterWords: [string, string, string, string];
  sunrise: string;
  sunset: string;
  sunsetHere: string;
  uvWords: [string, string, string, string];
  uvTip: string;
  fromProperty: string;
  hotelPick: string;
  call: string;
  openLink: string;
  stay: StayDict;
  push: PushDict;
  compass: string[];
};

export type StayDict = {
  title: string;
  intro: string;
  checkoutQ: string;
  change: string;
  planned: string;
  possible: string;
  notThisStay: string;
  alsoFine: string;
  free: string;
  seeDay: string;
  conf: Record<'high' | 'medium' | 'low', string>;
  horizon: string;
  trips: Record<'balos' | 'elafonisi' | 'falasarna' | 'gorge' | 'sfakia' | 'akrotiri', string>;
  share: string;
  shareTitle: string;
  noDays: string;
};

export type PushDict = {
  title: string;
  btn: string;
  on: string;
  denied: string;
  install: string;
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
  qrView: 'Κάρτα QR δωματίου',
  qrTitle: 'Πού να πάτε αύριο;',
  qrLine: 'Σκανάρετε για τις προτάσεις της ημέρας στα Ελληνικά',
  qrPrint: 'Εκτύπωση κάρτας',
  qrHint: 'Εκτυπώστε σε A6 ή A5 και βάλτε μία σε κάθε δωμάτιο και στη reception.',
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
  water: 'Νερό',
  waterWords: ['κρύο', 'δροσερό', 'ευχάριστο', 'ζεστό'],
  sunrise: 'Ανατολή',
  sunset: 'Ηλιοβασίλεμα',
  sunsetHere: 'Ηλιοβασίλεμα εδώ στις {t}',
  uvWords: ['χαμηλή', 'μέτρια', 'υψηλή', 'πολύ υψηλή'],
  uvTip: 'Σκιά 12:00–16:00 και αντηλιακό 50',
  fromProperty: 'Από το {name}',
  hotelPick: 'Αγαπημένο του {name}',
  call: 'Κλήση',
  openLink: 'Άνοιγμα',
  stay: {
    title: 'Το πλάνο της διαμονής σας',
    intro: 'Πείτε μας μέχρι πότε μένετε και θα σας πούμε ποια μέρα ταιριάζει για κάθε μεγάλη εκδρομή.',
    checkoutQ: 'Μέχρι πότε μένετε;',
    change: 'Αλλαγή',
    planned: 'Προτείνουμε',
    possible: 'Γίνεται, με επιφύλαξη',
    notThisStay: 'Όχι αυτή τη διαμονή',
    alsoFine: 'Επίσης καλά, αν αλλάξετε γνώμη',
    free: 'Ελεύθερη μέρα: κάτι κοντινό, πόλη ή χαλάρωση',
    seeDay: 'Δείτε τη μέρα',
    conf: { high: 'σίγουρο', medium: 'πιθανό', low: 'εκτίμηση' },
    horizon: 'Από την 4η μέρα και μετά είναι εκτίμηση από τα μοντέλα καιρού. Το πλάνο ανανεώνεται κάθε βράδυ· ξαναδείτε το την προηγούμενη μέρα.',
    trips: { balos: 'Μπάλος & Γραμβούσα', elafonisi: 'Ελαφονήσι', falasarna: 'Φαλάσαρνα', gorge: 'Φαράγγι (Σαμαριά)', sfakia: 'Σφακιά & Λουτρό', akrotiri: 'Ακρωτήρι' },
    share: 'Μοιραστείτε το πλάνο',
    shareTitle: 'Πλάνο διαμονής',
    noDays: 'Η πρόγνωση φτάνει 7 μέρες μπροστά· θα συμπληρώνεται όσο πλησιάζουν οι μέρες.',
  },
  push: {
    title: 'Θέλετε κάθε απόγευμα ειδοποίηση με τις προτάσεις της επόμενης μέρας;',
    btn: 'Ναι, ειδοποιήστε με',
    on: 'Ενεργό: θα σας ειδοποιούμε κάθε απόγευμα, και το πρωί αν αλλάξει ο καιρός.',
    denied: 'Οι ειδοποιήσεις είναι κλειστές στον browser σας. Μπορείτε να τις ανοίξετε από τις ρυθμίσεις.',
    install: 'Προσθέστε τη σελίδα στην αρχική οθόνη για να την έχετε πάντα πρόχειρη.',
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
  qrView: 'Room QR card',
  qrTitle: 'Where to go tomorrow?',
  qrLine: 'Scan for today’s picks in English',
  qrPrint: 'Print card',
  qrHint: 'Print on A6 or A5 and put one in every room and at the reception.',
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
  water: 'Water',
  waterWords: ['cold', 'fresh', 'pleasant', 'warm'],
  sunrise: 'Sunrise',
  sunset: 'Sunset',
  sunsetHere: 'Sunset here at {t}',
  uvWords: ['low', 'moderate', 'high', 'very high'],
  uvTip: 'Shade 12:00–16:00 and SPF 50',
  fromProperty: 'From {name}',
  hotelPick: '{name} favourite',
  call: 'Call',
  openLink: 'Open',
  stay: {
    title: 'Your stay, planned',
    intro: 'Tell us when you leave and we will say which day suits each big trip.',
    checkoutQ: 'Until when are you staying?',
    change: 'Change',
    planned: 'We suggest',
    possible: 'Possible, with reservations',
    notThisStay: 'Not this stay',
    alsoFine: 'Also fine, if you change your mind',
    free: 'Free day: somewhere close, the town or a rest',
    seeDay: 'See this day',
    conf: { high: 'confident', medium: 'likely', low: 'estimate' },
    horizon: 'From day 4 on this is an estimate from the weather models. The plan refreshes every evening; check again the day before.',
    trips: { balos: 'Balos & Gramvousa', elafonisi: 'Elafonisi', falasarna: 'Falasarna', gorge: 'Gorge (Samaria)', sfakia: 'Sfakia & Loutro', akrotiri: 'Akrotiri' },
    share: 'Share the plan',
    shareTitle: 'Stay plan',
    noDays: 'The forecast reaches 7 days ahead; the plan fills in as the days get closer.',
  },
  push: {
    title: 'Want a notification every afternoon with the next day’s picks?',
    btn: 'Yes, notify me',
    on: 'On: we will notify you every afternoon, and in the morning if the weather changes.',
    denied: 'Notifications are blocked in your browser. You can allow them in its settings.',
    install: 'Add this page to your home screen to keep it handy.',
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
  qrView: 'QR-Karte fürs Zimmer',
  qrTitle: 'Wohin morgen?',
  qrLine: 'Scannen für die Tipps des Tages auf Deutsch',
  qrPrint: 'Karte drucken',
  qrHint: 'Auf A6 oder A5 drucken und in jedes Zimmer und an die Rezeption legen.',
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
  water: 'Wasser',
  waterWords: ['kalt', 'frisch', 'angenehm', 'warm'],
  sunrise: 'Sonnenaufgang',
  sunset: 'Sonnenuntergang',
  sunsetHere: 'Sonnenuntergang hier um {t}',
  uvWords: ['niedrig', 'mäßig', 'hoch', 'sehr hoch'],
  uvTip: 'Schatten 12:00–16:00 und LSF 50',
  fromProperty: 'Von {name}',
  hotelPick: 'Favorit von {name}',
  call: 'Anrufen',
  openLink: 'Öffnen',
  stay: {
    title: 'Ihr Aufenthalt, geplant',
    intro: 'Sagen Sie uns, bis wann Sie bleiben, und wir sagen, welcher Tag zu welchem großen Ausflug passt.',
    checkoutQ: 'Bis wann bleiben Sie?',
    change: 'Ändern',
    planned: 'Wir empfehlen',
    possible: 'Möglich, mit Vorbehalt',
    notThisStay: 'Nicht bei diesem Aufenthalt',
    alsoFine: 'Ebenfalls gut, falls Sie umplanen',
    free: 'Freier Tag: etwas in der Nähe, die Stadt oder Ausruhen',
    seeDay: 'Diesen Tag ansehen',
    conf: { high: 'sicher', medium: 'wahrscheinlich', low: 'Schätzung' },
    horizon: 'Ab Tag 4 ist dies eine Schätzung der Wettermodelle. Der Plan wird jeden Abend aktualisiert; schauen Sie am Vortag noch einmal nach.',
    trips: { balos: 'Balos & Gramvousa', elafonisi: 'Elafonisi', falasarna: 'Falasarna', gorge: 'Schlucht (Samaria)', sfakia: 'Sfakia & Loutro', akrotiri: 'Akrotiri' },
    share: 'Plan teilen',
    shareTitle: 'Aufenthaltsplan',
    noDays: 'Die Vorhersage reicht 7 Tage voraus; der Plan füllt sich, je näher die Tage rücken.',
  },
  push: {
    title: 'Möchten Sie jeden Nachmittag eine Benachrichtigung mit den Tipps für den nächsten Tag?',
    btn: 'Ja, benachrichtigen',
    on: 'Aktiv: Wir melden uns jeden Nachmittag, und morgens, falls sich das Wetter ändert.',
    denied: 'Benachrichtigungen sind in Ihrem Browser blockiert. Sie können sie in den Einstellungen erlauben.',
    install: 'Fügen Sie die Seite zum Startbildschirm hinzu, um sie griffbereit zu haben.',
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
  qrView: 'Carte QR de chambre',
  qrTitle: 'Où aller demain ?',
  qrLine: 'Scannez pour les conseils du jour en français',
  qrPrint: 'Imprimer la carte',
  qrHint: 'Imprimez en A6 ou A5 et placez-en une dans chaque chambre et à la réception.',
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
  water: 'Eau',
  waterWords: ['froide', 'fraîche', 'agréable', 'chaude'],
  sunrise: 'Lever du soleil',
  sunset: 'Coucher du soleil',
  sunsetHere: 'Coucher du soleil ici à {t}',
  uvWords: ['faible', 'modéré', 'élevé', 'très élevé'],
  uvTip: 'Ombre 12h–16h et indice 50',
  fromProperty: 'De la part de {name}',
  hotelPick: 'Coup de cœur de {name}',
  call: 'Appeler',
  openLink: 'Ouvrir',
  stay: {
    title: 'Votre séjour, planifié',
    intro: 'Dites-nous jusqu’à quand vous restez et nous vous dirons quel jour convient à chaque grande excursion.',
    checkoutQ: 'Jusqu’à quand restez-vous ?',
    change: 'Modifier',
    planned: 'Nous conseillons',
    possible: 'Possible, sous réserve',
    notThisStay: 'Pas pendant ce séjour',
    alsoFine: 'Également possible, si vous changez d’avis',
    free: 'Journée libre : un lieu proche, la ville ou du repos',
    seeDay: 'Voir ce jour',
    conf: { high: 'sûr', medium: 'probable', low: 'estimation' },
    horizon: 'À partir du 4e jour, il s’agit d’une estimation des modèles météo. Le plan est mis à jour chaque soir ; revérifiez la veille.',
    trips: { balos: 'Balos & Gramvousa', elafonisi: 'Elafonisi', falasarna: 'Falasarna', gorge: 'Gorges (Samaria)', sfakia: 'Sfakia & Loutro', akrotiri: 'Akrotiri' },
    share: 'Partager le plan',
    shareTitle: 'Plan du séjour',
    noDays: 'La prévision porte sur 7 jours ; le plan se complète à mesure que les jours approchent.',
  },
  push: {
    title: 'Voulez-vous une notification chaque après-midi avec les conseils du lendemain ?',
    btn: 'Oui, prévenez-moi',
    on: 'Activé : nous vous préviendrons chaque après-midi, et le matin si la météo change.',
    denied: 'Les notifications sont bloquées dans votre navigateur. Vous pouvez les autoriser dans ses réglages.',
    install: 'Ajoutez cette page à votre écran d’accueil pour l’avoir toujours sous la main.',
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
