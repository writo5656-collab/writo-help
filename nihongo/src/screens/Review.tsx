// Mistake Notebook and the Sunday review.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, labelMistake, getKV } from '../lib/db';
import { usePlan } from '../lib/hooks';
import { LESSON_MAP } from '../content';
import { SKILL_NAMES } from './Session';
import { aiConfigured } from '../services/ai';
import { Screen, Icon, Empty, fmtDate, useAsync } from '../components/ui';

const LABELS = [['remembered', 'Remembered', 'check'], ['uncertain', 'Uncertain', 'bulb'], ['forgotten', 'Forgotten', 'x']] as const;

export function Mistakes() {
  const all = useLiveQuery(() => db.mistakes.orderBy('date').reverse().toArray(), []);
  const [filter, setFilter] = useState<'open' | 'remembered'>('open');
  if (!all) return null;
  const list = all.filter(m => (filter === 'open' ? m.status !== 'remembered' : m.status === 'remembered'));
  return (
    <Screen back title="Mistake Notebook">
      <div className="row between">
        <div className="seg"><button className={filter === 'open' ? 'on' : ''} onClick={() => setFilter('open')}>To revisit</button><button className={filter === 'remembered' ? 'on' : ''} onClick={() => setFilter('remembered')}>Remembered</button></div>
        {filter === 'open' && list.length > 0 && <Link className="btn sm" to="/session?m=mistakes">Retry all</Link>}
      </div>
      {list.length === 0 && <Empty title={filter === 'open' ? 'No open mistakes' : 'Nothing here yet'} mood="cheer">{filter === 'open' ? 'When an answer goes wrong it is saved here with an explanation, so you can come back to it.' : 'Mistakes you later get right move here.'}</Empty>}
      {list.map(m => (
        <article key={m.id} className="card col gap-s">
          <div className="row between"><span className="badge plain">{SKILL_NAMES[m.skill] ?? m.skill}</span><span className="tiny muted">{fmtDate(m.date)}</span></div>
          <p style={{ fontWeight: 650 }}>{m.prompt}</p>
          <div className="small"><span className="label">You wrote</span><div lang="ja" className="jp" style={{ color: 'var(--bad)' }}>{m.userAnswer || '—'}</div></div>
          <div className="small"><span className="label">Expected</span><div lang="ja" className="jp jp-m" style={{ color: 'var(--ok)', fontWeight: 600 }}>{m.expected}</div></div>
          {m.explanation && <div className="card amber small" style={{ padding: '10px 12px' }}>{m.explanation}</div>}
          <div className="row gap-s wrap">
            {LABELS.map(([id, label, icon]) => <button key={id} className={`chip ${m.status === id ? 'on' : ''}`} aria-pressed={m.status === id} onClick={() => labelMistake(m.id!, id)}><Icon n={icon} s={15} />{label}</button>)}
          </div>
          <div className="row">
            {m.lessonId && LESSON_MAP.has(m.lessonId) && <Link className="btn sm line" to={`/lesson/${m.lessonId}`}>Open lesson</Link>}
            {!!m.ex && <Link className="btn sm" to={`/session?m=mistake&id=${m.id}`}><Icon n="retry" s={16} />Try again</Link>}
          </div>
        </article>
      ))}
    </Screen>
  );
}

interface Report { date: number; total: number; correct: number; strengths: string[]; weak: string[]; missed: string[]; recurring: string[] }

export function Sunday() {
  const { plan } = usePlan();
  const reports = useLiveQuery(() => getKV<Report[]>('sundayReports', []), []);
  const ai = useAsync(aiConfigured, []);
  if (!plan || !reports) return null;
  const r = reports[0];
  const focus = r ? (r.weak.length ? `Spend extra time on ${r.weak.map(w => SKILL_NAMES[w]?.toLowerCase()).join(' and ')} this week.` : 'Keep the same rhythm — and try a new lesson.') : '';
  return (
    <Screen back title="Sunday review">
      <div className="card sakura col gap-s">
        <h2>A relaxed look back</h2>
        <p className="small">Not an exam. A short mixed session — vocabulary, grammar, sentence writing, listening and speaking — sampled from what you studied in the last <b>{plan.sundayWeeks} week{plan.sundayWeeks > 1 ? 's' : ''}</b>. Each Sunday reaches one week further back. If you miss it, it simply waits.</p>
      </div>
      <Link className="btn" to="/session?m=sunday">Start the review<Icon n="next" s={18} /></Link>
      <Link className="btn ghost" to={ai ? '/tutor?mode=sunday' : '/speak'}><Icon n="chat" s={18} />{ai ? 'Review by conversation with the AI tutor' : 'Follow with a roleplay conversation'}</Link>
      {!ai && <p className="tiny muted">The conversational Sunday review needs the AI tutor, which is not set up yet (Settings → AI tutor). The exercise review above works offline.</p>}
      {r && (
        <div className="card col gap-s">
          <div className="row between"><h3>Latest report</h3><span className="tiny muted">{fmtDate(r.date)}</span></div>
          <p><b className="num">{r.correct}</b> of <b className="num">{r.total}</b> right first time.</p>
          {r.strengths.length > 0 && <p className="small"><b>Strengths:</b> {r.strengths.map(s => SKILL_NAMES[s]).join(', ')}</p>}
          {r.weak.length > 0 && <p className="small"><b>Weak points:</b> {r.weak.map(s => SKILL_NAMES[s]).join(', ')}</p>}
          {r.missed.length > 0 && <div className="small"><b>Missed this time</b><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{r.missed.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
          {r.recurring.length > 0 && <p className="small"><b>Recurring mistakes:</b> <span lang="ja" className="jp">{r.recurring.map(id => id.startsWith('sent') ? 'a sentence' : id.split(':').slice(1).join(':')).join('、 ')}</span></p>}
          <div className="card sage small" style={{ padding: '10px 12px' }}><b>Next focus:</b> {focus}</div>
        </div>
      )}
      {reports.length > 1 && <p className="tiny muted center">{reports.length} reviews completed so far.</p>}
    </Screen>
  );
}
