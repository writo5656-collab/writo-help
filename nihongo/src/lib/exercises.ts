// Builds exercises from content. Exercises are plain data so they can be
// stored in the Mistake Notebook and replayed later.
import {
  type Lesson, type Sent, type Vocab, LESSONS, LESSON_MAP, ALL_VOCAB, ALL_SENTENCES, SENT_MAP, VOCAB_MAP,
  KANJI, KANJI_MAP, HIRA, KATA, kanaRomaji, PASSAGES, sentId, vocabId, kanaId, kanjiId,
} from '../content';
import { parseFuri } from './jp';
import type { ItemState } from './srs';

export type Skill = 'kana' | 'vocab' | 'kanji' | 'grammar' | 'reading' | 'writing' | 'listening' | 'speaking';
interface Base { key: string; skill: Skill; itemId: string; kind: string; lessonId?: string }
export type Ex = Base & (
  | { t: 'choice'; prompt: string; jp?: string; say?: string; context?: string; options: string[]; jpOptions?: boolean; a: number; why: string }
  | { t: 'fill'; sent: Sent; blank: number; options: string[]; a: number }
  | { t: 'arrange'; sent: Sent }
  | { t: 'type'; sent: Sent }
  | { t: 'copy'; sent: Sent }
  | { t: 'listen'; sent: Sent }
  | { t: 'speak'; sent: Sent }
  | { t: 'word'; word: Vocab }
);

export function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
let n = 0;
const key = () => `ex${++n}-${Math.random().toString(36).slice(2, 7)}`;

/** Correct answer + 3 distractors, shuffled. */
function options(correct: string, pool: string[], count = 4) {
  const others = shuffle([...new Set(pool)].filter(x => x !== correct)).slice(0, count - 1);
  const opts = shuffle([correct, ...others]);
  return { options: opts, a: opts.indexOf(correct) };
}

// ---- kana ---------------------------------------------------------------
export function kanaEx(ch: string, reverse = false, lessonId?: string): Ex {
  const table = HIRA[ch] ? HIRA : KATA;
  const base = { key: key(), skill: 'kana' as const, itemId: kanaId(ch), kind: 'kana', lessonId };
  const single = Object.keys(table).filter(c => c.length === ch.length);
  if (reverse) {
    return { ...base, t: 'choice', prompt: `Which character is "${kanaRomaji(ch)}"?`, say: ch, jpOptions: true, ...options(ch, single), why: `${ch} is read "${kanaRomaji(ch)}".` };
  }
  return { ...base, t: 'choice', prompt: 'How is this read?', jp: ch, say: ch, ...options(kanaRomaji(ch), single.map(kanaRomaji)), why: `${ch} is read "${kanaRomaji(ch)}".` };
}

// ---- vocabulary -----------------------------------------------------------
export function vocabEx(w: Vocab, mode: 'meaning' | 'jp' | 'type', lessonId?: string, pool: Vocab[] = ALL_VOCAB): Ex {
  const base = { key: key(), skill: 'vocab' as const, itemId: vocabId(w.jp), kind: 'vocab', lessonId };
  const f = w.jp === w.kana ? w.jp : undefined;
  const why = `${w.jp}${w.kana !== w.jp ? ` (${w.kana})` : ''} means "${w.en}".`;
  if (mode === 'type') return { ...base, t: 'word', word: w };
  if (mode === 'jp') return { ...base, t: 'choice', prompt: `Which word means "${w.en}"?`, jpOptions: true, ...options(w.jp, [...pool.map(x => x.jp), ...ALL_VOCAB.map(x => x.jp)]), why };
  return { ...base, t: 'choice', prompt: 'What does this mean?', jp: f ?? `${w.jp}`, say: w.jp, context: w.kana !== w.jp ? w.kana : undefined, ...options(w.en, [...pool.map(x => x.en), ...ALL_VOCAB.map(x => x.en)]), why };
}

