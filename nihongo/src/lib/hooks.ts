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
