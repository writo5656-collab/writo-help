// Japanese text helpers: furigana notation, normalising and romaji.
//
// Content is written in a compact "furigana notation":
//   私[わたし]は 学生[がくせい]です。
// - kanji followed by [reading] gives us the kana reading
// - spaces split the sentence into natural chunks (used for word-by-word
//   audio and "arrange the sentence" exercises)
// - {を} marks a particle that can be blanked out for fill-in exercises
import { toRomaji, toHiragana, isJapanese } from 'wanakana';

export interface Seg { text: string; reading?: string }
export interface Chunk { segs: Seg[]; jp: string; kana: string; particle?: string }
export interface Parsed { chunks: Chunk[]; jp: string; kana: string }

const KANJI = '\\u3400-\\u9fff々〆ヶ';
const FURI_RE = new RegExp(`([${KANJI}]+)\\[([^\\]]+)\\]`, 'g');

function parseChunk(raw: string): Chunk {
  let particle: string | undefined;
  const clean = raw.replace(/\{([^}]+)\}/g, (_m, p) => { particle = p; return p; });
  const segs: Seg[] = [];
  let last = 0;
  for (const m of clean.matchAll(FURI_RE)) {
    if (m.index! > last) segs.push({ text: clean.slice(last, m.index) });
    segs.push({ text: m[1], reading: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < clean.length) segs.push({ text: clean.slice(last) });
  return {
    segs, particle,
    jp: segs.map(s => s.text).join(''),
    kana: segs.map(s => s.reading ?? s.text).join(''),
  };
}

const cache = new Map<string, Parsed>();
export function parseFuri(f: string): Parsed {
  let p = cache.get(f);
  if (!p) {
    const chunks = f.trim().split(/\s+/).map(parseChunk);
    p = { chunks, jp: chunks.map(c => c.jp).join(''), kana: chunks.map(c => c.kana).join('') };
    cache.set(f, p);
  }
  return p;
}

/** Romaji for display. Particles は/へ are shown as they are pronounced (wa/e). */
export function romajiOf(f: string): string {
  return parseFuri(f).chunks.map(c => {
    let k = c.kana.replace(/[。、！？「」]/g, '');
    let tail = '';
    if (k.length > 1 && k.endsWith('は')) { k = k.slice(0, -1); tail = ' wa'; }
    else if (k.length > 1 && k.endsWith('へ') && c.particle !== undefined) { k = k.slice(0, -1); tail = ' e'; }
    else if (k.length > 1 && k.endsWith('を')) { k = k.slice(0, -1); tail = ' o'; }
    return toRomaji(k) + tail;
  }).join(' ').trim();
}

export function kanaToRomaji(k: string) { return toRomaji(k); }

/** Strip spaces and punctuation so answers compare fairly. */
export function normalize(s: string): string {
  return s.normalize('NFKC').replace(/[\s。、．，.,!?！？「」『』・~〜]/g, '');
}

function esc(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/** A pattern that accepts each kanji word either in kanji or in kana. */
export function answerRegex(f: string): RegExp {
  const src = parseFuri(f).chunks.flatMap(c => c.segs).map(s =>
    s.reading ? `(?:${esc(s.text)}|${esc(s.reading)})` : esc(normalize(s.text))
  ).join('');
  return new RegExp(`^${src}$`);
}

/** Convert what the learner typed to kana where we know the kanji readings. */
export function toKanaUsing(input: string, f: string): string {
  let out = input;
  const segs = parseFuri(f).chunks.flatMap(c => c.segs).filter(s => s.reading)
    .sort((a, b) => b.text.length - a.text.length);
  for (const s of segs) out = out.split(s.text).join(s.reading!);
  return out;
}

export function hasKanji(s: string) { return new RegExp(`[${KANJI}]`).test(s); }
export function looksLatin(s: string) { return /[a-zA-Z]{2,}/.test(s) && !isJapanese(s.replace(/\s/g, '')); }
export { toHiragana };

/**
 * Split furigana notation written without spaces into word chunks, so every
 * word can be tapped and gets its own pronunciation. A light rule set:
 * break after a particle that follows kanji/katakana/a closing bracket,
 * after punctuation, and between katakana and kanji.
 * Text that already has spaces is returned unchanged.
 */
const AUTO_PARTICLES = ['から', 'まで', 'より', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'や'];
export function autoSpace(f: string): string {
  const t = f.trim();
  // Already spaced: only split pieces that are clearly several words long.
  if (/\s/.test(t)) return t.split(/\s+/).map(c => (parseFuri(c).jp.length >= 7 ? autoSpace(c) : c)).join(' ');
  // Tokens: "漢字[かな]" groups or single characters.
  const toks = t.match(/[\u3400-\u9fff々〆ヶ]+\[[^\]]+\]|\{[^}]+\}|./gu) ?? [];
  const kind = (x: string) => /^[\u3400-\u9fff々〆ヶ]/.test(x) ? 'k' : /^[\u30a0-\u30ffー]/.test(x) ? 'K' : /^[\u3040-\u309f]/.test(x) ? 'h' : /^[。、！？!?]/.test(x) ? 'p' : /^[」』]/.test(x) ? 'c' : /^[「『]/.test(x) ? 'o' : 'x';
  const out: string[][] = [[]];
  for (let i = 0; i < toks.length; i++) {
    const cur = out[out.length - 1];
    const tk = toks[i], k = kind(tk);
    const prev = cur[cur.length - 1], pk = prev ? kind(prev) : '';
    // katakana word followed by kanji → new word
    if (cur.length && pk === 'K' && k === 'k') out.push([]);
    // opening bracket starts a new chunk
    if (cur.length && k === 'o') out.push([]);
    out[out.length - 1].push(tk);
    if (k === 'p') { out.push([]); continue; }
    // a one-kana particle right before kanji ends the word (私たちの|学校, 食べに|行く)
    if (k === 'h' && 'のをにでがはともへ'.includes(tk) && toks[i + 1] && kind(toks[i + 1]) === 'k' && cur.some(x => kind(x) === 'k' || kind(x) === 'K')) { out.push([]); continue; }
    // particle after a kanji / katakana / closing bracket → end the word here
    if (k === 'h' && (pk === 'k' || pk === 'K' || prev === '」' || prev === '』')) {
      for (const pa of AUTO_PARTICLES) {
        const ahead = toks.slice(i, i + pa.length).join('');
        if (ahead !== pa) continue;
        const after = toks[i + pa.length];
        // don't split inside words like 私たち / 行きます: the particle must be followed by a new word or the end
        if (after === undefined || kind(after) !== 'h' || pa === 'は' || pa === 'を' || pa === 'が') {
          for (let j = 1; j < pa.length; j++) out[out.length - 1].push(toks[i + j]);
          i += pa.length - 1;
          out.push([]);
        }
        break;
      }
    }
  }
  return out.map(x => x.join('')).filter(Boolean).join(' ');
}
