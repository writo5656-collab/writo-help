// Grammar library, N5–N1. N5/N4 points come from the lessons; N3–N1 from the reference list.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { GRAMMAR } from '../content/grammar';
import { LESSONS } from '../content';
import { useItems } from '../lib/hooks';
import { isKnown } from '../lib/srs';
import { parseFuri } from '../lib/jp';
import { Screen, Furi, SpeakBtn, Bar, Icon } from '../components/ui';

export default function Grammar() {
  const [q, setQ] = useSearchParams();
  const lvl = Number(q.get('lvl') ?? 3);
  const { map } = useItems();
  const [open, setOpen] = useState('');
  const lessonPoints = LESSONS.filter(l => l.level === `N${lvl}`).flatMap(l => l.grammar.map(g => ({ ...g, lesson: l })));
  const ref = GRAMMAR.filter(g => g.lvl === lvl);
  const known = ref.filter(g => isKnown(map.get(`gram:${g.p}`))).length;
  return (
    <Screen back title="Grammar library">
      <div className="row gap-s" style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
        {[5, 4, 3, 2, 1].map(l => <button key={l} className={`chip ${lvl === l ? 'on' : ''}`} onClick={() => setQ({ lvl: String(l) }, { replace: true })}>N{l}</button>)}
      </div>
      {ref.length > 0 && (
        <div className="card green row">
          <div className="grow"><h3>JLPT N{lvl} grammar</h3><p className="small muted"><span className="num">{known}</span> of <span className="num">{ref.length}</span> patterns known</p><div className="mt"><Bar pct={(known / ref.length) * 100} /></div></div>
          <Link className="btn sm cream" to={`/session?m=grammar&lvl=${lvl}`}>Practise 8</Link>
        </div>
      )}
      {lessonPoints.length > 0 && <p className="small muted">N{lvl} grammar is taught inside the lessons. Tap one to open its lesson.</p>}
      <div className="col gap-s">
        {lessonPoints.map((g, i) => (
          <Link key={i} to={`/lesson/${g.lesson.id}`} className="card flat col gap-s">
            <div className="row between"><b className="jp" lang="ja">{g.p}</b><span className="badge plain">{g.lesson.title}</span></div>
            <span className="small">{g.e}</span>
          </Link>
        ))}
        {ref.map(g => (
          <div key={g.p} className="card flat col gap-s">
            <button className="row between" style={{ textAlign: 'left', width: '100%', minHeight: 40 }} onClick={() => setOpen(open === g.p ? '' : g.p)} aria-expanded={open === g.p}>
              <span><b className="jp" lang="ja">{g.p}</b><span className="small muted"> — {g.m}</span></span>
              {isKnown(map.get(`gram:${g.p}`)) ? <span className="badge">known</span> : <Icon n={open === g.p ? 'close' : 'next'} s={16} />}
            </button>
            {open === g.p && (
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div><Furi f={g.f} className="jp-m" /><div className="small muted">{g.en}</div></div>
                <SpeakBtn text={parseFuri(g.f).jp} />
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="tiny muted">Patterns follow the commonly published JLPT grammar lists; example sentences are original. Have a fluent speaker spot-check them over time.</p>
    </Screen>
  );
}
