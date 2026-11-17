// A lesson is a short stack of teaching cards followed by practice.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LESSON_MAP, KANJI_MAP, kanaRomaji, type Lesson as L, type Sent } from '../content';
import { parseFuri } from '../lib/jp';
import { getKV, setKV } from '../lib/db';
import { speak } from '../services/tts';
import { sfx } from '../services/sfx';
import { StrokeOrder } from '../components/Strokes';
import { storyFor } from '../content/stories';
import { LESSON_CAST, CAST } from '../content/cast';
import { MangaPage } from '../components/Manga';
import { Portrait } from '../components/Portrait';
import { Screen, Icon, Furi, Audio, SpeakBtn, Bar, useS, Empty } from '../components/ui';

type Card =
  | { t: 'intro' } | { t: 'kana'; ch: string } | { t: 'grammar' } | { t: 'sent'; s: Sent; i: number }
  | { t: 'scene' } | { t: 'dialogue' } | { t: 'story' } | { t: 'end' };

export default function Lesson() {
  const { id } = useParams();
  const l = LESSON_MAP.get(id ?? '');
  const cards = useMemo<Card[]>(() => !l ? [] : [
    { t: 'intro' },
    ...(l.kana ?? []).map(ch => ({ t: 'kana' as const, ch })),
    ...(l.grammar.length ? [{ t: 'grammar' as const }] : []),
    ...l.sentences.map((s, i) => ({ t: 'sent' as const, s, i })),
    ...(l.scene ? [{ t: 'scene' as const }] : []),
    ...(l.dialogue ? [{ t: 'dialogue' as const }] : []),
    ...(storyFor(l) ? [{ t: 'story' as const }] : []),
    { t: 'end' },
  ], [l]);
  const [i, setI] = useState(0);
  useEffect(() => { if (l) void getKV<Record<string, number>>('lessonPos', {}).then(p => setI(Math.min(p[l.id] ?? 0, cards.length - 1))); }, [l]); // eslint-disable-line
  if (!l) return <Screen back title="Lesson"><Empty title="Lesson not found" mood="think" /></Screen>;
  const go = (n: number) => { sfx.flip(); const v = Math.max(0, Math.min(cards.length - 1, n)); setI(v); window.scrollTo(0, 0); void getKV<Record<string, number>>('lessonPos', {}).then(p => setKV('lessonPos', { ...p, [l.id]: v })); };
  const c = cards[i];

  return (
    <Screen back="/learn" title={l.title} right={<span className="badge plain">{l.level === 'Kana' ? 'Kana' : l.track === 'practical' ? 'Real life' : l.level}</span>}>
      <Bar pct={((i + 1) / cards.length) * 100} />
      <div className="col grow" key={i} style={{ animation: 'rise .25s ease both' }}>
        {c.t === 'intro' && <Intro l={l} />}
        {c.t === 'kana' && <KanaCard ch={c.ch} l={l} />}
        {c.t === 'grammar' && <GrammarCard l={l} />}
        {c.t === 'sent' && <SentCard s={c.s} l={l} n={c.i + 1} />}
        {c.t === 'scene' && <SceneCard l={l} />}
        {c.t === 'dialogue' && <DialogueCard l={l} />}
        {c.t === 'story' && <><MangaPage story={storyFor(l)!} /><p className="small muted">Read it carefully — the practice starts with a question about who was right.</p></>}
        {c.t === 'end' && <EndCard l={l} />}
      </div>
      <div className="dock">
        <div className="row">
          <button className="btn ghost" disabled={i === 0} onClick={() => go(i - 1)}><Icon n="back" s={18} />Previous</button>
          {c.t === 'end'
            ? <Link className="btn" to={`/session?m=lesson&id=${l.id}`} onClick={() => go(0)}>Start practice<Icon n="next" s={18} /></Link>
            : <button className="btn" onClick={() => go(i + 1)}>Next<Icon n="next" s={18} /></button>}
        </div>
      </div>
    </Screen>
  );
}

