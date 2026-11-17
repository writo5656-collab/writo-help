// Runs a queue of exercises: lesson practice, spaced review, drills,
// mistake retries, reading passages and the Sunday review.
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { db, recordAnswer, addMistake, setKV, getKV } from '../lib/db';
import { dueItems, risk, DAY, type Grade } from '../lib/srs';
import { type Ex, lessonExercises, reviewEx, drill, passageExercises, vocabEx, kanjiEx, sentEx, shuffle } from '../lib/exercises';
import { LESSON_MAP, PASSAGES, PACKS, KANJI, ALL_SENTENCES } from '../content';
import { sundayKey, lessonAfter } from '../lib/plan';
import { loadLibrary } from '../content/library';
import { castFor } from '../content/cast';
import { parseFuri } from '../lib/jp';
import { sfx } from '../services/sfx';
import { Exercise, type Outcome } from '../components/Exercise';
import { Screen, Icon, Bar, Mascot, Furi, Empty, Audio } from '../components/ui';

type QEx = Ex & { requeued?: boolean; mistakeId?: number };
interface Tally { skill: string; ok: boolean; prompt: string }

export function promptOf(ex: Ex): string {
  switch (ex.t) {
    case 'choice': return [ex.prompt, ex.jp ? parseFuri(ex.jp).jp : '', ex.context ?? ''].filter(Boolean).join(' — ');
    case 'fill': return `Particle: ${ex.sent.en}`;
    case 'arrange': return `Build: ${ex.sent.en}`;
    case 'type': return `Translate: ${ex.sent.en}`;
    case 'copy': return `Copy: ${ex.sent.en}`;
    case 'listen': return `Listening: ${ex.sent.en}`;
    case 'speak': return `Say: ${ex.sent.en}`;
    case 'word': return `Write: ${ex.word.en}`;
  }
}
const fresh = (e: Ex): QEx => ({ ...e, key: e.key + '-' + Math.random().toString(36).slice(2, 6) });

async function build(m: string, q: URLSearchParams): Promise<QEx[]> {
  const ok = <T,>(x: T | null | undefined): x is T => !!x;
  // Items from the big library can be due for review, so make sure it is loaded.
  const lib = await loadLibrary();
  if (m === 'lib') {
    const lvl = Number(q.get('lvl') ?? 5), kind = q.get('kind') ?? 'vocab';
    const states = new Map((await db.items.toArray()).map(i => [i.id, i]));
    if (kind === 'kanji') {
      const pool = lib.kanji.filter(k => k.lvl === lvl);
      const fresh = pool.filter(k => !states.has(`kanji:${k.k}`)).slice(0, 8);
      const weak = pool.filter(k => { const st = states.get(`kanji:${k.k}`); return st && st.status !== 'remembered'; }).slice(0, 4);
      return shuffle([...fresh, ...weak].flatMap(k => [kanjiEx(k.k, 'meaning'), kanjiEx(k.k, 'reading')]).filter(ok));
    }
    const pool = lib.words.filter(w => w.lvl === lvl);
    const fresh = pool.filter(w => !states.has(`vocab:${w.jp}`)).slice(0, 10);
    const weak = pool.filter(w => { const st = states.get(`vocab:${w.jp}`); return st && st.status !== 'remembered'; }).slice(0, 5);
    const lvlPool = pool.slice(0, 600);
    return [...fresh.map(w => vocabEx(w, 'meaning', undefined, lvlPool)), ...shuffle([...fresh, ...weak]).map((w, i) => vocabEx(w, i % 3 === 2 ? 'type' : 'jp', undefined, lvlPool))];
  }
  if (m === 'lesson') { const l = LESSON_MAP.get(q.get('id') ?? ''); return l ? lessonExercises(l) : []; }
  if (m === 'review') return dueItems(await db.items.toArray()).slice(0, 20).map(reviewEx).filter(ok);
  if (m === 'passage') return passageExercises(q.get('id') ?? '');
  if (m === 'pack') { const p = PACKS.find(x => x.id === q.get('id')); return p ? [...p.words.map(w => vocabEx(w, 'meaning', p.id, p.words)), ...shuffle(p.words).slice(0, 6).map(w => vocabEx(w, 'jp', p.id, p.words))] : []; }
  if (m === 'kanji') { const set = q.get('set'); const ks = set ? [...set] : shuffle(KANJI).slice(0, 10).map(k => k.k); return [...ks.map(k => kanjiEx(k, 'meaning')), ...ks.map(k => kanjiEx(k, 'reading'))].filter(ok); }
  if (m === 'mistakes' || m === 'mistake') {
    const all = await db.mistakes.toArray();
    const pick = m === 'mistake' ? all.filter(x => x.id === Number(q.get('id'))) : all.filter(x => x.status !== 'remembered').sort((a, b) => b.date - a.date).slice(0, 15);
    return pick.filter(x => x.ex).map(x => ({ ...fresh(x.ex as Ex), mistakeId: x.id }));
  }
  if (m === 'sunday') {
    const weeks = (await getKV<number>('sundaysDone', 0)) + 1;
    const since = Date.now() - weeks * 7 * DAY;
    const items = (await db.items.toArray()).filter(i => i.lastSeen >= since && i.status !== 'new');
    // Intelligent sampling: weakest and most at-risk first, but keep it short.
    const sample = items.sort((a, b) => risk(b) - risk(a)).slice(0, 14).map(reviewEx).filter(ok);
    const sentIds = items.filter(i => i.kind === 'sentence').map(i => i.id);
    const extra = shuffle(sentIds.length ? sentIds : ALL_SENTENCES.slice(0, 5).map(s => s.id)).slice(0, 2);
    return [...shuffle(sample), ...[sentEx(extra[0], 'listen'), extra[1] ? sentEx(extra[1], 'speak') : null].filter(ok)];
  }
  if (m === 'drill') {
    const started = new Set((await db.answers.toArray()).map(a => a.lessonId).filter(ok));
    return drill(q.get('type') ?? '', started);
  }
  return [];
}

