// One exercise: shows the task, checks the answer, explains, and allows
// unlimited retries. It reports results upward; it never blocks progress.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ex } from '../lib/exercises';
import { shuffle } from '../lib/exercises';
import { checkSentence, checkWord, PARTICLE_INFO, type CheckResult } from '../lib/check';
import { parseFuri, normalize, toKanaUsing, romajiOf } from '../lib/jp';
import { speak } from '../services/tts';
import { listenOnce, sttAvailable } from '../services/stt';
import { readingOf } from '../services/reading';
import { Furi, Audio, Icon, useS, useAsync } from './ui';
import { Paper, PaperInput, HelperRow, ReadingLine } from './Paper';

export interface Outcome { ok: boolean; hint: boolean; userAnswer: string; expected: string; explanation: string }
interface Props { ex: Ex; onResult: (o: Outcome) => void; onNext: (requeue: boolean) => void; last: boolean }

interface Fb { ok: boolean; title: string; notes: string[]; model?: string; diff?: CheckResult['diff']; heard?: string }

export function Exercise({ ex, onResult, onNext, last }: Props) {
  const s = useS();
  const [fb, setFb] = useState<Fb | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [everWrong, setEverWrong] = useState(false);
  const hintRef = useRef(false);

  const finish = (f: Fb, userAnswer: string, expected: string) => {
    setFb(f);
    if (!f.ok) setEverWrong(true);
    onResult({ ok: f.ok, hint: hintRef.current, userAnswer, expected, explanation: f.notes.join(' ') });
    if (f.model && s.autoplay && !f.ok) void speak(parseFuri(f.model).jp, { rate: s.rate });
  };
  const retry = () => { setFb(null); setAttempt(a => a + 1); };

  return (
    <div className="col gap-l grow" style={{ minHeight: 0 }}>
      <Body key={attempt} ex={ex} locked={!!fb} fb={fb} onHint={() => { hintRef.current = true; }} finish={finish} />
      {fb && (
        <div className="dock">
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`} role="status">
            <h3><Icon n={fb.ok ? 'check' : 'bulb'} s={20} />{fb.title}</h3>
            {fb.heard !== undefined && <p className="small">I heard: <span lang="ja" className="jp">{fb.heard || '— nothing clear —'}</span></p>}
            {fb.model && (
              <div className="row between">
                <div><Furi f={fb.model} className="jp-l" /><div className="small muted">{'sent' in ex ? ex.sent.en : ''}</div></div>
                <Audio f={fb.model} compact />
              </div>
            )}
            {fb.diff && fb.diff.some(d => !d.ok) && (
              <p className="small diff" lang="ja">Compare: {fb.diff.map((d, i) => <span key={i} className={d.ok ? '' : 'miss'}>{d.ch}</span>)}</p>
            )}
            {fb.notes.length > 0 && <ul>{fb.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            {fb.ok && everWrong && <p className="tiny muted">Nice recovery. Because you saw the answer first, this one will come back later to check it has stuck.</p>}
          </div>
          <div className="row">
            {!fb.ok && <button className="btn ghost" onClick={retry}><Icon n="retry" s={18} />Try again</button>}
            <button className="btn" onClick={() => onNext(everWrong)}>{last && !everWrong ? 'Finish' : 'Continue'}<Icon n="next" s={18} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function Body({ ex, locked, fb, onHint, finish }: { ex: Ex; locked: boolean; fb: Fb | null; onHint: () => void; finish: (f: Fb, user: string, expected: string) => void }) {
  switch (ex.t) {
    case 'choice': return <Choice ex={ex} locked={locked} finish={finish} />;
    case 'fill': return <Fill ex={ex} locked={locked} finish={finish} />;
    case 'arrange': return <Arrange ex={ex} locked={locked} finish={finish} />;
    case 'speak': return <Speak ex={ex} locked={locked} finish={finish} />;
    default: return <Typing ex={ex} locked={locked} fb={fb} onHint={onHint} finish={finish} />;
  }
}
type Fin = (f: Fb, user: string, expected: string) => void;

function Choice({ ex, locked, finish }: { ex: Extract<Ex, { t: 'choice' }>; locked: boolean; finish: Fin }) {
  const s = useS();
  const [picked, setPicked] = useState(-1);
  useEffect(() => { if (ex.say && ex.jp && s.autoplay) void speak(ex.say, { rate: s.rate }); }, []); // eslint-disable-line
  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const ok = i === ex.a;
    finish({ ok, title: ok ? 'Correct' : `The answer is: ${ex.options[ex.a]}`, notes: [ex.why] }, ex.options[i], ex.options[ex.a]);
  };
  const short = ex.options.every(o => o.length <= 6);
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">{ex.prompt}</span>
        {ex.context && <p style={{ fontWeight: 650 }} lang={ex.jp ? 'ja' : undefined} className={ex.jp ? 'muted jp' : ''}>{ex.context}</p>}
        {ex.jp && (
          <div className="card flat row between">
            <Furi f={ex.jp} className={ex.jp.length <= 3 ? 'kana-big' : 'jp-xl'} furigana={ex.skill === 'kanji' || ex.skill === 'vocab' ? false : undefined} romaji={ex.skill === 'kana' || ex.skill === 'vocab' || ex.skill === 'kanji' ? false : undefined} />
            {ex.say && <button className="iconbtn soft" aria-label="Listen" onClick={() => speak(ex.say!, { rate: s.rate })}><Icon n="sound" /></button>}
          </div>
        )}
      </div>
      <div className={short ? 'opts-grid' : 'col gap-s'}>
        {ex.options.map((o, i) => (
          <button key={i} lang={ex.jpOptions ? 'ja' : undefined} disabled={locked}
            className={`opt ${ex.jpOptions ? 'jp' : ''} ${locked && i === ex.a ? 'right' : ''} ${locked && i === picked && i !== ex.a ? 'wrong' : ''} ${locked && i !== ex.a && i !== picked ? 'dim' : ''}`}
            onClick={() => pick(i)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Fill({ ex, locked, finish }: { ex: Extract<Ex, { t: 'fill' }>; locked: boolean; finish: Fin }) {
  const [picked, setPicked] = useState(-1);
  const p = parseFuri(ex.sent.f);
  const part = ex.options[ex.a];
  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const ok = i === ex.a;
    finish({ ok, title: ok ? 'Correct' : `It needs ${part}`, notes: [PARTICLE_INFO[part] ?? '', ...(ex.sent.note ? [ex.sent.note] : [])].filter(Boolean), model: ex.sent.f }, ex.options[i], part);
  };
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">Fill in the missing particle</span>
        <p style={{ fontWeight: 650 }}>{ex.sent.en}</p>
      </div>
      <div className="card flat furi jp-l" lang="ja" style={{ lineHeight: 2.3 }}>
        {p.chunks.map((c, i) => {
          if (i !== ex.blank) return <span key={i}>{c.segs.map((sg, j) => sg.reading ? <ruby key={j}>{sg.text}<rt>{sg.reading}</rt></ruby> : <span key={j}>{sg.text}</span>)}</span>;
          const idx = c.jp.lastIndexOf(c.particle!);
          const before = c.segs.map(sg => sg.text).join('').slice(0, idx), after = c.jp.slice(idx + c.particle!.length);
          const kanaBefore = c.kana.slice(0, c.kana.lastIndexOf(c.particle!));
          return <span key={i}>{before !== kanaBefore ? <ruby>{before}<rt>{kanaBefore}</rt></ruby> : before}<span className="blank">{locked ? part : picked >= 0 ? ex.options[picked] : '　'}</span>{after}</span>;
        })}
      </div>
      <div className="opts-grid">
        {ex.options.map((o, i) => (
          <button key={i} lang="ja" disabled={locked} className={`opt jp ${locked && i === ex.a ? 'right' : ''} ${locked && i === picked && i !== ex.a ? 'wrong' : ''}`} onClick={() => pick(i)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Arrange({ ex, locked, finish }: { ex: Extract<Ex, { t: 'arrange' }>; locked: boolean; finish: Fin }) {
  const p = parseFuri(ex.sent.f);
  const tiles = useMemo(() => shuffle(p.chunks.map((c, i) => ({ i, jp: c.jp.replace(/[。、]$/g, '') }))), [ex.key]); // eslint-disable-line
  const [order, setOrder] = useState<number[]>([]);
  const check = () => {
    const built = order.map(i => p.chunks[i].jp).join('');
    const r = checkSentence(ex.sent, built);
    finish({ ok: r.ok, title: r.ok ? 'Correct' : 'Not quite — here is the natural order', notes: r.ok ? r.notes : ['Japanese usually puts the topic first and the verb at the very end.', ...(ex.sent.note ? [ex.sent.note] : [])], model: ex.sent.f }, built, p.jp);
  };
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">Build the sentence</span>
        <p style={{ fontWeight: 650, fontSize: '1.08rem' }}>{ex.sent.en}</p>
      </div>
      <div className="tiles answer-line" aria-label="Your sentence">
        {order.map((i, k) => <button key={k} lang="ja" className="tilebtn" disabled={locked} onClick={() => setOrder(order.filter((_x, j) => j !== k))}>{tiles.find(t => t.i === i)!.jp}</button>)}
      </div>
      <div className="tiles">
        {tiles.map(t => <button key={t.i} lang="ja" className={`tilebtn ${order.includes(t.i) ? 'used' : ''}`} disabled={locked || order.includes(t.i)} onClick={() => setOrder([...order, t.i])}>{t.jp}</button>)}
      </div>
      {!locked && <div className="dock"><button className="btn" disabled={order.length !== tiles.length} onClick={check}>Check answer</button></div>}
    </div>
  );
}

function Typing({ ex, locked, fb, onHint, finish }: { ex: Extract<Ex, { t: 'type' | 'listen' | 'word' }>; locked: boolean; fb: Fb | null; onHint: () => void; finish: Fin }) {
  const s = useS();
  const [value, setValue] = useState('');
  const [romajiMode, setRomajiMode] = useState(false);
  const [helper, setHelper] = useState(false);
  const [hints, setHints] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const f = ex.t === 'word' ? (ex.word.kana !== ex.word.jp ? `${ex.word.jp}[${ex.word.kana}]` : ex.word.jp) : ex.sent.f;
  const p = parseFuri(ex.t === 'word' ? ex.word.kana : f);
  const model = ex.t === 'word' && /[㐀-鿿]/.test(ex.word.jp) ? undefined : f;
  useEffect(() => { if (ex.t === 'listen') void speak(parseFuri(f).jp, { rate: s.rate }); }, []); // eslint-disable-line

  const check = () => {
    if (ex.t === 'word') {
      const ok = checkWord(ex.word.jp, ex.word.kana, value);
      finish({ ok, title: ok ? 'Correct' : `The answer is: ${ex.word.jp}${ex.word.kana !== ex.word.jp ? `（${ex.word.kana}）` : ''}`, notes: [`${ex.word.jp}${ex.word.kana !== ex.word.jp ? ` (${ex.word.kana})` : ''} means "${ex.word.en}".`], model }, value, ex.word.jp);
      return;
    }
    const r = checkSentence(ex.sent, value);
    if (!normalize(value)) { ref.current?.focus(); return; }
    finish({ ok: r.ok, title: r.ok ? 'Correct — well written' : 'Not quite. Here is the model answer', notes: r.notes, model: ex.sent.f, diff: r.diff }, value, parseFuri(ex.sent.f).jp);
  };
  const hint = () => { onHint(); setHints(h => h + 1); };
  const hintText = ex.t === 'listen' && hints === 1 ? `Meaning: ${ex.sent.en}` : p.chunks.slice(0, ex.t === 'listen' ? hints - 1 : hints).map(c => c.kana).join(' ') + (hints < p.chunks.length ? ' …' : '');
  const maxHints = p.chunks.length + (ex.t === 'listen' ? 1 : 0);
  const title = ex.t === 'listen' ? 'Listening practice' : ex.t === 'word' ? 'Vocabulary' : 'Sentence practice';

  return (
    <div className="col">
      <div className="row between">
        <div className="seg" role="group" aria-label="Input mode">
          <button className={!romajiMode ? 'on' : ''} onClick={() => setRomajiMode(false)} lang="ja">かな</button>
          <button className={romajiMode ? 'on' : ''} onClick={() => setRomajiMode(true)}>Romaji → kana</button>
        </div>
        <button className={`iconbtn soft`} aria-label="Kana helper row" aria-pressed={helper} onClick={() => setHelper(h => !h)}><Icon n="key" /></button>
      </div>
      <Paper title={title}>
        <div className="paper-line"><span className="label">{ex.t === 'listen' ? 'Listen and write what you hear' : ex.t === 'word' ? 'Write this word in Japanese' : 'Translate into Japanese'}</span></div>
        <div className="paper-line">
          {ex.t === 'listen'
            ? <span className="row gap-s"><button className="btn sm" onClick={() => speak(parseFuri(f).jp, { rate: s.rate })}><Icon n="sound" s={18} />Play</button><button className="btn sm ghost" onClick={() => speak(parseFuri(f).jp, { rate: s.rate, slow: true })}><Icon n="slow" s={18} />Slow</button></span>
            : <span className="paper-prompt">{ex.t === 'word' ? ex.word.en : ex.sent.en}</span>}
        </div>
        <PaperInput inputRef={ref} value={value} onChange={setValue} romajiMode={romajiMode} disabled={locked} minRows={2} onEnter={check}
          placeholder={romajiMode ? 'Type romaji, e.g. mizu → みず' : 'Write your answer here…'} />
        <ReadingLine text={value} known={ex.t === 'word' ? undefined : t => toKanaUsing(t, f)} romaji={s.showRomaji} />
        {fb && <div className="paper-line" style={{ justifyContent: 'flex-end', paddingBottom: 6 }}><span className={`stamp ${fb.ok ? 'ok' : ''}`} lang="ja">{fb.ok ? '正' : '惜'}</span></div>}
      </Paper>
      {helper && !locked && <HelperRow inputRef={ref} value={value} onChange={setValue} />}
      {hints > 0 && !locked && <div className="card amber note-tip"><Icon n="bulb" s={18} /><span lang="ja" className="jp">{hintText}</span></div>}
      {!locked && (
        <div className="dock">
          <div className="row">
            <button className="btn line" disabled={hints >= maxHints} onClick={hint}><Icon n="bulb" s={18} />Hint</button>
            {ex.t !== 'listen' && <button className="btn line" onClick={() => { onHint(); void speak(parseFuri(f).jp, { rate: s.rate }); }}><Icon n="sound" s={18} />Listen</button>}
          </div>
          <button className="btn" disabled={!value.trim()} onClick={check}>Check answer<Icon n="next" s={18} /></button>
        </div>
      )}
    </div>
  );
}

function Speak({ ex, locked, finish }: { ex: Extract<Ex, { t: 'speak' }>; locked: boolean; finish: Fin }) {
  const s = useS();
  const avail = useAsync(sttAvailable, []);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState('');
  const p = parseFuri(ex.sent.f);
  const go = async () => {
    setErr(''); setLive(true);
    try {
      const heard = await listenOnce();
      setLive(false);
      if (!heard.length) { setErr('I could not hear anything. Tap the microphone and try again.'); return; }
      const target = normalize(p.kana);
      let best = '', ok = false;
      for (const h of heard) {
        const kana = normalize(await readingOf(h).catch(() => h));
        if (!best) best = h;
        if (checkSentence(ex.sent, h).ok || kana === target || similar(kana, target) >= 0.85) { ok = true; best = h; break; }
      }
      finish({ ok, heard: best, title: ok ? 'That came through clearly' : 'The recogniser heard something different', notes: [ok ? 'The phone recognised your sentence. Recognition is a rough check, not a pronunciation score.' : 'Listen to the model once more and try again. Speech recognition is imperfect, so use your own ear too.'], model: ex.sent.f }, best, p.jp);
    } catch (e) { setLive(false); setErr((e as Error).message); }
  };
  const self = (ok: boolean) => finish({ ok, title: ok ? 'Noted — said comfortably' : 'Noted — this will come back for more practice', notes: ['This was self-assessed, because speech recognition is not available on this device.'], model: ex.sent.f }, ok ? '(self-assessed: good)' : '(self-assessed: needs practice)', p.jp);
  return (
    <div className="col gap-l center">
      <span className="label">Say this aloud</span>
      <div className="card flat col" style={{ alignItems: 'center' }}>
        <Furi f={ex.sent.f} className="jp-xl" />
        <span className="muted small">{ex.sent.en}</span>
        {s.showRomaji ? null : <span className="romaji">{romajiOf(ex.sent.f)}</span>}
        <Audio f={ex.sent.f} />
      </div>
      {!locked && avail && <><button className={`mic ${live ? 'live' : ''}`} aria-label="Tap to speak" onClick={go} disabled={live}><Icon n="mic" s={34} /></button><span className="small muted">{live ? 'Listening…' : 'Tap to speak'}</span></>}
      {!locked && avail === false && (
        <div className="col">
          <p className="small muted">Speech recognition is not available here, so say it aloud after the model and rate yourself honestly.</p>
          <div className="row"><button className="btn ghost" onClick={() => self(false)}>Needs practice</button><button className="btn" onClick={() => self(true)}>Said it well</button></div>
        </div>
      )}
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
    </div>
  );
}

function similar(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - m[a.length][b.length] / Math.max(a.length, b.length);
}
