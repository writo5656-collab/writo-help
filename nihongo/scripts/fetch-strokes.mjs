// One-off helper: downloads stroke-order paths from KanjiVG (CC BY-SA 3.0,
// https://kanjivg.tagaini.net) for every kana and kanji the app teaches and
// writes them to src/content/strokes.json. Re-run after adding new kanji.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const out = 'src/content/strokes.json';
const have = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
const kana = [];
for (let c = 0x3041; c <= 0x3093; c++) kana.push(String.fromCodePoint(c));
for (let c = 0x30a1; c <= 0x30f3; c++) kana.push(String.fromCodePoint(c));
const kanji = [...readFileSync('src/content/kanji.ts', 'utf8').matchAll(/^(.)\|/gm)].map(m => m[1]);
const extra = [...new Set((process.argv[2] ?? '').split(''))];
const chars = [...new Set([...kana, ...kanji, ...extra])].filter(c => !have[c]);

let ok = 0, fail = [];
const work = async c => {
  const hex = c.codePointAt(0).toString(16).padStart(5, '0');
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`);
      if (r.status === 404) break;
      if (!r.ok) throw new Error(String(r.status));
      const svg = await r.text();
      const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]);
      if (paths.length) { have[c] = paths; ok++; return; }
    } catch { await new Promise(r => setTimeout(r, 800)); }
  }
  fail.push(c);
};
for (let i = 0; i < chars.length; i += 8) await Promise.all(chars.slice(i, i + 8).map(work));
writeFileSync(out, JSON.stringify(have));
console.log(`fetched ${ok}, total ${Object.keys(have).length}, failed: ${fail.join('') || 'none'}`);
