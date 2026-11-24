// "Explain my answer" sheet (right or wrong): your answer vs the correct one,
// then one tab per piece of the sentence with meaning, particle, verb ending
// and examples from the course. The AI teacher can explain more on request.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Ex } from '../lib/exercises';
import { ALL_SENTENCES, LESSONS } from '../content';
import { CAST } from '../content/cast';
import { useLookup } from '../lib/lookup';
import { targetOf, explainPieces, explainPrompt } from '../lib/explain';
import { parseFuri, romajiOf } from '../lib/jp';
import { getKV } from '../lib/db';
import { speakSeq } from '../services/tts';
import { aiConfigured, tutorReply, type TutorReply } from '../services/ai';
import { sfx } from '../services/sfx';
import { Furi, Icon, useS, useAsync } from './ui';
import { Portrait } from './Portrait';

interface Props { ex: Ex; ok: boolean; user: string; expected: string; teacher?: string; onClose: () => void }

export function Explain({ ex, ok, user, expected, teacher, onClose }: Props) {
  const s = useS();
  const t = useMemo(() => targetOf(ex), [ex]);
  const look = useLookup();
  const pieces = useMemo(() => t ? explainPieces(t.f, look, (word, not) =>
    ALL_SENTENCES.map(x => ({ x, jp: parseFuri(x.f).jp })).filter(o => o.jp.includes(word) && o.jp !== not)
      .sort((a, b) => a.jp.length - b.jp.length).slice(0, 2).map(o => ({ f: o.x.f, en: o.x.en }))) : [], [t, look]);
  const [tab, setTab] = useState(-1); // -1 = overview
  const ai = useAsync(aiConfigured, []);
  const [more, setMore] = useState<TutorReply | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const who = teacher && CAST[teacher] ? CAST[teacher] : undefined;

  const askAi = async () => {
    if (!t || busy) return;
    sfx.tap(); setBusy(true); setErr('');
    try {
      const done = await getKV<Record<string, number>>('doneLessons', {});
      const known = LESSONS.filter(l => done[l.id]).map(l => l.title).join('; ') || 'beginner';
      const r = await tutorReply({ messages: [{ role: 'user', content: explainPrompt(t, user, expected, ok) }], scenario: 'explain', level: s.level, known, persona: who ? `${who.name} from the anime "${who.series}"` : undefined });
      setMore(r);
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  const cur = tab >= 0 ? pieces[tab] : undefined;
  // Rendered on <body>: screens animate with transforms, which would trap a fixed overlay.
  return createPortal(
    <div className="explain" role="dialog" aria-modal="true" aria-label="Explain my answer">
      <header className="row gap-s">
        <button className="iconbtn" aria-label="Back" onClick={onClose}><Icon n="back" /></button>
        <h2 style={{ margin: 0 }}>Explain my answer</h2>
      </header>
      {!t ? <p className="muted">This one has no Japanese sentence to break down.</p> : <>
        <div className="ex-tabs" role="tablist">
          <button role="tab" aria-selected={tab === -1} className={tab === -1 ? 'on' : ''} onClick={() => setTab(-1)}>Overview</button>
          {pieces.map((p, i) => <button key={i} role="tab" aria-selected={tab === i} className={tab === i ? 'on' : ''} lang="ja" onClick={() => { setTab(i); void speakSeq([{ text: p.jp, rate: s.rate }]); }}>{p.jp}</button>)}
        </div>
        <div className="card ex-card" key={tab}>
          {tab === -1 ? <>
            <div className="row between"><Furi f={t.f} className="jp-l" /><button className="iconbtn" aria-label="Hear it" onClick={() => speakSeq([{ text: parseFuri(t.f).jp, rate: s.rate }])}><Icon n="sound" /></button></div>
            <p className="small muted" style={{ margin: '2px 0 0' }}>{romajiOf(t.f)}</p>
            <p style={{ margin: '8px 0' }}>“{t.en}”</p>
            <div className={`ex-ans ${ok ? 'ok' : 'bad'}`}>
              <div><span className="tiny muted">Your answer</span><div lang="ja" className="jp">{user || '—'}</div></div>
              {!ok && <div><span className="tiny muted">Correct</span><div lang="ja" className="jp">{expected || parseFuri(t.f).jp}</div></div>}
              <b className="small">{ok ? '✓ Right!' : '✗ Not quite'}</b>
            </div>
            {t.notes.map((n, i) => <p key={i} className="small">{n}</p>)}
            <p className="tiny muted">Tap a piece above to see what each part means.</p>
          </> : cur && <>
            <div className="row between"><span className="jp-l" lang="ja"><b className="hl">{cur.jp}</b></span><button className="iconbtn" aria-label="Hear it" onClick={() => speakSeq([{ text: cur.jp, rate: s.rate * 0.8 }])}><Icon n="sound" /></button></div>
            <p className="small muted" style={{ margin: 0 }} lang="ja">{cur.kana !== cur.jp ? `${cur.kana} · ` : ''}{cur.romaji}</p>
            {cur.word && <p><b className="hl" lang="ja">{cur.word.jp}</b>{cur.word.kana !== cur.word.jp ? <span className="small muted" lang="ja"> ({cur.word.kana})</span> : null} means “{cur.word.en}”.{cur.word.base ? <span className="small muted"> Dictionary form: <span lang="ja">{cur.word.base}</span>.</span> : null}</p>}
            {cur.particle && <p><b className="hl" lang="ja">{cur.particle.p}</b> — {cur.particle.info.replace(/^\S+ (\([a-z]+\) )?/, '')}</p>}
            {cur.ending && <p><b className="hl" lang="ja">{cur.ending.e}</b> — {cur.ending.info.replace(/^\S+ = /, '')}</p>}
            {!cur.word && !cur.particle && !cur.ending && <p className="small muted">A fixed expression — learn it as one piece.</p>}
            {cur.examples.length > 0 && <>
              <span className="label">More examples</span>
              <ul className="ex-list">{cur.examples.map((e, i) => (
                <li key={i}><button className="linkish" onClick={() => speakSeq([{ text: parseFuri(e.f).jp, rate: s.rate }])}><Furi f={e.f} /></button><div className="tiny muted">{e.en}</div></li>
              ))}</ul>
            </>}
          </>}
        </div>
        {ai && (
          <div className="card ex-ai">
            {!more && <button className="btn line" onClick={() => void askAi()} disabled={busy}>
              {who && <Portrait id={who.id} size={28} mood="teach" />}{busy ? `${who?.name.split(' ')[0] ?? 'Teacher'} is writing…` : `Ask ${who?.name.split(' ')[0] ?? 'the teacher'} to explain more`}
            </button>}
            {err && <p className="small" style={{ color: 'var(--red, #c0392b)' }}>{err} <button className="chip" onClick={() => void askAi()}>Retry</button></p>}
            {more && <>
              <div className="row gap-s">{who && <Portrait id={who.id} size={36} mood="happy" />}<b>{who?.name.split(' ')[0] ?? 'Teacher'} explains</b></div>
              <p style={{ whiteSpace: 'pre-wrap' }}>{more.en}</p>
              {more.jp && <button className="linkish" onClick={() => speakSeq([{ text: more.jp, who: who?.id, rate: s.rate }])}><span lang="ja" className="jp">{more.jp}</span> <Icon n="sound" s={16} /></button>}
              {more.kana && more.kana !== more.jp && <div className="tiny muted" lang="ja">{more.kana}</div>}
              <p className="tiny muted">Written by the AI tutor — it can make mistakes.</p>
            </>}
          </div>
        )}
      </>}
      <button className="btn" style={{ marginTop: 'auto' }} onClick={onClose}>Continue lesson</button>
    </div>,
    document.body,
  );
}
