// Notebook: free notes on ruled or grid paper, plus handwriting practice.
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Note } from '../lib/db';
import { speak } from '../services/tts';
import { Paper, PaperInput, ReadingLine } from '../components/Paper';
import { KanaKeyboard } from '../components/Keyboard';
import { StrokeOrder, useStrokes } from '../components/Strokes';
import { saveSettings } from '../lib/settings';
import { sfx } from '../services/sfx';
import { Screen, Icon, Empty, fmtDate, useS } from '../components/ui';

export function Notebook() {
  const nav = useNavigate();
  const s = useS();
  const notes = useLiveQuery(() => db.notes.orderBy('updated').reverse().toArray(), []);
  const [folder, setFolder] = useState('All');
  const create = async () => {
    const id = `n${Date.now()}`;
    await db.notes.add({ id, title: '', folder: folder === 'All' ? 'General' : folder, body: '', paper: s.paper, created: Date.now(), updated: Date.now() });
    nav(`/note/${id}`);
  };
  if (!notes) return null;
  const folders = ['All', ...new Set(notes.map(n => n.folder))];
  const list = notes.filter(n => folder === 'All' || n.folder === folder);
  return (
    <Screen title="Notebook" tabs right={<button className="btn sm" onClick={create}><Icon n="plus" s={16} />New page</button>}>
      <Link to="/session?m=drill&type=translate" className="card green row">
        <span className="tile" style={{ background: 'rgba(255,255,255,.14)', color: 'var(--cream)' }}><Icon n="pen" /></span>
        <div className="grow"><h3>Guided typing practice</h3><p className="small muted">Translate full sentences on notebook paper</p></div><Icon n="next" />
      </Link>
      <div className="row">
        <Link to="/session?m=drill&type=listening" className="card grow col gap-s"><span className="tile"><Icon n="ear" /></span><h3>Dictation</h3><p className="small muted">Hear it, write it</p></Link>
        <Link to="/handwriting" className="card grow col gap-s"><span className="tile sakura"><Icon n="draw" /></span><h3>Handwriting</h3><p className="small muted">Trace with your finger</p></Link>
      </div>
      <div className="section-h"><h2>My pages</h2></div>
      {folders.length > 2 && <div className="row gap-s" style={{ overflowX: 'auto' }}>{folders.map(f => <button key={f} className={`chip ${folder === f ? 'on' : ''}`} onClick={() => setFolder(f)}><Icon n="folder" s={15} />{f}</button>)}</div>}
      {list.length === 0 && <Empty title="Your notebook is empty">Start a page for vocabulary lists, diary lines in Japanese, or anything you want to remember.</Empty>}
      {list.map(n => (
        <Link key={n.id} to={`/note/${n.id}`} className="card row">
          <span className="tile"><Icon n="note" /></span>
          <div className="grow"><h3 lang="ja" className="jp" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title || n.body.split('\n')[0] || 'Untitled page'}</h3><p className="small muted">{n.folder} · {fmtDate(n.updated)}</p></div>
          <Icon n="next" s={18} />
        </Link>
      ))}
    </Screen>
  );
}

export function NotePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const s = useS();
  const [n, setN] = useState<Note | null>(null);
  const [reading, setReading] = useState(false);
  const appKb = s.keyboard === 'app';
  const romajiMode = !appKb && s.romajiInput;
  const [saved, setSaved] = useState(true);
  const ref = useRef<HTMLTextAreaElement>(null);
  const folders = useLiveQuery(async () => [...new Set((await db.notes.toArray()).map(x => x.folder))], []) ?? [];
  useEffect(() => { void db.notes.get(id!).then(x => setN(x ?? null)); }, [id]);
  // Autosave shortly after typing stops, and again when leaving the page.
  const latest = useRef<Note | null>(null);
  latest.current = n;
  useEffect(() => {
    if (!n || saved) return;
    const t = setTimeout(() => { void db.notes.put({ ...n, updated: Date.now() }).then(() => setSaved(true)); }, 500);
    return () => clearTimeout(t);
  }, [n, saved]);
  useEffect(() => () => { if (latest.current) void db.notes.put(latest.current); }, []);
  if (!n) return <Screen back title="Notebook"><p className="muted">Loading…</p></Screen>;
  const up = (patch: Partial<Note>) => { setN({ ...n, ...patch, updated: Date.now() }); setSaved(false); };
  const del = async () => { if (confirm('Delete this page? This cannot be undone.')) { latest.current = null; await db.notes.delete(n.id); nav('/notebook', { replace: true }); } };

  return (
    <Screen back="/notebook" title={<span className="small muted" style={{ fontWeight: 600 }}>{saved ? 'Saved' : 'Saving…'}</span>} right={<>
      <button className="iconbtn soft" aria-label="Read aloud" onClick={() => speak(n.body, { rate: s.rate })}><Icon n="sound" /></button>
      <button className="iconbtn soft" aria-label="Delete page" onClick={del}><Icon n="trash" /></button>
    </>}>
      <div className="row gap-s wrap">
        <div className="seg"><button className={appKb ? 'on' : ''} onClick={() => saveSettings({ keyboard: 'app' })} lang="ja">かな keys</button><button className={!appKb ? 'on' : ''} onClick={() => saveSettings({ keyboard: 'phone' })}>Phone keyboard</button></div>
        {!appKb && <button className={`chip ${s.romajiInput ? 'on' : ''}`} onClick={() => saveSettings({ romajiInput: !s.romajiInput })}>Romaji → kana</button>}
        <button className={`chip ${n.paper === 'grid' ? 'on' : ''}`} onClick={() => up({ paper: n.paper === 'grid' ? 'lined' : 'grid' })}>Grid</button>
        <button className={`chip ${reading ? 'on' : ''}`} onClick={() => setReading(!reading)}>Reading</button>
      </div>
      <Paper title={n.folder} date={fmtDate(n.created)} grid={n.paper === 'grid'}>
        <input className="paper-input note" style={{ height: 'var(--rule)', fontWeight: 700 }} lang="ja" placeholder="Title" value={n.title} onChange={e => up({ title: e.target.value })} aria-label="Title" />
        <PaperInput inputRef={ref} value={n.body} onChange={v => up({ body: v })} romajiMode={romajiMode} minRows={appKb ? 6 : 9} note noSystemKeyboard={appKb} placeholder="Write here… 日本語で書きましょう" />
      </Paper>
      {reading && (
        <div className="card flat col gap-s">
          <span className="label">Reading (automatic — usually right, occasionally not)</span>
          {n.body.split('\n').filter(Boolean).map((line, i) => <ReadingLine key={i + line} text={line} romaji={s.showRomaji} />)}
          {!/[㐀-鿿]/.test(n.body) && <span className="small muted">Readings appear for lines that contain kanji.</span>}
        </div>
      )}
      <div className="row gap-s">
        <label className="label" htmlFor="fld">Folder</label>
        <input id="fld" className="field" list="folders" value={n.folder} onChange={e => up({ folder: e.target.value || 'General' })} />
        <datalist id="folders">{folders.map(f => <option key={f} value={f} />)}</datalist>
      </div>
      {appKb && <div className="dock"><KanaKeyboard inputRef={ref} value={n.body} onChange={v => up({ body: v })} /></div>}
    </Screen>
  );
}

