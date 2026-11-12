/*
 * One web-app manifest per property (public/manifests/<id>.webmanifest), generated before the build.
 * A guest who scans a hotel's QR and adds the page to the Home Screen must get THAT hotel's page when
 * the icon is tapped: the installed app opens the manifest's start_url, and on iPhone it does not share
 * storage with Safari, so the property has to be in the start_url itself.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** The manifest of one property; paths are relative to public/manifests/. */
export function manifestFor(property, base) {
  return {
    ...base,
    name: `${property.name} · Weather Mood`,
    short_name: property.name.length <= 14 ? property.name : base.short_name,
    start_url: `../guest.html?p=${encodeURIComponent(property.id)}&source=pwa`,
    scope: '../',
    theme_color: property.brand || base.theme_color,
    icons: base.icons.map((i) => ({ ...i, src: `../${i.src}` })),
  };
}

function main() {
  const properties = JSON.parse(readFileSync(join(root, 'src/data/properties.json'), 'utf8'));
  const base = JSON.parse(readFileSync(join(root, 'public/manifest.webmanifest'), 'utf8'));
  const dir = join(root, 'public/manifests');
  mkdirSync(dir, { recursive: true });
  for (const p of properties) writeFileSync(join(dir, `${p.id}.webmanifest`), JSON.stringify(manifestFor(p, base), null, 1));
  console.log(`manifests: ${properties.length} written to public/manifests/`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
