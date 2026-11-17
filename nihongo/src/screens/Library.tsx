// Reference screens: kana chart, kanji, vocabulary packs, reading passages.
import { useEffect, useState } from 'react';
import { LIB, loadLibrary, libKanjiAsKanji, type Library } from '../content/library';
import { Link, useSearchParams } from 'react-router-dom';
import { useItems } from '../lib/hooks';
import { isKnown } from '../lib/srs';
import { ROWS, YOON, KANJI, KANJI_MAP, PACKS, PASSAGES, kanaId, kanjiId, vocabId, LESSONS } from '../content';
import { speak } from '../services/tts';
import { Screen, Icon, Furi, SpeakBtn, useS, Bar } from '../components/ui';
import { StrokeOrder } from '../components/Strokes';

export function KanaChart() {
  const s = useS();
  const { map } = useItems();
  const [script, setScript] = useState<'hira' | 'kata'>('hira');
  const cell = (ch: string, ro: string) => {
    const it = map.get(kanaId(ch));
    return <button key={ch} className={`kana-cell ${isKnown(it) ? 'known' : it && (it.status === 'forgotten' || it.status === 'uncertain') ? 'weak' : ''}`} lang="ja" onClick={() => speak(ch, { rate: s.rate })}>{ch}<small>{ro}</small></button>;
  };
  return (
    <Screen back title="Kana chart">
      <div className="row between">
        <div className="seg"><button className={script === 'hira' ? 'on' : ''} onClick={() => setScript('hira')}>Hiragana</button><button className={script === 'kata' ? 'on' : ''} onClick={() => setScript('kata')}>Katakana</button></div>
        <Link className="btn sm" to={`/session?m=drill&type=${script === 'hira' ? 'hiragana' : 'katakana'}`}>Quiz me</Link>
      </div>
      <p className="small muted">Tap a character to hear it. Green = known, pink = needs review.</p>
      <div className="kana-grid">
        {ROWS.flatMap(r => {
          const chars = script === 'hira' ? r.hira : r.kata;
          const cells = chars.map((c, i) => cell(c, r.romaji[i]));
          if (chars.length === 3 && r.romaji[0] === 'ya') return [cells[0], <span key="y1" />, cells[1], <span key="y2" />, cells[2]];
          if (chars.length === 3) return [cells[0], <span key="w1" />, <span key="w2" />, <span key="w3" />, cells[1], cells[2], <span key="w4" />, <span key="w5" />, <span key="w6" />, <span key="w7" />];
          return cells;
        })}
      </div>
      <h2 className="mt">Blended sounds</h2>
      <div className="kana-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {YOON.map(([ro, h, k]) => { const ch = script === 'hira' ? h : k; return <button key={ch} className="kana-cell" style={{ aspectRatio: '2' }} lang="ja" onClick={() => speak(ch, { rate: s.rate })}>{ch}<small>{ro}</small></button>; })}
      </div>
      <Link to="/handwriting" className="btn line"><Icon n="draw" s={18} />Handwriting practice</Link>
    </Screen>
  );
}

const LEVELS = [5, 4, 3, 2, 1];
function useLib() { const [lib, setLib] = useState<Library | null>(LIB); useEffect(() => { if (!lib) void loadLibrary().then(setLib); }, []); return lib; } // eslint-disable-line
function LevelTabs({ value, onChange, extra }: { value: string; onChange: (v: string) => void; extra?: string }) {
  return (
    <div className="row gap-s" style={{ overflowX: 'auto', margin: '0 -16px', padding: '0 16px 2px' }}>
      {extra && <button className={`chip ${value === 'lessons' ? 'on' : ''}`} onClick={() => onChange('lessons')}>{extra}</button>}
      {LEVELS.map(l => <button key={l} className={`chip ${value === String(l) ? 'on' : ''}`} onClick={() => onChange(String(l))}>N{l}</button>)}
    </div>
  );
}