// ---- kanji ----------------------------------------------------------------
export function kanjiEx(k: string, mode: 'meaning' | 'reading'): Ex | null {
  const info = KANJI_MAP.get(k); if (!info) return null;
  const base = { key: key(), skill: 'kanji' as const, itemId: kanjiId(k), kind: 'kanji' };
  if (mode === 'reading') {
    const w = info.words[0]; const p = parseFuri(w.f);
    const pool = KANJI.flatMap(x => x.words.map(y => parseFuri(y.f).kana));
    return { ...base, t: 'choice', prompt: `How is this word read? (${w.en})`, jp: p.jp, say: p.jp, jpOptions: true, ...options(p.kana, pool), why: `${p.jp} is read ${p.kana} and means "${w.en}".` };
  }
  return { ...base, t: 'choice', prompt: 'What does this kanji mean?', jp: k, ...options(info.en, KANJI.map(x => x.en)), why: `${k} means "${info.en}". Example: ${parseFuri(info.words[0].f).jp} (${parseFuri(info.words[0].f).kana}) = ${info.words[0].en}.` };
}

// ---- sentences ------------------------------------------------------------
const PARTS = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'か', 'へ', 'から', 'まで'];
export function sentEx(id: string, mode: 'meaning' | 'fill' | 'arrange' | 'type' | 'copy' | 'listen' | 'speak'): Ex | null {
  const s = SENT_MAP.get(id); if (!s) return null;
  const sent: Sent = { f: s.f, en: s.en, alt: s.alt, note: s.note };
  const base = { key: key(), itemId: id, kind: 'sentence', lessonId: s.lessonId };
  const p = parseFuri(s.f);
  switch (mode) {
    case 'meaning': {
      const pool = (LESSON_MAP.get(s.lessonId)?.sentences ?? []).map(x => x.en).concat(ALL_SENTENCES.map(x => x.en));
      return { ...base, skill: 'reading', t: 'choice', prompt: 'What does this sentence mean?', jp: s.f, say: p.jp, ...options(s.en, pool), why: `${p.jp} = "${s.en}"${s.note ? ' ' + s.note : ''}` };
    }
    case 'fill': {
      const blank = p.chunks.findIndex(c => c.particle);
      if (blank < 0) return null;
      const part = p.chunks[blank].particle!;
      return { ...base, skill: 'grammar', t: 'fill', sent, blank, ...options(part, PARTS) };
    }
    case 'arrange': return p.chunks.length >= 2 ? { ...base, skill: 'writing', t: 'arrange', sent } : null;
    case 'type': return { ...base, skill: 'writing', t: 'type', sent };
    case 'copy': return { ...base, skill: 'writing', t: 'copy', sent };
    case 'listen': return { ...base, skill: 'listening', t: 'listen', sent };
    case 'speak': return { ...base, skill: 'speaking', t: 'speak', sent };
  }
}

const ok = <T,>(x: T | null): x is T => x !== null;

/** The practice set that follows a lesson's teaching cards. */
export function lessonExercises(l: Lesson): Ex[] {
  const out: Ex[] = [];
  if (l.kana) {
    for (const ch of l.kana) out.push(kanaEx(ch, false, l.id));
    for (const ch of shuffle(l.kana).slice(0, Math.ceil(l.kana.length / 2))) out.push(kanaEx(ch, true, l.id));
    for (const w of l.vocab) out.push(vocabEx(w, 'meaning', l.id, l.vocab));
    for (const w of l.vocab.slice(0, 4)) out.push(vocabEx(w, 'type', l.id));
    return [...shuffle(out.slice(0, l.kana.length)), ...shuffle(out.slice(l.kana.length))];
  }
  const vocab = l.vocab.map(w => vocabEx(w, 'meaning', l.id, l.vocab));
  const vocab2 = shuffle(l.vocab).slice(0, 4).map(w => vocabEx(w, 'jp', l.id, l.vocab));
  out.push(...shuffle(vocab), ...vocab2);
  l.sentences.forEach((_s, i) => out.push(...[sentEx(sentId(l.id, i), 'meaning')].filter(ok)));
  // Copy each new sentence by hand first: writing it out is how it starts to stick.
  l.sentences.forEach((_s, i) => out.push(...[sentEx(sentId(l.id, i), 'copy')].filter(ok)));
  l.sentences.forEach((_s, i) => { const id = sentId(l.id, i); out.push(...[sentEx(id, 'fill') ?? sentEx(id, 'arrange')].filter(ok)); });
  (l.choices ?? []).forEach((c, i) => out.push({ key: key(), skill: 'grammar', itemId: `choice:${l.id}:${i}`, kind: 'grammar', lessonId: l.id, t: 'choice', prompt: 'Choose the natural expression', context: c.q, jpOptions: true, options: c.options, a: c.a, why: c.why }));
  l.sentences.forEach((_s, i) => out.push(...[sentEx(sentId(l.id, i), 'type')].filter(ok)));
  shuffle(l.sentences.map((_s, i) => i)).slice(0, 2).forEach(i => out.push(...[sentEx(sentId(l.id, i), 'listen')].filter(ok)));
  return out;
}

