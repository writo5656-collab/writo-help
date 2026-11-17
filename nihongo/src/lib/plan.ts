// Today's suggested plan. Progress is mastery-based: nothing is ever locked,
// the plan only recommends what to do next based on evidence.
import { LESSONS, KANA_LESSONS, JLPT_LESSONS, PRACTICAL_LESSONS, lessonItemIds, type Lesson } from '../content';
import { type ItemState, isKnown, isMastered, dueItems, DAY } from './srs';

export interface LessonProgress { seen: number; mastered: number; total: number; pct: number; done: boolean }
export function lessonProgress(l: Lesson, items: Map<string, ItemState>, finished?: Set<string>): LessonProgress {
  const ids = lessonItemIds(l);
  const seen = ids.filter(id => isKnown(items.get(id)) || items.get(id)?.status === 'uncertain').length;
  const mastered = ids.filter(id => isMastered(items.get(id))).length;
  const total = ids.length || 1;
  // A lesson counts as "done" when most of it is known. Missing a day never undoes this.
  const pct = Math.round(((seen * 0.5 + mastered * 0.5) / total) * 100);
  // Done once its practice has been completed (or it is already mostly known). Mistakes go to review; they never hold you back.
  return { seen, mastered, total, pct, done: !!finished?.has(l.id) || seen / total >= 0.8 };
}

export function trackProgress(lessons: Lesson[], items: Map<string, ItemState>, finished?: Set<string>) {
  const ps = lessons.map(l => lessonProgress(l, items, finished));
  return Math.round(ps.reduce((a, p) => a + (p.done ? Math.max(p.pct, 60) : p.pct), 0) / Math.max(1, ps.length));
}

export function nextLesson(lessons: Lesson[], items: Map<string, ItemState>, finished?: Set<string>): Lesson | undefined {
  return lessons.find(l => !lessonProgress(l, items, finished).done);
}

/** ISO-like week key for the Sunday that starts the week containing d. */
export function sundayKey(d = new Date()): string {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  return `${s.getFullYear()}-${s.getMonth() + 1}-${s.getDate()}`;
}

export interface Plan {
  focus: 'jlpt' | 'practical' | 'review';
  cycleDay: number;                 // 1-4 in the repeating study cycle
  due: number;
  lesson?: Lesson;
  practical?: Lesson;
  sundayPending: boolean;
  sundayWeeks: number;              // how many weeks the cumulative review covers
}

export function buildPlan(o: { items: ItemState[]; studyDays: string[]; lastSunday: string; sundaysDone: number; finished?: Set<string>; now?: Date }): Plan {
  const now = o.now ?? new Date();
  const map = new Map(o.items.map(i => [i.id, i]));
  const kana = nextLesson(KANA_LESSONS, map, o.finished);
  const jlpt = nextLesson(JLPT_LESSONS, map, o.finished);
  const practical = nextLesson(PRACTICAL_LESSONS, map, o.finished);
  // The cycle counts days actually studied, never calendar days.
  const studied = o.studyDays.filter(d => d !== todayKey(now)).length;
  const cycleDay = (studied % 4) + 1;
  const first = o.studyDays[0];
  // A Sunday review is offered on Sunday, and carried forward (never lost) if missed.
  const hasWeek = !!first && now.getTime() - new Date(first).getTime() >= 5 * DAY;
  const sundayPending = o.studyDays.length >= 3 && o.lastSunday !== sundayKey(now) && (now.getDay() === 0 || hasWeek);
  const focus: Plan['focus'] = sundayPending && now.getDay() === 0 ? 'review' : cycleDay <= 2 ? 'jlpt' : 'practical';
  const lesson = focus === 'practical' ? (practical ?? jlpt ?? kana) : (kana ?? jlpt ?? practical);
  return { focus, cycleDay, due: dueItems(o.items, now.getTime()).length, lesson, practical: practical ?? PRACTICAL_LESSONS[0], sundayPending, sundayWeeks: o.sundaysDone + 1 };
}

function todayKey(d: Date) { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export { LESSONS };

/** Current and best run of consecutive study days. Today not studied yet does not break it. */
export function streaks(studied: string[], now = new Date()): { current: number; best: number } {
  const set = new Set(studied);
  const key = (d: Date) => todayKey(d);
  let current = 0;
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!set.has(key(d))) d.setDate(d.getDate() - 1);
  while (set.has(key(d))) { current++; d.setDate(d.getDate() - 1); }
  let best = 0, run = 0, prev = 0;
  for (const s of [...set].sort()) {
    const t = new Date(s + 'T12:00:00').getTime();
    run = prev && Math.round((t - prev) / DAY) === 1 ? run + 1 : 1;
    best = Math.max(best, run); prev = t;
  }
  return { current, best: Math.max(best, current) };
}

/** The lesson that follows this one: kana → JLPT in order; practical in its own order. */
export function lessonAfter(id: string): Lesson | undefined {
  const main = [...KANA_LESSONS, ...JLPT_LESSONS];
  for (const list of [main, PRACTICAL_LESSONS]) { const i = list.findIndex(l => l.id === id); if (i >= 0) return list[i + 1]; }
  return undefined;
}
