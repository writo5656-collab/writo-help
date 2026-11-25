// A casual call powered by the AI tutor, about today's lesson (or free talk).
// Speak by tapping the mic (tap again to finish); what you say appears live.
// Each turn she gives an easy sample answer you can read out or tap to send.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAST } from '../content/cast';
import { LESSONS, type Lesson } from '../content';
import { db, getKV } from '../lib/db';
import { markBlock } from '../lib/hooks';
import { kanaToRomaji } from '../lib/jp';
import { todaysLessons, materialText } from '../lib/today';
import { speakSeq, stop } from '../services/tts';
import { listenOnce, sttAvailable, stopListening } from '../services/stt';
import { tutorReply, type ChatMsg, type TutorReply } from '../services/ai';
import { sfx } from '../services/sfx';
import { Portrait } from '../components/Portrait';
import { PhotoAsk } from '../components/PhotoAsk';
import { nextPhotos, markPhotoSeen } from './ReadJapan';
import type { RealPhoto } from '../content/realPhotos';
import { Icon, useS, useAsync } from '../components/ui';

export default function AiCall({ id, mode, plan }: { id: string; mode: 'lesson' | 'talk'; plan: boolean }) {
  const s = useS();
  const nav = useNavigate();
  const c = CAST[id];
  const mic = useAsync(sttAvailable, []);
  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [reply, setReply] = useState<TutorReply | null>(null);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [mine, setMine] = useState('');
  const [thinking, setThinking] = useState(false);
  const [err, setErr] = useState('');
  const [en, setEn] = useState(true);
  const [secs, setSecs] = useState(0);
  const [turns, setTurns] = useState(0);
  const [mood, setMood] = useState<'teach' | 'happy' | 'oops'>('teach');
  const history = useRef<ChatMsg[]>([]);
  const alive = useRef(true);
  const reqId = useRef(0);        // only the newest request may update the screen
  const [photo, setPhoto] = useState<RealPhoto | null>(null);
  const photoRef = useRef(false);
  const turnsRef = useRef(0);
  const lastPhotoTurn = useRef(-1);
  const pool = useRef<RealPhoto[]>([]);
  useEffect(() => { void nextPhotos(6).then(p => { pool.current = p; }); }, []);
  const openPhoto = () => {
    const p = pool.current.shift();
    if (!p) return false;
    void stopListening(); void stop();
    lastPhotoTurn.current = turnsRef.current; photoRef.current = true; setPhoto(p);
    return true;
  };
  // A photo moment after your 2nd reply, then every 4 replies.
  const photoDue = () => turnsRef.current >= 2 && turnsRef.current !== lastPhotoTurn.current && (turnsRef.current - 2) % 4 === 0;
  const lastAsk = useRef<ChatMsg[]>([]);
  const [waitSecs, setWaitSecs] = useState(0);
  useEffect(() => {
    if (!thinking) { setWaitSecs(0); return; }
    const t = setInterval(() => setWaitSecs(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [thinking]);

  useEffect(() => { const t = setInterval(() => setSecs(x => x + 1), 1000); return () => { clearInterval(t); alive.current = false; void stop(); void stopListening(); }; }, []);
  useEffect(() => { if (plan && turns >= 4) void markBlock('real'); }, [turns]); // eslint-disable-line
  useEffect(() => { void todaysLessons().then(ls => { setLessons(ls); }); }, []);
  useEffect(() => { if (lessons) { sfx.streak(); void ask([]); } }, [lessons]); // eslint-disable-line

  const ask = async (h: ChatMsg[]) => {
    const my = ++reqId.current;
    lastAsk.current = h;
    setThinking(true); setErr('');
    try {
      const done = await getKV<Record<string, number>>('doneLessons', {});
      const known = LESSONS.filter(l => done[l.id]).map(l => l.title).join('; ') || 'beginner';
      const r = await tutorReply({ messages: h, scenario: mode === 'lesson' ? 'lesson' : 'call', persona: `${c.name} from the anime "${c.series}"`, level: s.level, known, lesson: mode === 'lesson' && lessons ? materialText(lessons) : undefined });
      if (!alive.current || my !== reqId.current) return;
      history.current = [...h, { role: 'assistant', content: r.jp }];
      setReply(r); setThinking(false);
      setMood(r.correction?.better ? 'oops' : h.length ? 'happy' : 'teach');
      if (r.correction?.better) void db.corrections.add({ ts: Date.now(), said: r.correction.said, better: r.correction.better, why: r.correction.why, source: 'call' });
      setTalking(true);
      await speakSeq([{ text: r.jp, who: id, rate: s.rate * 0.95 }]);
      if (!alive.current || my !== reqId.current) return;
      setTalking(false); setMood('teach');
      if (photoDue() && openPhoto()) return;
      if (mic && !photoRef.current) void listen();
    } catch (e) { if (my === reqId.current && alive.current) { setThinking(false); setTalking(false); setErr((e as Error).message); } }
  };
  const retry = () => { void stop(); setTalking(false); void ask(lastAsk.current); };

  const send = async (text: string) => {
    if (!text.trim()) return;
    setMine(text); setLive(''); setTurns(t => t + 1); turnsRef.current += 1;
    await ask([...history.current, { role: 'user', content: text }]);
  };

  async function listen() {
    if (listening) { await stopListening(); return; }
    if (talking || thinking || photoRef.current) return;
    setErr(''); setLive(''); setListening(true);
    try {
      const heard = await listenOnce(t => setLive(t), 20000);
      setListening(false);
      if (photoRef.current || !alive.current) return; // a photo opened mid-sentence: drop the half-heard words
      if (heard[0]) await send(heard[0]);
      // Silence is fine — just wait for the learner to tap the mic or the sample answer.
    } catch (e) { setListening(false); setErr((e as Error).message); }
  }

  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="call" style={{ ['--c' as string]: c.color }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="small" style={{ opacity: .85 }}>{mode === 'lesson' ? `Today: ${lessons?.map(l => l.title).join(' + ') ?? '…'}` : 'Free talk'} · <span className="num">{mmss}</span></span>
        <button className="chip" onClick={() => setEn(!en)} aria-pressed={en} style={{ background: en ? '#fff' : 'rgba(255,255,255,.15)', color: en ? 'var(--forest)' : '#fff', borderColor: 'transparent', minHeight: 32 }}>EN</button>
      </div>
      <div className="stage">
        <Portrait id={id} mood={mood} talking={talking} shape="full" size={150} />
        <div className="col center" style={{ alignItems: 'center', gap: 4 }}>
          <b style={{ fontSize: '1.1rem' }}>{c.name}</b>
          <span className="small" style={{ opacity: .8 }}>{thinking ? `thinking… ${waitSecs > 3 ? waitSecs + 's' : ''}` : talking ? 'speaking…' : listening ? 'listening — tap the mic when you\'re done' : 'your turn — tap the mic'}</span>
          {(talking || listening) && <span className="wave" aria-hidden="true"><i /><i /><i /><i /></span>}
        </div>
        <div className="cap" aria-live="polite">
          {reply ? <>
            <div className="jp" lang="ja">{reply.jp}</div>
            {reply.kana && reply.kana !== reply.jp && <div className="small" style={{ opacity: .75 }} lang="ja">{reply.kana}</div>}
            {en && <div className="small" style={{ marginTop: 4 }}>{reply.en}</div>}
            <div className="row gap-s" style={{ marginTop: 8 }}>
              <button className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent', minHeight: 32 }} onClick={() => speakSeq([{ text: reply.jp, who: id, rate: s.rate * 0.95 }])}><Icon n="sound" s={14} />Again</button>
              <button className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent', minHeight: 32 }} onClick={() => speakSeq([{ text: reply.jp, who: id, rate: s.rate * 0.6 }])}><Icon n="slow" s={14} />Slow</button>
            </div>
            {reply.correction?.better && <div className="small" style={{ marginTop: 8, color: '#f2d49b' }} lang="ja"><Icon n="pen" s={14} /> {reply.correction.better} — {reply.correction.why}</div>}
          </> : <span className="small" style={{ opacity: .7 }}>{err ? '' : `Calling ${c.name.split(' ')[0]}…`}</span>}
          {(listening || live) && <div className="small row" style={{ marginTop: 8, gap: 8 }} lang="ja"><Icon n="mic" s={14} />{live || '…'}</div>}
          {!listening && !live && mine && <div className="small" style={{ marginTop: 8, opacity: .8 }} lang="ja">You: {mine}</div>}
          {thinking && waitSecs >= 15 && <div className="small" style={{ marginTop: 8, opacity: .85 }}>Taking longer than usual… <button className="chip" style={{ minHeight: 28, marginLeft: 8 }} onClick={retry}>Retry</button></div>}
          {err && <div className="small" style={{ marginTop: 8, color: '#ffb3a8' }}>{err} <button className="chip" style={{ minHeight: 28, marginLeft: 8 }} onClick={retry}>Retry</button></div>}
        </div>
        {reply?.hint?.jp && !talking && (
          <button className="say-glow" onClick={() => void send(reply.hint!.jp)} aria-label="Send the sample answer">
            <span className="tiny">You could say (tap to send it):</span>
            <span className="jp" lang="ja" style={{ fontSize: '1.05rem', fontWeight: 600 }}>{reply.hint.jp}</span>
            <span className="tiny" style={{ color: 'rgba(255,255,255,.8)' }}>{reply.hint.romaji || kanaToRomaji(reply.hint.kana || reply.hint.jp)}{en ? ` — ${reply.hint.en}` : ''}</span>
          </button>
        )}
      </div>
      {photo && (
        <div className="call-photo">
          <PhotoAsk photo={photo} who={id} mic={!!mic} dark onDone={ok => {
            void markPhotoSeen(photo.id, ok);
            photoRef.current = false; setPhoto(null);
            void send(`「${photo.read}」って書いてあったよ！`);
          }} />
        </div>
      )}
      <div className="ctl">
        {mic !== false && <button className={listening ? 'mic-on' : ''} style={{ width: 78, height: 78 }} aria-label={listening ? 'Finish speaking' : 'Speak'} onClick={() => void listen()} disabled={talking || thinking}><Icon n="mic" s={34} /></button>}
        <button aria-label="Show me a real sign to read" onClick={() => { if (!talking && !thinking) openPhoto(); }} disabled={talking || thinking || !!photo}><Icon n="eye" s={26} /></button>
        {reply?.hint?.jp && <button aria-label="Hear the sample answer" onClick={() => speakSeq([{ text: reply.hint!.jp, rate: s.rate * 0.85 }])}><Icon n="bulb" s={26} /></button>}
        <button className="hang" aria-label="Hang up" onClick={() => (plan ? nav('/plan') : nav(-1))}><Icon n="close" s={28} /></button>
      </div>
      {mic === false && <p className="tiny" style={{ opacity: .8 }}>No speech recognition on this device — tap the sample answers to reply.</p>}
    </div>
  );
}
