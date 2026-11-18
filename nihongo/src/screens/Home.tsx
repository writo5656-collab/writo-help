import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan, useDaily } from '../lib/hooks';
import { BLOCKS } from '../lib/daily';
import { JapanFlag } from '../components/Flag';
import { StreakBadge, WeekStrip, PlanRing, mmss } from '../components/PlanWidgets';
import { db, dayKey } from '../lib/db';
import { trackProgress, streaks } from '../lib/plan';
import { isKnown } from '../lib/srs';
import { HIRA, KATA, KANJI, JLPT_LESSONS, PRACTICAL_LESSONS, kanaId, kanjiId, ROLEPLAYS } from '../content';
import { Icon, Ring, Bar, useS, fmtMin } from '../components/ui';
import { Portrait } from '../components/Portrait';
import { dailyCast, CAST } from '../content/cast';
import { useAsync, SpeakBtn } from '../components/ui';
import { loadLibrary } from '../content/library';

function greeting() { const h = new Date().getHours(); return h < 11 ? ['おはよう', 'Good morning'] : h < 18 ? ['こんにちは', 'Hello'] : ['こんばんは', 'Good evening']; }

export default function Home() {
  const s = useS();
  const { plan, map, days, finished } = usePlan();
  const today = useLiveQuery(() => db.days.get(dayKey()), []);
  const mistakes = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').count(), []) ?? 0;
  const pct = (ids: string[]) => Math.round((ids.filter(id => isKnown(map.get(id))).length / ids.length) * 100);
  const hira = pct(Object.keys(HIRA).map(kanaId)), kata = pct(Object.keys(KATA).map(kanaId)), kanji = pct(KANJI.map(k => kanjiId(k.k)));
  const [jp, en] = greeting();
  const rp = ROLEPLAYS[(new Date().getDate()) % ROLEPLAYS.length];
  const daily = useDaily();
  if (!plan || !daily) return null;
  const g = CAST[dailyCast().guide];
  const blocksLeft = BLOCKS.filter(x => !daily.blocks.includes(x.id));

  return (
    <main className="screen">
      <header className="topbar">
        <div className="brand grow"><span className="brand-mark"><Icon n="torii" s={20} w={2.2} /></span>Nihongo</div>
        <span className="lang-tag" title="You are learning Japanese"><JapanFlag w={24} /><span lang="ja">日本語</span></span>
        <Link className="iconbtn soft" to="/settings" aria-label="Settings"><Icon n="gear" /></Link>
      </header>

      <section className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="col gap-s">
          <h1><span lang="ja" className="jp">{jp}</span>{s.name ? `, ${s.name}` : ''}</h1>
          <p className="muted">{en}. Learning <b>Japanese</b> 🇯🇵</p>
          <Clock />
          <p className="small">Today's teacher: <b>{g.name}</b> · <Link to="/call" style={{ color: 'var(--forest-2)', fontWeight: 700 }}>call her</Link></p>
        </div>
        <Link to="/call" aria-label={`Call ${g.name}`} style={{ textAlign: 'center' }}><Portrait id={g.id} size={78} mood={daily.info.todayDone ? 'happy' : 'teach'} /><span className="tiny" style={{ display: 'block', fontWeight: 700, marginTop: 4 }}>{g.name.split(' ')[0]}</span></Link>
      </section>

      <section className="card green col">
        <div className="row" style={{ alignItems: 'center' }}>
          <PlanRing seconds={daily.seconds} size={92} />
          <div className="grow">
            <h2>Today's 25-minute plan</h2>
            <p className="small muted">{daily.info.todayDone ? 'Complete — streak secured for today.' : `${mmss(daily.left)} to go · ${blocksLeft.length ? `${blocksLeft.length} of 4 blocks left` : 'all blocks done'}`}</p>
            <p className="small muted"><span className="num">{daily.score.toLocaleString()}</span> score · {daily.studied} full days</p>
          </div>
        </div>
        <div className="list" style={{ ['--line' as string]: 'rgba(255,255,255,.14)' }}>
          {BLOCKS.map(b => <div key={b.id} className="li" style={{ minHeight: 40, padding: '8px 2px' }}><span className="num tiny" style={{ width: 40, opacity: .75, fontWeight: 700 }}>{b.min} min</span><span className="grow" style={{ fontWeight: 650, textDecoration: daily.blocks.includes(b.id) ? 'line-through' : 'none', opacity: daily.blocks.includes(b.id) ? .6 : 1 }}>{b.title}{b.id === 'lesson' && plan.lesson ? `: ${plan.lesson.title}` : ''}</span>{daily.blocks.includes(b.id) && <Icon n="check" s={18} />}</div>)}
        </div>
        <Link to="/plan" className="btn cream">{daily.info.todayDone ? 'Keep learning' : daily.blocks.length || daily.seconds > 60 ? 'Continue learning' : 'Start today\'s plan'}<Icon n="next" s={18} /></Link>
      </section>

      {plan.sundayPending && (
        <Link to="/sunday" className="card sakura row">
          <span className="tile sakura"><Icon n="calendar" /></span>
          <div className="grow"><h3>Sunday review is ready</h3><p className="small muted">A relaxed look back over the last {plan.sundayWeeks} week{plan.sundayWeeks > 1 ? 's' : ''}. It waits for you — no penalty if today does not suit.</p></div>
          <Icon n="next" />
        </Link>
      )}

      <Link to="/progress" className="streak-mini">
        <span className={`fl ${daily.info.todayDone ? '' : 'off'}`}><Icon n="flame" s={20} w={2.2} /></span>
        <span><b className="num">{daily.info.current}</b> day streak · {'❄'.repeat(daily.info.freezes)}{daily.info.atRisk ? ' · finish today\'s plan to keep it' : ''}</span>
        <span className="dots">{daily.week.map(w => <i key={w.key} className={w.status} />)}</span>
      </Link>

      <WordOfDay />

      <div className="section-h"><h2>Your progress</h2><Link to="/progress" className="small" style={{ color: 'var(--forest-2)', fontWeight: 700 }}>Details</Link></div>
      <section className="card row" style={{ justifyContent: 'space-around' }}>
        {([['あ', hira, 'Hiragana', 'var(--forest-2)'], ['ア', kata, 'Katakana', 'var(--amber)'], ['漢', kanji, 'Kanji', 'var(--sakura)']] as const).map(([ch, p, label, color]) => (
          <Link key={label} to={label === 'Kanji' ? '/kanji' : '/kana'} className="col center gap-s" style={{ alignItems: 'center' }}>
            <Ring pct={p} color={color}><span><span className="jp" lang="ja" style={{ fontWeight: 700, fontSize: '1.15rem' }}>{ch}</span><br /><span className="tiny muted num">{p}%</span></span></Ring>
            <span className="small" style={{ fontWeight: 600 }}>{label}</span>
          </Link>
        ))}
      </section>

      <Link to="/learn?t=jlpt" className="card row">
        <span className="tile green"><Icon n="star" /></span>
        <div className="grow col gap-s"><div className="row between"><h3>JLPT track</h3><span className="small muted num">{trackProgress(JLPT_LESSONS, map, finished)}%</span></div><Bar pct={trackProgress(JLPT_LESSONS, map, finished)} /></div>
        <Icon n="next" />
      </Link>
      <Link to="/learn?t=practical" className="card row">
        <span className="tile sakura"><Icon n="torii" /></span>
        <div className="grow col gap-s"><div className="row between"><h3>Real-life Japanese</h3><span className="small muted num">{trackProgress(PRACTICAL_LESSONS, map, finished)}%</span></div><Bar pct={trackProgress(PRACTICAL_LESSONS, map, finished)} /></div>
        <Icon n="next" />
      </Link>

      <Link to="/read-japan" className="card row">
        <span className="tile sakura"><Icon n="eye" /></span>
        <div className="grow col" style={{ gap: 2 }}><h3>Read real Japan 🇯🇵</h3><p className="small muted" style={{ margin: 0 }}>Real photos of signs and menus — can you read them?</p></div>
        <Icon n="next" />
      </Link>

      <div className="row">
        <Link to="/notebook" className="card grow col gap-s"><span className="tile"><Icon n="pen" /></span><h3>Notebook</h3><p className="small muted">Write freely in Japanese</p></Link>
        <Link to="/mistakes" className="card grow col gap-s"><span className="tile amber"><Icon n="bulb" /></span><h3>Mistakes</h3><p className="small muted">{mistakes ? `${mistakes} to revisit` : 'Nothing open'}</p></Link>
      </div>

      <Link to="/plan" className="btn">Continue learning<Icon n="next" s={18} /></Link>
    </main>
  );
}

