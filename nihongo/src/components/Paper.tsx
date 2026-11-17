// The notebook page: a REAL text area laid over ruled paper, so the phone's
// own Japanese keyboard (IME) works exactly as it does in any other app.
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toKana, toRomaji } from 'wanakana';
import { hasKanji } from '../lib/jp';
import { readingOf } from '../services/reading';
import { useS } from './ui';

const HELPER = ['。', '、', 'ー', '？', 'っ', 'ゃ', 'ゅ', 'ょ', '「', '」', 'を', 'ん', 'は', 'が', 'に', 'で', 'と', 'も', 'の', 'か', 'です', 'ます'];

export function PaperInput(p: {
  value: string; onChange: (v: string) => void;
  romajiMode?: boolean; placeholder?: string; minRows?: number; note?: boolean; disabled?: boolean;
  autoFocus?: boolean; onEnter?: () => void; inputRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const own = useRef<HTMLTextAreaElement>(null);
  const ref = p.inputRef ?? own;
  const composing = useRef(false);
  // Grow the text area so it always ends on a ruled line.
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const rule = parseFloat(getComputedStyle(el).lineHeight) || 44;
    el.style.height = '0px';
    el.style.height = Math.max((p.minRows ?? 2) * rule, Math.ceil(el.scrollHeight / rule) * rule) + 'px';
  }, [p.value, p.minRows]); // eslint-disable-line
  useEffect(() => { if (p.autoFocus) ref.current?.focus({ preventScroll: true }); }, []); // eslint-disable-line
  const convert = (v: string) => (p.romajiMode && !composing.current ? toKana(v, { IMEMode: true }) : v);
  return (
    <textarea
      ref={ref} className={`paper-input ${p.note ? 'note' : ''}`} lang="ja" value={p.value} disabled={p.disabled}
      placeholder={p.placeholder} rows={p.minRows ?? 2}
      autoCapitalize="off" autoCorrect="off" autoComplete="off" spellCheck={false} enterKeyHint={p.onEnter ? 'done' : 'enter'}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={e => { composing.current = false; p.onChange(convert((e.target as HTMLTextAreaElement).value)); }}
      onChange={e => p.onChange(convert(e.target.value))}
      onKeyDown={e => { if (p.onEnter && e.key === 'Enter' && !e.nativeEvent.isComposing && !composing.current) { e.preventDefault(); p.onEnter(); } }}
    />
  );
}

/** Kana helper row: an optional fallback, not a replacement for the keyboard. */
export function HelperRow({ inputRef, value, onChange }: { inputRef: React.RefObject<HTMLTextAreaElement | null>; value: string; onChange: (v: string) => void }) {
  const insert = (t: string) => {
    const el = inputRef.current;
    const a = el?.selectionStart ?? value.length, b = el?.selectionEnd ?? value.length;
    onChange(value.slice(0, a) + t + value.slice(b));
    requestAnimationFrame(() => { el?.focus({ preventScroll: true }); el?.setSelectionRange(a + t.length, a + t.length); });
  };
  return (
    <div className="helper" aria-label="Kana helper">
      {HELPER.map(h => <button key={h} type="button" lang="ja" onMouseDown={e => e.preventDefault()} onClick={() => insert(h)}>{h}</button>)}
      <button type="button" aria-label="Backspace" onMouseDown={e => e.preventDefault()} onClick={() => onChange(value.slice(0, -1))}>⌫</button>
    </div>
  );
}

/** The reading line under what was typed (kana, plus romaji if switched on). */
export function ReadingLine({ text, known, romaji }: { text: string; known?: (t: string) => string; romaji: boolean }) {
  const [auto, setAuto] = useState<string | null>(null);
  const base = known ? known(text) : text;
  useEffect(() => {
    setAuto(null);
    if (!text || !hasKanji(base)) return;
    let on = true;
    const t = setTimeout(() => readingOf(base).then(r => on && setAuto(r)).catch(() => undefined), 400);
    return () => { on = false; clearTimeout(t); };
  }, [text]); // eslint-disable-line
  const reading = auto ?? base;
  if (!text.trim()) return <div className="paper-reading" />;
  const showKana = hasKanji(text);
  return (
    <div className="paper-reading" lang="ja" aria-label="Reading">
      {showKana && <>（{reading}）</>}
      {romaji && <span className="romaji">{toRomaji(reading.replace(/[。、？！「」]/g, ' ')).trim()}</span>}
    </div>
  );
}

export function Paper({ title, date, children, grid }: { title: string; date?: string; children: ReactNode; grid?: boolean }) {
  const s = useS();
  const g = grid ?? s.paper === 'grid';
  return (
    <div className={`paper ${g ? 'grid' : ''}`}>
      <div className="paper-holes" aria-hidden="true"><i /><i /><i /></div>
      <div className="paper-head"><span>{title}</span><span className="num">{date ?? new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
      <div className="paper-body">{children}</div>
    </div>
  );
}
