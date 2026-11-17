// Japanese with romaji over each word (like word tiles), plus furigana on kanji.
import { parseFuri, romajiOf } from '../lib/jp';
import { useS } from './ui';

export function WordRomaji({ f }: { f: string }) {
  const s = useS();
  const p = parseFuri(f);
  return (
    <span className="wr" lang="ja">
      {p.chunks.map((c, i) => {
        const raw = c.segs.map(x => (x.reading ? `${x.text}[${x.reading}]` : x.text)).join('');
        return (
          <span key={i} className="wr-c">
            <small>{romajiOf(raw)}</small>
            <span>{c.segs.map((sg, j) => sg.reading && s.showFurigana ? <ruby key={j}>{sg.text}<rt>{sg.reading}</rt></ruby> : <span key={j}>{sg.text}</span>)}</span>
          </span>
        );
      })}
    </span>
  );
}
