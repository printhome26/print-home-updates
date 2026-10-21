// Baut journal/feed.json aus Metricool-Exporten (Instagram + Pinterest) und lädt die Bilder ins Repo.
// Eingabe: journal/raw/instagram.json  -> Zeilen [date, text, imageUrl, postUrl, type]
//          journal/raw/pinterest.json  -> Zeilen [date, title, description, imageUrl, pinUrl]
// Die Metricool-Antwort wird als {"rows": [...]} oder als Rohtext mit JSON gespeichert.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RAW = path.join(ROOT, 'journal/raw');
const IMG = path.join(ROOT, 'journal/img');
const OUT = path.join(ROOT, 'journal/feed.json');

async function loadRows(file) {
  if (!existsSync(file)) return [];
  const t = await readFile(file, 'utf8');
  const j = JSON.parse(t.slice(t.indexOf('{')));
  return j.rows || [];
}
const iso = (d) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

async function fetchImage(url, id) {
  const ext = /\.png(\?|$)/i.test(url) ? 'png' : 'jpg';
  const name = `${id}.${ext}`;
  const dest = path.join(IMG, name);
  if (!existsSync(dest)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Bild ${res.status}: ${url.slice(0, 80)}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  }
  return `journal/img/${name}`;
}

const items = [];
for (const r of await loadRows(path.join(RAW, 'instagram.json'))) {
  const [date, text, img, url] = r;
  const id = 'ig-' + createHash('sha1').update(url).digest('hex').slice(0, 12);
  items.push({ id, source: 'instagram', date: iso(date), title: '', text: text || '', url, image: img ? await fetchImage(img, id) : null });
}
for (const r of await loadRows(path.join(RAW, 'pinterest.json'))) {
  const [date, title, desc, img, url] = r;
  const id = 'pin-' + createHash('sha1').update(url).digest('hex').slice(0, 12);
  items.push({ id, source: 'pinterest', date: iso(date), title: title || '', text: desc || '', url, image: img ? await fetchImage(img, id) : null });
}
items.sort((a, b) => b.date.localeCompare(a.date));
await mkdir(IMG, { recursive: true });
await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), items }, null, 1) + '\n');
console.log('feed items:', items.length);
