// A "video call" with a teacher. With the AI tutor connected it is a free
// conversation; without it, the teacher runs one of the offline roleplays.
// You answer by speaking (or typing); she answers out loud.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CAST, GUIDES, dailyCast } from '../content/cast';
import { ROLEPLAYS } from '../content/extras';
import { checkSentence } from '../lib/check';
import { parseFuri } from '../lib/jp';
import { db, getKV } from '../lib/db';
import { LESSONS } from '../content';
import { speakSeq, stop } from '../services/tts';
import { listenOnce, sttAvailable, stopListening } from '../services/stt';
import { aiConfigured, tutorReply, type ChatMsg } from '../services/ai';
import { sfx } from '../services/sfx';
import { Portrait } from '../components/Portrait';
import { PaperInput } from '../components/Paper';
import { KanaKeyboard } from '../components/Keyboard';
import { Screen, Icon, Furi, useS, useAsync } from '../components/ui';

interface Line { me: boolean; jp: string; f?: string; en?: string; fix?: string }

export default function Call() {
  const [q, setQ] = useSearchParams();
  const id = q.get('c');
  const ai = useAsync(aiConfigured, []);
  if (!id || !CAST[id]) return (
    <Screen back title="Call a teacher">
      <p className="small muted">Pick who to call. She speaks first — answer out loud, or type if you prefer.</p>
      <div className="pick-grid">
        {GUIDES.map(g => (
          <button key={g} onClick={() => setQ({ c: g, rp: q.get('rp') ?? '' })}>
            <Portrait id={g} size={92} />
            <span>{CAST[g].name}</span>
            <span className="tiny muted" style={{ fontWeight: 500 }}>{CAST[g].series}</span>
          </button>
        ))}
      </div>
      <div className="card flat small">{ai ? 'The AI tutor is connected: this will be a free conversation, adapted to your level.' : 'The AI tutor is not connected, so calls follow the offline roleplay scripts (ordering food, shopping, directions…). Connect the tutor in Settings for free conversation.'}</div>
    </Screen>
  );
  return <InCall id={id} ai={!!ai} rpId={q.get('rp') || ''} />;
}

