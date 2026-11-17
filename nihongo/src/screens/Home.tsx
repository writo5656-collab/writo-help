import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan } from '../lib/hooks';
import { db, dayKey } from '../lib/db';
import { trackProgress } from '../lib/plan';
import { isKnown } from '../lib/srs';
import { HIRA, KATA, KANJI, JLPT_LESSONS, PRACTICAL_LESSONS, kanaId, kanjiId, ROLEPLAYS } from '../content';
import { Icon, Mascot, Ring, Bar, useS, fmtMin } from '../components/ui';

function greeting() { const h = new Date().getHours(); return h < 11 ? ['おはよう', 'Good morning'] : h < 18 ? ['こんにちは', 'Hello'] : ['こんばんは', 'Good evening']; }

export default function Home() {
  const s = useS();
  const { plan, map } = usePlan();
  const today = useLiveQuery(() => db.days.get(dayKey()), []);
  const mistakes = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').count(), []) ?? 0;
  const pct = (ids: string[]) => Math.round((ids.filter(id => isKnown(map.get(id))).length / ids.length) * 100);
  const hira = pct(Object.keys(HIRA).map(kanaId)), kata = pct(Object.keys(KATA).map(kanaId)), kanji = pct(KANJI.map(k => kanjiId(k.k)));
  const [jp, en] = greeting();
  const rp = ROLEPLAYS[(new Date().getDate()) % ROLEPLAYS.length];
  if (!plan) return null;
  const focusLabel = plan.focus === 'review' ? 'Sunday review' : plan.focus === 'jlpt' ? 'JLPT foundations' : 'Practical Japanese';

  return (
    <main className="screen">
      <header className="topbar">
        <div className="brand grow"><span className="brand-mark"><Icon n="torii" s={20} w={2.2} /></span>Nihongo</div>
        <Link className="iconbtn soft" to="/progress" aria-label="Progress"><Icon n="chart" /></Link>
        <Link className="iconbtn soft" to="/settings" aria-label="Settings"><Icon n="gear" /></Link>
      </header>

      <section className="row between" style={{ alignItems: 'flex-end' }}>
        <div className="col gap-s">
          <h1><span lang="ja" className="jp">{jp}</span>{s.name ? `, ${s.name}` : ''}</h1>
          <p className="muted">{en}. {today?.seconds ? `${fmtMin(today.seconds)} studied today.` : 'Ready when you are.'}</p>
        </div>
        <Mascot size={76} />
      </section>

      <section className="card green col">
        <div className="row between">
          <div><h2>Today's 25-minute plan</h2><p className="small muted">Day {plan.cycleDay} of 4 · {focusLabel}</p></div>
          <span className="badge" style={{ background: 'rgba(255,255,255,.14)', color: 'var(--cream)' }}>a guide, not a timer</span>
        </div>
        <div className="list" style={{ ['--line' as string]: 'rgba(255,255,255,.14)' }}>
          <Step to="/session?m=review" min="5" title="Spaced revision" sub={plan.due ? `${plan.due} item${plan.due === 1 ? '' : 's'} due` : 'Nothing due — you are up to date'} />
          {plan.lesson && <Step to={`/lesson/${plan.lesson.id}`} min="8" title="New lesson" sub={plan.lesson.title} />}
          <Step to="/session?m=drill&type=translate" min="7" title="Sentence practice" sub="Write full sentences in your notebook" />
          <Step to={plan.focus === 'practical' && plan.practical ? `/lesson/${plan.practical.id}` : `/roleplay/${rp.id}`} min="5" title="Real-life challenge" sub={plan.focus === 'practical' && plan.practical ? plan.practical.title : `Roleplay: ${rp.title}`} />
        </div>
      </section>

      {plan.sundayPending && (
        <Link to="/sunday" className="card sakura row">
          <span className="tile sakura"><Icon n="calendar" /></span>
          <div className="grow"><h3>Sunday review is ready</h3><p className="small muted">A relaxed look back over the last {plan.sundayWeeks} week{plan.sundayWeeks > 1 ? 's' : ''}. It waits for you — no penalty if today does not suit.</p></div>
          <Icon n="next" />
        </Link>
      )}

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
        <div className="grow col gap-s"><div className="row between"><h3>JLPT track</h3><span className="small muted num">{trackProgress(JLPT_LESSONS, map)}%</span></div><Bar pct={trackProgress(JLPT_LESSONS, map)} /></div>
        <Icon n="next" />
      </Link>
      <Link to="/learn?t=practical" className="card row">
        <span className="tile sakura"><Icon n="torii" /></span>
        <div className="grow col gap-s"><div className="row between"><h3>Real-life Japanese</h3><span className="small muted num">{trackProgress(PRACTICAL_LESSONS, map)}%</span></div><Bar pct={trackProgress(PRACTICAL_LESSONS, map)} /></div>
        <Icon n="next" />
      </Link>

      <div className="row">
        <Link to="/notebook" className="card grow col gap-s"><span className="tile"><Icon n="pen" /></span><h3>Notebook</h3><p className="small muted">Write freely in Japanese</p></Link>
        <Link to="/mistakes" className="card grow col gap-s"><span className="tile amber"><Icon n="bulb" /></span><h3>Mistakes</h3><p className="small muted">{mistakes ? `${mistakes} to revisit` : 'Nothing open'}</p></Link>
      </div>

      {plan.lesson && <Link to={`/lesson/${plan.lesson.id}`} className="btn">Continue learning<Icon n="next" s={18} /></Link>}
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
