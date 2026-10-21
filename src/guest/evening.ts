import { spotById } from '../data/spots';
import type { Recommendation } from '../engine/recommend';
import type { Synopsis } from '../engine/synopsis';
import type { HourConditions, ProfileId, SpotScore } from '../engine/types';
import type { PlanDiff } from '../engine/planchange';
import { daySummary, dedupeReasons, guestTips, mainProblem, seaLevel, windLevel } from './advice';
import { compassG, dayName, g, pick } from './i18n';
import type { GuestLang } from './property';

/*
 * The evening message: what a guest gets on WhatsApp / email around 18:30 for the next day,
 * and the "plan B" morning note when the forecast moved overnight. Plain text, no markup,
 * so it pastes anywhere. The same text is produced by the dashboard and by the nightly scripts.
 */

type L = Record<GuestLang, string>;
const t = (l: L, lang: GuestLang, vars: Record<string, string | number> = {}) => l[lang].replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

const T = {
  hello: { el: 'Καλησπέρα από το {property}!', en: 'Good evening from {property}!', de: 'Guten Abend von {property}!', fr: 'Bonsoir de la part de {property} !' },
  tomorrow: { el: 'Αύριο, {day}:', en: 'Tomorrow, {day}:', de: 'Morgen, {day}:', fr: 'Demain, {day} :' },
  weather: { el: '{temp}°, {wind}{dir}, θάλασσα {sea}.', en: '{temp}°, {wind}{dir}, sea {sea}.', de: '{temp}°, {wind}{dir}, Meer {sea}.', fr: '{temp}°, {wind}{dir}, mer {sea}.' },
  seaByCoast: { el: '{coast} {level}', en: '{coast} {level}', de: '{coast} {level}', fr: '{coast} {level}' },
  windCoast: { el: '{wind}{dir} στη {coast} ακτή{from}, αλλού πιο ήρεμα', en: '{wind}{dir} on the {coast} coast{from}, calmer elsewhere', de: '{wind}{dir} an der {coast}küste{from}, sonst ruhiger', fr: '{wind}{dir} sur la côte {coast}{from}, plus calme ailleurs' },
  lowConf: { el: 'Τα μοντέλα καιρού διαφωνούν για εδώ· ρίξτε μια ματιά ξανά το πρωί', en: 'The weather models disagree here; check again in the morning', de: 'Die Wettermodelle sind sich hier uneinig; morgen früh noch einmal nachsehen', fr: 'Les modèles météo divergent ici ; revérifiez demain matin' },
  fromHour: { el: ' από τις {h}:00', en: ' from {h}:00', de: ' ab {h}:00', fr: ' à partir de {h}:00' },
  forYou: { el: 'Οι προτάσεις μας για εσάς ({profile}):', en: 'Our picks for you ({profile}):', de: 'Unsere Tipps für Sie ({profile}):', fr: 'Nos conseils pour vous ({profile}) :' },
  avoid: { el: 'Καλύτερα όχι αύριο: {list}.', en: 'Better not tomorrow: {list}.', de: 'Morgen besser nicht: {list}.', fr: 'À éviter demain : {list}.' },
  bring: { el: 'Πάρτε μαζί: {list}.', en: 'Bring: {list}.', de: 'Mitnehmen: {list}.', fr: 'À emporter : {list}.' },
  planB: { el: 'Δύσκολη μέρα για εκδρομές· προτείνουμε πόλη, μουσεία ή κάτι κοντινό.', en: 'A tough day for trips; we suggest the town, museums or somewhere close by.', de: 'Ein schwieriger Tag für Ausflüge; wir empfehlen Stadt, Museen oder etwas in der Nähe.', fr: 'Journée difficile pour les excursions ; nous conseillons la ville, les musées ou un lieu proche.' },
  more: { el: 'Όλες οι προτάσεις, χάρτες και οδηγίες: {url}', en: 'All picks, maps and directions: {url}', de: 'Alle Tipps, Karten und Wegbeschreibungen: {url}', fr: 'Tous les conseils, cartes et itinéraires : {url}' },
  bye: { el: 'Καλό βράδυ! Αν αλλάξει ο καιρός, θα σας ενημερώσουμε το πρωί.', en: 'Have a good evening! If the weather changes, we will let you know in the morning.', de: 'Schönen Abend! Falls sich das Wetter ändert, melden wir uns morgen früh.', fr: 'Bonne soirée ! Si la météo change, nous vous préviendrons demain matin.' },
  // morning "plan B"
  pbHello: { el: 'Καλημέρα από το {property}! Άλλαξε λίγο ο καιρός για σήμερα.', en: 'Good morning from {property}! The weather for today has changed a little.', de: 'Guten Morgen von {property}! Das Wetter für heute hat sich etwas geändert.', fr: "Bonjour de la part de {property} ! La météo d'aujourd'hui a un peu changé." },
  pbInstead: { el: 'Αντί για {old}, σήμερα προτείνουμε {new}.', en: 'Instead of {old}, today we suggest {new}.', de: 'Statt {old} empfehlen wir heute {new}.', fr: "Au lieu de {old}, nous conseillons aujourd'hui {new}." },
  pbStill: { el: 'Το πρόγραμμα ισχύει: {list}.', en: 'The plan still holds: {list}.', de: 'Der Plan gilt weiterhin: {list}.', fr: 'Le programme reste valable : {list}.' },
  pbNow: { el: 'Σήμερα προτείνουμε: {list}.', en: 'Today we suggest: {list}.', de: 'Heute empfehlen wir: {list}.', fr: "Aujourd'hui nous conseillons : {list}." },
  pbWindUp: { el: 'Ο αέρας δυνάμωσε ({from}→{to} Bf).', en: 'The wind picked up ({from}→{to} Bf).', de: 'Der Wind hat zugenommen ({from}→{to} Bft).', fr: 'Le vent a forci ({from}→{to} Bf).' },
  pbRain: { el: 'Πιθανότητα βροχής {pp}%.', en: 'Rain chance {pp}%.', de: 'Regenwahrscheinlichkeit {pp}%.', fr: 'Risque de pluie {pp} %.' },
  pbSea: { el: 'Η θάλασσα έχει κύμα ({coast}).', en: 'The sea is rough ({coast} coast).', de: 'Das Meer ist rau ({coast}).', fr: 'La mer est agitée (côte {coast}).' },
  pbDrop: { el: '{spot}: καλύτερα όχι σήμερα ({why}).', en: '{spot}: better not today ({why}).', de: '{spot}: heute besser nicht ({why}).', fr: "{spot} : à éviter aujourd'hui ({why})." },
  // guest request to the hotel
  askMsg: { el: 'Γεια σας! Θα ήθελα το βραδινό μήνυμα με τις προτάσεις για αύριο.', en: 'Hello! I would like the evening message with tomorrow’s picks.', de: 'Hallo! Ich hätte gern die Abendnachricht mit den Tipps für morgen.', fr: "Bonjour ! J'aimerais recevoir le message du soir avec les conseils pour demain." },
} satisfies Record<string, L>;

