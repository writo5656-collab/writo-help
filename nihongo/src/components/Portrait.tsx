// A character's picture with reaction effects (bounce, sparkles, shake, sweat drop, talking).
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { CAST } from '../content/cast';
import { pick, type Mood } from '../services/portraits';
import { useS } from './ui';
import { Badge } from './Manga';

export function usePortrait(id: string, mood: Mood = 'teach') {
  const s = useS();
  const rec = useLiveQuery(() => db.portraits.get(id), [id]);
  if (!s.pictures && !rec?.custom) return undefined;
  return pick(rec, id, mood);
}

export function Portrait({ id, mood = 'teach', size = 64, shape = 'round', talking = false, fx = true, className = '' }: {
  id: string; mood?: Mood; size?: number | string; shape?: 'round' | 'card' | 'full'; talking?: boolean; fx?: boolean; className?: string;
}) {
  const c = CAST[id];
  const src = usePortrait(id, mood);
  if (!c) return <Badge id={id} size={typeof size === 'number' ? size : 64} />;
  const style = { width: size, height: shape === 'card' ? (typeof size === 'number' ? size * 1.35 : size) : size, ['--c' as string]: c.color };
  return (
    <span className={`portrait ${shape} mood-${mood} ${talking ? 'talking' : ''} ${className}`} style={style}>
      {src ? <img src={src} alt={c.name} loading="lazy" draggable={false} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        : <span className="pf" lang="ja">{c.mark}</span>}
      {fx && mood === 'happy' && <span className="mfx spark" aria-hidden="true">✦</span>}
      {fx && mood === 'happy' && <span className="mfx spark s2" aria-hidden="true">✧</span>}
      {fx && mood === 'oops' && <span className="mfx sweat" aria-hidden="true" />}
      {fx && mood === 'oops' && <span className="mfx lines" aria-hidden="true" />}
    </span>
  );
}
