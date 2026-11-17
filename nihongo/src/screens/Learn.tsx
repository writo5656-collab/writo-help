import { Link, useSearchParams } from 'react-router-dom';
import { usePlan } from '../lib/hooks';
import { lessonProgress } from '../lib/plan';
import { KANA_LESSONS, JLPT_LESSONS, PRACTICAL_LESSONS, UPCOMING_LEVELS, PACKS, PASSAGES, KANJI, type Lesson } from '../content';
import { Screen, Icon, Bar, Wip } from '../components/ui';

const TABS = [['kana', 'Kana'], ['jlpt', 'JLPT'], ['practical', 'Real life'], ['library', 'Library']] as const;

export default function Learn() {
  const [q, setQ] = useSearchParams();
  const { plan, map } = usePlan();
  const t = q.get('t') ?? (plan?.lesson?.track ?? 'kana');
  const Row = ({ l, n }: { l: Lesson; n: number }) => {
    const p = lessonProgress(l, map);
    const next = plan?.lesson?.id === l.id;
    return (
      <Link to={`/lesson/${l.id}`} className="card row">
        <span className={`tile ${p.done ? 'green' : ''}`}>{p.done ? <Icon n="check" /> : <span className="num" style={{ fontFamily: 'var(--ui)' }}>{n}</span>}</span>
        <div className="grow col gap-s">
          <div className="row between gap-s"><h3 style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.title}</h3>{next && <span className="badge sakura">Suggested next</span>}</div>
          <span className="small muted jp" lang="ja">{l.jp}</span>
          <Bar pct={p.pct} />
        </div>
      </Link>
    );
  };
  return (
    <Screen title="Learn" tabs>
      <div className="row gap-s" style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
        {TABS.map(([id, label]) => <button key={id} className={`chip ${t === id ? 'on' : ''}`} onClick={() => setQ({ t: id }, { replace: true })}>{label}</button>)}
      </div>
      <p className="small muted">Every lesson is open. Suggestions follow what you have actually mastered — never the calendar.</p>

      {t === 'kana' && <>
        <Link to="/kana" className="card sage row"><span className="tile green jp" lang="ja">あ</span><div className="grow"><h3>Kana chart</h3><p className="small muted">All hiragana and katakana with sound</p></div><Icon n="next" /></Link>
        {KANA_LESSONS.map((l, i) => <Row key={l.id} l={l} n={i + 1} />)}
      </>}

      {t === 'jlpt' && <>
        <h2>N5 — foundations</h2>
        {JLPT_LESSONS.filter(l => l.level === 'N5').map((l, i) => <Row key={l.id} l={l} n={i + 1} />)}
        <h2 className="mt">N4 — first steps</h2>
        {JLPT_LESSONS.filter(l => l.level === 'N4').map((l, i) => <Row key={l.id} l={l} n={i + 1} />)}
        <Wip><b>N4 is only started, and {UPCOMING_LEVELS.join(', ')} lessons are not written yet.</b> The app is built to hold them — lessons are plain content files — but they still need to be authored and checked. Nothing here is hidden behind a lock; it simply does not exist yet.</Wip>
      </>}

      {t === 'practical' && <>
        <p className="small muted">Situations you will meet in Japan. Each has key phrases, a scene to read, and a short dialogue.</p>
        {PRACTICAL_LESSONS.map((l, i) => <Row key={l.id} l={l} n={i + 1} />)}
      </>}

      {t === 'library' && <>
        <Link to="/kanji" className="card row"><span className="tile sakura jp" lang="ja">漢</span><div className="grow"><h3>Kanji</h3><p className="small muted">{KANJI.length} N5 kanji with readings and words</p></div><Icon n="next" /></Link>
        <Link to="/vocab" className="card row"><span className="tile jp" lang="ja">語</span><div className="grow"><h3>Vocabulary</h3><p className="small muted">{PACKS.length} topic packs plus every lesson word</p></div><Icon n="next" /></Link>
        <Link to="/reading" className="card row"><span className="tile amber jp" lang="ja">読</span><div className="grow"><h3>Reading</h3><p className="small muted">{PASSAGES.length} short real-world texts with questions</p></div><Icon n="next" /></Link>
        <Link to="/kana" className="card row"><span className="tile green jp" lang="ja">あ</span><div className="grow"><h3>Kana chart</h3><p className="small muted">Hiragana and katakana reference</p></div><Icon n="next" /></Link>
      </>}
    </Screen>
  );
}
