// Manga-style story pages and character badges. Panels are drawn by the app
// (screentone, speech bubbles); characters appear as name badges, not artwork.
import { useState } from 'react';
import { CAST } from '../content/cast';
import type { Story } from '../content/stories';
import { parseFuri, romajiOf } from '../lib/jp';
import { speak, sayAs } from '../services/tts';
import { Furi, Icon, useS } from './ui';
import { Portrait } from './Portrait';

export function Badge({ id, size = 40 }: { id: string; size?: number }) {
  const c = CAST[id];
  if (!c) {
    const label = id === 'you' ? 'You' : id.replace(/^role:/, '');
    return <span className="badge-av" style={{ width: size, height: size, background: id === 'you' ? 'var(--forest)' : '#8a8f88', fontSize: size * 0.3 }} aria-label={label}>{label.slice(0, 3)}</span>;
  }
  return <span className="badge-av" title={`${c.name} (${c.series})`} style={{ width: size, height: size, background: c.color, fontSize: size * 0.46 }} lang="ja">{c.mark}</span>;
}
export const nameOf = (id: string) => CAST[id]?.name ?? (id === 'you' ? 'You' : id.replace(/^role:/, ''));

export function MangaPage({ story }: { story: Story }) {
  const s = useS();
  const [vertical, setVertical] = useState(false);
  const [en, setEn] = useState(true);
  return (
    <div className="col gap-s">
      <div className="row between">
        <span className="label">Story · {story.title}</span>
        <div className="row gap-s">
          <button className={`chip ${vertical ? 'on' : ''}`} onClick={() => setVertical(!vertical)} aria-pressed={vertical} lang="ja">縦書き</button>
          <button className={`chip ${en ? 'on' : ''}`} onClick={() => setEn(!en)} aria-pressed={en}>Reading + meaning</button>
        </div>
      </div>
      <div className={`manga ${vertical ? 'vert' : ''}`}>
        {story.panels.map((p, i) => {
          const c = CAST[p.who];
          return (
            <button key={i} className={`panel ${p.size ?? 'normal'} tone-${i % 3} ${p.mood ?? ''}`} onClick={() => (CAST[p.who] ? sayAs(p.who, parseFuri(p.f).jp, s.rate) : speak(parseFuri(p.f).jp, { rate: s.rate }))} aria-label={`${nameOf(p.who)} says: ${parseFuri(p.f).jp}`}>
              {p.mood === 'oops' && <span className="fx" lang="ja">！？</span>}
              {p.mood === 'fix' && <span className="fx fix" lang="ja">ビシッ</span>}
              <span className="who">{c ? <Portrait id={p.who} mood={p.mood === 'oops' ? 'oops' : p.mood === 'ok' && c.role === 'guide' ? 'happy' : 'teach'} size={i === 0 ? 72 : 56} shape="card" fx={false} /> : <Badge id={p.who} size={40} />}<span className="tiny" style={{ fontWeight: 600 }}>{c ? c.name.split(' ')[0] : nameOf(p.who)}</span></span>
              <span className="bubble-m"><Furi f={p.f} className="jp-m" romaji={false} /></span>
              {en && <span className="gloss"><span lang="ja" className="jp">{parseFuri(p.f).kana}</span><span className="romaji">{romajiOf(p.f)}</span><span>{p.en}</span></span>}
            </button>
          );
        })}
      </div>
      <p className="tiny muted center"><Icon n="sound" s={12} /> Tap a panel to hear it. {vertical ? 'Vertical manga reads top-to-bottom, right-to-left.' : ''}</p>
    </div>
  );
}
