import { compass, windNameEl } from '../engine/geo';
import type { Factor, Lang, SpotType, Verdict } from '../engine/types';
import { REF_POINTS } from '../data/region';

const UI = {
  el: {
    brandTag: 'Ο καιρός γίνεται πρόγραμμα',
    accuracyTitle: 'Πόσο πέφτουμε μέσα',
    accuracyHint: 'Κάθε πρωί συγκρίνουμε την πρόγνωση της προηγούμενης μέρας με τις μετρήσεις του σταθμού του αεροδρομίου Χανίων (LGSA). Το κύμα δεν μετριέται από σταθμό.',
    accuracyDays: 'ημέρες ελέγχου',
    accuracyWind: 'Μέσο σφάλμα ανέμου',
    accuracyAfternoon: 'Bias 13:00–18:00',
    accuracyTemp: 'Μέσο σφάλμα θερμοκρασίας',
    accuracyBf: 'Beaufort σωστό (±1)',
    accuracyRain: 'Βροχή ναι/όχι σωστά',
    accuracyModels: 'Ποιο μοντέλο ανέμου πέφτει πιο κοντά',
    accuracyRecent: 'Τελευταίες ημέρες',
    accuracyNone: 'Δεν υπάρχουν ακόμη ημέρες ελέγχου.',
    accuracyRecs: 'Άντεξε η πρόταση;',
    accuracyRecsHint: 'Ξανατρέχουμε την πρόταση με τον άνεμο που μέτρησε ο σταθμός. Βόρεια ακτή (έως 30 km από τον σταθμό), προφίλ οικογένεια/ζευγάρι/πεζοπορία.',
    accuracyPicksHeld: 'Προτάσεις που άντεξαν',
    accuracyAvoidsRight: '«Αποφύγετε» που ήταν σωστά',
    accuracyStations: 'Δυτική και νότια ακτή (σταθμοί Εθνικού Αστεροσκοπείου)',
    accuracyStationsHint: 'Ημερήσια αρχεία: μέγιστη ριπή και η ώρα της, μέσος άνεμος, κυρίαρχη διεύθυνση, βροχή. Η πρόταση «άντεξε» αν η μεγάλη ριπή της μέρας (≥ 40 km/h) δεν έπεσε μέσα στο παράθυρο που δώσαμε.',
    accuracyStationCols: ['Σταθμός', 'Ημέρες', 'Σφάλμα ριπής', 'Ριπή ±10 km/h', 'Διεύθυνση ±45°', 'Βροχή', 'Πρόταση άντεξε'],
    fbTitle: 'Τι είπαν οι επισκέπτες',
    fbHint: 'Ψήφοι 👍/👎 από τη σελίδα επισκέπτη και τη φόρμα reception, δεμένοι με την πρόγνωση που είχαμε δώσει για εκείνη τη μέρα. Αυτά τα στοιχεία δεν τα έχει κανείς άλλος.',
    fbNone: 'Δεν υπάρχουν ακόμη ψήφοι. Το QR στο δωμάτιο και η φόρμα reception (guest.html#reception) τις συλλέγουν.',
    fbTotal: 'Ψήφοι',
    fbAgree: 'Συμφωνία με την πρόγνωση',
    fbJudged: 'με σαφή πρόγνωση',
    fbVisits: 'Ανοίγματα σελίδας (30 ημ.)',
    fbPhone: 'κινητό',
    fbLobby: 'οθόνη',
    fbBySpot: 'Ανά σημείο',
    fbCols: ['Σημείο', 'Ψήφοι', '👍', '👎', 'Διαφωνία', 'Συχνότερο παράπονο'],
    fbCalib: 'Αυτόματη διόρθωση κύματος',
    fbCalibHint: 'Όταν σε ένα σημείο μαζευτούν ≥ 8 ψήφοι με πρόγνωση και οι επισκέπτες βρίσκουν συστηματικά περισσότερο (ή λιγότερο) κύμα από όσο είπαμε, ο συντελεστής κύματος του σημείου μετακινείται κατά 5% ανά ψήφο, μέχρι ±30–40%. Αέρας και κόσμος δεν διορθώνονται αυτόματα· τα βλέπει άνθρωπος.',
    fbCalibNone: 'Καμία διόρθωση ακόμη: χρειάζονται τουλάχιστον 8 ψήφοι ανά σημείο.',
    fbRecent: 'Τελευταίες ψήφοι',
    fbTags: { wave: 'κύμα', wind: 'αέρας', crowd: 'κόσμος', rain: 'βροχή', heat: 'ζέστη', cold: 'κρύο', other: 'άλλο' },
    fbSource: { guest: 'επισκέπτης', reception: 'reception' },
    fbSaid: 'είπαμε',
    waveModels: 'Μοντέλα κύματος',
    waveModelsHint: 'Μέσο ύψος 10:00–18:00 ανοιχτά της ακτής, από 4 ανεξάρτητα μοντέλα κύματος.',
    waveModelsAt: 'Μοντέλα κύματος στο μέσο του παραθύρου',
    waveMedianOf: 'διάμεσος {n} μοντέλων',
    glanceTitle: 'Η μέρα με μια ματιά',
    glanceOk: 'προτείνονται',
    glanceBest: 'Καλύτερο',
    glanceLeastBad: 'Λιγότερο κακό',
    colWhy: 'Κύριος λόγος',
    staleData: 'Παλιά δεδομένα',
    hoursAgo: 'πριν {h} ώρες',
    compareProfiles: 'Για κάθε προφίλ',
    compareHint: 'Το ίδιο σημείο, την ίδια μέρα, για κάθε τύπο επισκέπτη.',
    region: 'Χανιά, Κρήτη',
    tabOverview: 'Εικόνα ημέρας',
    guestPage: 'Σελίδα επισκέπτη ↗',
    tabAnalysis: 'Ανάλυση σημείων',
    tabRecs: 'Προτάσεις',
    tabMethod: 'Μέθοδος & πηγές',
    profile: 'Προφίλ επισκέπτη',
    base: 'Κατάλυμα στην περιοχή',
    day: 'Ημέρα',
    today: 'Σήμερα',
    tomorrow: 'Αύριο',
    dayAfter: 'Μεθαύριο',
    dataFrom: 'Δεδομένα Open-Meteo',
    fetched: 'λήψη',
    refresh: 'Ζωντανή ανανέωση',
    refreshing: 'Λήψη…',
    liveFailed: 'Η ζωντανή λήψη απέτυχε — εμφανίζονται τα αποθηκευμένα δεδομένα.',
    loading: 'Φόρτωση προγνώσεων…',
    loadFailed: 'Δεν βρέθηκαν δεδομένα πρόγνωσης.',
    openSeaWind: 'Άνεμος στο ανοιχτό πέλαγος (βόρεια)',
    gusts: 'ριπές',
    coasts: 'Θάλασσα ανά ακτή',
    waveMax: 'κύμα έως',
    waveMean: 'μέσο',
    exposed: 'Εκτεθειμένη',
    shelteredCoast: 'Υπήνεμη',
    calmWind: 'Ασθενής άνεμος',
    roughSea: 'Κύμα',
    sst: 'θάλασσα',
    models: 'Τι λένε τα 5 μοντέλα',
    modelsHint: 'Μέσος άνεμος 10:00–18:00 στο ανοιχτό πέλαγος βόρεια των Χανίων. Όσο πιο κοντά είναι μεταξύ τους, τόσο πιο σίγουρη η πρόγνωση.',
    model: 'Μοντέλο',
    speed: 'Ένταση',
    direction: 'Διεύθυνση',
    gust: 'Ριπή',
    agreement: 'Συμφωνία',
    agreeHigh: 'Υψηλή',
    agreeMedium: 'Μέτρια',
    agreeLow: 'Χαμηλή',
    town: 'Στην πόλη',
    maxTemp: 'Μέγιστη',
    feels: 'Αίσθηση',
    uv: 'UV',
    rain: 'Βροχή',
    sunrise: 'Ανατολή',
    sunset: 'Δύση',
    hourlyWind: 'Άνεμος ανά ώρα',
    keyPoints: 'Τι σημαίνουν για τις εκδρομές',
    seeAnalysis: 'Δείτε την ανάλυση ανά σημείο',
    filterAll: 'Όλα',
    colPlace: 'Σημείο',
    colWeather: 'Καιρός',
    colSea: 'Θάλασσα στην ακτή',
    colWind: 'Άνεμος στο σημείο',
    colGust: 'Ριπές',
    colTemp: 'Αίσθηση',
    colRain: 'Βροχή',
    colWindow: 'Καλύτερη ώρα',
    colTravel: 'Διαδρομή',
    colConf: 'Βεβαιότητα',
    sortRank: 'Σειρά πρότασης',
    sortScore: 'Βαθμός καιρού',
    sortName: 'Όνομα',
    sortBy: 'Ταξινόμηση',
    analysisHint: 'Ο βαθμός καιρού (0–100) δείχνει πόσο κατάλληλες είναι οι συνθήκες για το επιλεγμένο προφίλ στην καλύτερη ώρα της ημέρας. Πατήστε ένα σημείο για την πλήρη ανάλυση.',
    confHigh: 'υψηλή',
    confMedium: 'μέτρια',
    confLow: 'χαμηλή',
    min: '΄',
    close: 'Κλείσιμο',
    weatherScore: 'Βαθμός καιρού',
    rankScore: 'Βαθμός πρότασης',
    bestWindow: 'Καλύτερη ώρα',
    travel: 'Διαδρομή',
    confidence: 'Βεβαιότητα πρόγνωσης',
    stepData: '1. Τα δεδομένα',
    stepGeometry: '2. Τι φτάνει στο σημείο',
    stepJudgement: '3. Η κρίση για το προφίλ',
    stepFit: '4. Ταιριάζει στο πρόγραμμα;',
    windConsensus: 'Άνεμος (διάμεσος 5 μοντέλων)',
    shoreFaces: 'Η ακτή κοιτάει',
    windFrom: 'ο άνεμος έρχεται από',
    windExposure: 'έκθεση στον άνεμο',
    waveOffshore: 'Κύμα ανοιχτά',
    waveExposure: 'φτάνει στην ακτή',
    localWindSea: 'τοπικός κυματισμός από τον άνεμο',
    waveAtShore: 'Εκτιμώμενο κύμα στην ακτή',
    hourByHour: 'Ώρα προς ώρα',
    legendWind: 'άνεμος km/h',
    legendGust: 'ριπή',
    legendWave: 'κύμα στην ακτή (m)',
    legendScore: 'βαθμός ανά ώρα',
    noFactors: 'Καμία αρνητική επίδραση — ιδανικές συνθήκες.',
    unverified: 'Τα στοιχεία του σημείου (προσανατολισμός, όρια) δεν έχουν ακόμη επαληθευτεί επιτόπου.',
    notes: 'Σημειώσεις',
    modelsAtWindow: 'Μοντέλα στο μέσο του παραθύρου',
    recsFor: 'Προτάσεις για',
    recsTitleTomorrow: 'Πού να πάτε αύριο',
    recsTitleToday: 'Πού να πάτε σήμερα',
    recsTitleOther: 'Πού να πάτε',
    topPicks: 'Κορυφαίες επιλογές',
    alternatives: 'Εναλλακτικές',
    avoid: 'Αποφύγετε αυτή τη μέρα',
    badDay: 'Δύσκολη μέρα για εξορμήσεις: προτείνουμε πρόγραμμα σε πόλη, μουσεία ή κοντινές διαδρομές.',
    noTop: 'Δεν βρέθηκε κατάλληλη επιλογή για αυτό το προφίλ.',
    go: 'Πηγαίνετε',
    when: 'Πότε',
    why: 'Γιατί',
    eveningTitle: 'Βραδινό μήνυμα',
    eveningHint: 'Το μήνυμα που παίρνει ο επισκέπτης το απόγευμα για την επόμενη μέρα, στη γλώσσα του. Στέλνεται αυτόματα στη reception στις 18:40· από εδώ το στέλνετε με ένα πάτημα.',
    eveningLang: 'Γλώσσα επισκέπτη',
    sendWhatsapp: 'WhatsApp',
    sendEmail: 'Email',
    planBTitle: 'Plan B: άλλαξε ο καιρός από το βραδινό μήνυμα',
    planBHint: 'Ο πρωινός έλεγχος βρήκε αλλαγή για σήμερα. Στείλτε στους επισκέπτες το νέο μήνυμα.',
    planBSame: 'Ο πρωινός έλεγχος επιβεβαίωσε το βραδινό μήνυμα· δεν χρειάζεται ενημέρωση.',
    message: 'Μήνυμα προς επισκέπτες',
    messageHint: 'Έτοιμο κείμενο για WhatsApp, email ή την οθόνη της reception.',
    copy: 'Αντιγραφή',
    copied: 'Αντιγράφηκε',
    copyFailed: 'Επιλέξτε το κείμενο και αντιγράψτε το χειροκίνητα.',
    details: 'Ανάλυση',
    disclaimer: 'Οι προτάσεις είναι ενδεικτικές και βασίζονται σε προγνώσεις. Ακολουθείτε πάντα τις οδηγίες ναυαγοσωστών, λιμενικού και φορέων.',
    verdict: { go: 'Προτείνεται', caution: 'Με επιφύλαξη', avoid: 'Αποφύγετε', unsuitable: 'Δεν ταιριάζει' } as Record<Verdict, string>,
    types: {
      beach: 'Παραλία',
      lake: 'Λίμνη',
      gorge: 'Φαράγγι',
      hike: 'Πεζοπορία',
      boat: 'Καραβάκι',
      culture: 'Πολιτισμός',
      village: 'Χωριό',
      nature: 'Φύση',
      town: 'Πόλη',
      museum: 'Μουσείο',
    } as Record<SpotType, string>,
  },
  en: {
    brandTag: 'Weather, turned into plans',
    accuracyTitle: 'How often we get it right',
    accuracyHint: 'Every morning we compare the previous day\'s forecast with measurements from the Chania airport station (LGSA). Waves have no station to check against.',
    accuracyDays: 'days checked',
    accuracyWind: 'Mean wind error',
    accuracyAfternoon: 'Bias 13:00–18:00',
    accuracyTemp: 'Mean temperature error',
    accuracyBf: 'Beaufort right (±1)',
    accuracyRain: 'Rain yes/no right',
    accuracyModels: 'Which wind model lands closest',
    accuracyRecent: 'Recent days',
    accuracyNone: 'No verified days yet.',
    accuracyRecs: 'Did the recommendation hold?',
    accuracyRecsHint: 'We rerun the recommendation with the wind the station measured. North coast (within 30 km of the station), family/couple/active profiles.',
    accuracyPicksHeld: 'Picks that held',
    accuracyAvoidsRight: '"Avoid" calls that were right',
    accuracyStations: 'West and south coast (National Observatory stations)',
    accuracyStationsHint: 'Daily files: max gust and its time, mean wind, dominant direction, rain. A pick "held" when the day’s big gust (≥ 40 km/h) did not fall inside the window we gave.',
    accuracyStationCols: ['Station', 'Days', 'Gust error', 'Gust ±10 km/h', 'Direction ±45°', 'Rain', 'Pick held'],
    fbTitle: 'What guests said',
    fbHint: 'Thumbs up/down from the guest page and the reception form, tied to the forecast we had issued for that day. Nobody else has this data.',
    fbNone: 'No votes yet. The in-room QR code and the reception form (guest.html#reception) collect them.',
    fbTotal: 'Votes',
    fbAgree: 'Agreement with forecast',
    fbJudged: 'with a clear forecast',
    fbVisits: 'Page opens (30 days)',
    fbPhone: 'phone',
    fbLobby: 'screen',
    fbBySpot: 'By place',
    fbCols: ['Place', 'Votes', '👍', '👎', 'Disagree', 'Most common complaint'],
    fbCalib: 'Automatic wave correction',
    fbCalibHint: 'Once a place has ≥ 8 votes with a forecast and guests consistently find more (or less) wave than we said, its wave factor moves 5% per vote, capped at ±30–40%. Wind and crowds are not auto-corrected; a human looks at those.',
    fbCalibNone: 'No correction yet: at least 8 votes per place are needed.',
    fbRecent: 'Latest votes',
    fbTags: { wave: 'waves', wind: 'wind', crowd: 'crowds', rain: 'rain', heat: 'heat', cold: 'cold', other: 'other' },
    fbSource: { guest: 'guest', reception: 'reception' },
    fbSaid: 'we said',
    waveModels: 'Wave models',
    waveModelsHint: 'Mean height 10:00–18:00 offshore, from 4 independent wave models.',
    waveModelsAt: 'Wave models at mid-window',
    waveMedianOf: 'median of {n} models',
    glanceTitle: 'The day at a glance',
    glanceOk: 'recommended',
    glanceBest: 'Best bet',
    glanceLeastBad: 'Least bad',
    colWhy: 'Main reason',
    staleData: 'Stale data',
    hoursAgo: '{h} hours ago',
    compareProfiles: 'For every profile',
    compareHint: 'Same place, same day, for each type of guest.',
    region: 'Chania, Crete',
    tabOverview: 'Day overview',
    guestPage: 'Guest page ↗',
    tabAnalysis: 'Spot analysis',
    tabRecs: 'Recommendations',
    tabMethod: 'Method & sources',
    profile: 'Guest profile',
    base: 'Accommodation area',
    day: 'Day',
    today: 'Today',
    tomorrow: 'Tomorrow',
    dayAfter: 'Day after',
    dataFrom: 'Open-Meteo data',
    fetched: 'fetched',
    refresh: 'Live refresh',
    refreshing: 'Fetching…',
    liveFailed: 'Live fetch failed — showing stored data.',
    loading: 'Loading forecasts…',
    loadFailed: 'No forecast data found.',
    openSeaWind: 'Open-sea wind (north)',
    gusts: 'gusts',
    coasts: 'Sea by coast',
    waveMax: 'waves up to',
    waveMean: 'mean',
    exposed: 'Exposed',
    shelteredCoast: 'Sheltered',
    calmWind: 'Light wind',
    roughSea: 'Rough sea',
    sst: 'sea',
    models: 'What the 5 models say',
    modelsHint: 'Mean wind 10:00–18:00 over the open sea north of Chania. The closer they are, the more reliable the forecast.',
    model: 'Model',
    speed: 'Speed',
    direction: 'Direction',
    gust: 'Gust',
    agreement: 'Agreement',
    agreeHigh: 'High',
    agreeMedium: 'Medium',
    agreeLow: 'Low',
    town: 'In town',
    maxTemp: 'Max',
    feels: 'Feels like',
    uv: 'UV',
    rain: 'Rain',
    sunrise: 'Sunrise',
    sunset: 'Sunset',
    hourlyWind: 'Wind by hour',
    keyPoints: 'What it means for day trips',
    seeAnalysis: 'See the per-spot analysis',
    filterAll: 'All',
    colPlace: 'Place',
    colWeather: 'Weather',
    colSea: 'Sea at shore',
    colWind: 'Wind at spot',
    colGust: 'Gusts',
    colTemp: 'Feels',
    colRain: 'Rain',
    colWindow: 'Best time',
    colTravel: 'Travel',
    colConf: 'Confidence',
    sortRank: 'Recommendation order',
    sortScore: 'Weather score',
    sortName: 'Name',
    sortBy: 'Sort',
    analysisHint: 'The weather score (0–100) shows how suitable conditions are for the selected profile at the best time of day. Tap a place for the full analysis.',
    confHigh: 'high',
    confMedium: 'medium',
    confLow: 'low',
    min: ' min',
    close: 'Close',
    weatherScore: 'Weather score',
    rankScore: 'Recommendation score',
    bestWindow: 'Best time',
    travel: 'Travel',
    confidence: 'Forecast confidence',
    stepData: '1. The data',
    stepGeometry: '2. What reaches the spot',
    stepJudgement: '3. Judgement for this profile',
    stepFit: '4. Does it fit the plan?',
    windConsensus: 'Wind (median of 5 models)',
    shoreFaces: 'The shore faces',
    windFrom: 'wind comes from',
    windExposure: 'wind exposure',
    waveOffshore: 'Offshore waves',
    waveExposure: 'reaches the shore',
    localWindSea: 'local wind chop',
    waveAtShore: 'Estimated waves at the shore',
    hourByHour: 'Hour by hour',
    legendWind: 'wind km/h',
    legendGust: 'gust',
    legendWave: 'waves at shore (m)',
    legendScore: 'hourly score',
    noFactors: 'Nothing holding it back — ideal conditions.',
    unverified: 'Spot details (orientation, limits) have not been verified on the ground yet.',
    notes: 'Notes',
    modelsAtWindow: 'Models at mid-window',
    recsFor: 'Recommendations for',
    recsTitleTomorrow: 'Where to go tomorrow',
    recsTitleToday: 'Where to go today',
    recsTitleOther: 'Where to go',
    topPicks: 'Top picks',
    alternatives: 'Alternatives',
    avoid: 'Avoid on this day',
    badDay: 'A tough day for trips: we suggest the town, museums or short outings.',
    noTop: 'No suitable option found for this profile.',
    go: 'Go',
    when: 'When',
    why: 'Why',
    eveningTitle: 'Evening message',
    eveningHint: 'What the guest receives in the afternoon for the next day, in their language. Emailed to the reception at 18:40 automatically; send it from here with one tap.',
    eveningLang: 'Guest language',
    sendWhatsapp: 'WhatsApp',
    sendEmail: 'Email',
    planBTitle: 'Plan B: the weather moved since the evening message',
    planBHint: 'The morning check found a change for today. Send guests the updated note.',
    planBSame: 'The morning check confirmed the evening message; no update needed.',
    message: 'Message to guests',
    messageHint: 'Ready-made text for WhatsApp, email or the reception screen.',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Select the text and copy it manually.',
    details: 'Analysis',
    disclaimer: 'Recommendations are indicative and based on forecasts. Always follow lifeguards, coast guard and local authorities.',
    verdict: { go: 'Recommended', caution: 'With caution', avoid: 'Avoid', unsuitable: 'Not a fit' } as Record<Verdict, string>,
    types: {
      beach: 'Beach',
      lake: 'Lake',
      gorge: 'Gorge',
      hike: 'Hike',
      boat: 'Boat trip',
      culture: 'Culture',
      village: 'Village',
      nature: 'Nature',
      town: 'Town',
      museum: 'Museum',
    } as Record<SpotType, string>,
  },
};

