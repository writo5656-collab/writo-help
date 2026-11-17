import { describe, it, expect } from 'vitest';
import { parseFuri, romajiOf, hasKanji } from './jp';
import { checkSentence, checkWord } from './check';
import { newItem, review, dueItems, isMastered, DAY } from './srs';
import { buildPlan } from './plan';
import { LESSONS, ALL_SENTENCES, ALL_VOCAB, KANJI, PASSAGES, ROLEPLAYS, PACKS } from '../content';
import { lessonExercises, reviewEx } from './exercises';

const water = { f: '私[わたし]は 水[みず]{を} 飲[の]みます。', en: 'I drink water.' };

describe('furigana notation', () => {
  it('parses text, reading and chunks', () => {
    const p = parseFuri(water.f);
    expect(p.jp).toBe('私は水を飲みます。');
    expect(p.kana).toBe('わたしはみずをのみます。');
    expect(p.chunks.length).toBe(3);
    expect(p.chunks[1].particle).toBe('を');
  });
  it('romaji shows particles as pronounced', () => expect(romajiOf(water.f)).toBe('watashi wa mizu o nomimasu'));
});

describe('answer checking', () => {
  it('accepts kanji, kana and mixed answers', () => {
    for (const a of ['私は水を飲みます。', 'わたしはみずをのみます', '私は みずを 飲みます', '水を飲みます。', 'みずをのみます'])
      expect(checkSentence(water, a).ok, a).toBe(true);
  });
  it('explains a wrong particle', () => {
    const r = checkSentence(water, '私は水が飲みます');
    expect(r.ok).toBe(false);
    expect(r.notes.join(' ')).toMatch(/を/);
  });
  it('explains plain form and romaji', () => {
    expect(checkSentence(water, '水を飲む').notes.join(' ')).toMatch(/polite/i);
    expect(checkSentence(water, 'mizu o nomimasu').notes.join(' ')).toMatch(/romaji/i);
  });
  it('accepts listed alternatives', () => {
    const s = ALL_SENTENCES.find(x => x.id === 'sent:n5-05:0')!;
    expect(checkSentence(s, '学校へ行きます').ok).toBe(true);
  });
  it('checks single words', () => { expect(checkWord('水', 'みず', 'みず')).toBe(true); expect(checkWord('水', 'みず', 'みす')).toBe(false); });
});

describe('spaced repetition', () => {
  it('forgotten items return soon, remembered items later', () => {
    const now = Date.now();
    const again = review(newItem('a', 'vocab', now), 'again', now);
    expect(again.status).toBe('forgotten'); expect(again.due - now).toBeLessThan(DAY);
    let good = review(newItem('b', 'vocab', now), 'good', now);
    expect(good.status).toBe('learning');
    good = review(good, 'good', now + DAY);
    expect(good.status).toBe('remembered'); expect(isMastered(good)).toBe(true);
    expect(dueItems([again, good], now + 2 * DAY).map(i => i.id)).toEqual(['a']);
  });
  it('a correct answer right after seeing the solution is not mastery', () => {
    const now = Date.now();
    const a = review(review(newItem('a', 'vocab', now), 'again', now), 'retry', now);
    expect(a.status).toBe('forgotten'); expect(a.reps).toBe(0);
  });
});

describe('plan', () => {
  it('missing days never changes the cycle, and a missed Sunday carries forward', () => {
    const p = buildPlan({ items: [], studyDays: ['2026-01-01', '2026-01-02', '2026-01-03'], lastSunday: '', sundaysDone: 0, now: new Date('2026-03-04T10:00:00') });
    expect(p.cycleDay).toBe(4); expect(p.focus).toBe('practical'); expect(p.sundayPending).toBe(true);
  });
});

