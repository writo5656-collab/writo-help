// Stroke-order animation. Stroke data comes from the KanjiVG project
// (© Ulrich Apel, CC BY-SA 3.0 — https://kanjivg.tagaini.net).
import { useEffect, useState } from 'react';
import { Icon } from './ui';

let cache: Promise<Record<string, string[]>> | null = null;
export function loadStrokes() { return (cache ??= import('../content/strokes.json').then(m => m.default as Record<string, string[]>)); }
export function useStrokes(ch: string) {
  const [paths, setPaths] = useState<string[] | null | undefined>(undefined);
  useEffect(() => { let on = true; setPaths(undefined); void loadStrokes().then(d => on && setPaths(d[ch] ?? null)); return () => { on = false; }; }, [ch]);
  return paths;
}

const startOf = (d: string) => { const m = d.match(/M\s*([\d.]+)[ ,]([\d.]+)/); return m ? [Number(m[1]), Number(m[2])] : [0, 0]; };

/** Animated strokes. `faint` renders it as a tracing guide behind a canvas. */
export function StrokeOrder({ ch, size = 220, faint = false, controls = true }: { ch: string; size?: number | string; faint?: boolean; controls?: boolean }) {
  const paths = useStrokes(ch);
  const [run, setRun] = useState(0);
  const [numbers, setNumbers] = useState(true);
  if (paths === undefined) return <div style={{ width: size, height: size }} />;
  if (paths === null) return <div className="col center" style={{ width: size, height: size, justifyContent: 'center' }}><span className="kana-big" lang="ja" style={{ opacity: faint ? 0.1 : 1 }}>{ch}</span>{!faint && <span className="tiny muted">No stroke data for this character</span>}</div>;
  return (
    <div className="col center" style={{ alignItems: 'center', gap: 8 }}>
      <svg key={run} viewBox="0 0 109 109" width={size} height={size} role="img" aria-label={`Stroke order for ${ch}: ${paths.length} strokes`} style={{ display: 'block' }}>
        {!faint && <><path d="M54.5 4v101M4 54.5h101" stroke="#dcd3ba" strokeWidth=".6" strokeDasharray="3 3" /><rect x="2" y="2" width="105" height="105" rx="8" fill="none" stroke="#e3d9bf" /></>}
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} fill="none" stroke={faint ? 'rgba(31,77,58,.16)' : '#22302a'} strokeWidth={faint ? 5 : 4} strokeLinecap="round" strokeLinejoin="round"
            style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `draw .55s ease ${i * 0.62}s forwards` }} />
        ))}
        {numbers && paths.map((d, i) => { const [x, y] = startOf(d); return <text key={i} x={x - 3} y={y - 2} fontSize="6.5" fontWeight="700" fill={faint ? 'rgba(185,80,74,.55)' : '#b9504a'} style={{ fontFamily: 'var(--ui)' }}>{i + 1}</text>; })}
      </svg>
      {controls && (
        <div className="row gap-s">
          <button className="chip" onClick={() => setRun(r => r + 1)}><Icon n="retry" s={15} />Replay</button>
          <button className={`chip ${numbers ? 'on' : ''}`} onClick={() => setNumbers(!numbers)} aria-pressed={numbers}>Numbers</button>
          <span className="small muted num">{paths.length} stroke{paths.length === 1 ? '' : 's'}</span>
        </div>
      )}
    </div>
  );
}
