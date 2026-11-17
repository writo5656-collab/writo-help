// Speak: scripted roleplays (work offline) and the AI tutor (needs your proxy).
import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { ROLEPLAYS, LESSONS } from '../content';
import { checkSentence } from '../lib/check';
import { parseFuri } from '../lib/jp';
import { speak } from '../services/tts';
import { listenOnce, sttAvailable } from '../services/stt';
import { aiConfigured, tutorReply, type ChatMsg, type TutorReply } from '../services/ai';
import { getKV } from '../lib/db';
import { PaperInput } from '../components/Paper';
import { KanaKeyboard } from '../components/Keyboard';
import { saveSettings } from '../lib/settings';
import { Screen, Icon, Furi, Wip, Mascot, useS, useAsync, fmtDate } from '../components/ui';

export function Speak() {
  const ai = useAsync(aiConfigured, []);
  const corrections = useLiveQuery(() => db.corrections.orderBy('ts').reverse().limit(6).toArray(), []) ?? [];
  return (
    <Screen title="Speak" tabs>
      <Link to="/tutor" className="card green row">
        <Mascot size={58} mood="cheer" />
        <div className="grow"><h3>AI conversation tutor</h3><p className="small muted">{ai ? 'Free conversation with gentle corrections' : 'Not set up yet — tap to see how'}</p></div><Icon n="next" />
      </Link>
      <h2 className="mt">Roleplay situations</h2>
      <p className="small muted">Guided conversations that work offline. Answer by typing or speaking.</p>
      {ROLEPLAYS.map(r => (
        <Link key={r.id} to={`/roleplay/${r.id}`} className="card row">
          <span className="tile sakura"><Icon n="chat" /></span>
          <div className="grow"><h3>{r.title}</h3><p className="small muted">{r.place} · you are the {r.you.toLowerCase()}</p></div><Icon n="next" s={18} />
        </Link>
      ))}
      <Link to="/session?m=drill&type=speaking" className="card row"><span className="tile"><Icon n="mic" /></span><div className="grow"><h3>Read aloud</h3><p className="small muted">Say sentences from your lessons</p></div><Icon n="next" s={18} /></Link>
      {corrections.length > 0 && <>
        <h2 className="mt">Recent corrections</h2>
        <div className="card flat list" style={{ padding: '2px 16px' }}>
          {corrections.map(c => <div key={c.id} className="li" style={{ alignItems: 'flex-start' }}><div className="grow small"><div lang="ja" className="jp" style={{ color: 'var(--bad)' }}>{c.said}</div><div lang="ja" className="jp" style={{ color: 'var(--ok)', fontWeight: 600 }}>{c.better}</div><div className="muted">{c.why}</div></div><span className="tiny muted">{fmtDate(c.ts)}</span></div>)}
        </div>
      </>}
    </Screen>
  );
}

/** Text box + microphone used by both roleplay and tutor. */
function Reply({ onSend, busy, hint }: { onSend: (t: string) => void; busy?: boolean; hint?: string }) {
  const s = useS();
  const [v, setV] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const appKb = s.keyboard === 'app';
  const romajiMode = !appKb && s.romajiInput;
  const [live, setLive] = useState(false);
  const [err, setErr] = useState('');
  const [showHint, setShowHint] = useState(false);
  const mic = useAsync(sttAvailable, []);
  const send = () => { if (v.trim()) { onSend(v.trim()); setV(''); setShowHint(false); } };
  const listen = async () => {
    setErr(''); setLive(true);
    try { const h = await listenOnce(); if (h[0]) setV(h[0]); else setErr('Nothing heard — try again, or type instead.'); }
    catch (e) { setErr((e as Error).message); }
    setLive(false);
  };
  return (
    <div className="dock">
      {showHint && hint && <div className="card amber note-tip"><Icon n="bulb" s={18} /><span lang="ja" className="jp">{hint}</span></div>}
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
      <div className="card flat" style={{ padding: '4px 12px', ['--rule' as string]: '40px' }}>
        <PaperInput inputRef={ref} value={v} onChange={setV} romajiMode={romajiMode} noSystemKeyboard={appKb} minRows={1} note placeholder={live ? 'Listening…' : 'Type or speak your reply in Japanese'} onEnter={send} disabled={busy} />
      </div>
      <div className="row gap-s">
        <button className={`chip ${appKb ? 'on' : ''}`} aria-pressed={appKb} onClick={() => saveSettings({ keyboard: appKb ? 'phone' : 'app' })} lang="ja">かな keys</button>
        {hint && <button className="chip" onClick={() => setShowHint(!showHint)}><Icon n="bulb" s={15} />Hint</button>}
        <span className="grow" />
        {mic && <button className={`iconbtn ${live ? '' : 'soft'}`} style={live ? { background: 'var(--bad)', color: '#fff' } : undefined} aria-label="Speak your reply" onClick={listen} disabled={live || busy}><Icon n="mic" /></button>}
        <button className="btn sm" onClick={send} disabled={!v.trim() || busy}>Send<Icon n="next" s={16} /></button>
      </div>
      {appKb && !busy && <KanaKeyboard inputRef={ref} value={v} onChange={setV} onEnter={send} enterLabel="送信" />}
      {mic === false && !appKb && <p className="tiny muted">Speech input is not available on this device, so replies are typed.</p>}
    </div>
  );
}

