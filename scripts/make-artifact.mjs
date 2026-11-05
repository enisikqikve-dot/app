// Turns the single-file build (dist-artifact/index.html) into a page body for
// hosting as a claude.ai artifact: the host adds its own <html>, <head> and
// <body>, so we keep only the title, meta tags, font links, styles, the app
// container and the inlined script.
//
// Usage: node scripts/make-artifact.mjs [output-file]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const input = 'dist-artifact/index.html';
const output = process.argv[2] ?? 'artifact/eNis.html';
const html = readFileSync(input, 'utf8');

const pick = (re) => html.match(re)?.[0] ?? '';
const all = (re) => [...html.matchAll(re)].map((m) => m[0]);

const title = pick(/<title>[\s\S]*?<\/title>/);
const metas = all(/<meta\b[^>]*>/g).filter((m) => /name="(claude:viewport-fit-sides|description)"/.test(m));
const links = all(/<link\b[\s\S]*?>/g).filter((l) => /fonts\.(googleapis|gstatic)\.com/.test(l));
const styles = all(/<style\b[\s\S]*?<\/style>/g);
const scripts = all(/<script\b[\s\S]*?<\/script>/g);
const body = (html.match(/<body[^>]*>([\s\S]*?)<\/body>/)?.[1] ?? '').replace(/<script\b[\s\S]*?<\/script>/g, '').trim();

if (!title || scripts.length === 0 || !body.includes('id="app"')) {
  throw new Error('Unexpected build output: missing title, script or #app');
}

const page = [title, ...metas, ...links, ...styles, body, ...scripts].join('\n');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, page + '\n');
console.log(`Wrote ${output} (${(page.length / 1024).toFixed(0)} KB)`);
