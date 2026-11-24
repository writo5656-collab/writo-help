// A teacher shows a real photo from Japan and asks, cutely, for you to read it.
// You read it aloud (or reveal it), then see the reading, meaning and a note.
// Used in calls, in the "Read real Japan" screen and in the plan's real-life block.
import { useEffect, useMemo, useRef, useState } from 'react';
import { CAST } from '../content/cast';
import { READ_ASKS, READ_THANKS, READ_RETRY, type RealPhoto } from '../content/realPhotos';
import { judgeReading } from '../lib/photoCheck';
import { speakSeq, stop } from '../services/tts';
import { listenOnce, stopListening } from '../services/stt';
import { readingOf } from '../services/reading';
import { sfx } from '../services/sfx';
import { buzz } from '../services/haptics';
import { celebrate } from '../services/fun';
import { Icon, useS } from './ui';
import { Portrait } from './Portrait';

type Phase = 'asking' | 'listening' | 'checking' | 'right' | 'wrong' | 'shown';
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export function PhotoAsk({ photo, who, mic, dark = false, onDone }: { photo: RealPhoto; who: string; mic: boolean; dark?: boolean; onDone: (ok: boolean) => void }) {
  const s = useS();
  const c = CAST[who];
  const ask = useMemo(() => pick(READ_ASKS), [photo.id]);
  const [phase, setPhase] = useState<Phase>('asking');
  const [line, setLine] = useState(ask);
  const [live, setLive] = useState('');
  const [heard, setHeard] = useState('');
  const [tries, setTries] = useState(0);
  const [zoom, setZoom] = useState(false);
  const alive = useRef(true);
  const firstOk = useRef(true);

  useEffect(() => {
    alive.current = true;
    void (async () => {
      await speakSeq([{ text: ask.jp, who }]);
      if (alive.current && mic) void listen();
      else if (alive.current) setPhase('wrong'); // no mic: go straight to "show me" / "I read it"
    })();
    return () => { alive.current = false; void stop(); void stopListening(); };
  }, [photo.id]); // eslint-disable-line

  async function listen() {
    if (phase === 'listening') { await stopListening(); return; }
    void stop();
    setLive(''); setPhase('listening');
    try {
      const alts = await listenOnce(t => setLive(t), 12000);
      if (!alive.current) return;
      const h = alts[0] ?? '';
      if (!h.trim()) { setPhase('wrong'); setHeard(''); return; } // silence: just wait for another try
      setHeard(h); setPhase('checking');
      let best = { ok: false, score: 0 };
      for (const a of alts.slice(0, 3)) {
        let k = a; try { k = await readingOf(a); } catch { /* no dictionary: compare as is */ }
        const r = judgeReading(a, k, photo.read, photo.kana);
        if (r.score > best.score) best = r;
        if (r.ok) break;
      }
      if (!alive.current) return;
      if (best.ok) return void right();
      setTries(t => t + 1); firstOk.current = false;
      sfx.wrong(); buzz.bad();
      const r = pick(READ_RETRY); setLine(r); setPhase('wrong');
      await speakSeq([{ text: r.jp, who }, { text: photo.kana, rate: s.rate * 0.8 }]);
    } catch { if (alive.current) { setPhase('wrong'); } }
  }

  function right() {
    sfx.correct(); buzz.ok(); celebrate.pop(0.5, 0.45);
    const t = pick(READ_THANKS); setLine(t); setPhase('right');
    void speakSeq([{ text: t.jp, who }]);
  }
  function show() {
    void stopListening();
    sfx.tap(); firstOk.current = false; setPhase('shown');
    void speakSeq([{ text: photo.kana, rate: s.rate * 0.85 }]);
  }

  const solved = phase === 'right' || phase === 'shown';
  return (
    <div className={`photo-ask ${dark ? 'dark' : ''}`}>
      <div className="row gap-s pa-who">
        <Portrait id={who} size={44} mood={phase === 'right' ? 'happy' : phase === 'wrong' ? 'oops' : 'teach'} talking={phase === 'asking'} />
        <div className="grow">
          <b className="small">{c?.name.split(' ')[0]}</b>
          <div lang="ja" className="jp">{line.jp}</div>
          <div className="tiny" style={{ opacity: .8 }}>{line.en}</div>
        </div>
      </div>
      <button className="pa-img" onClick={() => setZoom(!zoom)} aria-label={zoom ? 'Zoom out' : 'Zoom in'}>
        <img src={photo.img} alt={`Photo: ${photo.en}`} className={zoom ? 'zoom' : ''} />
      </button>
      <p className="small" style={{ margin: 0 }}>Read <b>{photo.look}</b> out loud. <span className="tiny" style={{ opacity: .75 }}>(tap the photo to zoom)</span></p>
      {(phase === 'listening' || live) && !solved && <p className="small" lang="ja" style={{ margin: 0 }}>🎤 {live || '…'}</p>}
      {phase === 'wrong' && heard && <p className="small" style={{ margin: 0 }}>I heard: <span lang="ja">{heard}</span></p>}
      {(solved || (phase === 'wrong' && tries > 0)) && (
        <div className={`pa-answer ${phase === 'right' ? 'ok' : ''}`}>
          <div className="row between">
            <span lang="ja" className="jp" style={{ fontSize: '1.3rem', fontWeight: 700 }}>{photo.read}</span>
            <button className="iconbtn" aria-label="Hear it" onClick={() => speakSeq([{ text: photo.kana, rate: s.rate * 0.85 }])}><Icon n="sound" /></button>
          </div>
          <div className="small" lang="ja">{photo.shown ?? photo.kana} · {photo.romaji}</div>
          {solved && <><div style={{ fontWeight: 600 }}>“{photo.en}”</div><div className="small" style={{ opacity: .85 }}>{photo.note}</div></>}
        </div>
      )}
      <div className="row gap-s" style={{ flexWrap: 'wrap' }}>
        {!solved && mic && <button className={`btn ${phase === 'listening' ? 'danger' : ''}`} onClick={() => void listen()} disabled={phase === 'asking' || phase === 'checking'}><Icon n="mic" s={18} />{phase === 'listening' ? 'Done' : tries ? 'Try again' : 'Read it'}</button>}
        {!solved && <button className="btn line" onClick={show}>{mic ? 'Show me' : 'Show the reading'}</button>}
        {!solved && !mic && <button className="btn line" onClick={right}>I read it ✓</button>}
        {solved && <button className="btn" onClick={() => onDone(phase === 'right' && firstOk.current)}>Continue<Icon n="next" s={18} /></button>}
      </div>
      <p className="tiny" style={{ opacity: .6, margin: 0 }}>Photo: {photo.credit.author} · {photo.credit.license} · Wikimedia Commons</p>
    </div>
  );
}