interface Msg { me: boolean; f?: string; text?: string; en?: string; note?: string; ok?: boolean; models?: string[] }

export function Roleplay() {
  const { id } = useParams();
  const rp = ROLEPLAYS.find(r => r.id === id);
  const s = useS();
  const [turn, setTurn] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [fixes, setFixes] = useState(0);
  const [en, setEn] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { if (rp) { setMsgs([{ me: false, f: rp.turns[0].npc.f, en: rp.turns[0].npc.en }]); void speak(parseFuri(rp.turns[0].npc.f).jp, { rate: s.rate }); } }, [rp]); // eslint-disable-line
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs]);
  if (!rp) return <Screen back title="Roleplay"><p className="muted">Not found.</p></Screen>;
  const done = turn >= rp.turns.length;
  const t = rp.turns[Math.min(turn, rp.turns.length - 1)];

  const advance = (extra: Msg[]) => {
    const next = turn + 1;
    const line = next < rp.turns.length ? rp.turns[next].npc : rp.closing;
    setMsgs(m => [...m, ...extra, { me: false, f: line.f, en: line.en }]);
    setTurn(next);
    void speak(parseFuri(line.f).jp, { rate: s.rate });
  };
  const send = async (text: string) => {
    const r = checkSentence({ f: t.expect[0], en: t.goal, alt: t.expect.slice(1) }, text);
    if (r.ok) return advance([{ me: true, text, ok: true }]);
    setFixes(f => f + 1);
    await db.corrections.add({ ts: Date.now(), said: text, better: parseFuri(t.expect[0]).jp, why: `${rp.title}: ${t.goal}`, source: 'roleplay' });
    setMsgs(m => [...m, { me: true, text, ok: false, note: `Goal: ${t.goal}`, models: t.expect.slice(0, 2) }]);
  };

  return (
    <Screen back="/speak" title={rp.title} right={<button className="btn sm line" onClick={() => setEn(!en)}>{en ? 'Hide' : 'Show'} English</button>}>
      <div className="card sage small"><b>{rp.place}.</b> You are the {rp.you.toLowerCase()}; {rp.partner} speaks first. This is a guided script, so it expects particular replies — the AI tutor is the place for open conversation.</div>
      <div className="col grow">
        {msgs.map((m, i) => m.me ? (
          <div key={i} className="col gap-s" style={{ alignItems: 'flex-end' }}>
            <div className="bubble me jp" lang="ja">{m.text}</div>
            {m.ok === false && (
              <div className="card amber small col gap-s" style={{ maxWidth: '92%' }}>
                <b>A more natural reply here:</b>
                {m.models!.map(x => <button key={x} className="row between" style={{ textAlign: 'left' }} onClick={() => speak(parseFuri(x).jp, { rate: s.rate })}><Furi f={x} className="jp-m" /><Icon n="sound" s={18} /></button>)}
                {m.note && <span className="muted">{m.note}</span>}
                {i === msgs.length - 1 && <div className="row"><span className="grow muted">Try again below, or</span><button className="btn sm ghost" onClick={() => advance([])}>move on</button></div>}
              </div>
            )}
          </div>
        ) : (
          <button key={i} className="bubble them" style={{ textAlign: 'left' }} onClick={() => speak(parseFuri(m.f!).jp, { rate: s.rate })}>
            <span className="tiny muted" style={{ fontWeight: 700 }}>{rp.partner}</span><br /><Furi f={m.f!} className="jp-m" />{en && <div className="small muted">{m.en}</div>}
          </button>
        ))}
        <div ref={end} />
      </div>
      {done ? (
        <div className="dock">
          <div className="card sage col gap-s center"><h3>Conversation complete</h3><p className="small muted">{fixes === 0 ? 'Every reply was natural. Try it again by speaking instead of typing.' : `${fixes} repl${fixes === 1 ? 'y was' : 'ies were'} adjusted — they are saved under Recent corrections.`}</p></div>
          <div className="row"><button className="btn ghost" onClick={() => { setTurn(0); setFixes(0); setMsgs([{ me: false, f: rp.turns[0].npc.f, en: rp.turns[0].npc.en }]); }}>Again</button><Link className="btn" to="/speak">Done</Link></div>
        </div>
      ) : (
        <>
          <div className="card flat small"><span className="label">Your goal</span><div style={{ fontWeight: 650 }}>{t.goal}</div></div>
          <Reply onSend={send} hint={t.hint} />
        </>
      )}
    </Screen>
  );
}

const SCENARIOS = [
  ['free', 'Free chat'], ['intro', 'Self-introduction'], ['restaurant', 'Ordering food'], ['shopping', 'Shopping'],
  ['hotel', 'Hotel check-in'], ['directions', 'Asking directions'], ['university', 'University'], ['work', 'Workplace'], ['sunday', 'Sunday review'],
] as const;