const TITLES: Record<string, string> = { lib: 'Library practice', lesson: 'Lesson practice', review: 'Spaced review', passage: 'Reading', pack: 'Vocabulary', kanji: 'Kanji', mistakes: 'Mistake review', mistake: 'Mistake review', sunday: 'Sunday review', drill: 'Practice' };

export default function Session() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const m = q.get('m') ?? 'review';
  const [queue, setQueue] = useState<QEx[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [tally, setTally] = useState<Tally[]>([]);
  const saw = useRef(new Set<string>());
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [secs, setSecs] = useState(0);
  useEffect(() => { const t = setInterval(() => setSecs(Math.round((Date.now() - start.current) / 1000)), 1000); return () => clearInterval(t); }, []);
  const start = useRef(Date.now());

  useEffect(() => { build(m, q).then(setQueue); }, []); // eslint-disable-line

  if (!queue) return <Screen back title={TITLES[m]}><p className="muted center mt-l">Preparing…</p></Screen>;
  if (queue.length === 0) return (
    <Screen back title={TITLES[m]}>
      <Empty title={m === 'review' ? 'Nothing is due right now' : m.startsWith('mistake') ? 'No open mistakes' : 'Nothing to practise yet'} mood="cheer">
        {m === 'review' ? 'Reviews appear when your memory of an item is about to fade. You can start a lesson or a drill any time — there are no limits.' : 'Study a lesson first, then come back here.'}
      </Empty>
      <Link className="btn" to="/learn">Go to lessons</Link>
    </Screen>
  );

  const done = idx >= queue.length;
  const ex = queue[Math.min(idx, queue.length - 1)];

  const onResult = async (o: Outcome) => {
    const first = !saw.current.has(ex.key);
    let grade: Grade;
    if (o.ok) grade = first ? (o.hint ? 'hard' : 'good') : 'retry';
    else if (first) grade = 'again';
    else return; // further wrong tries on the same question are not counted against you
    if (first) setTally(t => [...t, { skill: ex.skill, ok: o.ok, prompt: promptOf(ex) }]);
    setScore(x => x + (grade === 'good' ? 5 : grade === 'hard' ? 3 : grade === 'retry' ? 1 : 0) * (ex.tag === 'challenge' && first ? 2 : 1));
    if (first) setCombo(c => { const n = o.ok ? c + 1 : 0; if (n > 0 && n % 5 === 0) setTimeout(sfx.streak, 350); return n; });
    if (!o.ok) saw.current.add(ex.key);
    await recordAnswer({ itemId: ex.itemId, kind: ex.kind, skill: ex.skill, grade, lessonId: ex.lessonId });
    if (!o.ok) {
      const { requeued: _r, mistakeId: _m, ...plain } = ex;
      await addMistake({ itemId: ex.itemId, lessonId: ex.lessonId, skill: ex.skill, prompt: promptOf(ex), userAnswer: o.userAnswer, expected: o.expected, explanation: o.explanation, ex: plain });
    } else if (first && ex.mistakeId) {
      const mk = await db.mistakes.get(ex.mistakeId);
      if (mk) await db.mistakes.update(ex.mistakeId, { status: mk.status === 'uncertain' ? 'remembered' : 'uncertain' });
    }
  };

  const onNext = async (requeue: boolean) => {
    let len = queue.length;
    // Missed questions come back once at the end of the session, without the answer on screen.
    if (requeue && !ex.requeued) { setQueue([...queue, { ...fresh(ex), requeued: true }]); len++; }
    if (idx + 1 >= len) {
      if (m === 'lesson') { const d = await getKV<Record<string, number>>('doneLessons', {}); await setKV('doneLessons', { ...d, [q.get('id')!]: Date.now() }); }
      if (m === 'sunday') await finishSunday(tally);
    }
    setIdx(idx + 1);
    window.scrollTo(0, 0);
  };

  if (done) return <Done m={m} tally={tally} seconds={Math.round((Date.now() - start.current) / 1000)} score={score} lessonId={m === 'lesson' ? q.get('id') ?? undefined : undefined} />;
  const passage = m === 'passage' ? PASSAGES.find(p => p.id === q.get('id')) : undefined;

  return (
    <main className="screen no-tabs">
      <header className="topbar">
        <button className="iconbtn soft" aria-label="Close session" onClick={() => nav(-1)}><Icon n="close" /></button>
        <div className="grow"><Bar pct={(idx / queue.length) * 100} /></div>
        <span className="small muted num">{idx + 1}/{queue.length}</span>
      </header>
      <div className="hud" aria-label="Session score">
        <span className="pill"><Icon n="star" s={13} />{score}</span>
        <span key={combo} className={`pill ${combo >= 3 ? 'hot' : ''}`}><Icon n="flame" s={13} />{combo} in a row</span>
        <span className="grow" />
        <span className="pill"><Icon n="clock" s={13} />{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
      </div>
      {ex.tag === 'challenge' && <span className="badge sakura" style={{ alignSelf: 'flex-start' }}><Icon n="flame" s={13} />Final challenge · no hints · double score</span>}
      {ex.tag === 'earlier' && <span className="badge plain" style={{ alignSelf: 'flex-start' }}><Icon n="retry" s={13} />From an earlier lesson</span>}
      {ex.tag === 'story' && <span className="badge" style={{ alignSelf: 'flex-start' }}><Icon n="book" s={13} />Story check</span>}
      {ex.requeued && <span className="badge amber" style={{ alignSelf: 'flex-start' }}><Icon n="retry" s={13} />Second look</span>}
      {passage && (
        <div className="card flat col gap-s">
          <span className="label">{passage.context}</span>
          {passage.lines.map((l, i) => <div key={i} className="row between"><Furi f={l.f} className="jp-m" /><Audio f={l.f} compact /></div>)}
        </div>
      )}
      <Exercise key={ex.key} ex={ex} onResult={onResult} onNext={onNext} last={idx === queue.length - 1} cast={castFor(ex.lessonId ?? (m === 'lesson' ? q.get('id') ?? undefined : undefined))} />
    </main>
  );
}

async function finishSunday(tally: Tally[]) {
  const bySkill: Record<string, { ok: number; n: number }> = {};
  for (const t of tally) { const b = (bySkill[t.skill] ??= { ok: 0, n: 0 }); b.n++; if (t.ok) b.ok++; }
  const rows = Object.entries(bySkill).map(([skill, v]) => ({ skill, pct: Math.round((v.ok / v.n) * 100), n: v.n }));
  const recurring = (await db.items.toArray()).filter(i => i.wrong >= 2).sort((a, b) => b.wrong - a.wrong).slice(0, 5).map(i => i.id);
  const report = {
    date: Date.now(), total: tally.length, correct: tally.filter(t => t.ok).length,
    strengths: rows.filter(r => r.pct >= 80).map(r => r.skill), weak: rows.filter(r => r.pct < 60).map(r => r.skill),
    missed: tally.filter(t => !t.ok).map(t => t.prompt), recurring,
  };
  const all = await getKV<unknown[]>('sundayReports', []);
  await setKV('sundayReports', [report, ...all].slice(0, 30));
  await setKV('lastSunday', sundayKey());
  await setKV('sundaysDone', (await getKV<number>('sundaysDone', 0)) + 1);
}

const SKILL_NAMES: Record<string, string> = { kana: 'Kana', vocab: 'Vocabulary', kanji: 'Kanji', grammar: 'Grammar and particles', reading: 'Reading', writing: 'Sentence writing', listening: 'Listening', speaking: 'Speaking' };
export { SKILL_NAMES };

function Done({ m, tally, seconds, score, lessonId }: { m: string; tally: Tally[]; seconds: number; score: number; lessonId?: string }) {
  const next = lessonId ? lessonAfter(lessonId) : undefined;
  useEffect(() => { sfx.complete(); }, []);
  const right = tally.filter(t => t.ok).length, missed = tally.filter(t => !t.ok);
  const weak = [...new Set(missed.map(t => SKILL_NAMES[t.skill]))];
  return (
    <Screen>
      <div className="col center" style={{ alignItems: 'center', paddingTop: 24 }}>
        <Mascot mood="cheer" size={110} />
        <h1>{m === 'sunday' ? 'Sunday review complete' : 'Session complete'}</h1>
        <p className="muted" lang="ja">おつかれさまでした！</p>
      </div>
      <div className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div className="jp-xl num">{right}</div><div className="tiny muted">right first time</div></div>
        <div><div className="jp-xl num">{missed.length}</div><div className="tiny muted">to revisit</div></div>
        <div><div className="jp-xl num">{Math.max(1, Math.round(seconds / 60))}</div><div className="tiny muted">minutes</div></div>
        <div><div className="jp-xl num">+{score}</div><div className="tiny muted">score</div></div>
      </div>
      {missed.length > 0 ? (
        <div className="card flat col gap-s">
          <h3>Saved to your Mistake Notebook</h3>
          <p className="small muted">These will return sooner in review{weak.length ? ` — mostly ${weak.join(', ').toLowerCase()}` : ''}. Mistakes are how the app learns what to show you.</p>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{missed.slice(0, 6).map((t, i) => <li key={i}>{t.prompt}</li>)}</ul>
        </div>
      ) : <div className="card sage small">Everything right first time. These items will now wait longer before the next review.</div>}
      {m === 'sunday' && <Link className="btn ghost" to="/sunday">See your review report</Link>}
      {missed.length > 0 && <Link className="btn ghost" to="/mistakes">Open Mistake Notebook</Link>}
      {next && <Link className="btn" to={`/lesson/${next.id}`} replace>Next lesson: {next.title}<Icon n="next" s={18} /></Link>}
      {lessonId && !next && <div className="card sage small">That was the last lesson in this track for now. More are coming — meanwhile the library has every N5–N1 word and kanji.</div>}
      <Link className={next ? 'btn ghost' : 'btn'} to="/" replace>Back to home</Link>
    </Screen>
  );
}
