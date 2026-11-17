// Kana tables and the kana lessons generated from them.
import { type Lesson, vs, SRC } from './types';

export const HIRA: Record<string, string> = {};
export const KATA: Record<string, string> = {};
const rows: [string, string, string][] = [
  // romaji, hiragana, katakana
  ['a i u e o', 'あいうえお', 'アイウエオ'],
  ['ka ki ku ke ko', 'かきくけこ', 'カキクケコ'],
  ['sa shi su se so', 'さしすせそ', 'サシスセソ'],
  ['ta chi tsu te to', 'たちつてと', 'タチツテト'],
  ['na ni nu ne no', 'なにぬねの', 'ナニヌネノ'],
  ['ha hi fu he ho', 'はひふへほ', 'ハヒフヘホ'],
  ['ma mi mu me mo', 'まみむめも', 'マミムメモ'],
  ['ya yu yo', 'やゆよ', 'ヤユヨ'],
  ['ra ri ru re ro', 'らりるれろ', 'ラリルレロ'],
  ['wa wo n', 'わをん', 'ワヲン'],
  ['ga gi gu ge go', 'がぎぐげご', 'ガギグゲゴ'],
  ['za ji zu ze zo', 'ざじずぜぞ', 'ザジズゼゾ'],
  ['da ji zu de do', 'だぢづでど', 'ダヂヅデド'],
  ['ba bi bu be bo', 'ばびぶべぼ', 'バビブベボ'],
  ['pa pi pu pe po', 'ぱぴぷぺぽ', 'パピプペポ'],
];
export const ROWS = rows.map(([r, h, k]) => ({ romaji: r.split(' '), hira: [...h], kata: [...k] }));
for (const r of ROWS) r.romaji.forEach((ro, i) => { HIRA[r.hira[i]] = ro; KATA[r.kata[i]] = ro; });

export const YOON: [string, string, string][] = [
  ['kya', 'きゃ', 'キャ'], ['kyu', 'きゅ', 'キュ'], ['kyo', 'きょ', 'キョ'],
  ['sha', 'しゃ', 'シャ'], ['shu', 'しゅ', 'シュ'], ['sho', 'しょ', 'ショ'],
  ['cha', 'ちゃ', 'チャ'], ['chu', 'ちゅ', 'チュ'], ['cho', 'ちょ', 'チョ'],
  ['nya', 'にゃ', 'ニャ'], ['nyu', 'にゅ', 'ニュ'], ['nyo', 'にょ', 'ニョ'],
  ['hya', 'ひゃ', 'ヒャ'], ['hyu', 'ひゅ', 'ヒュ'], ['hyo', 'ひょ', 'ヒョ'],
  ['mya', 'みゃ', 'ミャ'], ['myu', 'みゅ', 'ミュ'], ['myo', 'みょ', 'ミョ'],
  ['rya', 'りゃ', 'リャ'], ['ryu', 'りゅ', 'リュ'], ['ryo', 'りょ', 'リョ'],
  ['gya', 'ぎゃ', 'ギャ'], ['gyu', 'ぎゅ', 'ギュ'], ['gyo', 'ぎょ', 'ギョ'],
  ['ja', 'じゃ', 'ジャ'], ['ju', 'じゅ', 'ジュ'], ['jo', 'じょ', 'ジョ'],
  ['bya', 'びゃ', 'ビャ'], ['byu', 'びゅ', 'ビュ'], ['byo', 'びょ', 'ビョ'],
  ['pya', 'ぴゃ', 'ピャ'], ['pyu', 'ぴゅ', 'ピュ'], ['pyo', 'ぴょ', 'ピョ'],
];
for (const [r, h, k] of YOON) { HIRA[h] = r; KATA[k] = r; }
export const kanaRomaji = (ch: string) => HIRA[ch] ?? KATA[ch] ?? '';

