// Spaced repetition. Weak items come back sooner; remembered items come back
// later but are never abandoned. Pure functions so they are easy to test.
export type Status = 'new' | 'learning' | 'remembered' | 'uncertain' | 'forgotten';
export type Grade =
  | 'good'   // correct, first try, no hint
  | 'hard'   // correct but used a hint
  | 'again'  // incorrect
  | 'retry'; // correct only after seeing the solution — does NOT count as mastery

export interface ItemState {
  id: string;
  kind: string;          // kana | vocab | kanji | sentence | grammar
  status: Status;
  interval: number;      // days until next review
  ease: number;
  reps: number;          // successful recalls in a row
  due: number;           // timestamp (ms)
  seen: number; right: number; wrong: number; hints: number;
  lastSeen: number;
}

export const DAY = 86400000;
const MIN = 60000;

export function newItem(id: string, kind: string, now = Date.now()): ItemState {
  return { id, kind, status: 'new', interval: 0, ease: 2.3, reps: 0, due: now, seen: 0, right: 0, wrong: 0, hints: 0, lastSeen: 0 };
}

export function review(it: ItemState, grade: Grade, now = Date.now()): ItemState {
  const s = { ...it, seen: it.seen + 1, lastSeen: now };
  switch (grade) {
    case 'good': {
      s.right++; s.reps++;
      s.interval = s.reps === 1 ? 1 : s.reps === 2 ? 3 : Math.round(Math.max(s.interval, 1) * s.ease);
      s.ease = Math.min(2.8, s.ease + 0.05);
      // "Remembered" needs a successful recall on a later day, not just today.
      s.status = s.reps >= 2 ? 'remembered' : 'learning';
      s.due = now + s.interval * DAY;
      break;
    }
    case 'hard': {
      s.right++; s.hints++;
      s.interval = Math.max(1, Math.round(s.interval * 0.6));
      s.ease = Math.max(1.5, s.ease - 0.1);
      s.status = 'uncertain';
      s.due = now + s.interval * DAY;
      break;
    }
    case 'again': {
      s.wrong++; s.reps = 0; s.interval = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.status = 'forgotten';
      s.due = now + 10 * MIN;
      break;
    }
    case 'retry': {
      // Typed correctly right after seeing the answer: keep it weak and test again later, unaided.
      s.due = Math.min(s.due, now + 10 * MIN);
      break;
    }
  }
  return s;
}

/** Manual label from the Mistake Notebook. */
export function setStatus(it: ItemState, status: 'remembered' | 'uncertain' | 'forgotten', now = Date.now()): ItemState {
  const s = { ...it, status };
  if (status === 'remembered') { s.interval = Math.max(s.interval, 4); s.reps = Math.max(s.reps, 2); s.due = now + s.interval * DAY; }
  if (status === 'uncertain') { s.interval = 1; s.due = now + DAY; }
  if (status === 'forgotten') { s.interval = 0; s.reps = 0; s.due = now; }
  return s;
}

/** Higher = more urgent. Forgotten and long-overdue items come first. */
export function risk(it: ItemState, now = Date.now()): number {
  const overdue = (now - it.due) / DAY;
  const weight = { forgotten: 3, uncertain: 2, learning: 1.5, new: 1, remembered: 1 }[it.status];
  return weight * (1 + Math.max(0, overdue) / Math.max(1, it.interval)) + it.wrong / Math.max(1, it.seen);
}

export function dueItems(items: ItemState[], now = Date.now()): ItemState[] {
  return items.filter(i => i.status !== 'new' && i.due <= now).sort((a, b) => risk(b, now) - risk(a, now));
}

/** Counts as mastered when remembered across days. */
export function isMastered(it?: ItemState) { return !!it && it.status === 'remembered' && it.interval >= 3; }
export function isKnown(it?: ItemState) { return !!it && (it.status === 'remembered' || it.status === 'learning'); }