/** Pick an exercise for a review item; stronger items get harder formats. */
export function reviewEx(it: ItemState): Ex | null {
  const [kind, ...rest] = it.id.split(':'); const id = rest.join(':');
  if (kind === 'kana') return kanaEx(id, it.reps >= 1 && Math.random() < 0.5);
  if (kind === 'vocab') { const w = VOCAB_MAP.get(id); return w ? vocabEx(w, it.reps >= 2 ? 'type' : it.reps === 1 ? 'jp' : 'meaning', w.lessonId) : null; }
  if (kind === 'kanji') return kanjiEx(id, it.reps >= 1 ? 'reading' : 'meaning');
  if (kind === 'sent') {
    const mode = it.reps >= 2 ? (Math.random() < 0.5 ? 'type' : 'listen') : it.reps === 1 ? 'type' : 'arrange';
    return sentEx(it.id, mode) ?? sentEx(it.id, 'type');
  }
  return null;
}

export function passageExercises(pid: string): Ex[] {
  const p = PASSAGES.find(x => x.id === pid); if (!p) return [];
  return p.questions.map((q, i) => ({ key: key(), skill: 'reading' as const, itemId: `read:${p.id}:${i}`, kind: 'reading', t: 'choice' as const, prompt: q.q, options: q.options, a: q.a, why: q.why }));
}

/** Free practice drills by type, drawn from lessons the learner has opened. */
export function drill(type: string, started: Set<string>, count = 10): Ex[] {
  const pool = ALL_SENTENCES.filter(s => started.has(s.lessonId));
  const sents = shuffle(pool.length >= 4 ? pool : ALL_SENTENCES.filter(s => s.lessonId.startsWith('n5-0') || s.lessonId === 'p-01'));
  const vocab = shuffle(ALL_VOCAB.filter(w => started.has(w.lessonId)).length >= 6 ? ALL_VOCAB.filter(w => started.has(w.lessonId)) : ALL_VOCAB.slice(0, 60));
  const take = (mode: Parameters<typeof sentEx>[1]) => sents.map(s => sentEx(s.id, mode)).filter(ok).slice(0, count);
  switch (type) {
    case 'translate': return take('type');
    case 'copy': return take('copy');
    case 'meaning': return take('meaning');
    case 'arrange': return take('arrange');
    case 'particles': return take('fill');
    case 'listening': return take('listen');
    case 'speaking': return take('speak').slice(0, 6);
    case 'vocab': return vocab.slice(0, count).map((w, i) => vocabEx(w, i % 2 ? 'jp' : 'meaning', w.lessonId));
    case 'hiragana': return shuffle(Object.keys(HIRA)).slice(0, 15).map((c, i) => kanaEx(c, i % 3 === 0));
    case 'katakana': return shuffle(Object.keys(KATA)).slice(0, 15).map((c, i) => kanaEx(c, i % 3 === 0));
    case 'kanji': return shuffle(KANJI).slice(0, count).map((k, i) => kanjiEx(k.k, i % 2 ? 'reading' : 'meaning')).filter(ok);
    default: return [];
  }
}
export { LESSONS };
