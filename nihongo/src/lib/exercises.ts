// Builds exercises from content. Exercises are plain data so they can be
// stored in the Mistake Notebook and replayed later.
import {
  type Lesson, type Sent, type Vocab, LESSONS, LESSON_MAP, ALL_VOCAB, ALL_SENTENCES, SENT_MAP, VOCAB_MAP,
  KANJI, KANJI_MAP, HIRA, KATA, kanaRomaji, PASSAGES, sentId, vocabId, kanaId, kanjiId,
} from '../content';
import { parseFuri } from './jp';
import { LIB, libKanjiAsKanji } from '../content/library';
import { storyFor } from '../content/stories';
import { GRAMMAR, type GrammarPoint } from '../content/grammar';
import { castFor } from '../content/cast';
import { ROLEPLAYS } from '../content/extras';
import type { ItemState } from './srs';

export type Skill = 'kana' | 'vocab' | 'kanji' | 'grammar' | 'reading' | 'writing' | 'listening' | 'speaking';
interface Base { key: string; skill: Skill; itemId: string; kind: string; lessonId?: string; tag?: 'earlier' | 'challenge' | 'story' }
export type Ex = Base & (
  | { t: 'choice'; prompt: string; jp?: string; say?: string; context?: string; options: string[]; jpOptions?: boolean; a: number; why: string }
  | { t: 'fill'; sent: Sent; blank: number; options: string[]; a: number }
  | { t: 'arrange'; sent: Sent }
  | { t: 'type'; sent: Sent }
  | { t: 'copy'; sent: Sent }
  | { t: 'listen'; sent: Sent }
  | { t: 'speak'; sent: Sent }
  | { t: 'word'; word: Vocab }
  | { t: 'chat'; who: string; line: Sent; options: string[]; a: number; why: string }
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
  const lk = !KANJI_MAP.has(k) && LIB ? LIB.kanjiMap.get(k) : undefined;
  const info = KANJI_MAP.get(k) ?? (lk && LIB ? libKanjiAsKanji(lk, LIB) : undefined); if (!info) return null;
  if (mode === 'reading' && !info.words.length) mode = 'meaning';
  const base = { key: key(), skill: 'kanji' as const, itemId: kanjiId(k), kind: 'kanji' };
  if (mode === 'reading') {
    const w = info.words[0]; const p = parseFuri(w.f);
    const pool = KANJI.flatMap(x => x.words.map(y => parseFuri(y.f).kana));
    return { ...base, t: 'choice', prompt: `How is this word read? (${w.en})`, jp: p.jp, say: p.jp, jpOptions: true, ...options(p.kana, pool), why: `${p.jp} is read ${p.kana} and means "${w.en}".` };
  }
  const pool = lk && LIB ? LIB.kanji.filter(x => x.lvl === lk.lvl).map(x => x.en) : KANJI.map(x => x.en);
  const ex0 = info.words[0];
  return { ...base, t: 'choice', prompt: 'What does this kanji mean?', jp: k, say: ex0 ? parseFuri(ex0.f).jp : undefined, ...options(info.en, pool), why: `${k} means "${info.en}".${ex0 ? ` Example: ${parseFuri(ex0.f).jp} (${parseFuri(ex0.f).kana}) = ${ex0.en}.` : ''}` };
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
/**
 * A lesson's practice, in two parts so each sitting stays manageable:
 *  Part 1 "Learn": recognise the new kana / words, read the story, understand and copy each sentence.
 *  Part 2 "Use it": build and write sentences yourself, listen, review earlier lessons, final challenge.
 * Leave out `part` to get both.
 */
export function lessonExercises(l: Lesson, part?: 1 | 2): Ex[] {
  const one: Ex[] = [], two: Ex[] = [];
  const n = LESSONS.indexOf(l);
  if (l.kana) {
    const recog = l.kana.map(ch => kanaEx(ch, false, l.id));
    const reverse = shuffle(l.kana).slice(0, Math.ceil(l.kana.length / 2)).map(ch => kanaEx(ch, true, l.id));
    one.push(...shuffle(recog), ...storyEx(l), ...reverse);
    two.push(...shuffle(l.vocab.map(w => vocabEx(w, 'meaning', l.id, l.vocab))), ...l.vocab.slice(0, 4).map(w => vocabEx(w, 'type', l.id)), ...earlierEx(l), ...challengeEx(l));
  } else {
    one.push(...shuffle(l.vocab.map(w => vocabEx(w, 'meaning', l.id, l.vocab))), ...shuffle(l.vocab).slice(0, 4).map(w => vocabEx(w, 'jp', l.id, l.vocab)));
    one.push(...storyEx(l));
    const meaning = l.sentences.map((_s, i) => sentEx(sentId(l.id, i), 'meaning')).filter(ok);
    // Copy each new sentence by hand first: writing it out is how it starts to stick.
    const copy = shuffle(l.sentences.map((_s, i) => i)).slice(0, 2).map(i => sentEx(sentId(l.id, i), 'copy')).filter(ok);
    const choices: Ex[] = (l.choices ?? []).map((c, i) => ({ key: key(), skill: 'grammar', itemId: `choice:${l.id}:${i}`, kind: 'grammar', lessonId: l.id, t: 'choice', prompt: 'Choose the natural expression', context: c.q, jpOptions: true, options: c.options, a: c.a, why: c.why }));
    // Every lesson runs in its own order, so no two feel the same.
    one.push(...(n % 2 ? [...copy, ...meaning] : [...meaning, ...copy]), ...choices);
    const build = l.sentences.map((_s, i) => { const id = sentId(l.id, i); return sentEx(id, 'fill') ?? sentEx(id, 'arrange'); }).filter(ok);
    // Write two sentences in full; the rest are built with tiles (faster, same structure practice).
    const pickW = shuffle(l.sentences.map((_s, i) => i)).slice(0, 2);
    const write = pickW.map(i => sentEx(sentId(l.id, i), 'type')).filter(ok);
    const listen = shuffle(l.sentences.map((_s, i) => i)).slice(0, 2).map(i => sentEx(sentId(l.id, i), 'listen')).filter(ok);
    // One Duolingo-style 'speak this sentence' per lesson.
    const speakOne = shuffle(l.sentences.map((_s, i) => i)).slice(0, 1).map(i => sentEx(sentId(l.id, i), 'speak')).filter(ok);
    two.push(...chatFromLesson(l).slice(0, 2), ...speakOne, ...(n % 3 === 1 ? [...listen, ...build, ...write] : n % 3 === 2 ? [...build, ...listen, ...write] : [...build, ...write, ...listen]), ...earlierEx(l), ...challengeEx(l));
  }
  return part === 1 ? one : part === 2 ? two : [...one, ...two];
}

/** Questions about the lesson's manga story. */
export function storyEx(l: Lesson): Ex[] {
  const st = storyFor(l); if (!st) return [];
  const opts = shuffle([st.correct, ...st.wrong]);
  const out: Ex[] = [{ key: key(), skill: 'reading', itemId: `story:${l.id}:0`, kind: 'reading', lessonId: l.id, tag: 'story', t: 'choice', prompt: 'Story check: who was right?', context: 'In the story, which version is correct?', jpOptions: true, options: opts, a: opts.indexOf(st.correct), why: st.mistakeNote }];
  const lines = (l.dialogue ?? []).filter(d => d.who !== 'You');
  if (lines.length >= 2) {
    const d = lines[Math.floor(Math.random() * lines.length)];
    const p = parseFuri(d.f);
    out.push({ key: key(), skill: 'reading', itemId: `story:${l.id}:1`, kind: 'reading', lessonId: l.id, tag: 'story', t: 'choice', prompt: 'Story check: what did they mean?', jp: d.f, say: p.jp, ...options(d.en, (l.dialogue ?? []).map(x => x.en)), why: `${p.jp} = "${d.en}"` });
  }
  return out;
}

/** A few sentences from the two lessons before this one, so nothing is forgotten. */
function earlierEx(l: Lesson): Ex[] {
  const same = LESSONS.filter(x => x.track === l.track || (l.track === 'jlpt' && x.track === 'kana'));
  const i = same.indexOf(l);
  const prev = same.slice(Math.max(0, i - 2), i);
  const pool = prev.flatMap(p => p.kana ? p.vocab.map(w => vocabEx(w, 'type', p.id)) : p.sentences.map((_s, j) => sentEx(sentId(p.id, j), Math.random() < 0.5 ? 'arrange' : 'type')).filter(ok));
  return shuffle(pool).slice(0, 3).map(e => ({ ...e, tag: 'earlier' as const }));
}

/** The final challenge: write full sentences with no hints. */
function challengeEx(l: Lesson): Ex[] {
  if (l.kana) return shuffle(l.vocab).slice(0, 2).map(w => ({ ...vocabEx(w, 'type', l.id), tag: 'challenge' as const }));
  return shuffle(l.sentences.map((_s, i) => i)).slice(0, 2).map(i => sentEx(sentId(l.id, i), 'type')).filter(ok).map(e => ({ ...e, tag: 'challenge' as const }));
}

/** Pick an exercise for a review item; stronger items get harder formats. */
export function reviewEx(it: ItemState): Ex | null {
  const [kind, ...rest] = it.id.split(':'); const id = rest.join(':');
  if (kind === 'kana') return kanaEx(id, it.reps >= 1 && Math.random() < 0.5);
  if (kind === 'vocab') { const w = VOCAB_MAP.get(id) ?? (LIB?.wordMap.get(id) && { ...LIB.wordMap.get(id)!, lessonId: undefined as unknown as string }); return w ? vocabEx(w, it.reps >= 2 ? 'type' : it.reps === 1 ? 'jp' : 'meaning', w.lessonId || undefined, LIB?.wordMap.has(id) && !VOCAB_MAP.has(id) ? LIB.words.filter(x => x.lvl === LIB!.wordMap.get(id)!.lvl).slice(0, 400) : ALL_VOCAB) : null; }
  if (kind === 'kanji') return kanjiEx(id, it.reps >= 1 ? 'reading' : 'meaning');
  if (kind === 'gram') { const g = GRAMMAR.find(x => x.p === id); return g ? grammarEx(g, it.reps >= 1 ? (Math.random() < 0.5 ? 'pattern' : 'example') : 'meaning') : null; }
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
    // Mostly quick tile-building, with every third one typed in full.
    case 'translate': return sents.slice(0, 8).map((x, i) => sentEx(x.id, i % 3 === 2 ? 'type' : 'arrange') ?? sentEx(x.id, 'type')).filter(ok);
    case 'copy': return take('copy').slice(0, 6);
    case 'meaning': return take('meaning');
    case 'arrange': return take('arrange');
    case 'particles': return take('fill');
    case 'listening': return take('listen');
    case 'speaking': return take('speak').slice(0, 6);
    case 'chat': return chatFromRoleplays(8);
    case 'vocab': return vocab.slice(0, count).map((w, i) => vocabEx(w, i % 2 ? 'jp' : 'meaning', w.lessonId));
    case 'hiragana': return shuffle(Object.keys(HIRA)).slice(0, 15).map((c, i) => kanaEx(c, i % 3 === 0));
    case 'katakana': return shuffle(Object.keys(KATA)).slice(0, 15).map((c, i) => kanaEx(c, i % 3 === 0));
    case 'kanji': return shuffle(KANJI).slice(0, count).map((k, i) => kanjiEx(k.k, i % 2 ? 'reading' : 'meaning')).filter(ok);
    default: return [];
  }
}
export { LESSONS };

