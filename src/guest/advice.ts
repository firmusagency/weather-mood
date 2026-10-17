import { haversineKm } from '../engine/geo';
import type { Factor, HourConditions, ProfileId, Spot, SpotScore } from '../engine/types';
import type { GuestLang } from './property';
import { compassG } from './i18n';

/*
 * Turns the engine's factors into short, plain sentences for guests: no scores, no jargon.
 * Staff see the full numbers in the dashboard; guests see "why now" and "what to bring".
 */

export interface GuestLine {
  kind: 'pos' | 'warn';
  text: string;
}

type L = Record<GuestLang, string>;
const t = (l: L, lang: GuestLang, vars: Record<string, string | number> = {}) => l[lang].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

const POS: Partial<Record<Factor['key'], L>> = {
  opportunity: {
    el: 'Εδώ συνήθως έχει αέρα· αυτή τη μέρα είναι ήρεμα, σπάνια ευκαιρία',
    en: 'Usually windy here; calm on this day, a rare chance',
    de: 'Hier ist es meist windig; an diesem Tag ruhig, eine seltene Gelegenheit',
    fr: "D'habitude venté ici ; calme ce jour-là, une occasion rare",
  },
  sheltered: {
    el: 'Προστατευμένο από τον αέρα ({dir})',
    en: 'Sheltered from the {dir} wind',
    de: 'Geschützt vor dem Wind aus {dir}',
    fr: 'Abrité du vent de {dir}',
  },
  seaCalm: {
    el: 'Ήρεμη θάλασσα, ιδανική για μπάνιο',
    en: 'Calm sea, ideal for swimming',
    de: 'Ruhiges Meer, ideal zum Baden',
    fr: 'Mer calme, idéale pour la baignade',
  },
  offshoreWind: {
    el: 'Ήρεμα νερά κοντά στην ακτή',
    en: 'Calm water close to the shore',
    de: 'Ruhiges Wasser nah am Ufer',
    fr: 'Eau calme près du rivage',
  },
  goodForBadWeather: {
    el: 'Καλή επιλογή όσο έξω βρέχει ή καίει',
    en: 'A good choice while it is wet or hot outside',
    de: 'Gute Wahl, wenn es draußen nass oder heiß ist',
    fr: 'Un bon choix quand il pleut ou fait très chaud',
  },
  pleasant: {
    el: 'Ευχάριστη θερμοκρασία ({temp}°C)',
    en: 'Pleasant temperature ({temp}°C)',
    de: 'Angenehme Temperatur ({temp}°C)',
    fr: 'Température agréable ({temp}°C)',
  },
};

const TRAITS: Record<string, L> = {
  kidFriendly: { el: 'Ιδανικό για παιδιά', en: 'Great for kids', de: 'Ideal für Kinder', fr: 'Idéal pour les enfants' },
  shallow: { el: 'Ρηχά νερά', en: 'Shallow water', de: 'Flaches Wasser', fr: 'Eau peu profonde' },
  facilities: { el: 'Ξαπλώστρες, φαγητό, τουαλέτες', en: 'Sunbeds, food and toilets', de: 'Liegen, Essen und Toiletten', fr: 'Transats, restauration, toilettes' },
  shade: { el: 'Υπάρχει σκιά', en: 'Shade available', de: 'Schatten vorhanden', fr: "De l'ombre sur place" },
  easyAccess: { el: 'Εύκολη πρόσβαση', en: 'Easy access', de: 'Leicht zugänglich', fr: 'Accès facile' },
  scenic: { el: 'Εντυπωσιακό τοπίο', en: 'Stunning scenery', de: 'Atemberaubende Landschaft', fr: 'Paysage spectaculaire' },
  sunset: { el: 'Υπέροχο ηλιοβασίλεμα', en: 'Beautiful sunset', de: 'Schöner Sonnenuntergang', fr: 'Superbe coucher de soleil' },
  snorkeling: { el: 'Καλό για snorkeling', en: 'Good snorkelling', de: 'Gut zum Schnorcheln', fr: 'Bon spot de snorkeling' },
  bus: { el: 'Φτάνει λεωφορείο', en: 'Reachable by bus', de: 'Mit dem Bus erreichbar', fr: 'Accessible en bus' },
  hiking: { el: 'Ωραία πεζοπορία', en: 'A great hike', de: 'Eine tolle Wanderung', fr: 'Une belle randonnée' },
};

