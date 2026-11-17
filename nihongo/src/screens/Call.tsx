// A "video call" with a teacher. You answer by speaking — there is no keyboard.
// Modes: free talk (AI tutor, if connected), a real-life roleplay (offline),
// or a quiz on your Mistake Notebook (offline). Everything she says is shown
// below her picture in Japanese, kana and English.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CAST, GUIDES } from '../content/cast';
import { ROLEPLAYS } from '../content/extras';
import { LESSONS } from '../content';
import { checkSentence, checkWord } from '../lib/check';
import { parseFuri } from '../lib/jp';
import { db, getKV, type Mistake } from '../lib/db';
import { markBlock } from '../lib/hooks';
import type { Ex } from '../lib/exercises';
import { speakSeq, stop } from '../services/tts';
import { listenOnce, sttAvailable, stopListening } from '../services/stt';
import { aiConfigured, tutorReply, type ChatMsg } from '../services/ai';
import { readingOf } from '../services/reading';
import { sfx } from '../services/sfx';
import { Portrait } from '../components/Portrait';
import { Screen, Icon, Furi, useS, useAsync } from '../components/ui';

interface Turn { f: string; en: string; goal: string; expect: string[]; word?: { jp: string; kana: string }; mistakeId?: number }

/** Turn Mistake Notebook entries into spoken quiz questions. */
function mistakeTurns(ms: Mistake[]): Turn[] {
  const out: Turn[] = [];
  for (const m of ms) {
    const ex = m.ex as Ex | undefined; if (!ex) continue;
    if ('sent' in ex) out.push({ f: 'これを 日本語[にほんご]で 言[い]ってみて。', en: `Say this in Japanese: "${ex.sent.en}"`, goal: ex.sent.en, expect: [ex.sent.f, ...(ex.sent.alt ?? [])], mistakeId: m.id });
    else if (ex.t === 'word') out.push({ f: 'この 言葉[ことば]は 日本語[にほんご]で？', en: `How do you say "${ex.word.en}" in Japanese?`, goal: ex.word.en, expect: [ex.word.jp], word: { jp: ex.word.jp, kana: ex.word.kana }, mistakeId: m.id });
    else if (ex.t === 'choice' && ex.jpOptions) out.push({ f: '答[こた]えを 言[い]ってみて。', en: `${ex.prompt}${ex.context ? ` — ${ex.context}` : ''}`, goal: ex.prompt, expect: [ex.options[ex.a]], word: { jp: ex.options[ex.a], kana: ex.options[ex.a] }, mistakeId: m.id });
    if (out.length >= 8) break;
  }
  return out;
}

