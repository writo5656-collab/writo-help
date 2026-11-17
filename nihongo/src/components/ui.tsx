// Shared building blocks used by every screen.
import { type ReactNode, useEffect, useState, createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseFuri, romajiOf } from '../lib/jp';
import { type Settings, DEFAULTS } from '../lib/settings';
import { speak, speakChunks } from '../services/tts';

export const SettingsCtx = createContext<Settings>(DEFAULTS);
export const useS = () => useContext(SettingsCtx);

// ---- icons (simple line icons, drawn here so the app needs no icon library)
const P: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10',
  book: 'M4 5.5c2.5-1 5.5-1 8 .5 2.5-1.5 5.5-1.5 8-.5v13c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5zM12 6v13',
  note: 'M6 3.5h9l4 4V20.5H6zM15 3.5v4h4M9 12h7M9 16h5',
  pen: 'M4 20l1-4.5L16.5 4a2 2 0 0 1 3 3L8 18.5zM14.5 6l3.5 3.5',
  mic: 'M12 3.5a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0v-5a3 3 0 0 0-3-3zM6 11.5a6 6 0 0 0 12 0M12 17.5v3',
  chart: 'M4 20V10M10 20V4M16 20v-8M21 20H3',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  back: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', close: 'M6 6l12 12M18 6 6 18',
  play: 'M8 5.5v13l10.5-6.5z', sound: 'M4 9.5v5h3.5L12 18V6L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  slow: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M7 7l10 10M17 7 7 17', retry: 'M4 12a8 8 0 1 0 2.6-5.9M4 4.5V9h4.5',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.3 1 2.1h5c0-.8.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  star: 'M12 4l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z',
  flag: 'M5 21V4M5 4.5h12l-2.5 4 2.5 4H5', clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3.5 2',
  plus: 'M12 5v14M5 12h14', trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13', folder: 'M3.5 6.5h6l2 2.5h9v10h-17z',
  chat: 'M4 5.5h16v11H10l-5 4v-4H4z', torii: 'M3 6.5c6 1.6 12 1.6 18 0M5 10.5h14M7.5 7.5V20M16.5 7.5V20',
  list: 'M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01', ear: 'M8 15a5 5 0 1 1 9-3c0 2.5-2 3-2.5 5a3 3 0 0 1-5.5 1M11.5 11a1.8 1.8 0 0 1 3 0',
  eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 20h14', upload: 'M12 15.5v-11M7.5 8.5 12 4l4.5 4.5M5 20h14',
  shuffle: 'M4 7h3.5c5 0 5.5 10 10.5 10h2M4 17h3.5c1.6 0 2.7-1 3.6-2.4M18 7h2M14.6 9.4C15.5 8 16.5 7 18 7M18 4.5 20.5 7 18 9.5M18 14.5l2.5 2.5-2.5 2.5',
  flame: 'M12 3.5c.6 3.2 4.5 4.8 4.5 9.5a4.5 4.5 0 0 1-9 0c0-1.8.8-3 1.6-3.8.3 1.3 1 2 1.6 2.2C10.4 9 10.6 6 12 3.5z',
  bell: 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0',
  calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 4v4M15.5 4v4', draw: 'M4 17c3-6 5 4 8-2s4 1 8-5', key: 'M4 7h16v10H4zM7.5 10.5h.01M11 10.5h.01M14.5 10.5h.01M8 14h8',
};
export function Icon({ n, s = 22, w = 1.9 }: { n: string; s?: number; w?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={n === 'play' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[n] ?? P.star} />
    </svg>
  );
}

/** Mochi, the small study companion. Decorative only — never covers content. */
export function Mascot({ size = 84, mood = 'happy' }: { size?: number; mood?: 'happy' | 'cheer' | 'think' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M22 36 18 12l20 12zM78 36l4-24-20 12z" fill="#fffdf7" stroke="#22302a" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M24 28 22 18l8 5zM76 28l2-10-8 5z" fill="#f2b8b0" />
      <ellipse cx="50" cy="56" rx="34" ry="30" fill="#fffdf7" stroke="#22302a" strokeWidth="2.4" />
      <path d="M62 28c8 2 16 8 19 17-6-2-13-1-19 3z" fill="#d9a36a" opacity=".85" />
      <path d="M17 44c10-9 56-9 66 0" fill="none" stroke="#2c6a50" strokeWidth="7" strokeLinecap="round" />
      <circle cx="50" cy="38.5" r="4.2" fill="#e9c46a" />
      {mood === 'think'
        ? <><circle cx="38" cy="58" r="3.2" fill="#22302a" /><circle cx="62" cy="58" r="3.2" fill="#22302a" /><path d="M45 69h10" stroke="#22302a" strokeWidth="2.4" strokeLinecap="round" /></>
        : <><path d="M33 59q5-6 10 0M57 59q5-6 10 0" fill="none" stroke="#22302a" strokeWidth="2.6" strokeLinecap="round" />
          <path d={mood === 'cheer' ? 'M43 66q7 10 14 0z' : 'M45 67q5 5 10 0'} fill={mood === 'cheer' ? '#dd8f8f' : 'none'} stroke="#22302a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></>}
      <ellipse cx="30" cy="67" rx="5" ry="3" fill="#f2b8b0" opacity=".8" /><ellipse cx="70" cy="67" rx="5" ry="3" fill="#f2b8b0" opacity=".8" />
    </svg>
  );
}

export function Screen({ title, back, right, children, tabs = false }: { title?: ReactNode; back?: boolean | string; right?: ReactNode; children: ReactNode; tabs?: boolean }) {
  const nav = useNavigate();
  return (
    <main className={`screen ${tabs ? '' : 'no-tabs'}`}>
      {(title || back) && (
        <header className="topbar">
          {back && <button className="iconbtn soft" aria-label="Back" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}><Icon n="back" /></button>}
          <h1>{title}</h1>
          {right}
        </header>
      )}
      {children}
    </main>
  );
}