/** Grammar quiz questions for one N3–N1 point. */
export function grammarEx(g: GrammarPoint, mode: 'meaning' | 'pattern' | 'example'): Ex {
  const same = GRAMMAR.filter(x => x.lvl === g.lvl);
  const base = { key: key(), skill: 'grammar' as const, itemId: `gram:${g.p}`, kind: 'grammar' };
  const p = parseFuri(g.f);
  const why = `${g.p} = "${g.m}". Example: ${p.jp} — ${g.en}`;
  if (mode === 'pattern') return { ...base, t: 'choice', prompt: `Which pattern means "${g.m}"?`, jpOptions: true, ...options(g.p, same.map(x => x.p)), why };
  if (mode === 'example') return { ...base, t: 'choice', prompt: 'What does this sentence mean?', jp: g.f, say: p.jp, ...options(g.en, same.map(x => x.en)), why };
  return { ...base, t: 'choice', prompt: `What does ${g.p} mean here?`, jp: g.f, say: p.jp, ...options(g.m, same.map(x => x.m)), why };
}
export function grammarSet(lvl: number, known: Set<string>, n = 8): Ex[] {
  const pool = GRAMMAR.filter(g => g.lvl === lvl);
  const fresh = pool.filter(g => !known.has(`gram:${g.p}`));
  const pick = (fresh.length >= n ? fresh : [...fresh, ...shuffle(pool.filter(g => known.has(`gram:${g.p}`)))]).slice(0, n);
  return [...pick.map(g => grammarEx(g, 'meaning')), ...shuffle(pick).map((g, i) => grammarEx(g, i % 2 ? 'pattern' : 'example'))];
}

