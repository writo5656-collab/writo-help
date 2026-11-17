// Streak flame with freezes, the week strip and the 25-minute timer ring.
import { Link } from 'react-router-dom';
import { PLAN_MIN, MAX_FREEZES, type DayStatus } from '../lib/daily';
import { Icon, Ring } from './ui';

export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

export function StreakBadge({ current, freezes, atRisk, todayDone }: { current: number; freezes: number; atRisk: boolean; todayDone: boolean }) {
  return (
    <div className={`streak ${todayDone ? 'lit' : atRisk ? 'risk' : ''}`}>
      <span className="flame" aria-hidden="true"><Icon n="flame" s={26} w={2.2} /></span>
      <span><b className="num">{current}</b><span className="tiny">day streak</span></span>
      <span className="freezes" aria-label={`${freezes} of ${MAX_FREEZES} streak freezes`}>{Array.from({ length: MAX_FREEZES }, (_, i) => <i key={i} className={i < freezes ? 'on' : ''}>❄</i>)}</span>
    </div>
  );
}

const DOT: Record<DayStatus, string> = { done: '✓', frozen: '❄', missed: '·', today: '', future: '', before: '' };
export function WeekStrip({ week }: { week: { key: string; label: string; status: DayStatus }[] }) {
  return (
    <div className="week" aria-label="This week">
      {week.map(d => <span key={d.key} className={`wd ${d.status}`} title={`${d.key}: ${d.status}`}><i>{DOT[d.status]}</i><small>{d.label}</small></span>)}
    </div>
  );
}

export function PlanRing({ seconds, size = 96 }: { seconds: number; size?: number }) {
  const pct = Math.min(100, (seconds / (PLAN_MIN * 60)) * 100);
  const left = Math.max(0, PLAN_MIN * 60 - seconds);
  return (
    <Ring pct={pct} size={size} stroke={9} color={pct >= 100 ? '#e9b82a' : 'var(--forest-2)'}>
      <span><b className="num" style={{ fontSize: size > 90 ? '1.25rem' : '1rem' }}>{pct >= 100 ? '✓' : mmss(left)}</b><br /><span className="tiny muted">{pct >= 100 ? 'done' : 'left'}</span></span>
    </Ring>
  );
}

export function PlanCta({ done, label }: { done: boolean; label?: string }) {
  return <Link to="/plan" className="btn">{label ?? (done ? 'Keep learning' : 'Continue today\'s plan')}<Icon n="next" s={18} /></Link>;
}