const WARN: Partial<Record<Factor['key'], L>> = {
  seaRough: {
    el: 'Έχει κύμα (~{wave} m), προσοχή στο μπάνιο',
    en: 'Some waves (~{wave} m), swim with care',
    de: 'Etwas Wellengang (~{wave} m), vorsichtig baden',
    fr: 'Quelques vagues (~{wave} m), baignade prudente',
  },
  onshoreWind: {
    el: 'Ο αέρας φυσάει προς την παραλία',
    en: 'The wind blows onto the beach',
    de: 'Der Wind weht auf den Strand',
    fr: 'Le vent souffle vers la plage',
  },
  gusts: { el: 'Ριπές αέρα έως {gust} km/h', en: 'Gusts up to {gust} km/h', de: 'Böen bis {gust} km/h', fr: "Rafales jusqu'à {gust} km/h" },
  downslopeGusts: {
    el: 'Δυνατές ριπές από τα βουνά',
    en: 'Strong gusts coming down the mountains',
    de: 'Starke Fallböen von den Bergen',
    fr: 'Fortes rafales descendant des montagnes',
  },
  rain: { el: 'Πιθανότητα βροχής {pp}%', en: '{pp}% chance of rain', de: '{pp}% Regenrisiko', fr: '{pp}% de risque de pluie' },
  thunder: { el: 'Πιθανές καταιγίδες', en: 'Thunderstorms possible', de: 'Gewitter möglich', fr: 'Orages possibles' },
  heat: {
    el: 'Ζέστη (αίσθηση {temp}°C): νερό και σκιά',
    en: 'Hot (feels like {temp}°C): water and shade',
    de: 'Heiß (gefühlt {temp}°C): Wasser und Schatten',
    fr: 'Chaud (ressenti {temp}°C) : eau et ombre',
  },
  cool: {
    el: 'Λίγο δροσερά για μπάνιο ({temp}°C)',
    en: 'A bit cool for swimming ({temp}°C)',
    de: 'Etwas kühl zum Baden ({temp}°C)',
    fr: 'Un peu frais pour se baigner ({temp}°C)',
  },
  cold: { el: 'Κρύο (αίσθηση {temp}°C)', en: 'Chilly (feels like {temp}°C)', de: 'Kühl (gefühlt {temp}°C)', fr: 'Frais (ressenti {temp}°C)' },
  coldWater: { el: 'Θάλασσα {sst}°C', en: 'Sea at {sst}°C', de: 'Wasser {sst}°C', fr: 'Mer à {sst}°C' },
  cloudy: { el: 'Αρκετή συννεφιά', en: 'Mostly cloudy', de: 'Überwiegend bewölkt', fr: 'Plutôt nuageux' },
  ripCurrents: {
    el: 'Με κύμα δημιουργούνται επικίνδυνα ρεύματα, προσέξτε τις σημαίες',
    en: 'Waves can cause dangerous currents, watch the flags',
    de: 'Wellen können gefährliche Strömungen bilden, Flaggen beachten',
    fr: 'Les vagues peuvent créer des courants dangereux, surveillez les drapeaux',
  },
  boatCancel: {
    el: 'Το καραβάκι μπορεί να ακυρωθεί, ρωτήστε πριν ξεκινήσετε',
    en: 'The boat may be cancelled, check before you go',
    de: 'Das Boot kann ausfallen, vorher nachfragen',
    fr: 'Le bateau peut être annulé, vérifiez avant de partir',
  },
  boatRough: { el: 'Η θάλασσα θα κουνάει λίγο', en: 'A slightly bumpy crossing', de: 'Etwas unruhige Überfahrt', fr: 'Traversée un peu agitée' },
  returnBoat: {
    el: 'Ελέγξτε το πλοίο της επιστροφής',
    en: 'Check the return boat',
    de: 'Rückfahrt mit dem Boot prüfen',
    fr: 'Vérifiez le bateau du retour',
  },
  closureRisk: {
    el: 'Μπορεί να κλείσει λόγω καιρού, ενημερωθείτε πριν',
    en: 'May close due to weather, check before going',
    de: 'Kann wetterbedingt schließen, vorher prüfen',
    fr: 'Peut fermer à cause de la météo, renseignez-vous',
  },
};