export function KanjiList() {
  const [q, setQ] = useSearchParams();
  const { map } = useItems();
  const lib = useLib();
  const [lvl, setLvl] = useState(q.get('lvl') ?? '5');
  const [limit, setLimit] = useState(150);
  const k = q.get('k') ?? '';
  const n5 = KANJI_MAP.get(k);
  const lk = lib?.kanjiMap.get(k);
  const sel = n5 ?? (lk && lib ? libKanjiAsKanji(lk, lib) : undefined);
  if (k && sel) return (
    <Screen back title="Kanji">
      <div className="card col center" style={{ alignItems: 'center' }}>
        <StrokeOrder ch={sel.k} size={190} />
        <h2>{sel.en}</h2>
        <div className="row wrap gap-s" style={{ justifyContent: 'center' }}>
          <span className="badge plain">{sel.level}</span>
          {sel.on && <span className="badge amber">On: <span lang="ja" className="jp">{sel.on}</span></span>}
          {sel.kun && <span className="badge">Kun: <span lang="ja" className="jp">{sel.kun}</span></span>}
        </div>
      </div>
      {sel.words.length > 0 && <div className="card flat"><h3>Words</h3><div className="list mt">{sel.words.map(w => <div key={w.f} className="li"><div className="grow"><Furi f={w.f} className="jp-l" furigana /><div className="small muted">{w.en}</div></div><SpeakBtn text={w.f.replace(/\[[^\]]+\]/g, '')} /></div>)}</div></div>}
      <p className="small muted">On-readings (katakana) came from Chinese and appear mostly in compound words. Kun-readings (hiragana) are native Japanese.</p>
      <div className="row"><Link className="btn line" to="/handwriting" state={{ ch: sel.k }}><Icon n="draw" s={18} />Write it</Link><Link className="btn" to={`/session?m=kanji&set=${sel.k}`}>Quiz this kanji</Link></div>
    </Screen>
  );
  const list = lib ? lib.kanji.filter(x => x.lvl === Number(lvl)) : [];
  const known = list.filter(x => isKnown(map.get(kanjiId(x.k)))).length;
  return (
    <Screen back title="Kanji library">
      <LevelTabs value={lvl} onChange={v => { setLvl(v); setLimit(150); }} />
      {!lib ? <p className="muted">Loading the library…</p> : <>
        <div className="row between"><p className="small muted grow"><b className="num">{known}</b> of <b className="num">{list.length}</b> N{lvl} kanji known. Tap one for readings, words and stroke order.</p><Link className="btn sm" to={`/session?m=lib&kind=kanji&lvl=${lvl}`}>Learn next</Link></div>
        <div className="kana-grid">
          {list.slice(0, limit).map(x => { const it = map.get(kanjiId(x.k)); return <button key={x.k} lang="ja" className={`kana-cell ${isKnown(it) ? 'known' : it && it.status !== 'new' ? 'weak' : ''}`} onClick={() => setQ({ k: x.k, lvl })}>{x.k}<small>{x.en.split(',')[0]}</small></button>; })}
        </div>
        {list.length > limit && <button className="btn line" onClick={() => setLimit(limit + 300)}>Show more ({list.length - limit} left)</button>}
      </>}
      <p className="tiny muted">Kanji data: KANJIDIC © EDRDG (CC BY-SA 4.0), via kanji-data. Stroke order: KanjiVG (CC BY-SA 3.0).</p>
    </Screen>
  );
}