describe('content integrity', () => {
  it('every sentence has a clean reading and accepts its own model answer and alternatives', () => {
    for (const s of ALL_SENTENCES) {
      const p = parseFuri(s.f);
      expect(hasKanji(p.kana), `${s.id} reading still has kanji: ${p.kana}`).toBe(false);
      expect(checkSentence(s, p.jp).ok, s.id).toBe(true);
      expect(checkSentence(s, p.kana).ok, s.id).toBe(true);
      for (const a of s.alt ?? []) { expect(hasKanji(parseFuri(a).kana), `${s.id} alt`).toBe(false); expect(checkSentence(s, parseFuri(a).jp).ok, `${s.id} alt ${a}`).toBe(true); }
    }
  });
  it('vocabulary readings are kana', () => { for (const w of ALL_VOCAB) expect(hasKanji(w.kana), w.jp).toBe(false); });
  it('other content parses', () => {
    for (const k of KANJI) for (const w of k.words) { expect(hasKanji(parseFuri(w.f).kana), w.f).toBe(false); expect(w.en, w.f).toBeTruthy(); }
    for (const p of PASSAGES) for (const l of p.lines) expect(hasKanji(parseFuri(l.f).kana), l.f).toBe(false);
    for (const r of ROLEPLAYS) for (const t of r.turns) { expect(hasKanji(parseFuri(t.npc.f).kana), t.npc.f).toBe(false); for (const e of t.expect) expect(hasKanji(parseFuri(e).kana), e).toBe(false); }
    for (const l of LESSONS) { for (const d of l.dialogue ?? []) expect(hasKanji(parseFuri(d.f).kana), d.f).toBe(false); for (const x of l.scene?.items ?? []) expect(hasKanji(parseFuri(x.f).kana), x.f).toBe(false); }
    expect(PACKS.length).toBeGreaterThan(0);
  });
  it('every lesson produces exercises and every item can be reviewed', () => {
    for (const l of LESSONS) {
      const ex = lessonExercises(l);
      expect(ex.length, l.id).toBeGreaterThan(5);
      for (const e of ex) { if (e.t === 'choice' || e.t === 'fill') { expect(e.a, l.id).toBeGreaterThanOrEqual(0); expect(new Set(e.options).size, `${l.id} ${JSON.stringify(e.options)}`).toBe(e.options.length); } expect(reviewEx(newItem(e.itemId, e.kind)) !== null || /^(choice|story):/.test(e.itemId), e.itemId).toBe(true); }
    }
  });
});

import { streaks } from './plan';
import { suggestions } from '../components/Keyboard';
import strokes from '../content/strokes.json';

describe('score and streak', () => {
  const now = new Date('2026-05-10T15:00:00');
  it('counts the current run, and today not yet studied does not break it', () => {
    expect(streaks(['2026-05-07', '2026-05-08', '2026-05-09'], now)).toEqual({ current: 3, best: 3 });
    expect(streaks(['2026-05-08', '2026-05-09', '2026-05-10'], now).current).toBe(3);
  });
  it('a gap resets the current run but keeps the best', () => {
    expect(streaks(['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-09'], now)).toEqual({ current: 1, best: 4 });
    expect(streaks(['2026-05-01'], now)).toEqual({ current: 0, best: 1 });
  });
});

describe('kana keyboard', () => {
  it('suggests kanji for known readings', () => {
    expect(suggestions('わたしはみず').map(s => s.jp)).toContain('水');
    expect(suggestions('がくせい').map(s => s.jp)).toContain('学生');
  });
});

describe('stroke data', () => {
  it('covers every kana and kanji taught', () => {
    const d = strokes as Record<string, string[]>;
    for (const k of KANJI) expect(d[k.k]?.length, k.k).toBeGreaterThan(0);
    for (const c of 'あいうえおアイウエオんンを') expect(d[c]?.length, c).toBeGreaterThan(0);
    expect(d['水'].length).toBe(4);
  });
});

import { storyFor } from '../content/stories';
import { LESSON_CAST, CAST } from '../content/cast';
import { lessonAfter, lessonProgress } from './plan';

describe('cast and stories', () => {
  it('every lesson has a guide (female) and a goof (male), and a story whose correct answer differs from the wrong ones', () => {
    for (const l of LESSONS) {
      const c = LESSON_CAST[l.id];
      expect(c, l.id).toBeTruthy();
      expect(CAST[c.guide].role, l.id).toBe('guide');
      expect(CAST[c.goof].role, l.id).toBe('goof');
      const st = storyFor(l);
      expect(st, l.id).toBeTruthy();
      expect(st!.wrong.length, l.id).toBeGreaterThan(0);
      for (const w of st!.wrong) expect(w, l.id).not.toBe(st!.correct);
      for (const p of st!.panels) expect(hasKanji(parseFuri(p.f).kana), `${l.id} ${p.f}`).toBe(false);
    }
  });
  it('finishing a lesson counts it as done and points to the next', () => {
    const l = LESSONS.find(x => x.id === 'n5-01')!;
    expect(lessonProgress(l, new Map()).done).toBe(false);
    expect(lessonProgress(l, new Map(), new Set(['n5-01'])).done).toBe(true);
    expect(lessonAfter('n5-01')?.id).toBe('n5-02');
    expect(lessonAfter('kana-k4')?.id).toBe('n5-01');
    expect(lessonAfter('p-01')?.id).toBe('p-02');
  });
});

describe('character pictures and voices', () => {
  it('every character has an AniList picture link and spoken reactions', () => {
    for (const c of Object.values(CAST)) {
      expect(c.al?.[0], c.id).toBeGreaterThan(0);
      expect(c.al?.[1], c.id).toMatch(/^https:\/\/s4\.anilist\.co\//);
      expect(c.say?.length, c.id).toBeGreaterThan(0);
    }
  });
});