export type UIStrings = (typeof UI)['el'];
export const strings = (lang: Lang): UIStrings => UI[lang];

const TRAITS: Record<string, { el: string; en: string }> = {
  kidFriendly: { el: 'φιλικό για παιδιά', en: 'kid-friendly' },
  shallow: { el: 'ρηχά νερά', en: 'shallow water' },
  facilities: { el: 'παροχές', en: 'facilities' },
  shade: { el: 'σκιά', en: 'shade' },
  easyAccess: { el: 'εύκολη πρόσβαση', en: 'easy access' },
  scenic: { el: 'εντυπωσιακό τοπίο', en: 'stunning scenery' },
  sunset: { el: 'ηλιοβασίλεμα', en: 'sunset' },
  snorkeling: { el: 'snorkeling', en: 'snorkelling' },
  bus: { el: 'με λεωφορείο', en: 'by bus' },
  hiking: { el: 'πεζοπορία', en: 'hiking' },
};

/** "Μαΐστρος (ΒΔ)" in Greek, "NW" in English. */
export function windLabel(deg: number, lang: Lang): string {
  return lang === 'el' ? `${windNameEl(deg)} (${compass(deg, 'el')})` : compass(deg, 'en');
}

const num = (x: string | number) => (typeof x === 'number' ? x : Number(x));

