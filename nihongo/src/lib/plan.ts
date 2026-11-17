// Today's suggested plan. Progress is mastery-based: nothing is ever locked,
// the plan only recommends what to do next based on evidence.
import { LESSONS, KANA_LESSONS, JLPT_LESSONS, PRACTICAL_LESSONS, lessonItemIds, type Lesson } from '../content';
import { type ItemState, isKnown, isMastered, dueItems, DAY } from './srs';

export interface LessonProgress { seen: number; mastered: number; total: number; pct: number; done: boolean }
export function lessonProgress(l: Lesson, items: Map<string, ItemState>): LessonProgress {
  const ids = lessonItemIds(l);
  const seen = ids.filter(id => isKnown(items.get(id)) || items.get(id)?.status === 'uncertain').length;
  const mastered = ids.filter(id => isMastered(items.get(id))).length;
  const total = ids.length || 1;
  // A lesson counts as "done" when most of it is known. Missing a day never undoes this.
  const pct = Math.round(((seen * 0.5 + mastered * 0.5) / total) * 100);
  return { seen, mastered, total, pct, done: seen / total >= 0.8 };
}

export function trackProgress(lessons: Lesson[], items: Map<string, ItemState>) {
  const ps = lessons.map(l => lessonProgress(l, items));
  return Math.round(ps.reduce((a, p) => a + p.pct, 0) / Math.max(1, ps.length));
}

export function nextLesson(lessons: Lesson[], items: Map<string, ItemState>): Lesson | undefined {
  return lessons.find(l => !lessonProgress(l, items).done);
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

export function buildPlan(o: { items: ItemState[]; studyDays: string[]; lastSunday: string; sundaysDone: number; now?: Date }): Plan {
  const now = o.now ?? new Date();
  const map = new Map(o.items.map(i => [i.id, i]));
  const kana = nextLesson(KANA_LESSONS, map);
  const jlpt = nextLesson(JLPT_LESSONS, map);
  const practical = nextLesson(PRACTICAL_LESSONS, map);
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
