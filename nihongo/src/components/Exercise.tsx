// One exercise: shows the task, checks the answer, explains, and allows
// unlimited retries. It reports results upward; it never blocks progress.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Ex } from '../lib/exercises';
import { shuffle } from '../lib/exercises';
import { ALL_SENTENCES } from '../content';
import { checkSentence, checkWord, PARTICLE_INFO, type CheckResult } from '../lib/check';
import { parseFuri, normalize, toKanaUsing, romajiOf, kanaToRomaji, toHiragana } from '../lib/jp';
import { speak, speakSeq } from '../services/tts';
import { listenOnce, sttAvailable, stopListening } from '../services/stt';
import { pauseSpeaking } from '../services/speaking';
import { readingOf } from '../services/reading';
import { Furi, Audio, Icon, useS, useAsync } from './ui';
import { Paper, PaperInput, ReadingLine } from './Paper';
import { KanaKeyboard } from './Keyboard';
import { SpellingGuide } from './Spelling';
import { db } from '../lib/db';
import { sfx } from '../services/sfx';
import { buzz } from '../services/haptics';
import { saveSettings } from '../lib/settings';
import { CAST } from '../content/cast';
import { Portrait } from './Portrait';
import { WordRomaji } from './WordRomaji';
import { Explain } from './Explain';
import { TapSentence } from './TapSentence';

export interface Outcome { ok: boolean; hint: boolean; userAnswer: string; expected: string; explanation: string }
interface Props { ex: Ex; onResult: (o: Outcome) => void; onNext: (requeue: boolean, solved: boolean) => void; last: boolean; cast?: { guide: string; goof: string } }

interface Fb { ok: boolean; title: string; notes: string[]; model?: string; diff?: CheckResult['diff']; heard?: string; say?: string[] }