const WIND: L[] = [
  { el: 'σχεδόν άπνοια', en: 'almost no wind', de: 'kaum Wind', fr: 'presque pas de vent' },
  { el: 'ελαφρύς αέρας', en: 'light wind', de: 'leichter Wind', fr: 'vent léger' },
  { el: 'μέτριος αέρας', en: 'moderate wind', de: 'mäßiger Wind', fr: 'vent modéré' },
  { el: 'δυνατός αέρας', en: 'strong wind', de: 'starker Wind', fr: 'vent fort' },
];
const FROM: L = { el: ' ', en: ' from the ', de: ' aus ', fr: ' de ' };

const COAST: Record<string, L> = {
  'ref-north': { el: 'βόρεια', en: 'north', de: 'Nord', fr: 'nord' },
  'ref-west': { el: 'δυτική', en: 'west', de: 'West', fr: 'ouest' },
  'ref-south': { el: 'νότια', en: 'south', de: 'Süd', fr: 'sud' },
};

const pad = (h: number) => `${String(h).padStart(2, '0')}:00`;

export interface EveningInput {
  rec: Recommendation;
  syn: Synopsis;
  scores: Record<string, SpotScore>;
  conditions: Record<string, HourConditions[]>;
}

/** One-line weather summary used at the top of the evening message. */
export function weatherLine(syn: Synopsis, lang: GuestLang): string {
  const d = g(lang);
  const levels = syn.coasts.map((c) => ({ id: c.id, lvl: seaLevel(c.waveMax ?? 0) }));
  const same = levels.every((x) => x.lvl === levels[0]?.lvl);
  // one word when every coast is alike, otherwise coast by coast so "calm" and "rough" don't collide
  const sea = same ? d.seaWords[levels[0]?.lvl ?? 0] : levels.map((x) => t(T.seaByCoast, lang, { coast: t(COAST[x.id] ?? COAST['ref-north'], lang), level: d.seaWords[x.lvl] })).join(', ');
  const dir = syn.wind.bf >= 2 ? `${t(FROM, lang)}${compassG(syn.wind.dir, lang)}` : '';
  // wind confined to one coast (e.g. a southerly on the west coast from 14:00): say where and when
  const wc = syn.takeaways.find((x) => x.key === 'windCoast');
  const wind = wc
    ? t(T.windCoast, lang, { wind: t(WIND[windLevel(Number(wc.params.bf) || syn.wind.bf)], lang), dir, coast: t(COAST[String(wc.params.coast)] ?? COAST['ref-north'], lang), from: wc.params.from === '' ? '' : t(T.fromHour, lang, { h: wc.params.from }) })
    : `${t(WIND[windLevel(syn.wind.bf)], lang)}${dir}`;
  return t(T.weather, lang, { temp: syn.town.tMax == null ? '–' : Math.round(syn.town.tMax), wind, dir: wc ? '' : '', sea });
}