function Intro({ l }: { l: L }) {
  const lc = LESSON_CAST[l.id]; const g = lc && CAST[lc.guide];
  return (
    <>
      {g && (
        <div className="card row" style={{ alignItems: 'flex-start' }}>
          <Portrait id={g.id} size={92} shape="card" />
          <div className="grow col" style={{ gap: 4 }}>
            <span className="label">Your guide · {g.series}</span>
            <b>{g.name}</b>
            <Furi f={lc.intro[0]} className="jp-m" romaji={false} />
            <span className="small muted">{lc.intro[1]}</span>
          </div>
          <SpeakBtn text={parseFuri(lc.intro[0]).jp} />
        </div>
      )}
      <div className="card sage col gap-s"><span className="label">In this lesson</span><p style={{ fontWeight: 650 }}>{l.goal}</p><span className="jp-l jp" lang="ja" style={{ color: 'var(--forest)' }}>{l.jp}</span></div>
      {l.kanji && <div className="card flat col gap-s"><h3>Kanji you will meet</h3><div className="row wrap gap-s">{[...l.kanji].filter(k => KANJI_MAP.has(k)).map(k => <Link key={k} to={`/kanji?k=${k}`} className="tile jp" lang="ja">{k}</Link>)}</div></div>}
      <div className="card flat">
        <h3>{l.kana ? 'Words you will be able to read' : 'Vocabulary'}</h3>
        <div className="list mt">
          {l.vocab.map(w => (
            <div key={w.jp} className="li">
              <div className="grow"><span className="jp jp-m" lang="ja" style={{ fontWeight: 600 }}>{w.jp}</span>{w.kana !== w.jp && <span className="small muted jp" lang="ja"> （{w.kana}）</span>}<div className="small muted">{w.en}</div></div>
              <SpeakBtn text={w.jp} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function KanaCard({ ch, l }: { ch: string; l: L }) {
  const s = useS();
  useEffect(() => { if (s.autoplay) void speak(ch, { rate: s.rate }); }, [ch]); // eslint-disable-line
  const words = l.vocab.filter(w => w.jp.includes(ch)).slice(0, 3);
  return (
    <>
      <div className="card col center" style={{ alignItems: 'center', padding: '28px 16px' }}>
        <StrokeOrder ch={ch} size={190} />
        <span style={{ fontSize: '1.6rem', fontWeight: 750, color: 'var(--forest)' }}>{kanaRomaji(ch)}</span>
        <button className="btn sm ghost" onClick={() => speak(ch, { rate: s.rate })}><Icon n="sound" s={18} />Hear it</button>
      </div>
      {words.length > 0 && <div className="card flat"><h3>Seen in</h3><div className="list mt">{words.map(w => <div key={w.jp} className="li"><div className="grow"><span className="jp jp-m" lang="ja" style={{ fontWeight: 600 }}>{w.jp}</span><span className="romaji"> {parseRomaji(w.kana)}</span><div className="small muted">{w.en}</div></div><SpeakBtn text={w.jp} /></div>)}</div></div>}
      <Link to="/handwriting" state={{ ch }} className="btn line"><Icon n="draw" s={18} />Practise writing {ch} by hand</Link>
    </>
  );
}
const parseRomaji = (k: string) => [...k].map(c => kanaRomaji(c) || c).join('');

function GrammarCard({ l }: { l: L }) {
  return <>{l.grammar.map((g, i) => (
    <div key={i} className="card col gap-s">
      <div className="row gap-s"><span className="tile amber"><Icon n="bulb" /></span><h2 className="jp" lang="ja">{g.p}</h2></div>
      <p>{g.e}</p>
    </div>
  ))}</>;
}

function SentCard({ s, l, n }: { s: Sent; l: L; n: number }) {
  const [hot, setHot] = useState(-1);
  const p = parseFuri(s.f);
  const words = l.vocab.filter(w => p.jp.includes(w.jp.replace(/ます$/, '')) && w.jp.length > 0).slice(0, 5);
  return (
    <>
      <div className="card col">
        <span className="label">Sentence {n} of {l.sentences.length}</span>
        <Furi f={s.f} className="jp-xl" hot={hot} />
        <div className="card sage" style={{ padding: '10px 14px', fontWeight: 650 }}>{s.en}</div>
        <div className="row between"><span className="small muted">Listen · slower · word by word</span><Audio f={s.f} autoplay onChunk={setHot} /></div>
      </div>
      {words.length > 0 && <div className="card flat"><div className="row gap-s"><Icon n="book" s={18} /><h3>Vocabulary</h3></div><div className="col gap-s mt">{words.map(w => <div key={w.jp} className="small"><span className="jp" lang="ja" style={{ fontWeight: 600 }}>{w.jp}</span>{w.kana !== w.jp && <span className="muted jp" lang="ja">（{w.kana}）</span>} — {w.en}</div>)}</div></div>}
      {(s.note || l.grammar[0]) && <div className="card amber note-tip"><Icon n="bulb" s={18} /><div><b>Grammar note</b><br />{s.note ?? <><span className="jp" lang="ja">{l.grammar[0].p}</span> — {l.grammar[0].e}</>}</div></div>}
    </>
  );
}

function SceneCard({ l }: { l: L }) {
  const sc = l.scene!;
  const [sel, setSel] = useState(0);
  const it = sc.items[sel];
  return (
    <>
      <div className={`scene kind-${sc.kind}`}>
        <div className="row between"><span className="small" style={{ opacity: .8 }}>{sc.place}</span><span className="badge" style={{ background: 'rgba(255,255,255,.16)', color: 'var(--cream)' }}>{sc.title}</span></div>
        {sc.items.map((x, i) => <button key={i} className={`sign look-${x.look ?? ({ sign: 'white', menu: 'board', screen: 'screen', desk: 'plate' } as const)[sc.kind]} ${i === sel ? 'on' : ''}`} onClick={() => { sfx.tap(); setSel(i); }}><Furi f={x.f} className="jp-l" furigana={i === sel} romaji={false} /></button>)}
        <span className="tiny" style={{ opacity: .75 }}>Tap a sign to read it. These are drawn in the style of real Japanese signs; they are not photographs.</span>
      </div>
      <div className="card col gap-s">
        <div className="row between"><Furi f={it.f} className="jp-l" /><Audio f={it.f} compact /></div>
        <div><span className="label">It means</span><p style={{ fontWeight: 650 }}>{it.en}</p></div>
        <div><span className="label">What to do</span><p>{it.action}</p></div>
      </div>
    </>
  );
}

function DialogueCard({ l }: { l: L }) {
  const s = useS();
  const [show, setShow] = useState(false);
  const playAll = async () => { for (const d of l.dialogue!) await speak(parseFuri(d.f).jp, { rate: s.rate }); };
  return (
    <>
      <div className="row between"><h2>Dialogue</h2><div className="row gap-s"><button className="btn sm ghost" onClick={playAll}><Icon n="play" s={16} />Play all</button><button className="btn sm line" onClick={() => setShow(!show)}>{show ? 'Hide' : 'Show'} English</button></div></div>
      <div className="col">
        {l.dialogue!.map((d, i) => (
          <button key={i} className={`bubble ${d.who === 'You' ? 'me' : 'them'}`} style={{ textAlign: 'left' }} onClick={() => speak(parseFuri(d.f).jp, { rate: s.rate })}>
            <span className="tiny" style={{ opacity: .7, fontWeight: 700 }}>{d.who}</span><br />
            <Furi f={d.f} className="jp-m" />
            {show && <div className="small" style={{ opacity: .8 }}>{d.en}</div>}
          </button>
        ))}
      </div>
      <p className="tiny muted center">Tap a line to hear it.</p>
    </>
  );
}

function EndCard({ l }: { l: L }) {
  return (
    <div className="card sage col center" style={{ alignItems: 'center', padding: '26px 16px' }}>
      <span className="tile green"><Icon n="pen" /></span>
      <h2>Ready to practise</h2>
      <p className="small muted" style={{ maxWidth: 300 }}>{l.kana ? 'Recognise each character, then read and write real words.' : 'Meaning, particles, sentence building, then writing full sentences in your notebook and a little listening.'} Take as many tries as you like.</p>
    </div>
  );
}
