import { describe, it, expect } from 'vitest';
import { splitChunk, dictForms, findWord, explainPieces, targetOf } from './explain';
import { ALL_VOCAB, ALL_SENTENCES } from '../content';
import { lessonExercises } from './exercises';
import { LESSONS } from '../content';

const m = new Map(ALL_VOCAB.map(v => [v.jp, v]));
const look = (jp: string) => m.get(jp);

describe('explain my answer', () => {
  it('splits particles and endings', () => {
    expect(splitChunk('私は')).toEqual({ stem: '私', particle: 'は', ending: undefined });
    expect(splitChunk('かかりますか。')).toMatchObject({ stem: 'かかり', ending: 'ますか' });
    expect(splitChunk('食べませんでした')).toMatchObject({ stem: '食べ', ending: 'ませんでした' });
    expect(splitChunk('学生です。')).toMatchObject({ stem: '学生', ending: 'です' });
    expect(splitChunk('学生ですか。')).toMatchObject({ stem: '学生', ending: 'ですか' });
    expect(splitChunk('水を', 'を')).toMatchObject({ stem: '水', particle: 'を' });
  });
  it('finds dictionary forms', () => {
    expect(dictForms('飲み')).toContain('飲む');
    expect(dictForms('食べ')).toContain('食べる');
    expect(dictForms('し')).toEqual(['する']);
    expect(findWord('飲み', 'ます', (j) => (j === '飲む' ? { jp: '飲む', kana: 'のむ', en: 'to drink' } : undefined))).toMatchObject({ en: 'to drink', base: '飲む' });
  });
  it('explains every real lesson sentence without crashing, with meanings for most pieces', () => {
    let pieces = 0, known = 0;
    for (const s of ALL_SENTENCES) {
      const ps = explainPieces(s.f, look, () => []);
      expect(ps.length).toBeGreaterThan(0);
      for (const p of ps) { pieces++; if (p.word || p.particle || p.ending) known++; expect(p.romaji).toBeTruthy(); }
    }
    expect(known / pieces).toBeGreaterThan(0.6);
  });
  it('has a target for every lesson exercise that has Japanese', () => {
    for (const l of LESSONS.slice(0, 5)) for (const ex of lessonExercises(l)) {
      const t = targetOf(ex);
      if (ex.t !== 'choice') expect(t, ex.t).not.toBeNull();
      if (t) expect(t.f.length).toBeGreaterThan(0);
    }
  });
});

import { judgeReading } from './photoCheck';
import { existsSync } from 'fs';
import { REAL_PHOTOS } from '../content/realPhotos';
describe('real photo reading check', () => {
  it('accepts kanji, kana and katakana answers, rejects wrong ones', () => {
    expect(judgeReading('止まってください', 'とまってください', '止まって下さい！', 'とまってください').ok).toBe(true);
    expect(judgeReading('とまって下さい', 'とまってください', '止まって下さい！', 'とまってください').ok).toBe(true);
    expect(judgeReading('限定カレー', 'げんていカレー', '限定カレー', 'げんていかれー').ok).toBe(true);
    expect(judgeReading('げんていかれ', 'げんていかれ', '限定カレー', 'げんていかれー').ok).toBe(true);
    expect(judgeReading('ありがとう', 'ありがとう', '非常口', 'ひじょうぐち').ok).toBe(false);
    expect(judgeReading('', '', '非常口', 'ひじょうぐち').ok).toBe(false);
  });
  it('every photo has an image, a kana answer and a credit', () => {
    for (const p of REAL_PHOTOS) {
      expect(p.kana).toMatch(/^[぀-ゟー]+$/);
      expect(p.img).toMatch(/^real\/[a-z-]+\.jpg$/);
      expect(p.credit.license).toMatch(/^CC BY/);
      expect(p.credit.url).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(existsSync(`public/${p.img}`), p.img).toBe(true);
    }
  });
});

import { autoSpace } from './jp';
describe('autoSpace', () => {
  it('splits unspaced lines into words', () => {
    expect(autoSpace('私[わたし]は女優[じょゆう]です。今日[きょう]は「AはBです」を教[おし]えます。')).toBe('私[わたし]は 女優[じょゆう]です。 今日[きょう]は 「AはBです」を 教[おし]えます。');
    expect(autoSpace('コンビニ行[い]こう！')).toBe('コンビニ 行[い]こう！');
    expect(autoSpace('今日[きょう]はひらがなだよ！')).toBe('今日[きょう]は ひらがなだよ！');
    expect(autoSpace('水[みず]を 飲[の]みます。')).toBe('水[みず]を 飲[の]みます。');
    expect(autoSpace('私[わたし]たちの学校[がっこう]')).toBe('私[わたし]たちの 学校[がっこう]');
  });
});
describe('word romaji', () => {
  it('spaces です-endings and particles', () => {
    const ps = explainPieces('あなたは 学生[がくせい]ですか。', () => undefined, () => []);
    expect(ps.map(p => p.romaji)).toEqual(['anata wa', 'gakusei desu ka']);
    expect(explainPieces('水[みず]を 飲[の]みます。', () => undefined, () => [])[1].romaji).toBe('nomimasu');
    expect(autoSpace('私[わたし]は女優[じょゆう]です。 今日[きょう]は「AはBです」を教[おし]えます。').split(' ').length).toBeGreaterThanOrEqual(5);
  });
});
describe('word romaji with particle marks', () => {
  it('handles {か}', () => {
    expect(explainPieces('あなたは 学生[がくせい]です{か}。', () => undefined, () => [])[1].romaji).toBe('gakusei desu ka');
    expect(explainPieces('ひらがなだよ！', () => undefined, () => [])[0].romaji).toBe('hiragana da yo');
  });
});
describe('particle detection', () => {
  it('does not cut words that end like a particle', () => {
    const look = (w: string) => (({ えいが: { jp: 'えいが', kana: 'えいが', en: 'movie' }, あなた: { jp: 'あなた', kana: 'あなた', en: 'you' } }) as Record<string, { jp: string; kana: string; en: string }>)[w];
    expect(explainPieces('えいが', look, () => [])[0].romaji).toBe('eiga');
    expect(explainPieces('あなたは', look, () => [])[0].romaji).toBe('anata wa');
    expect(explainPieces('質問[しつもん]の', look, () => [])[0].romaji).toBe('shitsumon no');
  });
});