interface KL { id: string; title: string; chars: string; words: string; tip: string }
const hira: KL[] = [
  { id: 'h1', title: 'Hiragana: vowels + K', chars: 'あいうえおかきくけこ', tip: 'Japanese has only five vowel sounds: a, i, u, e, o. Every other kana is a consonant plus one of these.', words: 'あい||love\nいえ||house\nうえ||above\nえき||station\nかお||face\nあき||autumn\nいけ||pond\nここ||here' },
  { id: 'h2', title: 'Hiragana: S + T', chars: 'さしすせそたちつてと', tip: 'Three irregular sounds: し is "shi", ち is "chi", つ is "tsu".', words: 'すし||sushi\nあさ||morning\nせかい||world\nつくえ||desk\nちかてつ||subway\nそと||outside\nうた||song\nて||hand' },
  { id: 'h3', title: 'Hiragana: N + H', chars: 'なにぬねのはひふへほ', tip: 'ふ is a soft "fu", made by blowing between the lips. は is read "wa" when it is the topic particle.', words: 'なに||what\nねこ||cat\nいぬ||dog\nはな||flower\nひと||person\nふね||ship\nほし||star\nへた||unskilled' },
  { id: 'h4', title: 'Hiragana: M + Y + R', chars: 'まみむめもやゆよらりるれろ', tip: 'The Japanese R is a light tap of the tongue, between an English R, L and D.', words: 'やま||mountain\nみみ||ear\nゆき||snow\nよる||night\nむら||village\nもり||forest\nくるま||car\nれきし||history' },
  { id: 'h5', title: 'Hiragana: W, N + voiced sounds', chars: 'わをんがぎぐげござじずぜぞ', tip: 'Two small marks ゛ make a sound voiced: か → が, さ → ざ. を is only used as the object particle.', words: 'わたし||I, me\nほん||book\nかぎ||key\nみず||water\nかぜ||wind\nかぞく||family\nにほんご||Japanese language\nげんき||healthy, well' },
  { id: 'h6', title: 'Hiragana: D, B, P + small kana', chars: 'だぢづでどばびぶべぼぱぴぷぺぽ', tip: 'A small っ doubles the next consonant (きって = kitte). Small ゃゅょ blend with the kana before (きょう = kyou).', words: 'だれ||who\nどこ||where\nでんわ||telephone\nたべもの||food\nえんぴつ||pencil\nきって||stamp\nきょう||today\nべんきょう||study' },
];
const kata: KL[] = [
  { id: 'k1', title: 'Katakana: vowels + K + S', chars: 'アイウエオカキクケコサシスセソ', tip: 'Katakana writes the same sounds as hiragana, used for loanwords and foreign names. ー lengthens the vowel before it.', words: 'アイス||ice cream\nケーキ||cake\nコーク||cola\nスキー||ski\nキス||kiss\nエース||ace\nカー||car\nソース||sauce' },
  { id: 'k2', title: 'Katakana: T + N + H', chars: 'タチツテトナニヌネノハヒフヘホ', tip: 'Careful with lookalikes: シ (shi) vs ツ (tsu), ソ (so) vs ン (n).', words: 'テスト||test\nノート||notebook\nホテル||hotel\nコーヒー||coffee\nタクシー||taxi\nネクタイ||necktie\nナイフ||knife\nヘア||hair' },
  { id: 'k3', title: 'Katakana: M + Y + R + W', chars: 'マミムメモヤユヨラリルレロワヲン', tip: 'ン is the only consonant that stands alone. Many everyday words in shops and menus are katakana.', words: 'メモ||memo\nラーメン||ramen\nレストラン||restaurant\nカメラ||camera\nワイン||wine\nトイレ||toilet\nミルク||milk\nメール||email' },
  { id: 'k4', title: 'Katakana: voiced sounds', chars: 'ガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ', tip: 'The same ゛ and ゜ marks apply to katakana. Small ッ and ャュョ work the same way too.', words: 'パン||bread\nバス||bus\nビール||beer\nテレビ||television\nコンビニ||convenience store\nパソコン||personal computer\nジュース||juice\nチケット||ticket' },
];

const mk = (k: KL, script: string): Lesson => ({
  id: 'kana-' + k.id, track: 'kana', level: 'Kana', title: k.title, jp: [...k.chars].slice(0, 5).join(''),
  goal: `Read and recognise these ${script} characters, then read real words written with them.`,
  kana: [...k.chars], vocab: vs(k.words), grammar: [{ p: 'Reading tip', e: k.tip }], sentences: [], source: SRC,
});
export const KANA_LESSONS: Lesson[] = [...hira.map(k => mk(k, 'hiragana')), ...kata.map(k => mk(k, 'katakana'))];
