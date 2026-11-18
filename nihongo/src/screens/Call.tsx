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
import { checkSentence, checkWord, similarity } from '../lib/check';
import { chatOptions } from '../lib/exercises';
import { WordRomaji } from '../components/WordRomaji';
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
import { PhotoAsk } from '../components/PhotoAsk';
import { nextPhotos, markPhotoSeen } from './ReadJapan';
import type { RealPhoto } from '../content/realPhotos';
import { Screen, Icon, Furi, useS, useAsync } from '../components/ui';
import AiCall from './AiCall';

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
  const [modeSel, setMode] = useState<string | null>(q.get('mode'));
  const mode = modeSel ?? (ai ? 'lesson' : 'roleplay');
  if (!id || !CAST[id]) return (
    <Screen back title="Call a teacher">
      {mic === false && <div className="card sakura small">Calls are spoken. This device has no speech recognition, so calls can't hear you here. On Android, make sure the <b>Google</b> app is installed and allowed to use the microphone.</div>}
      <div className="seg" style={{ alignSelf: 'flex-start' }} role="group" aria-label="Call type">
        <button className={mode === 'lesson' ? 'on' : ''} onClick={() => setMode('lesson')}>Today's lesson</button>
        <button className={mode === 'talk' ? 'on' : ''} onClick={() => setMode('talk')}>Free talk</button>
        <button className={mode === 'roleplay' ? 'on' : ''} onClick={() => setMode('roleplay')}>Real-life</button>
        <button className={mode === 'mistakes' ? 'on' : ''} onClick={() => setMode('mistakes')}>My mistakes{quizable ? ` (${quizable})` : ''}</button>
      </div>
      <p className="small muted">{mode === 'lesson' ? (ai ? 'A casual chat about what you studied today. She keeps it short and easy, and always shows a sample answer you can read out.' : 'This needs the AI tutor (Settings → AI tutor → Gemini key, free).') : mode === 'talk' ? (ai ? 'A free conversation in Japanese at your level, with gentle corrections.' : 'Free talk needs the AI tutor (Settings → AI tutor). Until then, choose Real-life or My mistakes.') : mode === 'roleplay' ? 'She plays a real situation (shop, station, hotel…). Reply out loud.' : quizable ? 'She asks you the things you got wrong before. Answer out loud — right answers move them towards "remembered".' : 'Your Mistake Notebook is empty — nothing to quiz yet.'}</p>
      <div className="pick-grid">
        {GUIDES.map(g => (
          <button key={g} disabled={((mode === 'talk' || mode === 'lesson') && !ai) || (mode === 'mistakes' && !quizable)} onClick={() => setQ({ c: g, mode, rp: q.get('rp') ?? '', plan: q.get('plan') ?? '', block: q.get('block') ?? '' })}>
            <Portrait id={g} size={92} />
            <span>{CAST[g].name}</span>
            <span className="tiny muted" style={{ fontWeight: 500 }}>{CAST[g].series}</span>
          </button>
        ))}
      </div>
    </Screen>
  );
  if (ai === undefined) return null; // wait until we know whether the AI tutor is connected
  const m = q.get('mode') ?? (ai ? 'lesson' : 'roleplay');
  if ((m === 'lesson' || m === 'talk') && ai) return <AiCall id={id} mode={m} plan={q.get('plan') === '1'} />;
  return <InCall id={id} mode={m === 'lesson' || m === 'talk' ? 'roleplay' : m} ai={!!ai} rpId={q.get('rp') || ''} plan={q.get('plan') === '1'} quiz={mistakeTurns(open)} />;
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
  const [tries, setTries] = useState(0);
  const [easy, setEasy] = useState(true);
  const optsFor = useRef(new Map<number, { options: string[]; a: number }>());
  const replyOpts = (i: number) => { if (!optsFor.current.has(i)) optsFor.current.set(i, chatOptions(turns[i].expect[0])); return optsFor.current.get(i)!; };
  const mic = useAsync(sttAvailable, []);
  const history = useRef<ChatMsg[]>([]);
  const alive = useRef(true);
  // Real-photo moment: she holds up a sign and asks you to read it.
  const [photo, setPhoto] = useState<RealPhoto | null>(null);
  const photoDone = useRef<(() => void) | null>(null);
  const pool = useRef<RealPhoto[]>([]);
  useEffect(() => { void nextPhotos(4).then(p => { pool.current = p; }); }, []);
  const showPhoto = () => new Promise<void>(res => {
    const p = pool.current.shift();
    if (!p || !alive.current) return res();
    void stopListening(); void stop(); setListening(false);
    photoDone.current = res; setPhoto(p);
  });

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
    let close = false;
    if (!ok) { // recognisers often return kanji the learner didn't intend; compare readings too
      const heard = await readingOf(said).catch(() => said);
      ok = t.word ? checkWord(t.word.jp, t.word.kana, heard) : checkSentence({ f: t.expect[0], en: t.goal, alt: t.expect.slice(1) }, heard).ok;
      // Beginners rarely say it perfectly: accept anything that sounds close to an expected reply.
      if (!ok) { const best = Math.max(...t.expect.map(e => similarity(parseFuri(e).kana, heard))); if (best >= 0.72) { ok = true; close = true; } }
    }
    if (!ok) {
      setTries(x => x + 1);
      setMood('oops'); sfx.wrong();
      setMine({ said, fix: `${parseFuri(t.expect[0]).jp}  (${parseFuri(t.expect[0]).kana})` });
      await say('もう一[いっ]回[かい]、 言[い]ってみて。', `Not quite. Try saying: ${parseFuri(t.expect[0]).jp}`);
      setMood('teach'); void listen(); return;
    }
    setTries(0);
    setMood('happy'); sfx.correct(); setScore(x => x + (close ? 3 : 5));
    if (close) setMine({ said, fix: `Close enough! Exactly: ${parseFuri(t.expect[0]).jp}` });
    if (t.mistakeId) { const m = await db.mistakes.get(t.mistakeId); if (m) await db.mistakes.update(t.mistakeId, { status: m.status === 'uncertain' ? 'remembered' : 'uncertain' }); }
    const next = cur + 1; setTurn(next);
    if (next === 2 && turns.length > 2 && mode !== 'mistakes') { await new Promise(r => setTimeout(r, 600)); await showPhoto(); }
    if (!alive.current) return;
    if (next < turns.length) { await say(turns[next].f, turns[next].en); setMood('teach'); void listen(); }
    else { endedRef.current = true; await say(closing.f, closing.en); setEnded(true); sfx.complete(); }
  };

  const choose = async (f: string) => { await stopListening(); setListening(false); await speakSeq([{ text: parseFuri(f).jp, rate: s.rate * 0.9 }]); await answer(parseFuri(f).jp); };

  async function listen() {
    if (listening) { await stopListening(); return; }
    if (!alive.current || endedRef.current) return;
    if (mic === false) { setErr('Speech recognition is not available on this device, so the call can\'t hear you.'); return; }
    setErr(''); setListening(true);
    try { const h = await listenOnce(t => setMine({ said: t + ' …' }), 15000); setListening(false); if (photoDone.current || !alive.current) return; if (h[0]) await answer(h[0]); else setErr('I didn\'t catch that — tap the microphone and speak again.'); }
    catch (e) { setListening(false); setErr((e as Error).message); }
  }

  const t = !free && !ended ? turns[Math.min(turn, turns.length - 1)] : null;
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <div className="call" style={{ ['--c' as string]: c.color }}>
      <div className="row between" style={{ width: '100%' }}>
        <span className="small" style={{ opacity: .85 }}>{free ? 'Free talk' : mode === 'mistakes' ? 'Mistake quiz' : rp.title} · <span className="num">{mmss}</span></span>
        {!free && <span className="row gap-s"><span className="small num" style={{ opacity: .85 }}>{Math.min(turn + 1, turns.length)}/{turns.length} · ★ {score}</span><button className="chip" onClick={() => setEasy(!easy)} aria-pressed={easy} style={{ background: easy ? '#fff' : 'rgba(255,255,255,.15)', color: easy ? 'var(--forest)' : '#fff', borderColor: 'transparent', minHeight: 32 }}>{easy ? 'Hints on' : 'Hints off'}</button></span>}
      </div>
      <div className="stage">
        <Portrait id={id} mood={mood} talking={talking} shape="full" size={170} />
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
            <div className="row gap-s" style={{ marginTop: 6 }}>
              <button className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent', minHeight: 32 }} onClick={() => speakSeq([{ text: parseFuri(cap.f).jp, who: id, rate: s.rate * 0.95 }])}><Icon n="sound" s={14} />Again</button>
              <button className="chip" style={{ background: 'rgba(255,255,255,.15)', color: '#fff', borderColor: 'transparent', minHeight: 32 }} onClick={() => speakSeq([{ text: parseFuri(cap.f).jp, who: id, rate: s.rate * 0.6 }])}><Icon n="slow" s={14} />Slow</button>
            </div>
          </> : <span className="small" style={{ opacity: .7 }}>Calling {c.name.split(' ')[0]}…</span>}
          {t && <div className="tiny" style={{ marginTop: 8, opacity: .8 }}>Your goal: {t.goal}</div>}
          {t && (easy || tries >= 1) && !talking && (
            <button className="say-glow" disabled={tries < 2} onClick={() => void choose(t.expect[0])} aria-label="What to say">
              <span className="tiny">{tries >= 2 ? 'Tap to say it together with her' : 'You can say (politely):'}</span>
              <WordRomaji f={t.expect[0]} />
            </button>
          )}
          {mine && <div className="small" style={{ marginTop: 8 }}>You said: <span lang="ja">{mine.said}</span></div>}
          {mine?.fix && !t && <div className="small" style={{ marginTop: 4, color: '#ffd27a' }} lang="ja">Say: {mine.fix}</div>}
          {err && <div className="small" style={{ marginTop: 6, color: '#ffb3a8' }}>{err}</div>}
        </div>
      </div>
      {photo && (
        <div className="call-photo">
          <PhotoAsk photo={photo} who={id} mic={mic !== false} dark onDone={ok => {
            void markPhotoSeen(photo.id, ok); if (ok) setScore(x => x + 5);
            setPhoto(null); const r = photoDone.current; photoDone.current = null; r?.();
          }} />
        </div>
      )}
      <div className="ctl">
        {!ended && <button className={listening ? 'mic-on' : ''} style={{ width: 78, height: 78 }} aria-label="Speak" onClick={() => void listen()} disabled={talking}><Icon n="mic" s={34} /></button>}
        {!ended && !free && <button aria-label="Show me a real sign to read" disabled={talking || !!photo} onClick={() => void showPhoto().then(() => { if (alive.current && !endedRef.current) { const cur = turns[turnRef.current]; if (cur) void say(cur.f, cur.en).then(() => void listen()); } })}><Icon n="eye" s={26} /></button>}
        {t && !ended && <button aria-label="Hear the answer" onClick={() => void speakSeq([{ text: parseFuri(t.expect[0]).jp, who: id, rate: s.rate * 0.85 }])}><Icon n="bulb" s={26} /></button>}
        <button className="hang" aria-label="Hang up" onClick={() => (plan ? nav('/plan') : nav(-1))}><Icon n="close" s={28} /></button>
      </div>
      {ended && <button className="btn cream" onClick={() => nav(plan ? '/plan' : '/speak')}>{plan ? 'Back to today\'s plan' : 'Done'}</button>}
    </div>
  );
}