function InCall({ id, ai, rpId }: { id: string; ai: boolean; rpId: string }) {
  const s = useS();
  const nav = useNavigate();
  const c = CAST[id];
  const pitch = 1.25;
  const rp = useRef(ROLEPLAYS.find(r => r.id === rpId) ?? ROLEPLAYS[Math.floor(Math.random() * ROLEPLAYS.length)]).current;
  const [lines, setLines] = useState<Line[]>([]);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [turn, setTurn] = useState(0);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [en, setEn] = useState(false);
  const [err, setErr] = useState('');
  const [secs, setSecs] = useState(0);
  const [ended, setEnded] = useState(false);
  const [mood, setMood] = useState<'teach' | 'happy' | 'oops'>('teach');
  const mic = useAsync(sttAvailable, []);
  const history = useRef<ChatMsg[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true);

  useEffect(() => { const t = setInterval(() => setSecs(x => x + 1), 1000); return () => { clearInterval(t); alive.current = false; void stop(); void stopListening(); }; }, []);

  const say = async (jp: string, f?: string, en?: string) => {
    setLines(l => [...l, { me: false, jp, f, en }]);
    setTalking(true);
    await speakSeq([{ text: jp, rate: s.rate * 0.95, pitch }]);
    if (alive.current) setTalking(false);
  };

  // Opening line.
  useEffect(() => {
    sfx.streak();
    void (async () => {
      await new Promise(r => setTimeout(r, 700));
      if (ai) await aiTurn([]);
      else { const t = rp.turns[0]; await say(parseFuri(t.npc.f).jp, t.npc.f, t.npc.en); autoListen(); }
    })();
  }, []); // eslint-disable-line

  const autoListen = () => { if (mic && !typing && alive.current) void listen(); };

  const aiTurn = async (h: ChatMsg[]) => {
    try {
      const done = await getKV<Record<string, number>>('doneLessons', {});
      const known = LESSONS.filter(l => done[l.id]).map(l => l.title).join('; ') || 'greetings only';
      const r = await tutorReply({ messages: h, scenario: 'call', persona: `${c.name} from the anime "${c.series}"`, level: s.level, known });
      history.current = [...h, { role: 'assistant', content: r.jp }];
      if (r.correction?.better) {
        setMood('oops');
        setLines(l => { const x = [...l]; const last = x.map(y => y.me).lastIndexOf(true); if (last >= 0) x[last] = { ...x[last], fix: `${r.correction!.better} — ${r.correction!.why}` }; return x; });
        await db.corrections.add({ ts: Date.now(), said: r.correction.said, better: r.correction.better, why: r.correction.why, source: 'call' });
      } else setMood('happy');
      await say(r.jp, undefined, r.en);
      setMood('teach');
      autoListen();
    } catch (e) { setErr((e as Error).message); }
  };

  const answer = async (said: string) => {
    if (!said.trim() || ended) return;
    setLines(l => [...l, { me: true, jp: said }]);
    setText('');
    if (ai) { await aiTurn([...history.current, { role: 'user', content: said }]); return; }
    const t = rp.turns[turn];
    const ok = checkSentence({ f: t.expect[0], en: t.goal, alt: t.expect.slice(1) }, said).ok;
    if (!ok) {
      setMood('oops'); sfx.wrong();
      setLines(l => { const x = [...l]; x[x.length - 1] = { ...x[x.length - 1], fix: `Try: ${parseFuri(t.expect[0]).jp} (${t.goal})` }; return x; });
      await say('もう一回、言ってみて。', 'もう一[いち]回[かい]、 言[い]ってみて。', 'Try saying it once more.');
      setMood('teach'); autoListen(); return;
    }
    setMood('happy'); sfx.correct();
    const next = turn + 1; setTurn(next);
    if (next < rp.turns.length) { const n = rp.turns[next]; await say(parseFuri(n.npc.f).jp, n.npc.f, n.npc.en); setMood('teach'); autoListen(); }
    else { await say(parseFuri(rp.closing.f).jp, rp.closing.f, rp.closing.en); setEnded(true); sfx.complete(); }
  };

  const listen = async () => {
    if (listening || talking) return;
    setErr(''); setListening(true);
    try { const h = await listenOnce(); setListening(false); if (h[0]) await answer(h[0]); }
    catch (e) { setListening(false); setErr((e as Error).message); }
  };

  const goal = !ai && !ended ? rp.turns[Math.min(turn, rp.turns.length - 1)] : null;
  const last = [...lines].reverse().find(l => !l.me);
  const mine = [...lines].reverse().find(l => l.me);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="call" style={{ ['--c' as string]: c.color }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="small" style={{ opacity: .8 }}>{ai ? 'AI tutor' : rp.title} · <span className="num">{mmss}</span></span>
        <button className="chip" onClick={() => setEn(!en)} aria-pressed={en} style={{ background: en ? '#fff' : 'rgba(255,255,255,.15)', color: en ? 'var(--forest)' : '#fff', borderColor: 'transparent' }}>EN</button>
      </div>
      <div className="stage">
        <Portrait id={id} mood={mood} talking={talking} shape="full" size={typing ? 96 : 230} />
        <div className="col center" style={{ alignItems: 'center', gap: 4 }}>
          <b style={{ fontSize: '1.15rem' }}>{c.name}</b>
          <span className="small" style={{ opacity: .75 }}>{ended ? 'Call ended' : talking ? 'speaking…' : listening ? 'listening to you…' : 'your turn'}</span>
          {(talking || listening) && <span className="wave" aria-hidden="true"><i /><i /><i /><i /></span>}
        </div>
        <div className="cap" aria-live="polite">
          {last ? <>{last.f ? <Furi f={last.f} className="jp" romaji={false} /> : <span className="jp" lang="ja">{last.jp}</span>}{en && last.en && <div className="small" style={{ opacity: .8 }}>{last.en}</div>}</> : <span className="small" style={{ opacity: .7 }}>Connecting…</span>}
          {mine && <div className="small" style={{ marginTop: 8, opacity: .9 }}>You: <span lang="ja">{mine.jp}</span></div>}
          {mine?.fix && <div className="small" style={{ marginTop: 4, color: '#ffd27a' }} lang="ja">{mine.fix}</div>}
          {goal && <div className="tiny" style={{ marginTop: 8, opacity: .75 }}>Your goal: {goal.goal}</div>}
          {err && <div className="small" style={{ marginTop: 6, color: '#ffb3a8' }}>{err}</div>}
        </div>
      </div>
      {typing && !ended && (
        <div style={{ width: '100%', flex: 'none' }}>
          <div className="card flat" style={{ padding: '2px 12px', ['--rule' as string]: '40px' }}><PaperInput inputRef={inputRef} value={text} onChange={setText} minRows={1} note noSystemKeyboard={s.keyboard === 'app'} onEnter={() => void answer(text)} placeholder="日本語で…" /></div>
          {s.keyboard === 'app' && <div style={{ marginTop: 6 }}><KanaKeyboard inputRef={inputRef} value={text} onChange={setText} onEnter={() => void answer(text)} enterLabel="送信" /></div>}
        </div>
      )}
      <div className="ctl">
        <button aria-label={typing ? 'Hide keyboard' : 'Type instead'} onClick={() => setTyping(!typing)}><Icon n="key" s={26} /></button>
        {!ended && mic !== false && <button className={listening ? 'mic-on' : ''} aria-label="Speak" onClick={listen} disabled={talking}><Icon n="mic" s={28} /></button>}
        {goal && <button aria-label="Hint" onClick={() => void say(parseFuri(goal.expect[0]).jp, goal.expect[0], `Hint: ${goal.goal}`)}><Icon n="bulb" s={26} /></button>}
        <button className="hang" aria-label="Hang up" onClick={() => nav(-1)}><Icon n="close" s={28} /></button>
      </div>
    </div>
  );
}
