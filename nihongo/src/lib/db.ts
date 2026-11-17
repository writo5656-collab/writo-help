// Local database (IndexedDB via Dexie). Everything the learner does is stored
// on the device; nothing is sent anywhere unless the AI tutor is configured.
import Dexie, { type Table } from 'dexie';
import { type ItemState, type Grade, newItem, review, setStatus } from './srs';

export interface Mistake {
  id?: number; itemId: string; lessonId?: string; skill: string;
  prompt: string; userAnswer: string; expected: string; explanation: string;
  date: number; status: 'remembered' | 'uncertain' | 'forgotten';
  /** Enough data to rebuild the exercise for a retry. */
  ex?: unknown;
}
export interface Answer { id?: number; ts: number; day: string; skill: string; itemId: string; ok: boolean; lessonId?: string }
export interface Note { id: string; title: string; folder: string; body: string; paper: 'lined' | 'grid'; created: number; updated: number; drawing?: string }
export interface DayLog { day: string; seconds: number; xp: number }
export interface KV { key: string; value: unknown }
export interface PortraitRec { id: string; data?: string; url?: string; fetched?: number; custom?: Partial<Record<'teach' | 'happy' | 'oops', string>> }
export interface Correction { id?: number; ts: number; said: string; better: string; why: string; source: string }

class DB extends Dexie {
  kv!: Table<KV, string>;
  items!: Table<ItemState, string>;
  mistakes!: Table<Mistake, number>;
  answers!: Table<Answer, number>;
  notes!: Table<Note, string>;
  days!: Table<DayLog, string>;
  corrections!: Table<Correction, number>;
  portraits!: Table<PortraitRec, string>;
  constructor() {
    super('nihongo');
    this.version(1).stores({
      kv: 'key',
      items: 'id, kind, status, due',
      mistakes: '++id, itemId, date, status',
      answers: '++id, ts, day, skill, itemId',
      notes: 'id, folder, updated',
      days: 'day',
      corrections: '++id, ts',
    });
    this.version(2).stores({ portraits: 'id' });
  }
}
export const db = new DB();

export function dayKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export async function getKV<T>(key: string, fallback: T): Promise<T> {
  const r = await db.kv.get(key);
  return r ? (r.value as T) : fallback;
}
export async function setKV(key: string, value: unknown) { await db.kv.put({ key, value }); }

/** Record one answer: updates the SRS state, the answer log and XP. */
export async function recordAnswer(o: { itemId: string; kind: string; skill: string; grade: Grade; lessonId?: string }) {
  const now = Date.now();
  await db.transaction('rw', db.items, db.answers, db.days, async () => {
    const cur = (await db.items.get(o.itemId)) ?? newItem(o.itemId, o.kind, now);
    await db.items.put(review(cur, o.grade, now));
    if (o.grade !== 'retry') {
      await db.answers.add({ ts: now, day: dayKey(), skill: o.skill, itemId: o.itemId, ok: o.grade !== 'again', lessonId: o.lessonId });
    }
    const xp = o.grade === 'good' ? 5 : o.grade === 'hard' ? 3 : o.grade === 'retry' ? 1 : 0;
    const d = (await db.days.get(dayKey())) ?? { day: dayKey(), seconds: 0, xp: 0 };
    await db.days.put({ ...d, xp: d.xp + xp });
  });
}

export async function addMistake(m: Omit<Mistake, 'id' | 'date' | 'status'>) {
  // One open entry per item: update it instead of piling up duplicates.
  const old = await db.mistakes.where('itemId').equals(m.itemId).first();
  if (old) await db.mistakes.update(old.id!, { ...m, date: Date.now(), status: 'forgotten' });
  else await db.mistakes.add({ ...m, date: Date.now(), status: 'forgotten' });
}

export async function labelMistake(id: number, status: Mistake['status']) {
  const m = await db.mistakes.get(id);
  if (!m) return;
  await db.mistakes.update(id, { status });
  const it = await db.items.get(m.itemId);
  if (it) await db.items.put(setStatus(it, status));
}

export async function addSeconds(sec: number) {
  const d = (await db.days.get(dayKey())) ?? { day: dayKey(), seconds: 0, xp: 0 };
  await db.days.put({ ...d, seconds: d.seconds + sec });
}

/** Mark items as already known (used by the placement check). */
export async function seedKnown(ids: { id: string; kind: string }[]) {
  const now = Date.now();
  await db.items.bulkPut(ids.map(({ id, kind }) => ({
    ...newItem(id, kind, now), status: 'remembered' as const, interval: 4, reps: 2, due: now + 4 * 86400000, seen: 1, right: 1, lastSeen: now,
  })));
}