/** Human sentence for one factor, with its numbers. */
export function factorText(fct: Factor, lang: Lang): string {
  const p = fct.params;
  const el = lang === 'el';
  const dir = (d: string | number) => windLabel(num(d), lang);
  switch (fct.key) {
    case 'seaRough':
      return el
        ? `Κύμα ~${p.wave} m στην ακτή (ανοιχτά ${p.offshore} m από ${dir(p.dir)}, φτάνει το ${p.exposure}%)`
        : `~${p.wave} m waves at the shore (${p.offshore} m offshore from ${dir(p.dir)}, ${p.exposure}% reaches it)`;
    case 'longSwell':
      return el
        ? `Μακρύ κύμα (swell ${p.period} s): σπάει πιο δυνατά απ' ό,τι φαίνεται από την ακτή`
        : `Long swell (${p.period} s period): breaks harder than it looks from the shore`;
    case 'seaCalm':
      return el ? `Ήρεμη θάλασσα: ~${p.wave} m στην ακτή (ανοιχτά ${p.offshore} m)` : `Calm sea: ~${p.wave} m at the shore (${p.offshore} m offshore)`;
    case 'onshoreWind':
      return el ? `Άνεμος ${p.bf} Bf (${p.kmh} km/h) από ${dir(p.dir)} προς την ακτή` : `${p.bf} Bf (${p.kmh} km/h) wind from ${dir(p.dir)} blowing onshore`;
    case 'offshoreWind':
      return el ? `Ο άνεμος (${dir(p.dir)}) φυσάει από τη στεριά: πιο ήρεμα νερά κοντά στην ακτή` : `Wind (${dir(p.dir)}) blows off the land: calmer water near the shore`;
    case 'windy':
      return el ? `Αρκετός αέρας στην παραλία: ${p.bf} Bf (${p.kmh} km/h) από ${dir(p.dir)}` : `Quite windy on the beach: ${p.bf} Bf (${p.kmh} km/h) from ${dir(p.dir)}`;
    case 'sheltered':
      return el ? `Προστατευμένο από τον ${dir(p.dir)} ${p.bf} Bf` : `Sheltered from the ${dir(p.dir)} ${p.bf} Bf wind`;
    case 'gusts':
      return el ? `Ριπές έως ${p.gust} km/h` : `Gusts up to ${p.gust} km/h`;
    case 'downslopeGusts':
      return el ? `Ριπές από τα βουνά με βοριά (~${p.gust} km/h)` : `Downslope gusts off the mountains in northerlies (~${p.gust} km/h)`;
    case 'rain':
      return el
        ? `Βροχή: πιθανότητα ${p.pp}%${num(p.mm) > 0 ? `, έως ${p.mm} mm/ώρα` : ''}`
        : `Rain: ${p.pp}% chance${num(p.mm) > 0 ? `, up to ${p.mm} mm/h` : ''}`;
    case 'thunder':
      return el ? 'Πιθανές καταιγίδες' : 'Thunderstorms possible';
    case 'cool':
      return el ? `Δροσερά για μπάνιο (αίσθηση ${p.apparent}°C)` : `Cool for swimming (feels like ${p.apparent}°C)`;
    case 'cold':
      return el ? `Κρύο: αίσθηση ${p.apparent}°C` : `Cold: feels like ${p.apparent}°C`;
    case 'coldWater':
      return el ? `Θάλασσα ${p.sst}°C` : `Sea at ${p.sst}°C`;
    case 'heat':
      return el ? `Ζέστη: αίσθηση ${p.apparent}°C` : `Heat: feels like ${p.apparent}°C`;
    case 'cloudy':
      return el ? `Συννεφιά ${p.cloud}%` : `${p.cloud}% cloud cover`;
    case 'ripCurrents':
      return el ? `Επικίνδυνα ρεύματα με κύμα ${p.wave} m` : `Dangerous currents with ${p.wave} m waves`;
    case 'boatCancel':
      return el
        ? `Κίνδυνος ακύρωσης ~${p.risk}% (άνεμος ${p.bf} Bf από ${dir(p.dir)}, κύμα ${p.wave} m)`
        : `~${p.risk}% cancellation risk (${p.bf} Bf from ${dir(p.dir)}, ${p.wave} m waves)`;
    case 'boatRough':
      return el ? `Κουνημένη διαδρομή (κύμα ${p.wave} m)` : `Bumpy crossing (${p.wave} m waves)`;
    case 'returnBoat':
      return el ? `Πλοίο επιστροφής: κίνδυνος ~${p.risk}% (κύμα ${p.wave} m)` : `Return boat: ~${p.risk}% risk (${p.wave} m waves)`;
    case 'closureRisk':
      return p.kind === 'wind'
        ? el
          ? `Πιθανό κλείσιμο: ριπές ${p.gust} km/h (όριο ~${p.limit})`
          : `May close: gusts ${p.gust} km/h (limit ~${p.limit})`
        : el
          ? `Πιθανό κλείσιμο λόγω βροχής (${p.mm} mm/ώρα)`
          : `May close due to rain (${p.mm} mm/h)`;
    case 'pleasant':
      return el ? `Ευχάριστη θερμοκρασία (${p.apparent}°C)` : `Pleasant temperature (${p.apparent}°C)`;
    case 'indoor':
      return el ? 'Εσωτερικός χώρος: προτείνεται κυρίως όταν ο καιρός έξω δεν βοηθά' : 'Indoors: suggested mainly when the weather outside is poor';
    case 'goodForBadWeather':
      return el ? 'Καλή επιλογή όσο έξω βρέχει ή καίει' : 'A good choice while it is wet or hot outside';
    case 'drive':
      return el ? `${p.min}΄ με αυτοκίνητο` : `${p.min} min by car`;
    case 'bus':
      return el ? `~${p.min}΄ με λεωφορείο` : `~${p.min} min by bus`;
    case 'trait':
      return (el ? 'Ταιριάζει: ' : 'Good fit: ') + String(p.traits).split(',').map((t) => TRAITS[t]?.[lang] ?? t).join(', ');
    case 'appeal':
      return el ? `Αξίζει την εκδρομή (${p.appeal}/8)` : `Worth the trip (${p.appeal}/8)`;
    case 'typePref':
      return el ? 'Τέτοιες δραστηριότητες ταιριάζουν στο προφίλ' : 'This kind of activity suits the profile';
    case 'opportunity':
      return el ? 'Σπάνια ευκαιρία: συνήθως έχει αέρα/κύμα, αυτή τη μέρα είναι ήρεμα' : 'Rare opportunity: usually windy or wavy, calm on this day';
    case 'dirtRoad':
      return el ? 'Χωματόδρομος' : 'Dirt road';
    case 'crowds':
      return el ? 'Πολύς κόσμος 11:00–16:00: πηγαίνετε νωρίς ή αργά' : 'Crowded 11:00–16:00: go early or late';
    case 'closed':
      return p.kind === 'tooLate'
        ? el
          ? 'Δεν προλαβαίνετε πια σήμερα'
          : 'Too late to go today'
        : el
          ? `Κλειστό εκτός σεζόν (λειτουργεί μήνες ${p.from}–${p.to})`
          : `Closed out of season (open months ${p.from}–${p.to})`;
    case 'notForProfile':
      return p.why === 'kids'
        ? el
          ? 'Δεν ενδείκνυται για μικρά παιδιά'
          : 'Not suitable for young children'
        : p.why === 'mobility'
          ? el
            ? 'Δύσκολη πρόσβαση'
            : 'Difficult access'
          : el
            ? 'Δεν εξυπηρετείται με λεωφορείο'
            : 'Not served by bus';
    default:
      return fct.key;
  }
}

