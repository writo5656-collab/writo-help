// Downloads every teacher's picture before you enter the app, with progress.
import { useEffect, useState } from 'react';
import { CAST } from '../content/cast';
import { syncPortraits, picturesReady } from '../services/portraits';
import { Portrait } from './Portrait';
import { Bar, Icon } from './ui';

export function PictureDownload({ onDone, compact = false }: { onDone: () => void; compact?: boolean }) {
  const [p, setP] = useState({ have: 0, total: Object.keys(CAST).length });
  const [state, setState] = useState<'working' | 'failed' | 'done'>('working');
  const run = async () => {
    setState('working');
    try {
      await syncPortraits(true, () => { void picturesReady().then(setP); });
      const r = await picturesReady(); setP(r);
      if (r.have >= r.total) { setState('done'); setTimeout(onDone, 700); } else setState('failed');
    } catch { setState('failed'); }
  };
  useEffect(() => { void run(); }, []); // eslint-disable-line
  return (
    <div className="col gap-l" style={{ alignItems: 'stretch' }}>
      {!compact && <div className="col center" style={{ alignItems: 'center' }}><h1>Meet your teachers</h1><p className="muted small" style={{ maxWidth: 320 }}>Downloading everyone's picture once, so lessons, reactions and calls look right — even offline later.</p></div>}
      <div className="pick-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {Object.values(CAST).map(c => <Portrait key={c.id} id={c.id} size={54} fx={false} />)}
      </div>
      <div className="col gap-s">
        <Bar pct={(p.have / Math.max(1, p.total)) * 100} />
        <p className="small center num">{state === 'done' ? 'All set!' : `${p.have} of ${p.total} pictures`}</p>
      </div>
      {state === 'failed' && <>
        <div className="card sakura small">Some pictures couldn't be downloaded. Check that you're connected to the internet, then try again.</div>
        <button className="btn" onClick={run}><Icon n="retry" s={18} />Try again</button>
        <button className="btn line" onClick={onDone}>Continue without them for now</button>
      </>}
    </div>
  );
}

/** Shown once at launch if pictures are missing; steps aside when offline. */
export function PictureGate({ children }: { children: React.ReactNode }) {
  const [need, setNeed] = useState<boolean | null>(null);
  useEffect(() => { void picturesReady().then(r => setNeed(r.have < r.total && navigator.onLine !== false)); }, []);
  if (need === null) return null;
  if (!need) return <>{children}</>;
  return <main className="screen no-tabs" style={{ justifyContent: 'center' }}><PictureDownload onDone={() => setNeed(false)} /></main>;
}
