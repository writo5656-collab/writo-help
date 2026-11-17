// Builds each lesson's manga-style story from the lesson's own sentences:
// the guide introduces the topic, the goof makes a typical mistake, the guide
// fixes it — then the learner checks they spotted the right version.
import type { Lesson } from './types';
import { LESSON_CAST, CAST, castFor } from './cast';
import { parseFuri } from '../lib/jp';

export interface Panel { who: string; f: string; en: string; size?: 'wide' | 'tall' | 'normal'; mood?: 'oops' | 'fix' | 'ok' }
export interface Story { title: string; panels: Panel[]; correct: string; wrong: string[]; mistakeNote: string }

// A plausible wrong particle for each correct one.
const SWAP: Record<string, string[]> = {
  'を': ['が', 'に'], 'は': ['を', 'が'], 'が': ['を', 'は'], 'に': ['を', 'で'], 'へ': ['を', 'で'], 'で': ['に', 'を'],
  'の': ['は', 'が'], 'と': ['に', 'を'], 'も': ['は', 'が'], 'か': ['ね', 'よ'], 'から': ['まで', 'に'], 'まで': ['から', 'に'],
};
// Kana that learners (and Naruto) confuse.
const LOOKALIKE: Record<string, string> = {
  'さ': 'ち', 'ち': 'さ', 'ぬ': 'め', 'め': 'ぬ', 'ね': 'れ', 'れ': 'わ', 'わ': 'ね', 'は': 'ほ', 'ほ': 'は', 'る': 'ろ', 'ろ': 'る',
  'き': 'さ', 'あ': 'お', 'お': 'あ', 'い': 'り', 'り': 'い', 'く': 'へ', 'つ': 'し', 'し': 'つ', 'ぱ': 'ば', 'ば': 'ぱ', 'ぴ': 'び', 'ぷ': 'ぶ',
  'シ': 'ツ', 'ツ': 'シ', 'ソ': 'ン', 'ン': 'ソ', 'ク': 'ケ', 'ケ': 'ク', 'ア': 'マ', 'マ': 'ア', 'ラ': 'ヲ', 'ル': 'レ', 'レ': 'ル', 'ス': 'ヌ', 'ヌ': 'ス',
  'ー': 'ｰ', 'ブ': 'プ', 'プ': 'ブ', 'パ': 'バ', 'バ': 'パ', 'ビ': 'ピ', 'ピ': 'ビ', 'ト': 'ド',
};

const wrongWith = (f: string, part: string, alt: string) => f.replace(`{${part}}`, alt);

export function storyFor(l: Lesson): Story | null {
  const c = LESSON_CAST[l.id] ?? { ...castFor(l.id), intro: ['いっしょに勉強[べんきょう]しよう！', 'Let\'s study together!'] as [string, string] };
  const guide = CAST[c.guide], goof = CAST[c.goof];
  const no = guide.polite ? '違[ちが]いますよ。' : 'ちがうよ。';
  const gotIt = goof.polite ? 'あ、なるほど！ ありがとうございます！' : 'あ、そっか！ サンキュー！';
  const intro: Panel = { who: guide.id, f: c.intro[0], en: c.intro[1], size: 'wide' };

  // Kana lessons: the goof misreads a look-alike character.
  if (l.kana) {
    const w = l.vocab.find(v => [...v.jp].some(ch => LOOKALIKE[ch]));
    if (!w) return null;
    const i = [...w.jp].findIndex(ch => LOOKALIKE[ch]);
    const chars = [...w.jp]; const bad = [...chars]; bad[i] = LOOKALIKE[chars[i]];
    const wrong = bad.join('');
    return {
      title: `${guide.name} & ${goof.name}`, correct: w.jp, wrong: [wrong, ...l.vocab.filter(v => v.jp !== w.jp).slice(0, 1).map(v => v.jp)],
      mistakeNote: `${goof.name} confused ${chars[i]} with ${LOOKALIKE[chars[i]]}. Look closely at the shapes.`,
      panels: [intro,
        { who: goof.id, f: `これ、「${wrong}」でしょ？`, en: `This says "${wrong}", right? (He means ${w.en}.)`, mood: 'oops' },
        { who: guide.id, f: `${no}「${w.jp}」！`, en: `No — it's "${w.jp}" (${w.en}).`, mood: 'fix', size: 'tall' },
        { who: goof.id, f: gotIt, en: 'Oh, I get it! Thanks!', mood: 'ok' },
      ],
    };
  }

  // Sentence lessons: the goof uses the wrong particle in one of the lesson's sentences.
  const s = l.sentences.find(x => /\{[^}]+\}/.test(x.f) && SWAP[x.f.match(/\{([^}]+)\}/)![1]]);
  if (!s) return null;
  const part = s.f.match(/\{([^}]+)\}/)![1];
  const [w1, w2] = SWAP[part];
  const bad1 = wrongWith(s.f, part, w1), bad2 = wrongWith(s.f, part, w2);
  const correct = parseFuri(s.f).jp;
  const dialogue: Panel[] = (l.dialogue ?? []).slice(0, 4).map(d => ({ who: d.who === 'You' ? 'you' : `role:${d.who}`, f: d.f, en: d.en }));
  return {
    title: `${guide.name} & ${goof.name}`, correct, wrong: [parseFuri(bad1).jp, parseFuri(bad2).jp],
    mistakeNote: `${goof.name} used ${w1} where the sentence needs ${part}.`,
    panels: [intro, ...dialogue,
      { who: goof.id, f: bad1, en: `(Trying to say: "${s.en}")`, mood: 'oops' },
      { who: guide.id, f: `${no} 「${s.f}」`, en: `It's ${part} here: "${s.en}"`, mood: 'fix', size: 'wide' },
      { who: goof.id, f: gotIt, en: 'Oh, I get it! Thanks!', mood: 'ok' },
    ],
  };
}
