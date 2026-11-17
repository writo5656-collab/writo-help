// The full JLPT N5–N1 vocabulary and kanji library (loaded on demand).
// Sources: open-anki-jlpt-decks (JMdict meanings, © EDRDG, CC BY-SA 4.0) and
// kanji-data (KANJIDIC, © EDRDG, CC BY-SA 4.0). See scripts/build-library.mjs.
import type { Vocab } from './types';
import type { Kanji } from './kanji';

export interface LibWord extends Vocab { lvl: number }
export interface LibKanji { k: string; on: string; kun: string; en: string; lvl: number; strokes: number }
export interface Library { words: LibWord[]; kanji: LibKanji[]; wordMap: Map<string, LibWord>; kanjiMap: Map<string, LibKanji> }

export let LIB: Library | null = null;
let loading: Promise<Library> | null = null;

export function loadLibrary(): Promise<Library> {
  return (loading ??= Promise.all([import('./library/vocab.json'), import('./library/kanji.json')]).then(([v, k]) => {
    const words: LibWord[] = (v.default as [string, string, string, number][]).map(([jp, kana, en, lvl]) => ({ jp, kana, en, lvl }));
    const kanji: LibKanji[] = (k.default as [string, string, string, string, number, number][]).map(([kk, on, kun, en, lvl, strokes]) => ({ k: kk, on, kun, en, lvl, strokes }));
    LIB = { words, kanji, wordMap: new Map(words.map(w => [w.jp, w])), kanjiMap: new Map(kanji.map(x => [x.k, x])) };
    return LIB;
  }));
}

const PURE_KANJI = /^[㐀-鿿々]+$/;
/** Library kanji in the same shape as the hand-written N5 set. */
export function libKanjiAsKanji(x: LibKanji, lib: Library): Kanji {
  const words = lib.words.filter(w => w.jp.includes(x.k) && PURE_KANJI.test(w.jp) && w.kana !== w.jp)
    .sort((a, b) => b.lvl - a.lvl || a.jp.length - b.jp.length).slice(0, 4)
    .map(w => ({ f: `${w.jp}[${w.kana}]`, en: w.en }));
  return { k: x.k, on: x.on, kun: x.kun, en: x.en, level: `N${x.lvl}`, words };
}