export function guestReasons(sc: SpotScore, lang: GuestLang): GuestLine[] {
  const pos: GuestLine[] = [];
  const all = [...sc.fit.filter((f) => f.key === 'opportunity'), ...sc.factors.filter((f) => f.impact > 0), ...sc.fit.filter((f) => f.key === 'goodForBadWeather')];
  for (const f of all) {
    const tpl = POS[f.key];
    if (!tpl) continue;
    pos.push({ kind: 'pos', text: t(tpl, lang, { dir: f.params.dir != null ? compassG(Number(f.params.dir), lang) : '', temp: f.params.apparent ?? '' }) });
  }
  const traits = String(sc.fit.find((f) => f.key === 'trait')?.params.traits ?? '')
    .split(',')
    .filter((x) => TRAITS[x]);
  for (const tr of traits) pos.push({ kind: 'pos', text: TRAITS[tr][lang] });

  const warnFactor = sc.factors.find((f) => f.impact <= -5 && WARN[f.key]);
  const out = pos.slice(0, warnFactor ? 2 : 3);
  if (warnFactor) {
    const p = warnFactor.params;
    out.push({ kind: 'warn', text: t(WARN[warnFactor.key]!, lang, { wave: p.wave ?? '', gust: p.gust ?? '', pp: p.pp ?? '', temp: p.apparent ?? '', sst: p.sst ?? '' }) });
  }
  return out;
}

/** The main problem with a place on this day — for the "better not" list. */
export function mainProblem(sc: SpotScore, lang: GuestLang): string | undefined {
  const f = sc.factors.find((x) => x.impact < 0 && WARN[x.key]);
  if (!f) return undefined;
  const p = f.params;
  return t(WARN[f.key]!, lang, { wave: p.wave ?? '', gust: p.gust ?? '', pp: p.pp ?? '', temp: p.apparent ?? '', sst: p.sst ?? '' });
}

const TIPS: Record<string, L> = {
  sunscreen: { el: 'Αντηλιακό και καπέλο', en: 'Sunscreen and a hat', de: 'Sonnencreme und Hut', fr: 'Crème solaire et chapeau' },
  water: { el: 'Αρκετό νερό', en: 'Plenty of water', de: 'Genug Wasser', fr: "Beaucoup d'eau" },
  shoes: { el: 'Κλειστά παπούτσια πεζοπορίας', en: 'Proper walking shoes', de: 'Feste Wanderschuhe', fr: 'De bonnes chaussures de marche' },
  jacket: { el: 'Ελαφρύ μπουφάν', en: 'A light jacket', de: 'Eine leichte Jacke', fr: 'Une veste légère' },
  raincoat: { el: 'Αδιάβροχο', en: 'A rain jacket', de: 'Eine Regenjacke', fr: 'Un imperméable' },
  seasick: { el: 'Κάτι για τη ναυτία', en: 'Something for seasickness', de: 'Etwas gegen Seekrankheit', fr: 'Un remède contre le mal de mer' },
  windbreak: { el: 'Η ομπρέλα ίσως δεν κρατάει με τον αέρα', en: 'Umbrellas may not hold in the wind', de: 'Sonnenschirme halten im Wind evtl. nicht', fr: 'Les parasols risquent de ne pas tenir au vent' },
  dirtRoad: { el: 'Χωματόδρομος: οδηγήστε αργά', en: 'Dirt road: drive slowly', de: 'Schotterpiste: langsam fahren', fr: 'Piste en terre : roulez doucement' },
  early: { el: 'Πηγαίνετε νωρίς, έχει πολύ κόσμο το μεσημέρι', en: 'Go early, it gets crowded at midday', de: 'Früh hinfahren, mittags ist es voll', fr: 'Allez-y tôt, il y a foule à midi' },
  snorkel: { el: 'Μάσκα για snorkeling', en: 'A snorkel mask', de: 'Eine Schnorchelmaske', fr: 'Un masque de snorkeling' },
  boatTimes: { el: 'Ελέγξτε τα δρομολόγια του πλοίου', en: 'Check the boat timetable', de: 'Fahrplan des Bootes prüfen', fr: 'Vérifiez les horaires du bateau' },
  cash: { el: 'Μετρητά για parking/είσοδο', en: 'Cash for parking or entry', de: 'Bargeld für Parken oder Eintritt', fr: 'Espèces pour parking ou entrée' },
};

