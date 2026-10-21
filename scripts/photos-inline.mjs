// Small (720 px, ~50 KB) JPEG copies of the spot photos as data URIs, for the single-file demo
// pages, whose sandbox blocks images from other hosts. Output: src/data/photos-inline.json.
// Needs ImageMagick (`convert`), present on GitHub runners and most dev machines.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const photos = JSON.parse(readFileSync('src/data/photos.json', 'utf8'));
const out = {};
for (const [id, p] of Object.entries(photos)) {
  if (!p.file || !existsSync(`public/${p.file}`)) continue;
  const jpg = execFileSync('convert', [`public/${p.file}`, '-auto-orient', '-resize', '720x720>', '-strip', '-interlace', 'Plane', '-quality', '72', 'jpg:-'], { maxBuffer: 64 * 1024 * 1024 });
  out[id] = `data:image/jpeg;base64,${jpg.toString('base64')}`;
}
writeFileSync('src/data/photos-inline.json', JSON.stringify(out) + '\n');
const kb = Math.round(Object.values(out).reduce((s, v) => s + v.length, 0) / 1024);
console.log(`${Object.keys(out).length} inline photos, ${kb} KB`);
