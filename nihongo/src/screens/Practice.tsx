import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { usePlan } from '../lib/hooks';
import { db } from '../lib/db';
import { Screen, Icon } from '../components/ui';

const DRILLS: [string, string, string, string][] = [
  ['translate', 'pen', 'English → Japanese', 'Type full sentences on notebook paper'],
  ['meaning', 'eye', 'Japanese → English', 'Read a sentence and choose its meaning'],
  ['particles', 'star', 'Particles', 'Fill in は, を, に, で and friends'],
  ['arrange', 'shuffle', 'Sentence building', 'Put the parts in the right order'],
  ['listening', 'ear', 'Listening', 'Hear a sentence and write it down'],
  ['speaking', 'mic', 'Read aloud', 'Say sentences and check they are understood'],
  ['vocab', 'book', 'Vocabulary', 'Words from lessons you have started'],
  ['kanji', 'flag', 'Kanji', 'Meanings and readings'],
];

export default function Practice() {
  const { plan } = usePlan();
  const mistakes = useLiveQuery(() => db.mistakes.where('status').notEqual('remembered').count(), []) ?? 0;
  return (
    <Screen title="Practice" tabs>
      <h2>Review</h2>
      <Link to="/session?m=review" className="card green row">
        <span className="tile" style={{ background: 'rgba(255,255,255,.14)', color: 'var(--cream)' }}><Icon n="retry" /></span>
        <div className="grow"><h3>Spaced review</h3><p className="small muted">{plan?.due ? `${plan.due} item${plan.due === 1 ? '' : 's'} due — weakest first` : 'Nothing due right now'}</p></div><Icon n="next" />
      </Link>
      <div className="row">
        <Link to="/mistakes" className="card grow col gap-s"><span className="tile amber"><Icon n="bulb" /></span><h3>Mistake Notebook</h3><p className="small muted">{mistakes ? `${mistakes} to revisit` : 'Nothing open'}</p></Link>
        <Link to="/sunday" className="card grow col gap-s"><span className="tile sakura"><Icon n="calendar" /></span><h3>Sunday review</h3><p className="small muted">{plan?.sundayPending ? 'Ready when you are' : 'Cumulative weekly look-back'}</p></Link>
      </div>
      <h2 className="mt">Drills</h2>
      <p className="small muted">Unlimited, any time. Drills use the lessons you have started.</p>
      <div className="card flat list" style={{ padding: '4px 16px' }}>
        {DRILLS.map(([type, icon, title, sub]) => (
          <Link key={type} to={`/session?m=drill&type=${type}`} className="li"><span className="tile"><Icon n={icon} /></span><span className="grow"><span style={{ fontWeight: 700, display: 'block' }}>{title}</span><span className="small muted">{sub}</span></span><Icon n="next" s={18} /></Link>
        ))}
        <Link to="/reading" className="li"><span className="tile"><Icon n="note" /></span><span className="grow"><span style={{ fontWeight: 700, display: 'block' }}>Reading comprehension</span><span className="small muted">Short real-world texts with questions</span></span><Icon n="next" s={18} /></Link>
      </div>
    </Screen>
  );
}