export function Exercise({ ex, onResult, onNext, last, cast }: Props) {
  const s = useS();
  const [fb, setFb] = useState<Fb | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [everWrong, setEverWrong] = useState(false);
  const hintRef = useRef(false);
  // A different line each time, picked once per answer.
  const pickLine = useMemo(() => Math.floor(Math.random() * 1000), [fb]);

  const [burst, setBurst] = useState(0);
  const [ans, setAns] = useState({ user: '', expected: '' });
  const [explain, setExplain] = useState(false);
  const finish = (f: Fb, userAnswer: string, expected: string) => {
    setFb(f);
    setAns({ user: userAnswer, expected });
    setBurst(b => b + 1);
    if (f.ok) { sfx.correct(); buzz.ok(); } else { sfx.wrong(); buzz.bad(); }
    if (!f.ok) setEverWrong(true);
    onResult({ ok: f.ok, hint: hintRef.current, userAnswer, expected, explanation: f.notes.join(' ') });
    // Spoken order: the answer you tapped, then the character's reaction, then the model answer if it was wrong.
    const who = cast && CAST[f.ok ? cast.guide : cast.goof];
    const seq: { text: string; rate?: number; pitch?: number; who?: string }[] = (f.say ?? []).map(t => ({ text: t, rate: s.rate }));
    if (who?.say && s.charVoices) seq.push({ text: who.say[Math.floor(Math.random() * who.say.length)], who: who.id });
    if (f.model && s.autoplay && !f.ok) seq.push({ text: parseFuri(f.model).jp, rate: s.rate });
    if (seq.length) void speakSeq(seq);
  };
  const retry = () => { sfx.tap(); setFb(null); setExplain(false); setAttempt(a => a + 1); };
  // Auto-continue: a right answer moves on by itself after a short pause (tap anywhere on the feedback to stay).
  const [hold, setHold] = useState(false);
  useEffect(() => {
    if (!fb?.ok || !s.autoNext || hold || everWrong || explain) return;
    const t = setTimeout(() => onNext(false, true), ex.t === 'choice' || ex.t === 'fill' || ex.t === 'chat' ? 1500 : 2300);
    return () => clearTimeout(t);
  }, [fb, hold, explain]); // eslint-disable-line
  const reactor = fb && cast ? CAST[fb.ok ? cast.guide : cast.goof] : undefined;
  const reactLine = reactor?.say?.[pickLine % reactor.say.length];

  return (
    <div className="col gap-l grow" style={{ minHeight: 0 }}>
      {/* Alternate two identical animations so the shake replays without re-mounting the exercise (which would wipe its state). */}
      <div style={fb && !fb.ok ? { animation: `${burst % 2 ? 'shakeA' : 'shakeB'} .45s ease both` } : undefined}>
        <Body key={attempt} ex={ex} locked={!!fb} fb={fb} onHint={() => { hintRef.current = true; }} finish={finish} skip={() => { void pauseSpeaking(); onNext(false, true); }} />
      </div>
      {fb && <Reaction key={burst} ok={fb.ok} />}
      {fb && (
        <div className="dock">
          <div className={`feedback ${fb.ok ? 'ok' : 'bad'}`} role="status" onClick={() => setHold(true)}>
            {fb.ok && s.autoNext && !hold && !everWrong && <span className="autobar" aria-hidden="true" />}
            <h3><Icon n={fb.ok ? 'check' : 'bulb'} s={20} />{fb.title}</h3>
            {reactor && (
              <div className="castline" key={burst}>
                <Portrait id={reactor.id} mood={fb.ok ? 'happy' : 'oops'} size={58} />
                <div className="say small">
                  <b>{reactor.name}</b>
                  {reactLine && <div><span className="bub" lang="ja">{reactLine}</span></div>}
                  {fb.ok ? <div className="muted">{reactor.cheers[pickLine % reactor.cheers.length]?.[1]}</div>
                    : <div>{reactor.oops[pickLine % reactor.oops.length]}</div>}
                </div>
              </div>
            )}
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
          <button className="btn line explain-btn" onClick={() => { sfx.tap(); setHold(true); setExplain(true); }}>Explain my answer</button>
          {fb.ok ? (
            <button className="btn" onClick={() => onNext(everWrong, true)}>{last && !everWrong ? 'Finish' : 'Continue'}<Icon n="next" s={18} /></button>
          ) : (
            <div className="row">
              <button className="btn line" onClick={() => onNext(true, false)}>Later</button>
              <button className="btn" style={{ flex: 2 }} onClick={retry}><Icon n="retry" s={18} />Try again</button>
            </div>
          )}
          {!fb.ok && <p className="tiny muted center">Not solved yet — it stays in this lesson until you get it right.</p>}
        </div>
      )}
      {fb && explain && <Explain ex={ex} ok={fb.ok} user={ans.user} expected={ans.expected} teacher={cast?.guide} onClose={() => setExplain(false)} />}
    </div>
  );
}

