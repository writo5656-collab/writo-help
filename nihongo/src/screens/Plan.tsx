// Today's 25-minute plan: four blocks in order, with a live timer.
// The day counts for your streak once 25 minutes are done.
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan, useDaily } from '../lib/hooks';
import { BLOCKS, nextBlock, type BlockId } from '../lib/daily';
import { db } from '../lib/db';
import { CAST, dailyCast, ROLEPLAYS } from '../content';
import { Portrait } from '../components/Portrait';
import { StreakBadge, WeekStrip, PlanRing, mmss } from '../components/PlanWidgets';
import { Screen, Icon, useS, useAsync } from '../components/ui';
import { sttAvailable } from '../services/stt';

export function blockRoute(id: BlockId, o: { due: number; lessonId?: string; part1Done: boolean; mic: boolean; mistakes: number }): string {
  const tag = `plan=1&block=${id}`;
  switch (id) {
    case 'review': return o.due ? `/session?m=review&${tag}` : o.mistakes ? `/session?m=mistakes&${tag}` : `/session?m=drill&type=vocab&${tag}`;
    case 'lesson': return !o.lessonId ? `/session?m=lib&kind=vocab&lvl=4&${tag}` : o.part1Done ? `/session?m=lesson&id=${o.lessonId}&part=2&${tag}` : `/lesson/${o.lessonId}?${tag}`;
    case 'sentences': return `/session?m=drill&type=translate&${tag}`;
    case 'real': { const rp = ROLEPLAYS[new Date().getDate() % ROLEPLAYS.length].id; return o.mic ? `/call?c=${dailyCast().guide}&rp=${rp}&${tag}` : `/read-japan?${tag}`; }
  }
}

export default function Plan() {
  const nav = useNavigate();
  const s = useS();
  const { plan } = usePlan();
  const daily = useDaily();
  const parts = useLiveQuery(async () => ((await db.kv.get('lessonParts'))?.value as Record<string, number[]>) ?? {}, []);
  const mistakes = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').count(), []) ?? 0;
  const mic = useAsync(sttAvailable, []) ?? false;
  if (!plan || !daily || !parts) return null;
  const g = CAST[dailyCast().guide];
  const lessonId = plan.lesson?.id;
  const opts = { due: plan.due, lessonId, part1Done: !!lessonId && (parts[lessonId] ?? []).includes(1), mic, mistakes };
  const cur = nextBlock(daily.blocks);
  const finished = daily.left === 0;
  const msg = finished ? 'Today\'s plan is complete. Your streak is safe, and anything more is extra practice.'
    : !cur ? `All four blocks done — ${mmss(daily.left)} to go. Keep practising to finish the 25 minutes.`
    : daily.seconds < 60 ? `Ready? 25 minutes today with me, ${s.name || 'friend'}.` : `Nice pace. ${mmss(daily.left)} left today.`;
  return (
    <Screen back="/" title="Today's plan">
      <div className="card row" style={{ alignItems: 'center' }}>
        <PlanRing seconds={daily.seconds} size={104} />
        <div className="grow col" style={{ gap: 8 }}>
          <span className="label">25-minute plan · {new Date().toLocaleDateString(undefined, { weekday: 'long' })}</span>
          <div className="row gap-s"><Portrait id={g.id} size={40} mood={finished ? 'happy' : 'teach'} /><span className="small"><b>{g.name.split(' ')[0]}:</b> {msg}</span></div>
          <span className="tiny muted">The timer only runs while you do the plan's activities below.</span>
        </div>
      </div>
      <StreakBadge current={daily.info.current} freezes={daily.info.freezes} atRisk={daily.info.atRisk} todayDone={daily.info.todayDone} />
      <WeekStrip week={daily.week} />
      <p className="tiny muted">The streak counts a day once you have studied 25 minutes. Miss a day and a freeze covers it (3 max, one earned back every 7 days). With no freezes left, a missed day breaks the streak at midnight.</p>
      <div className="col gap-s blocks">
        {BLOCKS.map((b, i) => {
          const done = daily.blocks.includes(b.id), isCur = b.id === cur;
          return (
            <Link key={b.id} to={blockRoute(b.id, opts)} className={`blk ${done ? 'done' : ''} ${isCur ? 'cur' : ''}`}>
              <span className="n" lang={done ? 'ja' : undefined} aria-label={done ? 'Done' : undefined}>{done ? '済' : i + 1}</span>
              <span className="grow"><b style={{ display: 'block' }}>{b.title}</b><span className="small muted">{b.id === 'lesson' && plan.lesson ? `${plan.lesson.title} · Part ${opts.part1Done ? 2 : 1}` : b.sub}</span></span>
              <span className="badge plain">{b.min} min</span>
            </Link>
          );
        })}
      </div>
      {cur ? <button className="btn" onClick={() => nav(blockRoute(cur, opts))}>{daily.blocks.length ? 'Continue' : 'Start'}: {BLOCKS.find(b => b.id === cur)!.title}<Icon n="next" s={18} /></button>
        : <button className="btn" onClick={() => nav(plan.due ? '/session?m=review&plan=1&block=extra' : '/session?m=lib&kind=vocab&lvl=4&plan=1&block=extra')}>{finished ? 'Bonus practice' : `Keep going — ${mmss(daily.left)} left`}<Icon n="next" s={18} /></button>}
    </Screen>
  );
}