export function Tutor() {
  const s = useS();
  const [q] = useSearchParams();
  const ai = useAsync(aiConfigured, []);
  const [scenario, setScenario] = useState<string>(q.get('mode') === 'sunday' ? 'sunday' : 'free');
  const [chat, setChat] = useState<{ me: boolean; text: string; r?: TutorReply }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [en, setEn] = useState(true);
  const [slow, setSlow] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [chat, busy]);

  const ask = async (history: typeof chat) => {
    setBusy(true); setErr('');
    try {
      const done = await getKV<Record<string, number>>('doneLessons', {});
      const known = LESSONS.filter(l => done[l.id]).map(l => `${l.title} (${l.jp})`).join('; ') || 'only greetings so far';
      let review = '';
      if (scenario === 'sunday') {
        const weak = (await db.mistakes.orderBy('date').reverse().limit(12).toArray()).map(m => `${m.prompt} → ${m.expected}`).join(' | ');
        review = weak || 'no recorded mistakes this week';
      }
      const messages: ChatMsg[] = history.map(m => ({ role: m.me ? 'user' : 'assistant', content: m.me ? m.text : m.r?.jp ?? m.text }));
      const r = await tutorReply({ messages, scenario, level: slow ? `${s.level}, please use very short, simple sentences` : s.level, known, review });
      setChat([...history, { me: false, text: r.jp, r }]);
      void speak(r.jp, { rate: s.rate, slow });
      if (r.correction?.better) await db.corrections.add({ ts: Date.now(), said: r.correction.said, better: r.correction.better, why: r.correction.why, source: 'tutor' });
    } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  const send = (text: string) => { const h = [...chat, { me: true, text }]; setChat(h); void ask(h); };

  if (ai === undefined) return null;
  if (!ai) return (
    <Screen back="/speak" title="AI tutor">
      <div className="col center" style={{ alignItems: 'center' }}><Mascot mood="think" size={96} /><h2>The AI tutor is not connected yet</h2></div>
      <Wip>
        <b>This feature needs one piece of setup outside the app.</b> Free conversation is powered by an AI model, which requires a paid API key. For safety the key is never stored in the app: it lives in a small private relay ("proxy") that you deploy once. The proxy code and step-by-step instructions are in the project folder <code>server/</code>. When it is deployed, paste its address into Settings → AI tutor.
      </Wip>
      <Link className="btn" to="/settings">Open Settings</Link>
      <Link className="btn ghost" to="/speak">Use the offline roleplays instead</Link>
    </Screen>
  );
  return (
    <Screen back="/speak" title="AI tutor" right={<>
      <button className={`chip ${slow ? 'on' : ''}`} onClick={() => setSlow(!slow)} aria-pressed={slow}><Icon n="slow" s={15} />Slower</button>
      <button className={`chip ${en ? 'on' : ''}`} onClick={() => setEn(!en)} aria-pressed={en}>EN</button>
    </>}>
      <div className="row gap-s" style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
        {SCENARIOS.map(([id, label]) => <button key={id} className={`chip ${scenario === id ? 'on' : ''}`} onClick={() => { setScenario(id); setChat([]); }}>{label}</button>)}
      </div>
      <div className="col grow">
        {chat.length === 0 && !busy && (
          <div className="col center" style={{ alignItems: 'center', padding: 20 }}>
            <Mascot size={84} /><p className="muted small" style={{ maxWidth: 280 }}>Say anything in Japanese to begin, or let the tutor start. Mistakes are welcome — corrections are gentle and saved for you.</p>
            <button className="btn sm ghost" onClick={() => ask([])}>Let the tutor start</button>
          </div>
        )}
        {chat.map((m, i) => m.me ? <div key={i} className="bubble me jp" lang="ja">{m.text}</div> : (
          <div key={i} className="col gap-s">
            {m.r?.correction?.better && (
              <div className="card amber small col" style={{ gap: 4 }}>
                <b>A small correction</b>
                <span lang="ja" className="jp"><span style={{ color: 'var(--bad)' }}>{m.r.correction.said}</span> → <b style={{ color: 'var(--ok)' }}>{m.r.correction.better}</b></span>
                <span className="muted">{m.r.correction.why}</span>
              </div>
            )}
            <button className="bubble them" style={{ textAlign: 'left' }} onClick={() => speak(m.text, { rate: s.rate, slow })}>
              <span className="jp jp-m" lang="ja">{m.text}</span>
              {m.r?.kana && s.showFurigana && <div className="small muted jp" lang="ja">{m.r.kana}</div>}
              {en && m.r?.en && <div className="small muted">{m.r.en}</div>}
            </button>
          </div>
        ))}
        {busy && <div className="bubble them muted small">…</div>}
        {err && <div className="card sakura small">{err}</div>}
        <div ref={end} />
      </div>
      <Reply onSend={send} busy={busy} />
    </Screen>
  );
}
