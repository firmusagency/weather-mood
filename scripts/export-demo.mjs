// Turns a single-file build (dist-single/<page>.html) into a page fragment — title first,
// no html/head/body wrapper — suitable for publishing as a hosted demo page.
// Usage: node scripts/export-demo.mjs [index|guest] [out.html]
import { readFileSync, writeFileSync } from 'node:fs';

const page = process.argv[2] ?? 'index';
const out = process.argv[3] ?? `dist-single/demo-${page}.html`;
const html = readFileSync(`dist-single/${page}.html`, 'utf8');
let head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
head = head.replace(/\s*<meta charset="UTF-8"\s*\/?>/, '').replace(/\s*<meta name="viewport"[^>]*>/, '');
const title = head.match(/<title>[\s\S]*?<\/title>/)[0];
head = head.replace(title, '');
writeFileSync(out, `${title}\n${head.trim()}\n${body.trim()}\n`);
console.log(`wrote ${out}`);
