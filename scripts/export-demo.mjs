// Turns dist-single/index.html into a page fragment (title first, no html/head/body wrapper)
// suitable for publishing as a hosted demo page. Usage: npm run demo:page -- <out.html>
import { readFileSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'dist-single/weather-mood-chania.html';
const html = readFileSync('dist-single/index.html', 'utf8');
let head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
head = head.replace(/\s*<meta charset="UTF-8"\s*\/?>/, '').replace(/\s*<meta name="viewport"[^>]*>/, '');
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
head = head.replace(title, '');
writeFileSync(out, `${title}\n${head.trim()}\n${body.trim()}\n`);
console.log(`wrote ${out}`);