export function eveningMessage(input: EveningInput, property: { name: string; guestUrl: string }, profile: ProfileId, lang: GuestLang): string {
  const { rec, syn, scores, conditions } = input;
  const d = g(lang);
  const out: string[] = [t(T.hello, lang, { property: property.name }), t(T.tomorrow, lang, { day: dayName(syn.date, lang) }), weatherLine(syn, lang)];
  const summary = daySummary(syn, lang);
  if (summary.length) out.push(summary.join(' '));
  out.push('');
  if (rec.badWeatherDay) out.push(t(T.planB, lang));
  out.push(t(T.forYou, lang, { profile: d.profiles[profile] }));
  const lines = dedupeReasons(rec.top, lang);
  rec.top.forEach((sc, i) => {
    const spot = spotById(sc.spotId)!;
    out.push(`${i + 1}. ${pick(spot.name, lang)} · ${pad(sc.window.start)}–${pad(sc.window.end)}`);
    const why = lines[i].find((l) => l.kind === 'pos');
    const warn = lines[i].find((l) => l.kind === 'warn');
    if (why) out.push(`   ✓ ${why.text}`);
    if (warn) out.push(`   ! ${warn.text}`);
    else if (sc.confidence === 'low') out.push(`   ! ${t(T.lowConf, lang)}`);
  });
  if (rec.avoid.length) {
    const list = rec.avoid.slice(0, 3).map((sc) => {
      const why = mainProblem(sc, lang);
      return `${pick(spotById(sc.spotId)!.name, lang)}${why ? ` (${why.toLowerCase()})` : ''}`;
    });
    out.push('', t(T.avoid, lang, { list: list.join(', ') }));
  }
  const first = rec.top[0];
  if (first) {
    const tips = guestTips(spotById(first.spotId)!, scores[first.spotId], conditions[first.spotId] ?? [], lang).slice(0, 3);
    if (tips.length) out.push(t(T.bring, lang, { list: tips.map((x) => x.toLowerCase()).join(', ') }));
  }
  out.push('', t(T.more, lang, { url: property.guestUrl }), t(T.bye, lang));
  return out.join('\n');
}

/** Morning note when the overnight forecast moved: what changed and what to do instead. */
export function planBMessage(diff: PlanDiff, property: { name: string; guestUrl: string }, lang: GuestLang): string {
  const name = (id: string) => pick(spotById(id)!.name, lang);
  const out: string[] = [t(T.pbHello, lang, { property: property.name })];
  const reasons: string[] = [];
  for (const c of diff.changes) {
    if (c.kind === 'windUp') reasons.push(t(T.pbWindUp, lang, c.params));
    if (c.kind === 'rainUp') reasons.push(t(T.pbRain, lang, c.params));
  }
  const roughCoasts = diff.changes.filter((c) => c.kind === 'seaUp').map((c) => t(COAST[String(c.params.coast)] ?? COAST['ref-north'], lang));
  if (roughCoasts.length) reasons.push(t(T.pbSea, lang, { coast: roughCoasts.join(', ') }));
  if (reasons.length) out.push(reasons.join(' '));
  const dropped = diff.changes.filter((c) => c.kind === 'pickDropped' || c.kind === 'pickDowngraded').map((c) => String(c.params.spot));
  const keep = diff.before.picks.map((p) => p.spotId).filter((id) => !dropped.includes(id) && diff.after.picks.some((p) => p.spotId === id));
  const fresh = diff.after.picks.map((p) => p.spotId).filter((id) => !diff.before.picks.some((p) => p.spotId === id));
  if (dropped.length && fresh.length) out.push(t(T.pbInstead, lang, { old: dropped.map(name).join(', '), new: fresh.map(name).join(', ') }));
  else if (dropped.length) {
    for (const id of dropped) {
      const why = diff.changes.find((c) => String(c.params.spot) === id);
      out.push(t(T.pbDrop, lang, { spot: name(id), why: why?.kind === 'pickDowngraded' ? String(why.params.to) : '' }).replace(' ()', ''));
    }
  }
  if (keep.length && dropped.length) out.push(t(T.pbStill, lang, { list: keep.map(name).join(', ') }));
  if (!dropped.length) out.push(t(T.pbNow, lang, { list: diff.after.picks.map((p) => `${name(p.spotId)} ${pad(p.window.start)}–${pad(p.window.end)}`).join(', ') }));
  out.push('', t(T.more, lang, { url: property.guestUrl }));
  return out.join('\n');
}

/** Pre-filled text for the guest's "send me the evening message" WhatsApp request to the hotel. */
export const askEveningText = (lang: GuestLang) => t(T.askMsg, lang);

export const whatsappTo = (phone: string | undefined, text: string) => `https://wa.me/${(phone ?? '').replace(/[^\d]/g, '')}?text=${encodeURIComponent(text)}`;
export const mailtoUrl = (subject: string, body: string) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