export function VocabList() {
  const { map } = useItems();
  const lib = useLib();
  const [sq] = useSearchParams();
  const [tab, setTab] = useState(sq.get('lvl') ?? '5');
  const [open, setOpen] = useState<string>('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(100);
  const groups = [...PACKS.map(p => ({ id: p.id, title: p.title, words: p.words, pack: true })), ...LESSONS.filter(l => !l.kana).map(l => ({ id: l.id, title: l.title, words: l.vocab, pack: false }))];
  const ql = query.trim().toLowerCase();
  const list = lib && tab !== 'lessons' ? lib.words.filter(w => w.lvl === Number(tab) && (!ql || w.jp.includes(query.trim()) || w.kana.includes(query.trim()) || w.en.toLowerCase().includes(ql))) : [];
  const all = lib && tab !== 'lessons' ? lib.words.filter(w => w.lvl === Number(tab)) : [];
  const known = all.filter(w => isKnown(map.get(vocabId(w.jp)))).length;
  return (
    <Screen back title="Vocabulary library">
      <LevelTabs value={tab} onChange={v => { setTab(v); setLimit(100); }} extra="My lessons" />
      {tab === 'lessons' ? <>
        <p className="small muted">Topic packs first, then the words from each lesson.</p>
        {groups.map(g => {
          const k = g.words.filter(w => isKnown(map.get(vocabId(w.jp)))).length;
          return (
            <div key={g.id} className="card flat">
              <button className="row between" style={{ width: '100%', minHeight: 44, textAlign: 'left' }} onClick={() => setOpen(open === g.id ? '' : g.id)} aria-expanded={open === g.id}>
                <div><h3>{g.title}</h3><span className="small muted num">{k}/{g.words.length} known</span></div><Icon n={open === g.id ? 'close' : 'next'} s={18} />
              </button>
              {open === g.id && <>
                <div className="list mt">{g.words.map(w => <WordRow key={w.jp} jp={w.jp} kana={w.kana} en={w.en} />)}</div>
                <Link className="btn sm mt" to={g.pack ? `/session?m=pack&id=${g.id}` : `/lesson/${g.id}`}>{g.pack ? 'Practise this pack' : 'Open lesson'}</Link>
              </>}
            </div>
          );
        })}
      </> : !lib ? <p className="muted">Loading the library…</p> : <>
        <div className="card green row">
          <div className="grow"><h3>JLPT N{tab}</h3><p className="small muted"><span className="num">{known}</span> of <span className="num">{all.length}</span> words known</p><div className="mt"><Bar pct={(known / Math.max(1, all.length)) * 100} /></div></div>
          <Link className="btn sm cream" to={`/session?m=lib&kind=vocab&lvl=${tab}`}>Learn 10</Link>
        </div>
        <input className="field" placeholder="Search Japanese or English" value={query} onChange={e => { setQuery(e.target.value); setLimit(100); }} aria-label="Search vocabulary" />
        <div className="card flat list" style={{ padding: '2px 16px' }}>
          {list.slice(0, limit).map(w => <WordRow key={w.jp + w.kana} jp={w.jp} kana={w.kana} en={w.en} known={isKnown(map.get(vocabId(w.jp)))} />)}
          {list.length === 0 && <div className="li small muted">No words match.</div>}
        </div>
        {list.length > limit && <button className="btn line" onClick={() => setLimit(limit + 200)}>Show more ({list.length - limit} left)</button>}
      </>}
      <p className="tiny muted">Word lists: open-anki-jlpt-decks (MIT), from Jonathan Waller's JLPT lists; meanings from JMdict © EDRDG (CC BY-SA 4.0).</p>
    </Screen>
  );
}

function WordRow({ jp, kana, en, known }: { jp: string; kana: string; en: string; known?: boolean }) {
  return <div className="li"><div className="grow"><span className="jp jp-m" lang="ja" style={{ fontWeight: 600 }}>{jp}</span>{kana !== jp && <span className="small muted jp" lang="ja">（{kana}）</span>}{known && <span className="badge" style={{ marginLeft: 6 }}>known</span>}<div className="small muted">{en}</div></div><SpeakBtn text={jp} /></div>;
}

export function ReadingList() {
  const [open, setOpen] = useState(PASSAGES[0].id);
  const [en, setEn] = useState(false);
  return (
    <Screen back title="Reading">
      <p className="small muted">Short texts you might really meet. Read first, then answer the questions.</p>
      {PASSAGES.map(p => (
        <div key={p.id} className="card flat col">
          <button className="row between" style={{ width: '100%', textAlign: 'left', minHeight: 44 }} onClick={() => setOpen(p.id)}><div><h3>{p.title}</h3><span className="small muted">{p.context}</span></div></button>
          {open === p.id && <>
            <div className="col gap-s">{p.lines.map((l, i) => <div key={i}><Furi f={l.f} className="jp-m" />{en && <div className="small muted">{l.en}</div>}</div>)}</div>
            <div className="row"><button className="btn sm line" onClick={() => setEn(!en)}>{en ? 'Hide' : 'Show'} English</button><Link className="btn sm" to={`/session?m=passage&id=${p.id}`}>Answer questions</Link></div>
          </>}
        </div>
      ))}
    </Screen>
  );
}
