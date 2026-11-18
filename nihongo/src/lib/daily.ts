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
  { id: 'real', min: 5, title: 'Real-life challenge', sub: 'Talk with your teacher and read real Japanese signs' },
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

/** Teacher messages for notifications (original lines). Many kinds, so they rarely repeat. */
export type NudgeAt = 'morning' | 'evening' | 'late' | 'last' | 'sunday' | 'milestone' | 'freeze';
export const NUDGES: { who: string; at: NudgeAt; text: (n: number) => string }[] = [
  // Morning hellos
  { who: 'mahiru', at: 'morning', text: () => 'おはようございます。 Breakfast first, then 25 minutes of Japanese with me?' },
  { who: 'chinatsu', at: 'morning', text: () => 'おはよう！ Morning practice is the best practice. Quick review before school or work?' },
  { who: 'marin', at: 'morning', text: () => 'Goood morning!! New day, new words. Let\'s go! 💪' },
  { who: 'mai', at: 'morning', text: n => `おはよう。 ${n ? `Day ${n + 1} of your streak starts now.` : 'Today is a good day to start.'} Don\'t keep me waiting.` },
  { who: 'kaoruko', at: 'morning', text: () => 'おはようございます！ I brought cake. Let\'s study a little first, okay? 🍰' },
  { who: 'yuki', at: 'morning', text: () => 'Good morning. A little every day beats a lot once a week. 今日もよろしくお願いします。' },
  { who: 'tomoe', at: 'morning', text: () => 'おはよ〜！ Five minutes on the train counts too, you know!' },
  { who: 'hori', at: 'morning', text: () => 'Morning! Sota\'s still asleep, so it\'s quiet. Perfect time to study.' },
  // Evening nudges
  { who: 'mai', at: 'evening', text: n => `大丈夫？ You haven't done today's 25 minutes yet. ${n ? `Your ${n}-day streak is waiting.` : 'Let\'s start one today.'}` },
  { who: 'hinata', at: 'evening', text: () => 'U-um… are you feeling okay? I\'ll wait for you. Just 25 minutes, together?' },
  { who: 'mahiru', at: 'evening', text: () => 'I made some tea. Shall we study for a little while? お疲れさまです。' },
  { who: 'marin', at: 'evening', text: n => `Heyyy! Today's plan is still open! ${n ? `${n} days in a row — don't drop it now!` : 'Let\'s do it together!'}` },
  { who: 'rio', at: 'evening', text: () => 'Hypothesis: 25 minutes now means a calmer night. Shall we test it?' },
  { who: 'masha', at: 'evening', text: () => 'お疲れさま〜。 Long day? Come sit with me and do a gentle review.' },
  { who: 'juju', at: 'evening', text: () => 'Hmph. You\'re not skipping today, are you? …I\'ll be waiting.' },
  { who: 'ino', at: 'evening', text: () => 'The shop\'s closed, so I\'m free. Your plan isn\'t done yet — let\'s finish it!' },
  { who: 'yuki', at: 'evening', text: () => 'Shall we have a quick lesson after dinner? I\'ll go easy on you. Maybe.' },
  { who: 'tomoe', at: 'evening', text: () => 'Senpai said studying in the evening helps you remember. Let\'s try!' },
  // Late warnings
  { who: 'hina', at: 'late', text: n => `Oi! You're about to break your ${n}-day streak! A few more minutes — you can do it!` },
  { who: 'chinatsu', at: 'late', text: () => 'Still time before midnight. Warm up with a quick review, then finish strong. ファイト！' },
  { who: 'kaoruko', at: 'late', text: () => 'Are you busy today? Even a short lesson counts. I believe in you!' },
  { who: 'hinata', at: 'late', text: () => 'I-it\'s getting late… are you all right? Please don\'t forget today\'s practice.' },
  { who: 'marin', at: 'late', text: n => `Nooo your ${n}-day streak!! Come quick, I'll cheer you on!` },
  { who: 'mahiru', at: 'late', text: () => 'It\'s late, so let\'s keep it light: review first, then you can rest.' },
  { who: 'masha', at: 'late', text: () => 'Mm, still awake? Let\'s finish today together, then sweet dreams.' },
  // Last call
  { who: 'tsunade', at: 'last', text: n => `Last call. Your ${n}-day streak breaks at midnight. No excuses — 25 minutes, now.` },
  { who: 'alya', at: 'last', text: () => '…It\'s not like I was waiting for you. But your streak ends at midnight. Hurry.' },
  { who: 'sakura', at: 'last', text: () => 'しゃーんなろー！ Midnight is close! Get in here and finish your plan!' },
  { who: 'mai', at: 'last', text: () => 'It\'s almost midnight. Are you really going to stand me up?' },
  { who: 'hina', at: 'last', text: () => 'Final set! Midnight is the buzzer — let\'s finish this!' },
  { who: 'juju', at: 'last', text: () => 'If you break your streak I\'ll be… disappointed. Not that I care. Go!' },
  // Sunday review
  { who: 'yuki', at: 'sunday', text: () => 'It\'s Sunday — review day. Let\'s look back over your week together.' },
  { who: 'mahiru', at: 'sunday', text: () => 'Sunday review is ready. Tea, a blanket, and your week\'s words. ゆっくりしましょう。' },
  { who: 'rio', at: 'sunday', text: () => 'Sunday: time to measure what stuck this week. The review is waiting.' },
  { who: 'mai', at: 'sunday', text: () => 'Sunday review day. Show me what you remember.' },
  // Milestones and freezes
  { who: 'marin', at: 'milestone', text: n => `One more day and you hit a ${n + 1}-day streak!! Don't miss it!` },
  { who: 'tsunade', at: 'milestone', text: n => `${n} days in a row. Not bad. Tomorrow makes it ${n + 1}.` },
  { who: 'hinata', at: 'freeze', text: () => 'If today slips by, a ❄ freeze will cover it… but I\'d rather see you here.' },
  { who: 'alya', at: 'freeze', text: n => `You have no freezes left. Miss today and the ${n}-day streak is gone. Just saying.` },
];
