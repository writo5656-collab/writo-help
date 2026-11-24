// Japanese sentence as tappable words (Duolingo style): furigana above kanji,
// pronunciation (romaji) under every word. Tap a word to hear it and see its
// meaning, reading and what the particle / ending does.
import { useEffect, useMemo, useState } from 'react';
import { explainPieces, type Piece } from '../lib/explain';
import { useLookup } from '../lib/lookup';
import { parseFuri, autoSpace } from '../lib/jp';
import { speakSeq } from '../services/tts';
import { sfx } from '../services/sfx';
import { Icon, useS } from './ui';

export function TapSentence({ f: given, size = 'l', romaji = true, onWord }: { f: string; size?: 'm' | 'l' | 'xl'; romaji?: boolean; onWord?: (p: Piece) => void }) {
  const s = useS();
  const f = useMemo(() => autoSpace(given), [given]);
  const look = useLookup();
  const pieces = useMemo(() => explainPieces(f, look, () => []), [f, look]);
  const raws = useMemo(() => f.trim().split(/\s+/).filter(r => parseFuri(r).jp.replace(/[。、！？!?「」]/g, '')), [f]);
  const [open, setOpen] = useState(-1);
  useEffect(() => setOpen(-1), [f]); // a new sentence starts closed
  const cur = open >= 0 ? pieces[open] : undefined;
  const tap = (i: number) => {
    sfx.tap();
    setOpen(o => (o === i ? -1 : i));
    void speakSeq([{ text: pieces[i].jp.replace(/[。、！？]/g, ''), rate: s.rate * 0.9 }]);
    onWord?.(pieces[i]);
  };
  return (
    <div className="tapsent">
      <div className={`ts-line ts-${size}`} lang="ja">
        {raws.map((raw, i) => {
          const c = parseFuri(raw).chunks[0];
          const p = pieces[i];
          return (
            <button key={i} className={`ts-w ${open === i ? 'on' : ''}`} onClick={() => tap(i)} aria-label={`${c.jp}${p?.word ? ': ' + p.word.en : ''}`}>
              <span className="ts-jp">{c.segs.map((sg, j) => sg.reading && s.showFurigana ? <ruby key={j}>{sg.text}<rt>{sg.reading}</rt></ruby> : <span key={j}>{sg.text}</span>)}</span>
              {romaji && p && <span className="ts-ro">{p.romaji}</span>}
            </button>
          );
        })}
      </div>
      {cur && (
        <div className="ts-pop" role="status" key={open}>
          <div className="row between">
            <span><b lang="ja" className="jp" style={{ fontSize: '1.15rem' }}>{cur.word?.jp ?? cur.jp.replace(/[。、！？]/g, '')}</b>{' '}
              <span className="small muted" lang="ja">{(cur.word?.kana ?? cur.kana).replace(/[。、！？]/g, '')}</span>{' '}
              <span className="small" style={{ color: 'var(--forest-2)' }}>{cur.romaji}</span></span>
            <button className="iconbtn" aria-label="Hear it again" onClick={() => speakSeq([{ text: cur.jp.replace(/[。、！？]/g, ''), rate: s.rate * 0.7 }])}><Icon n="slow" s={18} /></button>
          </div>
          {cur.word && <div>= <b>{cur.word.en}</b>{cur.word.base && <span className="small muted"> (from <span lang="ja">{cur.word.base}</span>)</span>}</div>}
          {cur.particle && <div className="small"><b lang="ja">{cur.particle.p}</b> — {cur.particle.info.replace(/^\S+ (\([a-z]+\) )?/, '')}</div>}
          {cur.ending && <div className="small"><b lang="ja">{cur.ending.e}</b> — {cur.ending.info.replace(/^\S+ = /, '')}</div>}
          {!cur.word && !cur.particle && !cur.ending && <div className="small muted">An expression — learn it as one piece.</div>}
        </div>
      )}
    </div>
  );
}
