// "Explain my answer": breaks a Japanese answer into its pieces and explains
// each one (word meaning, particle, verb ending), with examples from the course.
// Everything here works offline; the AI teacher can add more on top.
import type { Ex } from './exercises';
import type { Vocab } from '../content/types';
import { parseFuri, romajiOf, kanaToRomaji } from './jp';
import { PARTICLE_INFO } from './check';

export interface Target { f: string; en: string; notes: string[] }
export interface Piece {
  jp: string; kana: string; romaji: string;
  word?: { jp: string; kana: string; en: string; base?: string };
  particle?: { p: string; info: string };
  ending?: { e: string; info: string };
  examples: { f: string; en: string }[];
}

/** The Japanese the exercise is about, its meaning and any built-in notes. */
export function targetOf(ex: Ex): Target | null {
  switch (ex.t) {
    case 'fill': case 'arrange': case 'type': case 'copy': case 'listen': case 'speak':
      return { f: ex.sent.f, en: ex.sent.en, notes: ex.sent.note ? [ex.sent.note] : [] };
    case 'chat':
      return { f: ex.options[ex.a], en: ex.why.replace(/^"[^"]*" — /, ''), notes: [`She said: ${parseFuri(ex.line.f).jp} — ${ex.line.en}`] };
    case 'word':
      return { f: ex.word.jp !== ex.word.kana && !/\[/.test(ex.word.jp) ? `${ex.word.jp}[${ex.word.kana}]` : ex.word.jp, en: ex.word.en, notes: [] };
    case 'choice': {
      const jp = ex.jpOptions ? ex.options[ex.a] : ex.jp;
      if (!jp || !/[぀-ヿ㐀-鿿]/.test(jp)) return null;
      return { f: jp, en: ex.jpOptions ? ex.prompt : ex.options[ex.a], notes: ex.why ? [ex.why] : [] };
    }
  }
}

// Verb and sentence endings, longest first so ませんでした wins over ません.
export const ENDINGS: [string, string][] = ([
  ['ませんでした', 'ませんでした = polite past negative: "did not …".'],
  ['ましょうか', 'ましょうか = "Shall I / shall we …?" — offering or suggesting.'],
  ['ましたか', 'ましたか = polite past question: "did you …?"'],
  ['ますか', 'ますか = polite question: "do you … / will you …?" (ます + question marker か).'],
  ['ませんか', 'ませんか = "Won\'t you …? / Would you like to …?" — a soft invitation.'],
  ['ましょう', 'ましょう = "Let\'s …".'],
  ['ました', 'ました = polite past: "did …".'],
  ['ません', 'ません = polite negative: "don\'t / won\'t …".'],
  ['ます', 'ます = polite present/future: "do / will …".'],
  ['たいです', 'たいです = "want to …" (stem + たい).'],
  ['てください', 'てください = "Please …" (て-form + ください).'],
  ['でください', 'でください = "Please …" (て-form + ください).'],
  ['ています', 'ています = "is …-ing" or an ongoing state (て-form + います).'],
  ['でいます', 'でいます = "is …-ing" or an ongoing state (て-form + います).'],
  ['じゃありません', 'じゃありません = "is not" (polite).'],
  ['ではありません', 'ではありません = "is not" (polite, a bit formal).'],
  ['でした', 'でした = "was" (polite past of です).'],
  ['ですか', 'ですか = "is it …?" — です + question marker か.'],
  ['です', 'です = "is / am / are" — makes the sentence polite.'],
  ['だよ', 'だよ = casual "it\'s …!" (だ + よ for telling someone).'],
  ['だね', 'だね = casual "it\'s …, isn\'t it?"'],
  ['くないです', 'くないです = "is not …" for い-adjectives.'],
  ['かったです', 'かったです = "was …" for い-adjectives.'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

const PARTICLES = Object.keys(PARTICLE_INFO).sort((a, b) => b.length - a.length);
const strip = (s: string) => s.replace(/[。、！？!?「」『』…\s]/g, '');

// い-row → う-row for godan verbs (書き → 書く).
const I_TO_U: Record<string, string> = { き: 'く', ぎ: 'ぐ', し: 'す', ち: 'つ', に: 'ぬ', び: 'ぶ', み: 'む', り: 'る', い: 'う' };
const E_TO_U: Record<string, string> = { け: 'く', げ: 'ぐ', せ: 'す', て: 'つ', ね: 'ぬ', べ: 'ぶ', め: 'む', れ: 'る', え: 'う' };

/** Possible dictionary forms for a verb stem like 食べ / 飲み / し. */
export function dictForms(stem: string): string[] {
  if (!stem) return [];
  if (stem === 'し') return ['する'];
  if (stem === 'き' || stem === '来') return ['来る', 'くる'];
  if (stem.endsWith('し') && stem.length > 1) return [stem.slice(0, -1) + 'する', stem.slice(0, -1), stem.slice(0, -1) + 'す'];
  const out = [stem + 'る'];
  const last = stem.slice(-1);
  if (I_TO_U[last]) out.push(stem.slice(0, -1) + I_TO_U[last]);
  // "can do" forms: 食べられ → 食べる, 飲め → 飲む
  if (stem.endsWith('られ') && stem.length > 2) out.push(stem.slice(0, -2) + 'る');
  if (E_TO_U[last] && stem.length > 1) out.push(stem.slice(0, -1) + E_TO_U[last]);
  return out;
}

/** Split one chunk into word + particle and find an ending. */
export function splitChunk(jp: string, particle?: string, look?: (w: string) => unknown): { stem: string; particle?: string; ending?: string } {
  let s = strip(jp);
  let p = particle && s.endsWith(particle) && s.length > particle.length ? particle : undefined;
  if (!p) for (const q of PARTICLES) if (s.length > q.length && s.endsWith(q) && !/(です|ます)か$/.test(s)) {
    // After hiragana it may just be the end of a word (えいが, ながら): only split when the rest is a known word.
    const before = s[s.length - q.length - 1];
    if (/[\u3040-\u309f]/.test(before) && look && (look(s) || !look(s.slice(0, -q.length)))) break;
    p = q; break;
  }
  // A trailing か after です/ます is the question marker — kept inside the ending.
  if (p) s = s.slice(0, -p.length);
  let ending: string | undefined;
  for (const [e] of ENDINGS) if (s.endsWith(e) && s.length >= e.length) { ending = e; break; }
  return { stem: ending ? s.slice(0, -ending.length) : s, particle: p, ending };
}

export type Lookup = (jp: string) => Vocab | undefined;

/** Find the word in a chunk: exact, then dictionary forms, then the longest known prefix. */
export function findWord(stem: string, ending: string | undefined, look: Lookup): (Vocab & { base?: string }) | undefined {
  if (!stem) return undefined;
  const exact = look(stem) ?? (ending ? look(stem + ending) : undefined);
  if (exact) return exact;
  if (ending && /^(ま|た|て|で)/.test(ending)) for (const d of dictForms(stem)) { const v = look(d); if (v) return { ...v, base: d }; }
  // Adjectives: 高くない → 高い
  if (ending && /^(くない|かった)/.test(ending)) { const v = look(stem + 'い'); if (v) return { ...v, base: stem + 'い' }; }
  for (let n = stem.length - 1; n >= 1; n--) {
    const v = look(stem.slice(0, n));
    if (v && (n >= 2 || /[㐀-鿿]/.test(stem[0]))) return v;
  }
  return undefined;
}

/** Explain every chunk of a furigana sentence. */
export function explainPieces(f: string, look: Lookup, examplesFor: (word: string, not: string) => { f: string; en: string }[]): Piece[] {
  const whole = parseFuri(f).jp;
  return f.trim().split(/\s+/).filter(raw => strip(parseFuri(raw).jp)).map(raw => {
    const c = parseFuri(raw).chunks[0];
    const sp = splitChunk(c.jp, c.particle, look);
    const w = findWord(sp.stem, sp.ending, look);
    let romaji = romajiOf(raw) || kanaToRomaji(c.kana);
    // Show です-type endings as their own words: "gakusei desu ka" (verbs stay joined: "tabemasu").
    if (sp.ending && /^(で|だ|じゃ)/.test(sp.ending) && sp.stem) {
      let k = c.kana.replace(/[。、！？!?「」\s]/g, '');
      const tail = sp.particle && k.endsWith(sp.particle) ? sp.particle : '';
      if (tail) k = k.slice(0, -tail.length);
      if (k.endsWith(sp.ending) && k.length > sp.ending.length) {
        const endR = kanaToRomaji(sp.ending).replace(/^(desu|deshita|da|dewaarimasen|jaarimasen)(ka|yo|ne)$/, '$1 $2').replace('dewaarimasen', 'dewa arimasen').replace('jaarimasen', 'ja arimasen');
        romaji = [kanaToRomaji(k.slice(0, -sp.ending.length)), endR, tail ? kanaToRomaji(tail) : ''].filter(Boolean).join(' ');
      }
    }
    // Particles as their own word in the romaji: "shitsumon no", "watashi wa".
    else if (sp.particle && !sp.ending) {
      const k = c.kana.replace(/[。、！？!?「」\s]/g, '');
      const pr: Record<string, string> = { は: 'wa', へ: 'e', を: 'o' };
      if (k.endsWith(sp.particle) && k.length > sp.particle.length) romaji = `${kanaToRomaji(k.slice(0, -sp.particle.length))} ${pr[sp.particle] ?? kanaToRomaji(sp.particle)}`;
    }
    const piece: Piece = { jp: c.jp, kana: c.kana, romaji, examples: [] };
    if (w) piece.word = { jp: w.jp, kana: w.kana, en: w.en, base: w.base };
    if (sp.particle && PARTICLE_INFO[sp.particle]) piece.particle = { p: sp.particle, info: PARTICLE_INFO[sp.particle] };
    else if (!sp.particle && PARTICLE_INFO[strip(c.jp)]) piece.particle = { p: strip(c.jp), info: PARTICLE_INFO[strip(c.jp)] };
    if (sp.ending) piece.ending = { e: sp.ending, info: ENDINGS.find(([e]) => e === sp.ending)![1] };
    const key = w?.jp ?? (sp.stem.length >= 2 ? sp.stem : '');
    if (key) piece.examples = examplesFor(key, whole);
    return piece;
  });
}

/** The text sent to the AI teacher when the learner asks for more. */
export function explainPrompt(t: Target, user: string, expected: string, ok: boolean): string {
  return [
    `Exercise answer: ${parseFuri(t.f).jp} (${parseFuri(t.f).kana}) = "${t.en}".`,
    `My answer: ${user || '(nothing)'}`,
    `Expected: ${expected || parseFuri(t.f).jp}`,
    ok ? 'I got it right — explain why it is right and how the sentence works.' : 'I got it wrong — explain what I did wrong and how to get it right.',
  ].join('\n');
}
