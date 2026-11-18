// What did the learner study today? Used to keep the casual call on topic.
import { db, dayKey, getKV } from './db';
import { LESSON_MAP, LESSONS, type Lesson } from '../content';
import { parseFuri } from './jp';

export async function todaysLessons(): Promise<Lesson[]> {
  const today = dayKey();
  const ids = [...new Set((await db.answers.where('day').equals(today).toArray()).map(a => a.lessonId).filter((x): x is string => !!x && LESSON_MAP.has(x)))];
  if (ids.length) return ids.map(id => LESSON_MAP.get(id)!).slice(-2);
  // Nothing yet today: use the most recently finished lesson, or the first one.
  const done = await getKV<Record<string, number>>('doneLessons', {});
  const last = Object.entries(done).sort((a, b) => b[1] - a[1])[0]?.[0];
  return [LESSON_MAP.get(last ?? '') ?? LESSONS.find(l => l.id === 'n5-01')!];
}

/** A compact summary of the lessons for the tutor's instructions. */
export function materialText(ls: Lesson[]): string {
  return ls.map(l => [
    `Lesson: ${l.title} (${l.jp}) — ${l.goal}`,
    `Words: ${l.vocab.map(w => `${w.jp}${w.kana !== w.jp ? `(${w.kana})` : ''}=${w.en}`).join('; ')}`,
    l.grammar.length ? `Grammar: ${l.grammar.map(g => `${g.p}: ${g.e}`).join(' | ')}` : '',
    l.sentences.length ? `Example sentences: ${l.sentences.map(s => `${parseFuri(s.f).jp} = ${s.en}`).join(' | ')}` : '',
  ].filter(Boolean).join('\n')).join('\n\n');
}