/** All the replies "you" give in dialogues and roleplays — wrong options for chat questions. */
const ALL_REPLIES = (): string[] => [
  ...LESSONS.flatMap(l => (l.dialogue ?? []).filter(d => d.who === 'You').map(d => d.f)),
  ...ROLEPLAYS.flatMap(r => r.turns.map(t => t.expect[0])),
];
export function chatOptions(correct: string): { options: string[]; a: number } {
  const cj = parseFuri(correct).jp;
  const others = shuffle([...new Set(ALL_REPLIES())].filter(x => parseFuri(x).jp !== cj)).slice(0, 2);
  const opts = shuffle([correct, ...others]);
  return { options: opts, a: opts.indexOf(correct) };
}
/** "Complete the chat": pick the natural reply to what the teacher says. */
export function chatFromLesson(l: Lesson): Ex[] {
  const d = l.dialogue ?? []; const out: Ex[] = [];
  const who = castFor(l.id).guide;
  d.forEach((line, i) => {
    if (line.who !== 'You' && d[i + 1]?.who === 'You') {
      const reply = d[i + 1];
      out.push({ key: key(), skill: 'speaking', itemId: `chat:${l.id}:${i}`, kind: 'grammar', lessonId: l.id, t: 'chat', who, line: { f: line.f, en: line.en }, ...chatOptions(reply.f), why: `"${parseFuri(reply.f).jp}" — ${reply.en}` });
    }
  });
  return out;
}
export function chatFromRoleplays(n = 8): Ex[] {
  const out: Ex[] = [];
  for (const r of shuffle(ROLEPLAYS)) r.turns.forEach((t, i) => out.push({ key: key(), skill: 'speaking', itemId: `chat:${r.id}:${i}`, kind: 'grammar', t: 'chat', who: castFor().guide, line: t.npc, ...chatOptions(t.expect[0]), why: `${t.goal}: "${parseFuri(t.expect[0]).jp}"` }));
  return shuffle(out).slice(0, n);
}
