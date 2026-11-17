// One place that gathers all content and builds look-up tables.
import { type Lesson, type Vocab, type Sent } from './types';
import { KANA_LESSONS } from './kana';
import { JLPT_LESSONS } from './jlpt';
import { PRACTICAL_LESSONS } from './practical';
import { PACKS } from './extras';
export * from './types';
export * from './kana';
export * from './kanji';
export * from './extras';
export * from './cast';

export const LESSONS: Lesson[] = [...KANA_LESSONS, ...JLPT_LESSONS, ...PRACTICAL_LESSONS];
export const LESSON_MAP = new Map(LESSONS.map(l => [l.id, l]));
export { KANA_LESSONS, JLPT_LESSONS, PRACTICAL_LESSONS };

/** Levels that have no written lessons yet — shown honestly in the app. */
export const UPCOMING_LEVELS = ['N3', 'N2', 'N1'] as const;

export const sentId = (lessonId: string, i: number) => `sent:${lessonId}:${i}`;
export const vocabId = (jp: string) => `vocab:${jp}`;
export const kanaId = (ch: string) => `kana:${ch}`;
export const kanjiId = (k: string) => `kanji:${k}`;

/** Every vocabulary word, de-duplicated, with the lesson that introduces it. */
export const ALL_VOCAB: (Vocab & { lessonId: string })[] = (() => {
  const seen = new Set<string>(); const out: (Vocab & { lessonId: string })[] = [];
  for (const l of LESSONS) for (const w of l.vocab) if (!seen.has(w.jp)) { seen.add(w.jp); out.push({ ...w, lessonId: l.id }); }
  for (const p of PACKS) for (const w of p.words) if (!seen.has(w.jp)) { seen.add(w.jp); out.push({ ...w, lessonId: p.id }); }
  return out;
})();
export const VOCAB_MAP = new Map(ALL_VOCAB.map(w => [w.jp, w]));

export const ALL_SENTENCES: (Sent & { id: string; lessonId: string })[] =
  LESSONS.flatMap(l => l.sentences.map((s, i) => ({ ...s, id: sentId(l.id, i), lessonId: l.id })));
export const SENT_MAP = new Map(ALL_SENTENCES.map(s => [s.id, s]));

/** The item ids a lesson teaches — used to measure lesson mastery. */
export function lessonItemIds(l: Lesson): string[] {
  return [
    ...(l.kana ?? []).map(kanaId),
    ...l.vocab.map(w => vocabId(w.jp)),
    ...l.sentences.map((_s, i) => sentId(l.id, i)),
  ];
}