function Body({ ex, locked, fb, onHint, finish, skip }: { ex: Ex; locked: boolean; fb: Fb | null; onHint: () => void; finish: (f: Fb, user: string, expected: string) => void; skip?: () => void }) {
  switch (ex.t) {
    case 'choice': return <Choice ex={ex} locked={locked} finish={finish} />;
    case 'fill': return <Fill ex={ex} locked={locked} finish={finish} />;
    case 'arrange': return <Arrange ex={ex} locked={locked} finish={finish} />;
    case 'speak': return <Speak ex={ex} locked={locked} finish={finish} skip={skip} />;
    case 'chat': return <Chat ex={ex} locked={locked} finish={finish} />;
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
    // Say the answer out loud: the tapped Japanese option, then the right one if it was wrong.
    const say = ex.jpOptions ? (ok ? [ex.options[i]] : [ex.options[i], ex.options[ex.a]]) : ex.say ? [ex.say] : [];
    finish({ ok, title: ok ? 'Correct' : `The answer is: ${ex.options[ex.a]}`, notes: [ex.why], say }, ex.options[i], ex.options[ex.a]);
  };
  const short = ex.options.every(o => o.length <= 6);
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">{ex.prompt}</span>
        {ex.context && <p style={{ fontWeight: 500 }} lang={ex.jp ? 'ja' : undefined} className={ex.jp ? 'muted jp' : ''}>{ex.context}</p>}
        {ex.jp && (
          <div className="card flat row between">
            {(ex.skill === 'reading' || ex.skill === 'grammar') && ex.tag !== 'challenge' && /\s/.test(ex.jp.trim())
              ? <TapSentence f={ex.jp} size="l" />
              : <Furi f={ex.jp} className={ex.jp.length <= 3 ? 'kana-big' : 'jp-xl'} furigana={ex.skill === 'kanji' || ex.skill === 'vocab' ? false : undefined} romaji={ex.skill === 'kana' || ex.skill === 'vocab' || ex.skill === 'kanji' ? false : undefined} />}
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
  const s = useS();
  const [picked, setPicked] = useState(-1);
  const p = parseFuri(ex.sent.f);
  const part = ex.options[ex.a];
  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const ok = i === ex.a;
    finish({ ok, title: ok ? 'Correct' : `It needs ${part}`, notes: [PARTICLE_INFO[part] ?? '', ...(ex.sent.note ? [ex.sent.note] : [])].filter(Boolean), model: ex.sent.f, say: ok ? [p.jp] : [] }, ex.options[i], part);
  };
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">Fill in the missing particle</span>
        <p style={{ fontWeight: 500 }}>{ex.sent.en}</p>
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
  const s = useS();
  const p = parseFuri(ex.sent.f);
  const tiles = useMemo(() => shuffle(p.chunks.map((c, i) => ({ i, jp: c.jp.replace(/[。、]$/g, ''), ro: romajiOf(c.segs.map(x => x.reading ? `${x.text}[${x.reading}]` : x.text).join('')) }))), [ex.key]); // eslint-disable-line
  const [order, setOrder] = useState<number[]>([]);
  const check = () => {
    const built = order.map(i => p.chunks[i].jp).join('');
    const r = checkSentence(ex.sent, built);
    finish({ say: r.ok ? [p.jp] : [], ok: r.ok, title: r.ok ? 'Correct' : 'Not quite — here is the natural order', notes: r.ok ? r.notes : ['Japanese usually puts the topic first and the verb at the very end.', ...(ex.sent.note ? [ex.sent.note] : [])], model: ex.sent.f }, built, p.jp);
  };
  return (
    <div className="col gap-l">
      <div className="col gap-s">
        <span className="label">Build the sentence</span>
        <p style={{ fontWeight: 500, fontSize: '1.08rem' }}>{ex.sent.en}</p>
      </div>
      <div className="tiles answer-line" aria-label="Your sentence">
        {order.map((i, k) => <button key={k} lang="ja" className="tilebtn" disabled={locked} onClick={() => setOrder(order.filter((_x, j) => j !== k))}>{tiles.find(t => t.i === i)!.jp}</button>)}
      </div>
      <div className="tiles">
        {tiles.map(t => <button key={t.i} lang="ja" className={`tilebtn ${order.includes(t.i) ? 'used' : ''}`} disabled={locked || order.includes(t.i)} onClick={() => { void speak(t.jp, { rate: s.rate }); setOrder([...order, t.i]); }}><small>{t.ro}</small>{t.jp}</button>)}
      </div>
      {!locked && <div className="dock"><button className="btn" disabled={order.length !== tiles.length} onClick={check}>Check answer</button></div>}
    </div>
  );
}

function Typing({ ex, locked, fb, onHint, finish }: { ex: Extract<Ex, { t: 'type' | 'copy' | 'listen' | 'word' }>; locked: boolean; fb: Fb | null; onHint: () => void; finish: Fin }) {
  const s = useS();
  const [value, setValue] = useState('');
  const [hints, setHints] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const appKb = s.keyboard === 'app';
  // Spelling help: always for copying; for new sentences and after a mistake; on request otherwise.
  // Never in the final challenge or in listening (that would give the answer away).
  const seenBefore = useAsync(async () => { const it = await db.items.get(ex.itemId); return !!it && it.seen > 0; }, [ex.itemId]);
  const [askSpell, setAskSpell] = useState(false);

  const canSpell = ex.tag !== 'challenge' && ex.t !== 'listen' && ex.t !== 'word';
  const showSpell = canSpell && (ex.t === 'copy' || askSpell || fb?.ok === false || (seenBefore === false && ex.tag !== 'earlier'));
  const romajiMode = !appKb && s.romajiInput;
  const f = ex.t === 'word' ? (ex.word.kana !== ex.word.jp ? `${ex.word.jp}[${ex.word.kana}]` : ex.word.jp) : ex.sent.f;
  const p = parseFuri(ex.t === 'word' ? ex.word.kana : f);
  // Word bank: tap whole words instead of typing every kana (off in the final challenge).
  const [bank, setBank] = useState(ex.tag !== 'challenge' && ex.t !== 'word');
  const bankWords = useMemo(() => {
    if (ex.t === 'word') return [];
    const strip = (x: string) => x.replace(/[。、？！]/g, '');
    // Romaji from the reading, with particles written as said (は = wa, を = o).
    const tile = (c: { jp: string; segs: { text: string; reading?: string }[]; particle?: string }) => ({ jp: strip(c.jp), ro: romajiOf(c.segs.map(x => (x.reading ? `${x.text}[${x.reading}]` : x.text)).join('').replace(/(.)(は|を|へ)$/, c.particle ? '$1{$2}' : '$1$2')) });
    const mine = parseFuri(f).chunks.map(tile).filter(t => t.jp);
    const others = shuffle(ALL_SENTENCES.filter(x => x.f !== f).flatMap(x => parseFuri(x.f).chunks.map(tile)))
      .filter((t, i, a) => t.jp && !mine.some(m => m.jp === t.jp) && a.findIndex(y => y.jp === t.jp) === i)
      .slice(0, Math.min(3, Math.max(2, Math.ceil(mine.length / 2))));
    return shuffle([...mine, ...others]);
  }, [ex.key]); // eslint-disable-line
  const addWord = (w: string) => { sfx.key(); void speak(w, { rate: s.rate }); setValue(v => v + w); };
  const model = ex.t === 'word' && /[㐀-鿿]/.test(ex.word.jp) ? undefined : f;
  useEffect(() => {
    if (ex.t === 'listen') void speak(parseFuri(f).jp, { rate: s.rate });
    // Copying has the answer on screen, so it never counts as unaided recall.
    if (ex.t === 'copy') { onHint(); if (s.autoplay) void speak(parseFuri(f).jp, { rate: s.rate }); }
  }, []); // eslint-disable-line

  const check = () => {
    if (!normalize(value)) { ref.current?.focus(); return; }
    sfx.stamp();
    if (ex.t === 'word') {
      const ok = checkWord(ex.word.jp, ex.word.kana, value);
      finish({ ok, title: ok ? 'Correct' : `The answer is: ${ex.word.jp}${ex.word.kana !== ex.word.jp ? `（${ex.word.kana}）` : ''}`, notes: [`${ex.word.jp}${ex.word.kana !== ex.word.jp ? ` (${ex.word.kana})` : ''} means "${ex.word.en}".`], model }, value, ex.word.jp);
      return;
    }
    const r = checkSentence(ex.sent, value);
    const good = ex.t === 'copy' ? 'Copied correctly' : 'Correct — well written';
    finish({ say: r.ok ? [parseFuri(ex.sent.f).jp] : [], ok: r.ok, title: r.ok ? good : ex.t === 'copy' ? 'Almost — compare with the sentence' : 'Not quite. Here is the model answer', notes: r.notes, model: ex.sent.f, diff: r.diff }, value, parseFuri(ex.sent.f).jp);
  };
  const hint = () => { onHint(); sfx.tap(); setHints(h => h + 1); };
  const hintText = ex.t === 'listen' && hints === 1 ? `Meaning: ${ex.sent.en}` : p.chunks.slice(0, ex.t === 'listen' ? hints - 1 : hints).map(c => c.kana).join(' ') + (hints < p.chunks.length ? ' …' : '');
  const maxHints = p.chunks.length + (ex.t === 'listen' ? 1 : 0);
  const title = ex.tag === 'challenge' ? 'Final challenge' : ex.t === 'listen' ? 'Listening practice' : ex.t === 'word' ? 'Vocabulary' : ex.t === 'copy' ? 'Copy writing' : 'Sentence practice';
  const label = ex.t === 'listen' ? 'Listen and write what you hear' : ex.t === 'word' ? 'Write this word in Japanese' : ex.t === 'copy' ? 'Write this sentence out yourself' : 'Translate into Japanese';

  return (
    <div className="col">
      <div className="row between gap-s">
        <div className="seg" role="group" aria-label="Keyboard">
          <button className={appKb ? 'on' : ''} onClick={() => saveSettings({ keyboard: 'app' })} lang="ja">かな keys</button>
          <button className={!appKb ? 'on' : ''} onClick={() => saveSettings({ keyboard: 'phone' })}>Phone keyboard</button>
        </div>
        {!appKb && <button className={`chip ${s.romajiInput ? 'on' : ''}`} aria-pressed={s.romajiInput} onClick={() => saveSettings({ romajiInput: !s.romajiInput })}>Romaji → kana</button>}
      </div>
      <Paper title={title}>
        <div className="paper-line"><span className="label">{label}</span></div>
        {ex.t === 'listen' && <div className="paper-line"><span className="row gap-s"><button className="btn sm" onClick={() => speak(parseFuri(f).jp, { rate: s.rate })}><Icon n="sound" s={18} />Play</button><button className="btn sm ghost" onClick={() => speak(parseFuri(f).jp, { rate: s.rate, slow: true })}><Icon n="slow" s={18} />Slow</button></span></div>}
        {ex.t === 'copy' && <>
          <div className="paper-line" style={{ minHeight: 'calc(var(--rule) * 2)', alignItems: 'flex-end', paddingBottom: 4 }}><Furi f={f} className="jp-l" /></div>
          <div className="paper-line"><span className="small muted">{ex.sent.en}</span></div>
        </>}
        {(ex.t === 'type' || ex.t === 'word') && <div className="paper-line"><span className="paper-prompt">{ex.t === 'word' ? ex.word.en : ex.sent.en}</span></div>}
        <PaperInput inputRef={ref} value={value} onChange={setValue} romajiMode={romajiMode} disabled={locked} minRows={2} onEnter={check} noSystemKeyboard={appKb} autoFocus={appKb}
          placeholder={romajiMode ? 'Type romaji, e.g. mizu → みず' : 'Write your answer here…'} />
        <ReadingLine text={value} known={ex.t === 'word' ? undefined : t => toKanaUsing(t, f)} romaji={s.showRomaji} />
        {fb && <div className="paper-line" style={{ justifyContent: 'flex-end', paddingBottom: 8 }}><span className={`stamp ${fb.ok ? 'ok' : ''}`} lang="ja">{fb.ok ? '正' : '惜'}</span></div>}
      </Paper>

      {hints > 0 && !locked && <div className="card amber note-tip"><Icon n="bulb" s={18} /><span lang="ja" className="jp">{hintText}</span></div>}
      {!locked && (
        <div className="dock">
          {bank && bankWords.length > 0 && (
            <div className="bank" aria-label="Word bank">
              {bankWords.map((w, i) => <button key={i} type="button" lang="ja" className="tilebtn" onMouseDown={e => e.preventDefault()} onClick={() => addWord(w.jp)}><small>{w.ro}</small>{w.jp}</button>)}
              <button type="button" className="tilebtn undo" aria-label="Clear" onMouseDown={e => e.preventDefault()} onClick={() => setValue('')}>⌫</button>
            </div>
          )}
          {showSpell && !bank && <SpellingGuide f={f} typed={value} />}
          <div className="row gap-s wrap">
            {ex.tag !== 'challenge' && ex.t !== 'word' && <button className={`chip ${bank ? 'on' : ''}`} aria-pressed={bank} onClick={() => setBank(!bank)}>{bank ? 'Word bank on' : 'Use word bank'}</button>}
            {canSpell && !showSpell && !bank && <button className="chip" onClick={() => { onHint(); setAskSpell(true); }}><Icon n="key" s={15} />How to spell it</button>}
          </div>
          <div className="row gap-s">
            {ex.t !== 'copy' && ex.tag !== 'challenge' && <button className="btn sm line grow" disabled={hints >= maxHints} onClick={hint}><Icon n="bulb" s={16} />Hint</button>}
            {ex.t !== 'listen' && ex.tag !== 'challenge' && <button className="btn sm line grow" onClick={() => { if (ex.t !== 'copy') onHint(); void speak(parseFuri(f).jp, { rate: s.rate }); }}><Icon n="sound" s={16} />Listen</button>}
            <button className="btn sm grow" style={{ flex: 1.4 }} disabled={!value.trim()} onClick={check}>Check<Icon n="next" s={16} /></button>
          </div>
          {appKb && !bank && <KanaKeyboard inputRef={ref} value={value} onChange={setValue} onEnter={check} enterLabel="OK" />}
        </div>
      )}
    </div>
  );
}

function Speak({ ex, locked, finish, skip }: { ex: Extract<Ex, { t: 'speak' }>; locked: boolean; finish: Fin; skip?: () => void }) {
  const s = useS();
  const avail = useAsync(sttAvailable, []);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState('');
  const [heardKana, setHeardKana] = useState('');
  const [err, setErr] = useState('');
  const p = parseFuri(ex.sent.f);
  // Compare everything as hiragana, so テレビ and てれび count as the same word.
  const strip = (x: string) => toHiragana(normalize(x), { passRomaji: true });
  const [heardRaw, setHeardRaw] = useState('');
  const chunks = p.chunks.map(c => ({ c, kana: strip(c.kana), jp: normalize(c.jp) })).filter(x => x.kana);
  const matched = (k: { kana: string; jp: string }) => (!!heardKana && (heardKana.includes(k.kana) || similar(k.kana, heardKana) > 0.8)) || (!!heardRaw && normalize(heardRaw).includes(k.jp));
  // Live: as words come in, convert to kana and light up the tiles that match.
  useEffect(() => { if (!live) return; setHeardRaw(live); let on = true; void readingOf(live).catch(() => live).then(k => { if (on) setHeardKana(strip(k)); }); return () => { on = false; }; }, [live]); // eslint-disable-line
  const go = async () => {
    if (listening) { await stopListening(); return; }
    setErr(''); setLive(''); setHeardKana(''); setHeardRaw(''); setListening(true);
    try {
      const heard = await listenOnce(t => setLive(t), 12000);
      setListening(false);
      if (!heard.length) { setErr('I couldn\'t hear anything. Tap the mic and read the sentence out loud.'); return; }
      const target = strip(p.kana);
      let best = heard[0], bestScore = 0;
      for (const h of heard) {
        const k = strip(await readingOf(h).catch(() => h));
        const hit = chunks.filter(x => k.includes(x.kana) || normalize(h).includes(x.jp)).length / Math.max(1, chunks.length);
        const sc = Math.max(hit, similar(k, target), checkSentence(ex.sent, h).ok ? 1 : 0);
        if (sc > bestScore) { bestScore = sc; best = h; setHeardKana(k); setHeardRaw(h); }
      }
      // Lenient on purpose: phone recognisers struggle with learners' Japanese.
      const ok = bestScore >= 0.7;
      finish({ ok, heard: best, title: ok ? (bestScore >= 0.95 ? 'Clearly understood' : 'Understood') : 'Not quite — listen and try again', notes: [ok ? 'Recognition is a rough check, not a pronunciation score — keep listening to the model too.' : 'Tap the speaker, listen once (or slowly), then say it again. Green words were understood.'], model: ex.sent.f, say: ok ? [] : [p.jp] }, best, p.jp);
    } catch (e) { setListening(false); setErr((e as Error).message); }
  };
  const self = (ok: boolean) => finish({ ok, title: ok ? 'Noted — said comfortably' : 'Noted — this will come back for more practice', notes: ['Self-assessed, because speech recognition is not available on this device.'], model: ex.sent.f }, ok ? '(self-assessed: good)' : '(self-assessed: needs practice)', p.jp);
  return (
    <div className="col gap-l">
      <span className="label">Speak this sentence</span>
      <div className="row" style={{ alignItems: 'center' }}>
        <button className="iconbtn soft" style={{ width: 56, height: 56 }} aria-label="Listen" onClick={() => speak(p.jp, { rate: s.rate })}><Icon n="sound" s={26} /></button>
        <button className="iconbtn soft" style={{ width: 56, height: 56 }} aria-label="Listen slowly" onClick={() => speak(p.jp, { rate: s.rate, slow: true })}><Icon n="slow" s={26} /></button>
        <span className="small muted grow">{ex.sent.en}</span>
      </div>
      <div className="speak-line" lang="ja">
        {chunks.map((x, i) => (
          <span key={i} className={`sw ${matched(x) ? 'hit' : ''}`}>
            <small>{romajiOf(x.c.segs.map(sg => (sg.reading ? `${sg.text}[${sg.reading}]` : sg.text)).join('').replace(/(.)(は|を|へ)([。、]?)$/, x.c.particle ? '$1{$2}$3' : '$1$2$3'))}</small>
            <span>{x.c.segs.map((sg, j) => sg.reading && s.showFurigana ? <ruby key={j}>{sg.text}<rt>{sg.reading}</rt></ruby> : <span key={j}>{sg.text}</span>)}</span>
          </span>
        ))}
      </div>
      {(listening || live) && <p className="small center row" style={{ justifyContent: 'center', gap: 8 }} lang="ja"><Icon n="mic" s={14} />{live || 'listening…'}</p>}
      {!locked && avail && (
        <div className="col center" style={{ alignItems: 'center' }}>
          <button className={`mic ${listening ? 'live' : ''}`} aria-label={listening ? 'Finish' : 'Tap to speak'} onClick={go}><Icon n="mic" s={34} /></button>
          <span className="small muted">{listening ? 'Speak now — tap again when done' : 'Tap the mic and read it out loud'}</span>
        </div>
      )}
      {!locked && avail === false && (
        <div className="col">
          <p className="small muted">Speech recognition isn't available here. Say it aloud after the model, then rate yourself honestly.</p>
          <div className="row"><button className="btn ghost" onClick={() => self(false)}>Needs practice</button><button className="btn" onClick={() => self(true)}>Said it well</button></div>
        </div>
      )}
      {err && <p className="small center" style={{ color: 'var(--bad)' }}>{err}</p>}
      {!locked && skip && <button className="btn line" style={{ marginTop: 'auto' }} onClick={skip}>Can't speak now</button>}
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

/** A seal pressed over the screen for an answer: a red hanko 正解 for right, an outlined 惜しい for wrong. */
function Reaction({ ok }: { ok: boolean }) {
  const s = useS();
  if (s.reducedMotion) return null;
  return (
    <div className={`react ${ok ? 'ok' : 'bad'}`} aria-hidden="true">
      <div className="stamp-big" lang="ja">{ok ? '正解' : '惜しい'}</div>
    </div>
  );
}

function Chat({ ex, locked, finish }: { ex: Extract<Ex, { t: 'chat' }>; locked: boolean; finish: Fin }) {
  const s = useS();
  const [picked, setPicked] = useState(-1);
  const line = parseFuri(ex.line.f);
  useEffect(() => { if (s.autoplay) void speakSeq([{ text: line.jp, who: ex.who, rate: s.rate }]); }, []); // eslint-disable-line
  const pick = (i: number) => {
    if (locked) return;
    setPicked(i);
    const ok = i === ex.a;
    finish({ ok, title: ok ? 'Natural reply' : 'A more natural reply', notes: [ex.why], model: ex.options[ex.a], say: [parseFuri(ex.options[i]).jp] }, parseFuri(ex.options[i]).jp, parseFuri(ex.options[ex.a]).jp);
  };
  return (
    <div className="col gap-l">
      <span className="label">Complete the chat</span>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Portrait id={ex.who} size={52} />
        <div className="chat-bubble them">
          <button className="iconbtn" aria-label="Listen" onClick={() => speakSeq([{ text: line.jp, who: ex.who, rate: s.rate }])}><Icon n="sound" /></button>
          <TapSentence f={ex.line.f} size="m" />
          <div className="small muted">{ex.line.en}</div>
        </div>
      </div>
      <div className="chat-bubble me">{picked >= 0 ? <WordRomaji f={ex.options[picked]} /> : <span className="blank-line" />}</div>
      <div className="col gap-s">
        {ex.options.map((o, i) => (
          <button key={i} disabled={locked} className={`opt ${locked && i === ex.a ? 'right' : ''} ${locked && i === picked && i !== ex.a ? 'wrong' : ''}`} onClick={() => pick(i)}><WordRomaji f={o} /></button>
        ))}
      </div>
    </div>
  );
}
