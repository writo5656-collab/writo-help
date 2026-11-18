// "Read real Japan": real photos of signs and menus. Today's teacher asks you
// to read each one for her. Photos you have read least come first.
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { REAL_PHOTOS, type RealPhoto } from '../content/realPhotos';
import { dailyCast } from '../content/cast';
import { getKV, setKV } from '../lib/db';
import { markBlock } from '../lib/hooks';
import { sttAvailable } from '../services/stt';
import { PhotoAsk } from '../components/PhotoAsk';
import { Screen, Icon, useAsync } from '../components/ui';

const GOAL = 4;

/** Least-practised photos first (ties shuffled), so every session is different. */
export async function nextPhotos(n: number): Promise<RealPhoto[]> {
  const seen = await getKV<Record<string, number>>('photosSeen', {});
  return [...REAL_PHOTOS].map(p => ({ p, k: (seen[p.id] ?? 0) + Math.random() * 0.9 })).sort((a, b) => a.k - b.k).slice(0, n).map(x => x.p);
}
export async function markPhotoSeen(id: string, ok: boolean) {
  const seen = await getKV<Record<string, number>>('photosSeen', {});
  await setKV('photosSeen', { ...seen, [id]: (seen[id] ?? 0) + (ok ? 1 : 0.5) });
}

export default function ReadJapan() {
  const nav = useNavigate();
  const [q] = useSearchParams();
  const plan = q.get('plan') === '1';
  const mic = useAsync(sttAvailable, []);
  const [list, setList] = useState<RealPhoto[] | null>(null);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [batch, setBatch] = useState(0); // index where this round of GOAL photos started
  const guide = dailyCast().guide;
  useEffect(() => { void nextPhotos(REAL_PHOTOS.length).then(setList); }, []);
  useEffect(() => { if (plan && i >= GOAL) void markBlock('real'); }, [i, plan]);
  if (!list || mic === undefined) return null;
  const done = i >= list.length || i - batch >= GOAL;

  return (
    <Screen back={plan ? '/plan' : true} title="Read real Japan" right={<span className="badge plain num">{Math.min(i + 1, list.length)} / {list.length}</span>}>
      {!done ? (
        <PhotoAsk key={list[i].id} photo={list[i]} who={guide} mic={!!mic} onDone={ok => { void markPhotoSeen(list[i].id, ok); if (ok) setRight(r => r + 1); setI(i + 1); }} />
      ) : (
        <div className="card col gap-s center" style={{ alignItems: 'center', textAlign: 'center' }}>
          <h2 style={{ margin: 0 }}>🇯🇵 {right} of {i} read on the first try</h2>
          <p className="muted small">These are real photos taken in Japan — the same signs you will see on the street.</p>
          {i < list.length && <button className="btn" onClick={() => setBatch(i)}>Read {Math.min(GOAL, list.length - i)} more<Icon n="next" s={18} /></button>}
          <button className="btn line" onClick={() => (plan ? nav('/plan') : nav(-1))}>{plan ? 'Back to today\'s plan' : 'Done'}</button>
        </div>
      )}
    </Screen>
  );
}
