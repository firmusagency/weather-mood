/*
 * Picks one freely licensed photo per spot from Wikimedia Commons, downloads a 1200 px copy to
 * public/photos/<spot>.jpg and records the credit in src/data/photos.json.
 *
 * Only CC BY, CC BY-SA, CC0 and public-domain images are accepted; the author and licence are
 * stored and shown next to every photo. Entries marked `locked: true` are never replaced
 * (use that for the property's own pictures).
 *
 * Usage: npm run photos                 # all spots without a photo
 *        npm run photos -- --all        # re-pick every unlocked spot
 *        npm run photos -- falasarna    # one spot
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPOTS } from '../src/data/spots';
import { PHOTO_QUERIES } from '../src/data/photo-queries';
import type { Photo } from '../src/data/photos';
import { pickBest, type Candidate } from '../src/engine/photos';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = join(root, 'src/data/photos.json');
const OUT_DIR = join(root, 'public/photos');
const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'weather-mood-photos/1.0 (https://github.com/firmusagency/weather-mood)';

interface ApiPage {
  title: string;
  imageinfo?: {
    url: string;
    thumburl?: string;
    thumbwidth?: number;
    thumbheight?: number;
    descriptionurl: string;
    mime: string;
    width: number;
    height: number;
    extmetadata?: Record<string, { value: string }>;
  }[];
}

async function search(term: string): Promise<Candidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `${term} filetype:bitmap`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1200',
  });
  const res = await fetch(`${API}?${params}`, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`commons ${res.status}`);
  const json = (await res.json()) as { query?: { pages?: Record<string, ApiPage> } };
  const pages = Object.values(json.query?.pages ?? {});
  const strip = (html: string | undefined) => (html ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return pages.flatMap((p): Candidate[] => {
    const ii = p.imageinfo?.[0];
    if (!ii || !ii.thumburl) return [];
    const m = ii.extmetadata ?? {};
    return [
      {
        title: p.title,
        mime: ii.mime,
        width: ii.width,
        height: ii.height,
        thumbUrl: ii.thumburl,
        source: ii.descriptionurl,
        license: strip(m.LicenseShortName?.value),
        licenseUrl: strip(m.LicenseUrl?.value),
        author: strip(m.Artist?.value) || strip(m.Credit?.value) || 'Wikimedia Commons',
        assessments: strip(m.Assessments?.value),
        description: strip(m.ImageDescription?.value),
        categories: strip(m.Categories?.value),
      },
    ];
  });
}

async function download(url: string, file: string) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes('--all');
  const only = args.filter((a) => !a.startsWith('--'));
  const photos: Record<string, Photo> = existsSync(JSON_PATH) ? JSON.parse(readFileSync(JSON_PATH, 'utf8')) : {};
  mkdirSync(OUT_DIR, { recursive: true });

  for (const spot of SPOTS) {
    if (only.length && !only.includes(spot.id)) continue;
    const current = photos[spot.id];
    if (current?.locked) continue;
    if (current && !all && existsSync(join(root, 'public', current.file))) continue;
    const terms = PHOTO_QUERIES[spot.id] ?? [spot.name.en];
    let chosen: Candidate | null = null;
    for (const term of terms) {
      try {
        const cands = await search(term);
        chosen = pickBest(cands, spot.name.en);
      } catch (e) {
        console.warn(`${spot.id}: "${term}" failed: ${(e as Error).message}`);
      }
      if (chosen) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!chosen) {
      console.log(`${spot.id}: no usable photo found (${terms.join(' / ')})`);
      continue;
    }
    const file = `photos/${spot.id}.jpg`;
    await download(chosen.thumbUrl, join(root, 'public', file));
    photos[spot.id] = {
      file,
      remote: chosen.thumbUrl,
      title: chosen.title.replace(/^File:/, ''),
      author: chosen.author.slice(0, 80),
      license: chosen.license,
      licenseUrl: chosen.licenseUrl,
      source: chosen.source,
      width: chosen.width,
      height: chosen.height,
    };
    console.log(`${spot.id}: ${photos[spot.id].title} · ${chosen.author} · ${chosen.license}`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const sorted = Object.fromEntries(Object.entries(photos).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(JSON_PATH, JSON.stringify(sorted, null, 1) + '\n');
  console.log(`${Object.keys(sorted).length}/${SPOTS.length} spots have a photo`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
