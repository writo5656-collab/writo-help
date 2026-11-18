import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from './db';
import type { ItemState } from './srs';
import { buildPlan } from './plan';

export function useItems() {
  const items = useLiveQuery(() => db.items.toArray(), []);
  const map = useMemo(() => new Map<string, ItemState>((items ?? []).map(i => [i.id, i])), [items]);
  return { items, map };
}
export function usePlan() {
  const { items, map } = useItems();
  const days = useLiveQuery(() => db.days.toArray(), []);
  const sunday = useLiveQuery(async () => ({
    last: ((await db.kv.get('lastSunday'))?.value as string) ?? '',
    done: ((await db.kv.get('sundaysDone'))?.value as number) ?? 0,
    finished: new Set(Object.keys(((await db.kv.get('doneLessons'))?.value as Record<string, number>) ?? {})),
  }), []);
  const plan = useMemo(() => items && days && sunday ? buildPlan({
    items, studyDays: days.filter(d => d.xp > 0).map(d => d.day).sort(), lastSunday: sunday.last, sundaysDone: sunday.done, finished: sunday.finished,
  }) : undefined, [items, days, sunday]);
  return { plan, items, map, days, finished: sunday?.finished ?? new Set<string>() };
}

import { streakInfo, lastWeek, PLAN_SECONDS, type BlockId } from './daily';
import { dayKey, getKV, setKV, planTime } from './db';

/** Today's plan progress and the streak, live from the database. */
export function useDaily() {
  const days = useLiveQuery(() => db.days.toArray(), []);
  const today = dayKey();
  const blocks = useLiveQuery(async () => ((await db.kv.get(`plan:${today}`))?.value as BlockId[]) ?? [], [today]);
  return useMemo(() => {
    if (!days || !blocks) return undefined;
    const completed = new Set(days.filter(d => planTime(d) >= PLAN_SECONDS).map(d => d.day));
    const first = days.filter(d => d.seconds > 0 || d.xp > 0).map(d => d.day).sort()[0];
    const info = streakInfo(completed, first, today);
    const td = days.find(d => d.day === today);
    const seconds = td ? planTime(td) : 0; // only time spent inside today's plan
    return { info, week: lastWeek(info, today), seconds, left: Math.max(0, PLAN_SECONDS - seconds), blocks, today, score: days.reduce((a, d) => a + d.xp, 0), studied: completed.size };
  }, [days, blocks, today]);
}

export async function markBlock(id: BlockId) {
  const k = `plan:${dayKey()}`;
  const cur = await getKV<BlockId[]>(k, []);
  if (!cur.includes(id)) await setKV(k, [...cur, id]);
}
