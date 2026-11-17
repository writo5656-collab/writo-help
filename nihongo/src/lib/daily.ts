// The daily 25-minute plan and the streak.
//  - A day counts for the streak once you have studied 25 minutes that day.
//  - You hold up to 3 streak freezes. A missed day uses one up automatically
//    and the streak survives. With none left, a missed day breaks the streak.
//  - Every 7 completed days earns one freeze back (up to 3).
// All pure functions, so they are easy to test.
export const PLAN_MIN = 25;
export const PLAN_SECONDS = PLAN_MIN * 60;
export const MAX_FREEZES = 3;
export const EARN_EVERY = 7;

export type BlockId = 'review' | 'lesson' | 'sentences' | 'real';
export const BLOCKS: { id: BlockId; min: number; title: string; sub: string }[] = [
  { id: 'review', min: 5, title: 'Spaced revision', sub: 'What you are about to forget, weakest first' },
  { id: 'lesson', min: 8, title: 'New lesson', sub: 'One part of your next lesson' },
  { id: 'sentences', min: 7, title: 'Sentence practice', sub: 'Write full sentences in your notebook' },
  { id: 'real', min: 5, title: 'Real-life challenge', sub: 'A spoken call with your teacher' },
];

const pad = (n: number) => String(n).padStart(2, '0');
export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const addDays = (k: string, n: number) => { const d = fromKey(k); d.setDate(d.getDate() + n); return keyOf(d); };

export type DayStatus = 'done' | 'frozen' | 'missed' | 'today' | 'future' | 'before';
export interface StreakInfo {
  current: number; best: number; freezes: number;
  todayDone: boolean; atRisk: boolean;
  status: Map<string, DayStatus>;
}

/** Work out the streak from the days on which the 25-minute plan was completed. */
export function streakInfo(completed: Set<string>, firstDay: string | undefined, today: string): StreakInfo {
  const status = new Map<string, DayStatus>();
  let run = 0, best = 0, freezes = MAX_FREEZES, sinceEarn = 0;
  if (firstDay && firstDay < today) {
    for (let d = firstDay; d < today; d = addDays(d, 1)) {
      if (completed.has(d)) {
        run++; best = Math.max(best, run); status.set(d, 'done');
        if (++sinceEarn >= EARN_EVERY) { sinceEarn = 0; if (freezes < MAX_FREEZES) freezes++; }
      } else if (run > 0 && freezes > 0) {
        freezes--; status.set(d, 'frozen');            // the streak survives, but this day does not add to it
      } else {
        run = 0; sinceEarn = 0; status.set(d, 'missed');
      }
    }
  }
  const todayDone = completed.has(today);
  if (todayDone) { run++; best = Math.max(best, run); }
  status.set(today, todayDone ? 'done' : 'today');
  return { current: run, best, freezes, todayDone, atRisk: !todayDone && run > 0, status };
}

/** The seven days ending today, for the week strip and the widget. */
export function lastWeek(info: StreakInfo, today: string): { key: string; label: string; status: DayStatus }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const k = addDays(today, i - 6);
    return { key: k, label: 'SMTWTFS'[fromKey(k).getDay()], status: info.status.get(k) ?? 'before' };
  });
}

/** Which plan block to do next. */
export function nextBlock(done: BlockId[]): BlockId | undefined {
  return BLOCKS.find(b => !done.includes(b.id))?.id;
}

/** Character messages for streak reminders (original lines). */
export const NUDGES: { who: string; at: 'evening' | 'late' | 'last'; text: (n: number) => string }[] = [
  { who: 'mai', at: 'evening', text: n => `大丈夫？ You haven't done today's 25 minutes yet. ${n ? `Your ${n}-day streak is waiting.` : 'Let\'s start one today.'}` },
  { who: 'hinata', at: 'evening', text: () => 'U-um… are you feeling okay? I\'ll wait for you. Just 25 minutes, together?' },
  { who: 'mahiru', at: 'evening', text: () => 'I made some tea. Shall we study for a little while? お疲れさまです。' },
  { who: 'marin', at: 'evening', text: n => `Heyyy! Today's plan is still open! ${n ? `${n} days in a row — don't drop it now!` : 'Let\'s do it together!'}` },
  { who: 'hina', at: 'late', text: n => `Oi! You're about to break your ${n}-day streak! A few more minutes — you can do it!` },
  { who: 'chinatsu', at: 'late', text: () => 'Still time before midnight. Warm up with a quick review, then finish strong. ファイト！' },
  { who: 'kaoruko', at: 'late', text: () => 'Are you busy today? Even a short lesson counts. I believe in you!' },
  { who: 'tsunade', at: 'last', text: n => `Last call. Your ${n}-day streak breaks at midnight. No excuses — 25 minutes, now.` },
  { who: 'alya', at: 'last', text: () => '…It\'s not like I was waiting for you. But your streak ends at midnight. Hurry.' },
  { who: 'sakura', at: 'last', text: () => 'しゃーんなろー！ Midnight is close! Get in here and finish your plan!' },
];