function Step({ to, min, title, sub }: { to: string; min: string; title: string; sub: string }) {
  return (
    <Link to={to} className="li">
      <span className="num tiny" style={{ width: 40, opacity: .75, fontWeight: 700 }}>{min} min</span>
      <span className="grow"><span style={{ fontWeight: 700, display: 'block' }}>{title}</span><span className="small muted" style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span></span>
      <Icon n="next" s={18} />
    </Link>
  );
}

/** A new word and kanji every day from the full library, a level above what you have finished. */
function WordOfDay() {
  const lib = useAsync(loadLibrary, []);
  if (!lib) return null;
  const d = new Date(); const seed = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate();
  const words = lib.words.filter(w => w.lvl >= 4 && w.jp !== w.kana);
  const w = words[(seed * 7919) % words.length];
  const kj = lib.kanji.filter(k => k.lvl >= 4)[(seed * 104729) % lib.kanji.filter(k => k.lvl >= 4).length];
  const g = dailyCast(d.getDate() + 3).guide;
  return (
    <section className="card row" style={{ alignItems: 'flex-start' }}>
      <Portrait id={g} size={54} />
      <div className="grow col" style={{ gap: 4 }}>
        <span className="label">Word of the day · from {CAST[g].name.split(' ')[0]}</span>
        <span className="row gap-s"><span className="jp-l jp" lang="ja">{w.jp}</span><span className="small muted jp" lang="ja">{w.kana}</span></span>
        <span className="small">{w.en} <span className="badge plain">N{w.lvl}</span></span>
        <Link to={`/kanji?k=${kj.k}`} className="small" style={{ color: 'var(--forest-2)', fontWeight: 700 }}>Kanji of the day: <span lang="ja" className="jp">{kj.k}</span> — {kj.en.split(',')[0]}</Link>
      </div>
      <SpeakBtn text={w.jp} />
    </section>
  );
}

/** Today's date and time from the phone, and when the next Sunday review is. */
function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(t); }, []);
  const toSun = (7 - now.getDay()) % 7;
  return (
    <span className="clockline">
      <span>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
      <span>{toSun === 0 ? <b style={{ color: 'var(--sakura)' }}>📅 Sunday review day</b> : `📅 Sunday review in ${toSun} day${toSun > 1 ? 's' : ''}`}</span>
    </span>
  );
}
