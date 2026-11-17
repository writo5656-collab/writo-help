// Builds the full JLPT N5–N1 vocabulary and kanji library from open data on GitHub:
//  - vocabulary: jamsinclair/open-anki-jlpt-decks (MIT; word lists by Jonathan
//    Waller, meanings from JMdict © EDRDG, CC BY-SA 4.0)
//  - kanji: davidluzgouveia/kanji-data (MIT; data from KANJIDIC © EDRDG, CC BY-SA 4.0).
//    Only the KANJIDIC fields are used.
// Usage: node scripts/build-library.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const get = async (u) => { for (let t = 0; t < 4; t++) { try { const r = await fetch(u); if (r.ok) return await r.text(); } catch {} await new Promise(r => setTimeout(r, 1000)); } throw new Error('download failed: ' + u); };

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const vocab = []; const seen = new Set();
for (const lvl of [5, 4, 3, 2, 1]) {
  const rows = parseCsv(await get(`https://raw.githubusercontent.com/jamsinclair/open-anki-jlpt-decks/main/src/n${lvl}.csv`)).slice(1);
  for (const [jp, kana, en] of rows) {
    if (!jp || seen.has(jp + kana)) continue;
    seen.add(jp + kana);
    vocab.push([jp.trim(), (kana || jp).trim(), en.trim().replace(/\s+/g, ' '), lvl]);
  }
}

const kd = JSON.parse(await get('https://raw.githubusercontent.com/davidluzgouveia/kanji-data/master/kanji.json'));
const kanji = Object.entries(kd)
  .filter(([, v]) => v.jlpt_new)
  .map(([k, v]) => [k, (v.readings_on ?? []).join('、'), (v.readings_kun ?? []).join('、'), (v.meanings ?? []).filter(m => !/radical/i.test(m)).slice(0, 4).join(', '), v.jlpt_new, v.strokes, v.freq ?? 9999])
  .sort((a, b) => b[4] - a[4] || a[6] - b[6]);

mkdirSync('src/content/library', { recursive: true });
writeFileSync('src/content/library/vocab.json', JSON.stringify(vocab));
writeFileSync('src/content/library/kanji.json', JSON.stringify(kanji));
writeFileSync('src/content/library/kanji-chars.txt', kanji.map(k => k[0]).join(''));
const byLvl = l => [vocab.filter(v => v[3] === l).length, kanji.filter(k => k[4] === l).length];
console.log('vocab', vocab.length, 'kanji', kanji.length, Object.fromEntries([5, 4, 3, 2, 1].map(l => ['N' + l, byLvl(l)])));
