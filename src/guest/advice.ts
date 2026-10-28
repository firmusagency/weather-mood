import { haversineKm } from '../engine/geo';
import type { Factor, HourConditions, ProfileId, Spot, SpotScore } from '../engine/types';
import type { Synopsis } from '../engine/synopsis';
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

const LATER_WIND: L = {
  el: 'Από τις {from}:00 δυναμώνει {dir} {bf} Bf: φύγετε μέχρι τις {end}:00',
  en: 'From {from}:00 the {dir} wind picks up to {bf} Bf: leave by {end}:00',
  de: 'Ab {from}:00 frischt der Wind aus {dir} auf {bf} Bft auf: bis {end}:00 aufbrechen',
  fr: 'À partir de {from}:00 le vent de {dir} forcit à {bf} Bf : partez avant {end}:00',
};

const WARN: Partial<Record<Factor['key'], L>> = {
  windy: {
    el: 'Αρκετός αέρας στην παραλία ({bf} Bf)',
    en: 'Quite windy on the beach ({bf} Bf)',
    de: 'Ziemlich windig am Strand ({bf} Bft)',
    fr: 'Pas mal de vent sur la plage ({bf} Bf)',
  },
  seaRough: {
    el: 'Έχει κύμα (~{wave} m), προσοχή στο μπάνιο',
    en: 'Some waves (~{wave} m), swim with care',
    de: 'Etwas Wellengang (~{wave} m), vorsichtig baden',
    fr: 'Quelques vagues (~{wave} m), baignade prudente',
  },
  longSwell: {
    el: 'Μακρύ κύμα από ανοιχτά: η θάλασσα σπάει πιο δυνατά απ\' ό,τι φαίνεται',
    en: 'Long swell from offshore: the waves break harder than they look',
    de: 'Lange Dünung: die Wellen brechen stärker, als es aussieht',
    fr: "Houle longue du large : les vagues cassent plus fort qu'il n'y paraît",
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
  coldSwim: {
    el: 'Κρύο για μπάνιο (αίσθηση {temp}°C, νερό {sst}°C): ωραίο για βόλτα, όχι για θάλασσα',
    en: 'Too cold for swimming (feels like {temp}°C, sea {sst}°C): nice for a walk, not a beach day',
    de: 'Zu kalt zum Baden (gefühlt {temp}°C, Wasser {sst}°C): schön für einen Spaziergang, kein Strandtag',
    fr: 'Trop froid pour se baigner (ressenti {temp}°C, mer {sst}°C) : agréable pour une balade, pas pour la plage',
  },
  coolSwim: {
    el: 'Δροσερά για μπάνιο (αίσθηση {temp}°C, νερό {sst}°C): για τους τολμηρούς',
    en: 'On the cool side for swimming (feels like {temp}°C, sea {sst}°C): for the brave',
    de: 'Eher kühl zum Baden (gefühlt {temp}°C, Wasser {sst}°C): etwas für Mutige',
    fr: 'Un peu frais pour se baigner (ressenti {temp}°C, mer {sst}°C) : pour les courageux',
  },
  rainRisk: {
    el: 'Πιθανή βροχή ({pp}%): έχετε εναλλακτική για τη θάλασσα',
    en: 'Rain likely ({pp}%): keep a backup plan for the sea',
    de: 'Regen wahrscheinlich ({pp}%): Plan B fürs Meer bereithalten',
    fr: 'Pluie probable ({pp} %) : prévoyez une alternative à la mer',
  },
  rainyDay: {
    el: 'Βροχή ({pp}%): όχι μέρα για θάλασσα',
    en: 'Rain ({pp}% chance): not a day for the sea',
    de: 'Regen ({pp}%): kein Tag fürs Meer',
    fr: 'Pluie ({pp} %) : pas une journée pour la mer',
  },
  floodRisk: {
    el: 'Βροχή στα βουνά ({pp}%): κίνδυνος απότομης πλημμύρας και κλεισίματος, όχι φαράγγι',
    en: 'Rain in the mountains ({pp}%): flash-flood and closure risk, not a gorge day',
    de: 'Regen in den Bergen ({pp}%): Gefahr von Sturzfluten und Sperrung, kein Schluchttag',
    fr: 'Pluie en montagne ({pp} %) : risque de crue subite et de fermeture, pas de gorges',
  },
  closureRisk: {
    el: 'Μπορεί να κλείσει λόγω καιρού, ενημερωθείτε πριν',
    en: 'May close due to weather, check before going',
    de: 'Kann wetterbedingt schließen, vorher prüfen',
    fr: 'Peut fermer à cause de la météo, renseignez-vous',
  },
};

function candidates(sc: SpotScore, lang: GuestLang): { pos: GuestLine[]; warn?: GuestLine } {
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
  const p = warnFactor?.params;
  let warn = warnFactor
    ? { kind: 'warn' as const, text: t(WARN[warnFactor.key]!, lang, { wave: p!.wave ?? '', gust: p!.gust ?? '', pp: p!.pp ?? '', temp: p!.apparent ?? '', sst: p!.sst ?? '', bf: p!.bf ?? '' }) }
    : undefined;
  // a calm window before the wind arrives: the time to leave matters more than a mild caveat
  if (sc.laterWind && (!warnFactor || warnFactor.impact > -10)) {
    const lw = sc.laterWind;
    warn = { kind: 'warn', text: t(LATER_WIND, lang, { from: lw.fromHour, dir: compassG(lw.dir, lang), bf: lw.bf, end: Math.min(sc.window.end, lw.fromHour) }) };
  }
  return { pos, warn };
}

/** What earlier cards on the same page already said. */
export interface ReasonContext {
  seen: Set<string>;
  /** Lines that already opened a card. */
  leads: Set<string>;
}
export const newReasonContext = (): ReasonContext => ({ seen: new Set(), leads: new Set() });

/** 2–3 short lines for a card: positives first (unseen ones preferred), then the main caveat. */
export function guestReasons(sc: SpotScore, lang: GuestLang, ctx: ReasonContext = newReasonContext()): GuestLine[] {
  const { pos, warn } = candidates(sc, lang);
  const limit = warn ? 2 : 3;
  const picked = [...pos.filter((l) => !ctx.seen.has(l.text)), ...pos.filter((l) => ctx.seen.has(l.text))].slice(0, limit);
  // when every line was already used above, at least open with one that did not open another card
  const freshLead = picked.findIndex((l) => !ctx.leads.has(l.text));
  if (freshLead > 0) picked.unshift(...picked.splice(freshLead, 1));
  const out = warn ? [...picked, warn] : picked;
  for (const l of out) ctx.seen.add(l.text);
  if (out[0]) ctx.leads.add(out[0].text);
  return out;
}

/**
 * Three cards saying "rare chance" three times reads like a template: each card prefers lines
 * the cards above it have not used yet.
 */
export function dedupeReasons(scores: SpotScore[], lang: GuestLang): GuestLine[][] {
  const ctx = newReasonContext();
  return scores.map((sc) => guestReasons(sc, lang, ctx));
}

const UNSUITABLE: Record<string, L> = {
  closed: { el: 'Κλειστό αυτή την εποχή', en: 'Closed at this time of year', de: 'Zu dieser Jahreszeit geschlossen', fr: 'Fermé à cette période de l’année' },
  tooLate: { el: 'Πολύ αργά για σήμερα', en: 'Too late for today', de: 'Zu spät für heute', fr: 'Trop tard pour aujourd’hui' },
  kids: { el: 'Δύσκολο για παιδιά', en: 'Hard going for children', de: 'Schwierig für Kinder', fr: 'Difficile pour les enfants' },
  mobility: { el: 'Απαιτητική διαδρομή', en: 'A demanding route', de: 'Anspruchsvolle Strecke', fr: 'Parcours exigeant' },
  nobus: { el: 'Δεν πάει λεωφορείο', en: 'No bus goes there', de: 'Kein Bus fährt dorthin', fr: 'Aucun bus n’y va' },
};

/** A single factor as a guest sentence (warnings and "unsuitable" reasons). */
export function factorText(f: Factor | undefined, lang: GuestLang): string | undefined {
  if (!f) return undefined;
  if (f.key === 'closed') return t(f.params.kind === 'tooLate' ? UNSUITABLE.tooLate : UNSUITABLE.closed, lang);
  if (f.key === 'notForProfile') return t(UNSUITABLE[String(f.params.why)] ?? UNSUITABLE.mobility, lang);
  const tpl = WARN[f.key];
  if (!tpl) return undefined;
  const p = f.params;
  return t(tpl, lang, { wave: p.wave ?? '', gust: p.gust ?? '', pp: p.pp ?? '', temp: p.apparent ?? '', sst: p.sst ?? '', bf: p.bf ?? '' });
}

/** The main problem with a place on this day — for the "better not" list. */
export function mainProblem(sc: SpotScore, lang: GuestLang): string | undefined {
  return factorText(sc.factors.find((x) => x.impact < 0 && WARN[x.key]), lang);
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
/** UV index bands: low (≤2), moderate (3–5), high (6–7), very high (8+). */
export function uvLevel(uv: number): 0 | 1 | 2 | 3 {
  return uv <= 2 ? 0 : uv <= 5 ? 1 : uv <= 7 ? 2 : 3;
}
/** Sea temperature as felt by a swimmer: cold (<20), fresh (<23), pleasant (<26), warm. */
export function waterLevel(sst: number): 0 | 1 | 2 | 3 {
  return sst < 20 ? 0 : sst < 23 ? 1 : sst < 26 ? 2 : 3;
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

const SUMMARY: Record<'calm' | 'wind' | 'rain' | 'hot', L> = {
  calm: {
    el: 'Ελαφρύς αέρας και ήρεμη θάλασσα σχεδόν παντού: καλή μέρα και για τα πιο εκτεθειμένα μέρη.',
    en: 'Light wind and a calm sea almost everywhere: a good day even for the exposed spots.',
    de: 'Leichter Wind und fast überall ruhiges Meer: ein guter Tag auch für die exponierten Orte.',
    fr: 'Vent léger et mer calme presque partout : une bonne journée même pour les endroits exposés.',
  },
  wind: {
    el: '{word} {dir} άνεμος: η {coast} ακτή έχει κύμα, προτιμήστε προστατευμένες παραλίες.',
    en: '{word} {dir} wind: the {coast} coast is rough, prefer sheltered beaches.',
    de: '{word} {dir}-Wind: die {coast}-Küste ist rau, lieber geschützte Strände.',
    fr: 'Vent {dir} {word} : la côte {coast} est agitée, préférez les plages abritées.',
  },
  rain: {
    el: 'Πιθανή βροχή ({pp}%): κρατήστε εναλλακτική σε πόλη ή μουσείο.',
    en: 'Rain likely ({pp}%): keep a town or museum plan as backup.',
    de: 'Regen wahrscheinlich ({pp}%): Stadt oder Museum als Alternative einplanen.',
    fr: 'Pluie probable ({pp}%) : prévoyez la ville ou un musée en plan B.',
  },
  hot: {
    el: 'Ζέστη (αίσθηση {temp}°C): νερό, σκιά και νωρίς το πρωί για πεζοπορία.',
    en: 'Hot (feels like {temp}°C): water, shade, and early starts for walks.',
    de: 'Heiß (gefühlt {temp}°C): Wasser, Schatten und früh los zum Wandern.',
    fr: 'Chaud (ressenti {temp}°C) : eau, ombre et départs matinaux pour marcher.',
  },
};

const COAST_WORD: Record<'north' | 'west' | 'south', L> = {
  north: { el: 'βόρεια', en: 'north', de: 'Nord', fr: 'nord' },
  west: { el: 'δυτική', en: 'west', de: 'West', fr: 'ouest' },
  south: { el: 'νότια', en: 'south', de: 'Süd', fr: 'sud' },
};
const WIND_WORD: L[] = [
  { el: 'Σχεδόν άπνοια,', en: 'Almost no', de: 'Kaum', fr: 'presque nul' },
  { el: 'Ελαφρύς', en: 'Light', de: 'Leichter', fr: 'léger' },
  { el: 'Μέτριος', en: 'Moderate', de: 'Mäßiger', fr: 'modéré' },
  { el: 'Δυνατός', en: 'Strong', de: 'Starker', fr: 'fort' },
];

/** One sentence that explains the day, so the picks below make sense. */
export function daySummary(syn: Synopsis, lang: GuestLang): string[] {
  const out: string[] = [];
  const rough = syn.coasts.filter((c) => (c.waveMax ?? 0) >= 1.0);
  // a coast-confined blow (afternoon southerly on the west coast) counts at its peak, not the day's mean
  const wc = syn.takeaways.find((x) => x.key === 'windCoast');
  const bf = Math.max(syn.wind.bf, Number(wc?.params.bf) || 0);
  if (bf <= 2 && !rough.length) out.push(t(SUMMARY.calm, lang));
  else if (rough.length) {
    const coast = rough.sort((a, b) => (b.waveMax ?? 0) - (a.waveMax ?? 0))[0].id.replace('ref-', '') as 'north' | 'west' | 'south';
    out.push(t(SUMMARY.wind, lang, { word: t(WIND_WORD[windLevel(bf)], lang), dir: compassG(syn.wind.dir, lang), coast: t(COAST_WORD[coast] ?? COAST_WORD.north, lang) }));
  }
  if ((syn.town.rainProbMax ?? 0) >= 50) out.push(t(SUMMARY.rain, lang, { pp: syn.town.rainProbMax! }));
  if ((syn.town.apparentMax ?? 0) >= 32) out.push(t(SUMMARY.hot, lang, { temp: Math.round(syn.town.apparentMax!) }));
  return out;
}

const SHARE: Record<'via' | 'bestTime' | 'directions' | 'plan', L> = {
  via: { el: 'Πρόταση από', en: 'Tip from', de: 'Tipp von', fr: 'Conseil de' },
  bestTime: { el: 'Καλύτερη ώρα', en: 'Best time', de: 'Beste Zeit', fr: 'Meilleur moment' },
  directions: { el: 'Οδηγίες', en: 'Directions', de: 'Route', fr: 'Itinéraire' },
  plan: { el: 'Πού να πάμε', en: 'Where to go', de: 'Wohin', fr: 'Où aller' },
};

/** Plain text a guest can paste into any chat: one place, its time, the reasons and a map link. */
export function shareSpotText(spot: Spot, sc: SpotScore, lines: GuestLine[], propertyName: string, dayLabel: string, profile: ProfileId, lang: GuestLang): string {
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const out = [`${spot.name[lang === 'el' ? 'el' : 'en']} · ${dayLabel}`];
  if (sc.window.start >= 0) out.push(`${t(SHARE.bestTime, lang)}: ${pad(sc.window.start)}–${pad(sc.window.end)}`);
  for (const l of lines) out.push(`${l.kind === 'warn' ? '!' : '✓'} ${l.text}`);
  out.push(`${t(SHARE.directions, lang)}: ${mapsUrl(spot, profile)}`);
  out.push(`${t(SHARE.via, lang)} ${propertyName}`);
  return out.join('\n');
}

/** The whole day's picks as one message. */
export function sharePlanText(picks: { spot: Spot; sc: SpotScore; lines: GuestLine[] }[], propertyName: string, dayLabel: string, summary: string[], lang: GuestLang): string {
  const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;
  const out = [`${t(SHARE.plan, lang)} · ${dayLabel}`, ...summary, ''];
  picks.forEach(({ spot, sc, lines }, i) => {
    out.push(`${i + 1}. ${spot.name[lang === 'el' ? 'el' : 'en']}${sc.window.start >= 0 ? ` · ${pad(sc.window.start)}–${pad(sc.window.end)}` : ''}`);
    const why = lines.filter((l) => l.kind === 'pos').slice(0, 2).map((l) => l.text).join('; ');
    if (why) out.push(`   ${why}`);
  });
  out.push('', `${t(SHARE.via, lang)} ${propertyName}`);
  return out.join('\n');
}

export const whatsappUrl = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
