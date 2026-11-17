// The in-app Japanese keyboard: tap kana directly, no English letters involved.
// Kana are laid out as the standard gojūon table (columns a-ka-sa-ta-na-…),
// which also quietly teaches the table. A suggestion bar offers kanji for
// words the app knows.
import { useMemo, useState } from 'react';
import { toKatakana, toRomaji } from 'wanakana';
import { ALL_VOCAB, ALL_SENTENCES, KANJI } from '../content';
import { parseFuri } from '../lib/jp';
import { sfx } from '../services/sfx';
import { speak } from '../services/tts';
import { useS } from './ui';
import { Icon } from './ui';

// Rows are vowels (a i u e o); columns run あ か さ た な は ま や ら わ.
const GRID = [
  'あかさたなはまやらわ',
  'いきしちにひみ　り　',
  'うくすつぬふむゆるを',
  'えけせてねへめ　れん',
  'おこそとのほもよろー',
].map(r => [...r]);

// One key cycles a kana through its variants: か→が, は→ば→ぱ, つ→っ→づ, や→ゃ …
const CYCLES = ['かが', 'きぎ', 'くぐ', 'けげ', 'こご', 'さざ', 'しじ', 'すず', 'せぜ', 'そぞ', 'ただ', 'ちぢ', 'つっづ', 'てで', 'とど',
  'はばぱ', 'ひびぴ', 'ふぶぷ', 'へべぺ', 'ほぼぽ', 'やゃ', 'ゆゅ', 'よょ', 'あぁ', 'いぃ', 'うぅゔ', 'えぇ', 'おぉ', 'わゎ'];
const NEXT = new Map<string, string>();
for (const c of CYCLES) { const a = [...c]; a.forEach((ch, i) => { NEXT.set(ch, a[(i + 1) % a.length]); NEXT.set(toKatakana(ch), toKatakana(a[(i + 1) % a.length])); }); }

/** reading → written forms, built from everything the app teaches. */
const DICT: Map<string, string[]> = (() => {
  const m = new Map<string, Set<string>>();
  const add = (kana: string, jp: string) => { if (kana && jp && kana !== jp && kana.length >= 2) (m.get(kana) ?? m.set(kana, new Set()).get(kana)!).add(jp); };
  for (const w of ALL_VOCAB) add(w.kana, w.jp);
  for (const k of KANJI) for (const w of k.words) { const p = parseFuri(w.f); add(p.kana, p.jp); }
  for (const s of ALL_SENTENCES) for (const c of parseFuri(s.f).chunks) for (const sg of c.segs) if (sg.reading) add(sg.reading, sg.text);
  // A few very common one-kana readings.
  for (const [k, j] of [['め', '目'], ['て', '手'], ['き', '木'], ['ひ', '日'], ['こ', '子']]) (m.get(k) ?? m.set(k, new Set()).get(k)!).add(j);
  return new Map([...m].map(([k, v]) => [k, [...v]]));
})();

export function suggestions(before: string): { len: number; jp: string }[] {
  const out: { len: number; jp: string }[] = [];
  for (let len = Math.min(8, before.length); len >= 1; len--) {
    for (const jp of DICT.get(before.slice(-len)) ?? []) if (!out.some(o => o.jp === jp)) out.push({ len, jp });
  }
  return out.slice(0, 6);
}

export function KanaKeyboard({ inputRef, value, onChange, onEnter, enterLabel = '改行' }: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void; onEnter?: () => void; enterLabel?: string;
}) {
  const st = useS();
  const [kata, setKata] = useState(false);
  const say = (t: string) => { if (st.speakKeys && /[\u3041-\u30ff]/.test(t)) void speak(t, { rate: st.rate }); };
  const sel = () => { const el = inputRef.current; return [el?.selectionStart ?? value.length, el?.selectionEnd ?? value.length] as const; };
  const put = (next: string, caret: number) => {
    onChange(next);
    requestAnimationFrame(() => { const el = inputRef.current; if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(caret, caret); } });
  };
  const insert = (t: string) => { sfx.key(); say(t); const [a, b] = sel(); put(value.slice(0, a) + t + value.slice(b), a + t.length); };
  const back = () => { sfx.key(); const [a, b] = sel(); if (a !== b) put(value.slice(0, a) + value.slice(b), a); else if (a > 0) put(value.slice(0, a - 1) + value.slice(a), a - 1); };
  const cycle = () => { sfx.key(); const [a] = sel(); const ch = value[a - 1]; const n = ch && NEXT.get(ch); if (n) { say(n); put(value.slice(0, a - 1) + n + value.slice(a), a); } };
  const [a] = sel();
  const sugg = useMemo(() => suggestions(value.slice(0, a)), [value, a]);
  const pick = (s: { len: number; jp: string }) => { sfx.key(); say(s.jp); put(value.slice(0, a - s.len) + s.jp + value.slice(a), a - s.len + s.jp.length); };
  const hold = (e: React.SyntheticEvent) => e.preventDefault(); // keep the caret in the text area

  return (
    <div className="kb" role="group" aria-label="Japanese keyboard" onMouseDown={hold}>
      <div className="kb-sugg" aria-label="Kanji suggestions">
        {sugg.length === 0 ? <span className="tiny muted">Kanji suggestions appear here as you type</span>
          : sugg.map(s => <button key={s.jp} type="button" lang="ja" onClick={() => pick(s)}>{s.jp}</button>)}
      </div>
      <div className="kb-grid">
        {GRID.flatMap((row, r) => row.map((ch, c) => ch === '　'
          ? <span key={`${r}-${c}`} />
          : <button key={`${r}-${c}`} type="button" lang="ja" className="kb-key" onClick={() => insert(kata && ch !== 'ー' ? toKatakana(ch) : ch)}>{kata && ch !== 'ー' ? toKatakana(ch) : ch}{ch !== 'ー' && <small>{toRomaji(ch)}</small>}</button>))}
      </div>
      <div className="kb-fn">
        <button type="button" className={`kb-key fn ${kata ? 'on' : ''}`} onClick={() => { sfx.key(); setKata(!kata); }} aria-pressed={kata} lang="ja">{kata ? 'あ' : 'ア'}</button>
        <button type="button" className="kb-key fn" onClick={cycle} lang="ja" aria-label="Change last kana: voiced, half-voiced or small">゛゜小</button>
        <button type="button" className="kb-key fn" onClick={() => insert('、')} lang="ja">、</button>
        <button type="button" className="kb-key fn" onClick={() => insert('。')} lang="ja">。</button>
        <button type="button" className="kb-key fn" onClick={() => insert('？')} lang="ja">？</button>
        <button type="button" className="kb-key fn" onClick={back} aria-label="Delete"><Icon n="back" s={18} /></button>
        <button type="button" className="kb-key fn go" onClick={() => { sfx.key(); if (onEnter) onEnter(); else insert('\n'); }} lang="ja">{enterLabel}</button>
      </div>
    </div>
  );
}