export default function Call() {
  const [q, setQ] = useSearchParams();
  const id = q.get('c');
  const ai = useAsync(aiConfigured, []);
  const mic = useAsync(sttAvailable, []);
  const open = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').toArray(), []) ?? [];
  const quizable = mistakeTurns(open).length;
  const [mode, setMode] = useState(q.get('mode') ?? (ai ? 'talk' : 'roleplay'));
  if (!id || !CAST[id]) return (
    <Screen back title="Call a teacher">
      {mic === false && <div className="card sakura small">Calls are spoken. This device has no speech recognition, so calls can't hear you here. On Android, make sure the <b>Google</b> app is installed and allowed to use the microphone.</div>}
      <div className="seg" style={{ alignSelf: 'flex-start' }} role="group" aria-label="Call type">
        <button className={mode === 'talk' ? 'on' : ''} onClick={() => setMode('talk')}>Free talk</button>
        <button className={mode === 'roleplay' ? 'on' : ''} onClick={() => setMode('roleplay')}>Real-life</button>
        <button className={mode === 'mistakes' ? 'on' : ''} onClick={() => setMode('mistakes')}>My mistakes{quizable ? ` (${quizable})` : ''}</button>
      </div>
      <p className="small muted">{mode === 'talk' ? (ai ? 'A free conversation in Japanese at your level, with gentle corrections.' : 'Free talk needs the AI tutor (Settings → AI tutor). Until then, choose Real-life or My mistakes.') : mode === 'roleplay' ? 'She plays a real situation (shop, station, hotel…). Reply out loud.' : quizable ? 'She asks you the things you got wrong before. Answer out loud — right answers move them towards "remembered".' : 'Your Mistake Notebook is empty — nothing to quiz yet.'}</p>
      <div className="pick-grid">
        {GUIDES.map(g => (
          <button key={g} disabled={(mode === 'talk' && !ai) || (mode === 'mistakes' && !quizable)} onClick={() => setQ({ c: g, mode, rp: q.get('rp') ?? '', plan: q.get('plan') ?? '', block: q.get('block') ?? '' })}>
            <Portrait id={g} size={92} />
            <span>{CAST[g].name}</span>
            <span className="tiny muted" style={{ fontWeight: 500 }}>{CAST[g].series}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
  return <InCall id={id} mode={q.get('mode') ?? (ai ? 'talk' : 'roleplay')} ai={!!ai} rpId={q.get('rp') || ''} plan={q.get('plan') === '1'} quiz={mistakeTurns(open)} />;
}

function InCall({ id, mode, ai, rpId, plan, quiz }: { id: string; mode: string; ai: boolean; rpId: string; plan: boolean; quiz: Turn[] }) {
  const s = useS();
  const nav = useNavigate();
  const c = CAST[id];
  const free = mode === 'talk' && ai;
  const rp = useRef(ROLEPLAYS.find(r => r.id === rpId) ?? ROLEPLAYS[Math.floor(Math.random() * ROLEPLAYS.length)]).current;
  const turns = useRef<Turn[]>(mode === 'mistakes' && quiz.length ? quiz : rp.turns.map(t => ({ f: t.npc.f, en: t.npc.en, goal: t.goal, expect: t.expect }))).current;
  const closing = mode === 'mistakes' ? { f: 'よくがんばったね！ また 練習[れんしゅう]しよう。', en: 'You did great! Let\'s practise again.' } : rp.closing;
  const [cap, setCap] = useState<{ f: string; en: string; kana?: string } | null>(null);
  const [mine, setMine] = useState<{ said: string; fix?: string } | null>(null);
  const [talking, setTalking] = useState(false);
  const [listening, setListening] = useState(false);
  const [turn, setTurnState] = useState(0);
  // Refs, because the listen → answer loop runs inside earlier renders' closures.
  const turnRef = useRef(0);
  const setTurn = (n: number) => { turnRef.current = n; setTurnState(n); };
  const endedRef = useRef(false);
  const [err, setErr] = useState('');
  const [secs, setSecs] = useState(0);
  const [ended, setEnded] = useState(false);
  const [mood, setMood] = useState<'teach' | 'happy' | 'oops'>('teach');
  const [score, setScore] = useState(0);
  const mic = useAsync(sttAvailable, []);
  const history = useRef<ChatMsg[]>([]);
  const alive = useRef(true);

  useEffect(() => { const t = setInterval(() => setSecs(x => x + 1), 1000); return () => { clearInterval(t); alive.current = false; void stop(); void stopListening(); }; }, []);
  useEffect(() => { if (ended && plan) void markBlock('real'); }, [ended]); // eslint-disable-line

  const say = async (f: string, en: string) => {
    const jp = parseFuri(f).jp;
    const kana = /[㐀-鿿]/.test(f) && !/\[/.test(f) ? await readingOf(jp).catch(() => undefined) : undefined;
    setCap({ f, en, kana });
    setTalking(true);
    await speakSeq([{ text: jp, who: id, rate: s.rate * 0.95 }]);
    if (alive.current) setTalking(false);
  };

  useEffect(() => {
    sfx.streak();
    void (async () => {
      await new Promise(r => setTimeout(r, 700));
      if (free) await aiTurn([]);
      else { await say(turns[0].f, turns[0].en); void listen(); }
    })();
  }, []); // eslint-disable-line

  const aiTurn = async (h: ChatMsg[]) => {
    try {
      const done = await getKV<Record<string, number>>('doneLessons', {});
      const known = LESSONS.filter(l => done[l.id]).map(l => l.title).join('; ') || 'greetings only';
      const r = await tutorReply({ messages: h, scenario: 'call', persona: `${c.name} from the anime "${c.series}"`, level: s.level, known });
      history.current = [...h, { role: 'assistant', content: r.jp }];
      if (r.correction?.better) {
        setMood('oops'); setMine(m => m && { ...m, fix: `${r.correction!.better} — ${r.correction!.why}` });
        await db.corrections.add({ ts: Date.now(), said: r.correction.said, better: r.correction.better, why: r.correction.why, source: 'call' });
      } else setMood('happy');
      setCap({ f: r.jp, en: r.en, kana: r.kana });
      setTalking(true); await speakSeq([{ text: r.jp, who: id, rate: s.rate * 0.95 }]); if (alive.current) setTalking(false);
      setMood('teach'); void listen();
    } catch (e) { setErr((e as Error).message); }
  };

  const answer = async (said: string) => {
    setMine({ said });
    if (free) { await aiTurn([...history.current, { role: 'user', content: said }]); return; }
    const cur = turnRef.current;
    const t = turns[cur];
    let ok = t.word ? checkWord(t.word.jp, t.word.kana, said) : checkSentence({ f: t.expect[0], en: t.goal, alt: t.expect.slice(1) }, said).ok;
    if (!ok) { // recognisers often return kanji the learner didn't intend; compare readings too
      const heard = await readingOf(said).catch(() => said);
      ok = t.word ? checkWord(t.word.jp, t.word.kana, heard) : checkSentence({ f: t.expect[0], en: t.goal, alt: t.expect.slice(1) }, heard).ok;
    }
    if (!ok) {
      setMood('oops'); sfx.wrong();
      setMine({ said, fix: `${parseFuri(t.expect[0]).jp}  (${parseFuri(t.expect[0]).kana})` });
      await say('もう一[いっ]回[かい]、 言[い]ってみて。', `Not quite. Try saying: ${parseFuri(t.expect[0]).jp}`);
      setMood('teach'); void listen(); return;
    }
    setMood('happy'); sfx.correct(); setScore(x => x + 5);
    if (t.mistakeId) { const m = await db.mistakes.get(t.mistakeId); if (m) await db.mistakes.update(t.mistakeId, { status: m.status === 'uncertain' ? 'remembered' : 'uncertain' }); }
    const next = cur + 1; setTurn(next);
    if (next < turns.length) { await say(turns[next].f, turns[next].en); setMood('teach'); void listen(); }
    else { endedRef.current = true; await say(closing.f, closing.en); setEnded(true); sfx.complete(); }
  };

  async function listen() {
    if (!alive.current || endedRef.current) return;
    if (mic === false) { setErr('Speech recognition is not available on this device, so the call can\'t hear you.'); return; }
    setErr(''); setListening(true);
    try { const h = await listenOnce(); setListening(false); if (h[0]) await answer(h[0]); else setErr('I didn\'t catch that — tap the microphone and speak again.'); }
    catch (e) { setListening(false); setErr((e as Error).message); }
  }

  const t = !free && !ended ? turns[Math.min(turn, turns.length - 1)] : null;
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="call" style={{ ['--c' as string]: c.color }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="small" style={{ opacity: .85 }}>{free ? 'Free talk' : mode === 'mistakes' ? 'Mistake quiz' : rp.title} · <span className="num">{mmss}</span></span>
        {!free && <span className="small num" style={{ opacity: .85 }}>{Math.min(turn + 1, turns.length)}/{turns.length} · ★ {score}</span>}
      </div>
      <div className="stage">
        <Portrait id={id} mood={mood} talking={talking} shape="full" size={200} />
        <div className="col center" style={{ alignItems: 'center', gap: 4 }}>
          <b style={{ fontSize: '1.15rem' }}>{c.name}</b>
          <span className="small" style={{ opacity: .8 }}>{ended ? 'Call ended' : talking ? 'speaking…' : listening ? 'listening to you — speak now' : 'tap the microphone to answer'}</span>
          {(talking || listening) && <span className="wave" aria-hidden="true"><i /><i /><i /><i /></span>}
        </div>
        <div className="cap" aria-live="polite">
          {cap ? <>
            <Furi f={cap.f} className="jp" romaji={false} furigana />
            <div className="small" style={{ opacity: .75, marginTop: 2 }} lang="ja">{cap.kana ?? parseFuri(cap.f).kana}</div>
            <div className="small" style={{ marginTop: 4 }}>{cap.en}</div>
          </> : <span className="small" style={{ opacity: .7 }}>Calling {c.name.split(' ')[0]}…</span>}
          {t && <div className="tiny" style={{ marginTop: 8, opacity: .8 }}>Your goal: {t.goal}</div>}
          {mine && <div className="small" style={{ marginTop: 8 }}>You said: <span lang="ja">{mine.said}</span></div>}
          {mine?.fix && <div className="small" style={{ marginTop: 4, color: '#ffd27a' }} lang="ja">Say: {mine.fix}</div>}
          {err && <div className="small" style={{ marginTop: 6, color: '#ffb3a8' }}>{err}</div>}
        </div>
      </div>
      <div className="ctl">
        {!ended && <button className={listening ? 'mic-on' : ''} style={{ width: 78, height: 78 }} aria-label="Speak" onClick={() => void listen()} disabled={talking || listening}><Icon n="mic" s={34} /></button>}
        {t && !ended && <button aria-label="Hear the answer" onClick={() => void speakSeq([{ text: parseFuri(t.expect[0]).jp, who: id, rate: s.rate * 0.85 }])}><Icon n="bulb" s={26} /></button>}
        <button className="hang" aria-label="Hang up" onClick={() => (plan ? nav('/plan') : nav(-1))}><Icon n="close" s={28} /></button>
      </div>
      {ended && <button className="btn cream" onClick={() => nav(plan ? '/plan' : '/speak')}>{plan ? 'Back to today\'s plan' : 'Done'}</button>}
    </div>
  );
}
