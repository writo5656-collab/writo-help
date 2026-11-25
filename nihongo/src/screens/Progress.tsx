// Progress dashboard: skills and retention, not just streaks.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, dayKey } from '../lib/db';
import { useItems, usePlan, useDaily } from '../lib/hooks';
import { StreakBadge, PlanRing } from '../components/PlanWidgets';
import { keyOf } from '../lib/daily';
import { isKnown, isMastered, dueItems, DAY } from '../lib/srs';
import { trackProgress } from '../lib/plan';
import { HIRA, KATA, KANJI, ALL_VOCAB, JLPT_LESSONS, PRACTICAL_LESSONS, kanaId, kanjiId, vocabId } from '../content';
import { SKILL_NAMES } from './Session';
import { Screen, Ring, Bar, useS, fmtMin, Empty } from '../components/ui';

export default function Progress() {
  const s = useS();
  const { items, map } = useItems();
  const { finished } = usePlan();
  const daily = useDaily();
  const answers = useLiveQuery(() => db.answers.toArray(), []);
  const days = useLiveQuery(() => db.days.toArray(), []);
  const openMistakes = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').count(), []) ?? 0;
  if (!items || !answers || !days || !daily) return null;

  const count = (ids: string[]) => ({ known: ids.filter(id => isKnown(map.get(id))).length, mastered: ids.filter(id => isMastered(map.get(id))).length, total: ids.length });
  const sets = [
    ['Hiragana', count(Object.keys(HIRA).map(kanaId)), 'var(--forest-2)'],
    ['Katakana', count(Object.keys(KATA).map(kanaId)), 'var(--amber)'],
    ['Kanji', count(KANJI.map(k => kanjiId(k.k))), 'var(--sakura)'],
    ['Vocabulary', count(ALL_VOCAB.map(w => vocabId(w.jp))), 'var(--forest)'],
  ] as const;

  const now = Date.now();
  const recent = answers.filter(a => a.ts > now - 30 * DAY);
  const skills = Object.keys(SKILL_NAMES).map(k => {
    const a = recent.filter(x => x.skill === k);
    return { k, n: a.length, pct: a.length ? Math.round((a.filter(x => x.ok).length / a.length) * 100) : 0 };
  });
  // Retention: answers on items that had already been learned on an earlier day.
  const firstSeen = new Map<string, string>();
  for (const a of answers) if (!firstSeen.has(a.itemId)) firstSeen.set(a.itemId, a.day);
  const reviews = recent.filter(a => firstSeen.get(a.itemId) !== a.day);
  const retention = reviews.length ? Math.round((reviews.filter(a => a.ok).length / reviews.length) * 100) : null;

  const last14 = Array.from({ length: 14 }, (_, i) => { const d = new Date(now - (13 - i) * DAY); const k = dayKey(d); return { k, d, sec: days.find(x => x.day === k)?.seconds ?? 0 }; });
  const maxSec = Math.max(60, ...last14.map(d => d.sec));
  const weeks = Array.from({ length: 6 }, (_, i) => {
    const from = now - (6 - i) * 7 * DAY, to = from + 7 * DAY;
    const a = answers.filter(x => x.ts >= from && x.ts < to);
    return { n: a.length, err: a.length ? Math.round((a.filter(x => !x.ok).length / a.length) * 100) : null };
  });
  const studied = days.filter(d => d.xp > 0).map(d => d.day).sort();
  let streak = 0; for (let i = 0; ; i++) { if (studied.includes(dayKey(new Date(now - i * DAY)))) streak++; else if (i > 0) break; }
  const totalSec = days.reduce((a, d) => a + d.seconds, 0);
  const due = dueItems(items).length;
  const weakest = skills.filter(x => x.n >= 5).sort((a, b) => a.pct - b.pct)[0];

  return (
    <Screen back title="Progress">
      <StreakBadge current={daily.info.current} freezes={daily.info.freezes} atRisk={daily.info.atRisk} todayDone={daily.info.todayDone} />
      <section className="card row">
        <PlanRing seconds={daily.seconds} size={84} />
        <div className="grow"><h3>Today: {Math.floor(daily.seconds / 60)} of 25 minutes</h3><p className="small muted">Best streak: <b className="num">{daily.info.best}</b> days · {daily.studied} full days · {daily.info.freezes} freeze{daily.info.freezes === 1 ? '' : 's'} left</p></div>
      </section>
      <h2>Streak calendar</h2>
      <section className="card col gap-s">
        <div className="cal">
          {Array.from({ length: 35 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - 34 + i); const k = keyOf(d); const st = daily.info.status.get(k) ?? 'before'; return <span key={k} className={`cd ${st}`} title={`${k}: ${st}`}>{d.getDate()}</span>; })}
        </div>
        <div className="row gap-s wrap tiny muted"><span className="cd done sw" /> 25 min done <span className="cd frozen sw" /> frozen <span className="cd missed sw" /> missed <span className="cd today sw" /> today</div>
      </section>
      {answers.length === 0 && <Empty title="Your progress will appear here">Complete a lesson or a few exercises and this page fills in with what you know, what is fading and where to focus.</Empty>}
      <section className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div className="jp-xl num">{studied.length}</div><div className="tiny muted">days studied</div></div>
        <div><div className="jp-xl num">{fmtMin(totalSec)}</div><div className="tiny muted">total time</div></div>
        <div><div className="jp-xl num">{retention === null ? '—' : `${retention}%`}</div><div className="tiny muted">retention</div></div>
        {s.showStreak && <div><div className="jp-xl num">{streak}</div><div className="tiny muted">day streak</div></div>}
      </section>
      <p className="tiny muted">Retention = how often you were right on items first learned on an earlier day (last 30 days). It is the number that matters most.</p>

      <h2>What you know</h2>
      <section className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {sets.map(([label, c, color]) => (
          <div key={label} className="row">
            <Ring pct={(c.known / c.total) * 100} size={58} stroke={6} color={color}><span className="tiny num" style={{ fontWeight: 600 }}>{Math.round((c.known / c.total) * 100)}%</span></Ring>
            <div><h3>{label}</h3><div className="tiny muted num">{c.known}/{c.total} known</div><div className="tiny muted num">{c.mastered} long-term</div></div>
          </div>
        ))}
      </section>
      <section className="card flat row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
        <div><div className="jp-l num">{due}</div><div className="tiny muted">due for review</div></div>
        <div><div className="jp-l num">{items.filter(i => i.status === 'forgotten' || i.status === 'uncertain').length}</div><div className="tiny muted">weak items</div></div>
        <div><div className="jp-l num">{openMistakes}</div><div className="tiny muted">open mistakes</div></div>
      </section>

      <h2>Skills (last 30 days)</h2>
      <section className="card col">
        {skills.map(x => (
          <div key={x.k} className="col" style={{ gap: 4 }}>
            <div className="row between small"><span style={{ fontWeight: 500 }}>{SKILL_NAMES[x.k]}</span><span className="muted num">{x.n ? `${x.pct}% · ${x.n} answers` : 'not practised yet'}</span></div>
            <Bar pct={x.pct} />
          </div>
        ))}
        {weakest && weakest.pct < 80 && <div className="card amber small" style={{ padding: '12px 12px' }}><b>Suggested focus:</b> {SKILL_NAMES[weakest.k]} — your lowest accuracy at {weakest.pct}%.</div>}
      </section>

      <h2>Tracks</h2>
      <section className="card col">
        <div className="col" style={{ gap: 4 }}><div className="row between small"><span style={{ fontWeight: 500 }}>JLPT track (N5 → N4)</span><span className="muted num">{trackProgress(JLPT_LESSONS, map, finished)}%</span></div><Bar pct={trackProgress(JLPT_LESSONS, map, finished)} /></div>
        <div className="col" style={{ gap: 4 }}><div className="row between small"><span style={{ fontWeight: 500 }}>Practical situations</span><span className="muted num">{trackProgress(PRACTICAL_LESSONS, map, finished)}%</span></div><Bar pct={trackProgress(PRACTICAL_LESSONS, map, finished)} /></div>
      </section>

      <h2>Time studied — last 14 days</h2>
      <section className="card col gap-s">
        <div className="spark" role="img" aria-label="Minutes studied per day over the last 14 days">{last14.map(d => <i key={d.k} className={d.k === dayKey() ? 'today' : ''} style={{ height: `${(d.sec / maxSec) * 100}%` }} title={`${d.k}: ${fmtMin(d.sec)}`} />)}</div>
        <div className="row between tiny muted"><span>{last14[0].d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span><span>Today · {fmtMin(last14[13].sec)}</span></div>
      </section>

      <h2>Mistake rate by week</h2>
      <section className="card col gap-s">
        <div className="spark">{weeks.map((w, i) => <i key={i} style={{ height: `${w.err ?? 0}%`, background: i === 5 ? 'var(--sakura)' : '#edc9c4' }} title={w.err === null ? 'no answers' : `${w.err}% wrong of ${w.n}`} />)}</div>
        <div className="row between tiny muted"><span>6 weeks ago</span><span>This week{weeks[5].err !== null ? ` · ${weeks[5].err}% wrong` : ''}</span></div>
        <p className="tiny muted">Lower is better, but some mistakes are healthy — they show the app is stretching you.</p>
      </section>

      <h2>History</h2>
      <section className="card flat list" style={{ padding: '2px 16px' }}>
        {[...days].sort((a, b) => b.day.localeCompare(a.day)).slice(0, 10).map(d => {
          const a = answers.filter(x => x.day === d.day);
          return <div key={d.day} className="li"><span className="grow" style={{ fontWeight: 500 }}>{new Date(d.day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span><span className="small muted num">{fmtMin(d.seconds)} · {a.length} answers · {d.xp} XP</span></div>;
        })}
        {days.length === 0 && <div className="li muted small">No study sessions yet.</div>}
      </section>
    </Screen>
  );
}
