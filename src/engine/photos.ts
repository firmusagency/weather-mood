/*
 * Choosing a photo from Commons search results: licence first, then "looks like a landscape
 * photo of the place" (size, aspect, not a map/diagram/document), with a bonus for images
 * the Commons community has assessed as quality/featured.
 */
export interface Candidate {
  title: string;
  mime: string;
  width: number;
  height: number;
  thumbUrl: string;
  source: string;
  license: string;
  licenseUrl: string;
  author: string;
  assessments?: string;
  description?: string;
  categories?: string;
}

const ALLOWED = [/^cc0$/i, /^public domain$/i, /^cc by(-sa)? \d(\.\d)?$/i, /^cc by(-sa)? \d(\.\d)? [a-z]{2}$/i];
const BAD_WORDS = /\b(map|karte|χάρτης|plan|diagram|logo|svg|panorama|collage|sign|poster|screenshot|flag|coat of arms|stamp|ticket|chart|satellite|aerial view of the island of crete)\b/i;

export function licenseOk(license: string): boolean {
  const l = license.trim();
  return ALLOWED.some((re) => re.test(l));
}

export function scoreCandidate(c: Candidate, placeName: string): number {
  if (!licenseOk(c.license)) return -Infinity;
  if (c.mime !== 'image/jpeg') return -Infinity;
  if (c.width < 900 || c.height < 500) return -Infinity;
  const text = `${c.title} ${c.description ?? ''} ${c.categories ?? ''}`;
  if (BAD_WORDS.test(c.title) || /\b(map|diagram|logo)\b/i.test(c.description ?? '')) return -Infinity;
  let s = 0;
  const aspect = c.width / c.height;
  if (aspect >= 1.2 && aspect <= 2.1) s += 30;
  else if (aspect > 2.1) s += 5; // very wide panoramas crop badly on a phone
  else s -= 10;
  s += Math.min(20, Math.log2(c.width / 900) * 10);
  if (/featured|quality|valued/i.test(c.assessments ?? '')) s += 25;
  const name = placeName.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  if (name.some((w) => text.toLowerCase().includes(w))) s += 15;
  if (/beach|bay|lagoon|coast|sea|gorge|monastery|harbour|harbor|village|lake|view/i.test(text)) s += 5;
  return s;
}

export function pickBest(cands: Candidate[], placeName: string): Candidate | null {
  const ranked = cands.map((c) => ({ c, s: scoreCandidate(c, placeName) })).filter((x) => Number.isFinite(x.s)).sort((a, b) => b.s - a.s);
  return ranked[0]?.c ?? null;
}