export function guestTips(spot: Spot, sc: SpotScore, conds: HourConditions[], lang: GuestLang): string[] {
  const w = conds.filter((c) => c.hour >= sc.window.start && c.hour < sc.window.end);
  const max = (f: (c: HourConditions) => number | null | undefined) => Math.max(-Infinity, ...w.map((c) => f(c) ?? -Infinity));
  const min = (f: (c: HourConditions) => number | null | undefined) => Math.min(Infinity, ...w.map((c) => f(c) ?? Infinity));
  const outdoor = spot.type !== 'museum';
  const keys: string[] = [];
  if (outdoor && max((c) => c.uv) >= 6) keys.push('sunscreen');
  if (spot.type === 'gorge' || spot.type === 'hike') keys.push('shoes', 'water');
  else if (outdoor && max((c) => c.apparent) >= 30) keys.push('water');
  if (spot.type === 'boat' && max((c) => c.sea?.offshoreWave) >= 0.7) keys.push('seasick');
  if (spot.access.boatRequired && spot.type !== 'boat') keys.push('boatTimes');
  if (spot.type === 'beach' && max((c) => c.effectiveGust) >= 35) keys.push('windbreak');
  if (max((c) => c.precipProb) >= 40) keys.push('raincoat');
  if (outdoor && min((c) => c.apparent) < 20) keys.push('jacket');
  if (spot.traits.snorkeling && max((c) => c.sea?.effectiveWave) < 0.4) keys.push('snorkel');
  if (spot.access.dirtRoad) keys.push('dirtRoad', 'cash');
  if (spot.traits.crowded) keys.push('early');
  return [...new Set(keys)].slice(0, 5).map((k) => TIPS[k][lang]);
}

export function seaLevel(wave: number): 0 | 1 | 2 | 3 {
  return wave < 0.3 ? 0 : wave < 0.6 ? 1 : wave < 1.0 ? 2 : 3;
}
export function windLevel(bf: number): 0 | 1 | 2 | 3 {
  return bf <= 1 ? 0 : bf <= 3 ? 1 : bf <= 5 ? 2 : 3;
}

export function travelLabel(spot: Spot, sc: SpotScore, base: { lat: number; lon: number }, profile: ProfileId, words: { byCar: string; byBus: string; onFoot: string }, lang: GuestLang) {
  const walk = haversineKm(base.lat, base.lon, spot.lat, spot.lon) < 1.5;
  const mode = walk ? words.onFoot : profile === 'nocar' ? words.byBus : words.byCar;
  const m = sc.travelMinutes;
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const time = lang === 'el' ? (h ? `${h} ώρα ${mm}΄` : `${m}΄`) : h ? `${h} h ${mm}` : `${m} min`;
  return `${time} ${mode}`;
}

export function mapsUrl(spot: Spot, profile: ProfileId) {
  const mode = profile === 'nocar' ? '&travelmode=transit' : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lon}${mode}`;
}