const coastName = (id: string, lang: Lang) => REF_POINTS.find((r) => r.id === id)?.name[lang] ?? id;

export function takeawayText(t: { key: string; params: Record<string, string | number> }, lang: Lang): string {
  const p = t.params;
  const el = lang === 'el';
  switch (t.key) {
    case 'wind':
      return num(p.bf) <= 2
        ? el
          ? `Σχεδόν άπνοια: ${windLabel(num(p.dir), lang)} ${p.bf} Bf (~${p.kmh} km/h).`
          : `Almost no wind: ${windLabel(num(p.dir), lang)} ${p.bf} Bf (~${p.kmh} km/h).`
        : el
          ? `Άνεμος ${windLabel(num(p.dir), lang)} ${p.bf} Bf (~${p.kmh} km/h), ριπές έως ${p.gust} km/h.`
          : `${windLabel(num(p.dir), lang)} wind ${p.bf} Bf (~${p.kmh} km/h), gusts up to ${p.gust} km/h.`;
    case 'windCoast': {
      const from = p.from === '' || p.from == null ? '' : el ? ` από τις ${p.from}:00` : ` from ${p.from}:00`;
      return el
        ? `Ο άνεμος αφορά κυρίως τη ${coastName(String(p.coast), lang).toLowerCase()} ακτή: ${windLabel(num(p.dir), lang)} ${p.bf} Bf${from}· αλλού πιο ήρεμα.`
        : `The wind is mainly on the ${coastName(String(p.coast), lang).toLowerCase()} coast: ${windLabel(num(p.dir), lang)} ${p.bf} Bf${from}; calmer elsewhere.`;
    }
    case 'roughCoast':
      return el ? `${coastName(String(p.coast), lang)}: κύμα έως ${p.wave} m.` : `${coastName(String(p.coast), lang)}: waves up to ${p.wave} m.`;
    case 'calmCoasts': {
      const names = String(p.coasts).split(',').map((c) => coastName(c, lang)).join(el ? ' και ' : ' and ');
      return el ? `Ήρεμη θάλασσα: ${names}.` : `Calm sea: ${names}.`;
    }
    case 'southGusts':
      return el
        ? `Με βοριά ${p.bf} Bf πέφτουν δυνατές ριπές από τα Λευκά Όρη στη νότια ακτή (Σφακιά, Φραγκοκάστελλο).`
        : `With a ${p.bf} Bf northerly, strong gusts come down the White Mountains onto the south coast (Sfakia, Frangokastello).`;
    case 'windPicksUp':
      return el
        ? `Ο άνεμος δυναμώνει μέσα στη μέρα (${p.from} → ${p.to} km/h): οι πρωινές ώρες είναι καλύτερες για θάλασσα.`
        : `The wind builds during the day (${p.from} → ${p.to} km/h): mornings are better for the sea.`;
    case 'heat':
      return el ? `Ζέστη με αίσθηση έως ${p.apparent}°C: σκιά και νερό, φαράγγια νωρίς το πρωί.` : `Heat, feels like up to ${p.apparent}°C: shade and water, gorges early in the morning.`;
    case 'uv':
      return el ? `Υψηλός δείκτης UV (${p.uv}): αντηλιακό και καπέλο 11:00–16:00.` : `High UV index (${p.uv}): sunscreen and a hat 11:00–16:00.`;
    case 'rain':
      return el ? `Πιθανότητα βροχής έως ${p.pp}% (σύνολο ~${p.mm} mm στην πόλη).` : `Rain chance up to ${p.pp}% (~${p.mm} mm in town).`;
    case 'waveAgreement':
      return p.level === 'low'
        ? el
          ? 'Τα μοντέλα κύματος διαφωνούν αρκετά: η θάλασσα μπορεί να είναι χειρότερη απ\' ό,τι δείχνουμε.'
          : 'Wave models disagree: the sea may be rougher than shown.'
        : el
          ? 'Τα μοντέλα κύματος διαφωνούν λίγο για το ύψος του κύματος.'
          : 'Wave models differ somewhat on the wave height.';
    case 'agreement':
      return p.level === 'high'
        ? el
          ? 'Τα 5 μοντέλα συμφωνούν: υψηλή βεβαιότητα πρόγνωσης.'
          : 'All 5 models agree: high forecast confidence.'
        : p.level === 'medium'
          ? el
            ? 'Τα μοντέλα διαφωνούν λίγο: μέτρια βεβαιότητα, ελέγξτε ξανά το πρωί.'
            : 'Models differ somewhat: medium confidence, re-check in the morning.'
          : el
            ? 'Τα μοντέλα διαφωνούν αρκετά: χαμηλή βεβαιότητα, κρατήστε εναλλακτική.'
            : 'Models disagree: low confidence, keep a backup plan.';
    default:
      return '';
  }
}

export function relativeDayLabel(date: string, today: string, lang: Lang): string {
  const s = strings(lang);
  const diff = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
  const named = diff === 0 ? s.today : diff === 1 ? s.tomorrow : diff === 2 ? s.dayAfter : '';
  const fmt = new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
  const d = fmt.format(new Date(`${date}T12:00:00Z`));
  return named ? `${named} · ${d}` : d;
}

export function longDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(lang === 'el' ? 'el-GR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  );
}