export function Ring({ pct, size = 68, stroke = 7, color = 'var(--forest-2)', children }: { pct: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9e2cf" strokeWidth={stroke} />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(100, Math.max(0, pct)) / 100)} style={{ transition: 'stroke-dashoffset .6s ease' }} />}
      </svg>
      <div className="ring-in">{children}</div>
    </div>
  );
}
export const Bar = ({ pct }: { pct: number }) => <div className="bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>;

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

/** Japanese text with furigana above kanji; romaji line is optional. */
export function Furi({ f, className = '', hot = -1, romaji, furigana }: { f: string; className?: string; hot?: number; romaji?: boolean; furigana?: boolean }) {
  const s = useS();
  const showF = furigana ?? s.showFurigana, showR = romaji ?? s.showRomaji;
  const p = parseFuri(f);
  return (
    <span className="furi-wrap">
      <span className={`furi ${className}`} lang="ja">
        {p.chunks.map((c, i) => (
          <span key={i} className={`chunk ${hot === i ? 'hot' : ''}`}>
            {c.segs.map((sg, j) => sg.reading && showF ? <ruby key={j}>{sg.text}<rt>{sg.reading}</rt></ruby> : <span key={j}>{sg.text}</span>)}
          </span>
        ))}
      </span>
      {showR && <span className="romaji" style={{ display: 'block' }}>{romajiOf(f)}</span>}
    </span>
  );
}

/** Listen / slow / word-by-word controls for a sentence. */
export function Audio({ f, autoplay = false, onChunk, compact = false }: { f: string; autoplay?: boolean; onChunk?: (i: number) => void; compact?: boolean }) {
  const s = useS();
  const p = parseFuri(f);
  useEffect(() => { if (autoplay && s.autoplay) void speak(p.jp, { rate: s.rate }); }, [f]); // eslint-disable-line
  return (
    <span className="row gap-s">
      <button className="iconbtn soft" aria-label="Listen" onClick={() => speak(p.jp, { rate: s.rate })}><Icon n="sound" /></button>
      <button className="iconbtn soft" aria-label="Listen slowly" onClick={() => speak(p.jp, { rate: s.rate, slow: true })}><Icon n="slow" /></button>
      {!compact && p.chunks.length > 1 && <button className="iconbtn soft" aria-label="Word by word" onClick={() => speakChunks(p.chunks.map(c => c.jp), s.rate, onChunk)}><Icon n="list" /></button>}
    </span>
  );
}

export function SpeakBtn({ text, label = 'Listen' }: { text: string; label?: string }) {
  const s = useS();
  return <button className="iconbtn soft" aria-label={label} onClick={e => { e.stopPropagation(); void speak(text, { rate: s.rate }); }}><Icon n="sound" s={20} /></button>;
}

export const Wip = ({ children }: { children: ReactNode }) => <div className="wip"><Icon n="flag" s={18} /><div>{children}</div></div>;

export function Empty({ title, children, mood = 'happy' as const }: { title: string; children?: ReactNode; mood?: 'happy' | 'cheer' | 'think' }) {
  return <div className="col center" style={{ alignItems: 'center', padding: '28px 12px' }}><Mascot mood={mood} /><h2>{title}</h2><p className="muted small" style={{ maxWidth: 300 }}>{children}</p></div>;
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): T | undefined {
  const [v, setV] = useState<T>();
  useEffect(() => { let on = true; fn().then(x => on && setV(x)); return () => { on = false; }; }, deps); // eslint-disable-line
  return v;
}

export const fmtDate = (ts: number) => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const fmtMin = (sec: number) => sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.round(sec / 60)} min` : `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
