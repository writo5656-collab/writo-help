// Curriculum data types. Content lives in this folder, separate from app code,
// so lessons can be edited or added without touching screens.
export type Track = 'kana' | 'jlpt' | 'practical';
export type Level = 'Kana' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export interface Sent { f: string; en: string; alt?: string[]; note?: string }
export interface Vocab { jp: string; kana: string; en: string }
export interface Grammar { p: string; e: string }
export interface SceneItem { f: string; en: string; action: string }
export interface Scene { title: string; place: string; kind: 'sign' | 'menu' | 'screen' | 'desk'; items: SceneItem[] }
export interface Line { who: string; f: string; en: string }
export interface Choice { q: string; options: string[]; a: number; why: string }

export interface Lesson {
  id: string; track: Track; level: Level;
  title: string; jp: string; goal: string;
  kana?: string[];              // kana lessons: characters taught
  kanji?: string;               // kanji introduced (looked up in kanji.ts)
  vocab: Vocab[];
  grammar: Grammar[];
  sentences: Sent[];
  scene?: Scene;
  dialogue?: Line[];
  choices?: Choice[];           // "choose the natural expression"
  source: string;               // provenance, so content can be reviewed
}

/** "水|みず|water" → Vocab. Keeps content files compact. */
export const v = (s: string): Vocab => { const [jp, kana, en] = s.split('|'); return { jp, kana: kana || jp, en }; };
export const vs = (list: string): Vocab[] => list.trim().split('\n').map(x => v(x.trim()));
export const SRC = 'Original sentences written for this app; grammar scope follows the public JLPT N5/N4 outline and the can-do themes of Japan Foundation IRODORI. Needs periodic review by a fluent speaker.';
