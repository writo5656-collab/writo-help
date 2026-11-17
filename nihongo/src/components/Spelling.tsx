// "How to spell it": the target broken into kana tiles with romaji above,
// like word tiles — so you know which keys to press.
import { parseFuri, kanaToRomaji } from '../lib/jp';

export function SpellingGuide({ f, typed = '' }: { f: string; typed?: string }) {
  const chunks = parseFuri(f).chunks.map(c => ({ kana: c.kana.replace(/[。、？！]/g, ''), jp: c.jp.replace(/[。、？！]/g, '') })).filter(c => c.kana);
  const plainTyped = typed.replace(/\s/g, '');
  let pos = 0;
  return (
    <div className="spell" aria-label="How to spell it">
      <span className="tiny muted" style={{ width: '100%' }}>How to spell it — type the kana, then pick the kanji from the suggestions</span>
      {chunks.map((c, i) => {
        const done = plainTyped.startsWith(c.jp, pos) || plainTyped.startsWith(c.kana, pos);
        if (done) pos += plainTyped.startsWith(c.jp, pos) ? c.jp.length : c.kana.length;
        return (
          <span key={i} className={`stile ${done ? 'done' : ''}`}>
            <small>{kanaToRomaji(c.kana)}</small>
            <b lang="ja">{c.kana}</b>
            {c.jp !== c.kana && <i lang="ja">{c.jp}</i>}
          </span>
        );
      })}
    </div>
  );
}
