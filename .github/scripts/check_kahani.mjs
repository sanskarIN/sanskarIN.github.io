import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '_site');
const pages = ['Kahani/index.html', 'About-Kahani-Videos/index.html'];
const read = (name) => readFile(path.join(root, name), 'utf8');
for (const name of pages) {
  const html = await read(name);
  assert.match(html, /<html lang="hi"/u, `${name}: Hindi page language`);
  assert.match(html, /Kahani by Ram Sandesh/u, `${name}: author credit`);
  assert.match(html, /<meta name="author" content="Ram Sandesh"/u, `${name}: author metadata`);
  assert.equal([...html.matchAll(/<h1(?:\s|>)/gu)].length, 1, `${name}: one primary heading`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/gu)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${name}: unique anchors`);
  assert.doesNotMatch(html, /<iframe\b|youtube\.com\/@KisseByRamSandesh/u, `${name}: no unverified channel/player`);
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)(?:[^" ]*)"/gu)) {
    await access(path.join(root, decodeURIComponent(match[1])));
  }
  assert.match(html, /Content-Security-Policy/u, `${name}: site CSP preserved`);
}
const catalogue = await read(pages[0]);
assert.match(catalogue, /data-story-filters hidden/u, 'filters progressively enabled by JS');
assert.match(catalogue, /data-story-status="production"/u, 'first episode remains in production');
assert.match(catalogue, /आवाज़ व अंतिम संपादन जारी/u, 'honest production message');
assert.doesNotMatch(catalogue, />YouTube पर देखें</u, 'no empty watch link');
const search = JSON.parse(await read('search.json'));
assert(search.some((item) => item.url === '/Kahani/'), 'catalogue is searchable');
assert(search.some((item) => item.url === '/About-Kahani-Videos/'), 'about page is searchable');
const sitemap = await read('sitemap.xml');
assert.match(sitemap, /https:\/\/sanskarin\.github\.io\/Kahani\//u);
assert.match(sitemap, /https:\/\/sanskarin\.github\.io\/About-Kahani-Videos\//u);
console.log('Kahani: both routes, metadata, local assets, publication state, search and sitemap passed.');