/** Finger-drawing canvas with an animated stroke-order guide to trace. */
export function Handwriting() {
  const loc = useLocation();
  const [ch, setCh] = useState<string>((loc.state as { ch?: string } | null)?.ch ?? 'あ');
  const [guide, setGuide] = useState(true);
  const [drawn, setDrawn] = useState(0);
  const [run, setRun] = useState(0);
  const cv = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const s = useS();
  const first = [...ch][0] ?? 'あ';
  const paths = useStrokes(first);
  const total = paths?.length ?? 0;
  const clear = () => { const c = cv.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setDrawn(0); };
  useEffect(() => {
    const c = cv.current!; const dpr = window.devicePixelRatio || 1;
    const size = c.clientWidth; c.width = size * dpr; c.height = size * dpr;
    const g = c.getContext('2d')!; g.scale(dpr, dpr); g.lineCap = 'round'; g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = '#1d2b3f';
  }, []);
  useEffect(() => { if (total && drawn === total) sfx.correct(); }, [drawn]); // eslint-disable-line
  const pos = (e: React.PointerEvent) => { const r = cv.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] as const; };
  return (
    <Screen back title="Handwriting practice">
      <div className="row gap-s">
        <input className="field jp" lang="ja" style={{ width: 84, textAlign: 'center', fontSize: '1.3rem' }} value={ch} maxLength={2} onChange={e => { setCh(e.target.value); clear(); }} aria-label="Character to practise" />
        <button className="iconbtn soft" aria-label="Hear it" onClick={() => speak(first, { rate: s.rate })}><Icon n="sound" /></button>
        <span className="grow" />
        <button className={`chip ${guide ? 'on' : ''}`} onClick={() => setGuide(!guide)} aria-pressed={guide}>Guide</button>
        <button className="chip" onClick={() => { clear(); setRun(r => r + 1); }}><Icon n="retry" s={15} />Clear</button>
      </div>
      <div className="canvas-wrap">
        {guide && <div style={{ position: 'absolute', inset: 0 }} key={first + run}><StrokeOrder ch={first} size="100%" faint controls={false} /></div>}
        <canvas ref={cv} style={{ width: '100%', aspectRatio: '1', display: 'block', position: 'relative' }}
          onPointerDown={e => { drawing.current = true; cv.current!.setPointerCapture(e.pointerId); const g = cv.current!.getContext('2d')!; const [x, y] = pos(e); g.beginPath(); g.moveTo(x, y); g.lineTo(x + .1, y + .1); g.stroke(); }}
          onPointerMove={e => { if (!drawing.current) return; const g = cv.current!.getContext('2d')!; const [x, y] = pos(e); g.lineTo(x, y); g.stroke(); }}
          onPointerUp={() => { if (drawing.current) setDrawn(d => d + 1); drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
      </div>
      {total > 0 && (
        <div className={`card ${drawn === total ? 'sage' : 'flat'} row between`}>
          <span style={{ fontWeight: 650 }}>Strokes: <span className="num">{drawn}</span> of <span className="num">{total}</span></span>
          <span className="small muted">{drawn === 0 ? 'Follow the numbers, in order' : drawn < total ? 'Keep going' : drawn === total ? 'Right number of strokes' : 'Too many strokes — clear and retry'}</span>
        </div>
      )}
      <p className="small muted">The faint guide shows each stroke in order, starting at its number. Trace it, then switch the guide off and write from memory. The app counts your strokes; it cannot yet judge their shape.</p>
    </Screen>
  );
}
