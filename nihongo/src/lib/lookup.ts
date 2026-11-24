// Word lookup for tap-to-translate: course words first (their meanings match
// the lessons), then the full JLPT library once it has loaded.
import { useEffect, useMemo, useState } from 'react';
import type { Vocab } from '../content/types';
import { ALL_VOCAB } from '../content';
import { LIB, loadLibrary } from '../content/library';

let cache: Map<string, Vocab> | null = null;
let cacheHasLib = false;

export function lookupMap(): Map<string, Vocab> {
  if (cache && (cacheHasLib || !LIB)) return cache;
  const m = new Map<string, Vocab>();
  if (LIB) for (const w of LIB.words) { if (!m.has(w.jp)) m.set(w.jp, w); if (w.kana && !m.has(w.kana)) m.set(w.kana, w); }
  for (const w of ALL_VOCAB) { m.set(w.jp, w); if (w.kana && !ALL_VOCAB.some(x => x.jp === w.kana)) m.set(w.kana, w); }
  cache = m; cacheHasLib = !!LIB;
  return m;
}

/** A lookup function that improves once the big library has loaded. */
export function useLookup(): (jp: string) => Vocab | undefined {
  const [ready, setReady] = useState(!!LIB);
  useEffect(() => { if (!LIB) void loadLibrary().then(() => setReady(true)).catch(() => undefined); }, []);
  return useMemo(() => { const m = lookupMap(); return (jp: string) => m.get(jp); }, [ready]);
}
