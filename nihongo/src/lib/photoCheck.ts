// Checks a spoken reading of a real-photo sign against its expected kana.
import { toHiragana } from 'wanakana';
import { normalize } from './jp';
import { similarity } from './check';

const kanaOnly = (s: string) => toHiragana(normalize(s)).replace(/[^぀-ゟー]/g, '');

/** heard = what speech recognition returned; heardKana = the same text with kanji turned into kana. */
export function judgeReading(heard: string, heardKana: string, read: string, kana: string): { ok: boolean; score: number } {
  const want = kanaOnly(kana);
  if (!heard.trim()) return { ok: false, score: 0 };
  if (normalize(heard).includes(normalize(read).replace(/[・]/g, ''))) return { ok: true, score: 1 };
  const got = kanaOnly(heardKana || heard);
  if (!got) return { ok: false, score: 0 };
  if (got.includes(want)) return { ok: true, score: 1 };
  const score = similarity(got, want);
  return { ok: score >= 0.7, score };
}
