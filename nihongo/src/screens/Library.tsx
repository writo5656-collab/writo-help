// Reference screens: kana chart, kanji, vocabulary packs, reading passages.
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useItems } from '../lib/hooks';
import { isKnown } from '../lib/srs';
import { ROWS, YOON, KANJI, KANJI_MAP, PACKS, PASSAGES, kanaId, kanjiId, vocabId, LESSONS } from '../content';
import { speak } from '../services/tts';
import { Screen, Icon, Furi, SpeakBtn, useS } from '../components/ui';

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

export function KanjiList() {
  const [q, setQ] = useSearchParams();
  const { map } = useItems();
  const sel = KANJI_MAP.get(q.get('k') ?? '');
  if (sel) return (
    <Screen back title="Kanji">
      <div className="card col center" style={{ alignItems: 'center' }}>
        <span className="kana-big" lang="ja" style={{ fontSize: '6.5rem' }}>{sel.k}</span>
        <h2>{sel.en}</h2>
        <div className="row wrap gap-s" style={{ justifyContent: 'center' }}>
          {sel.on && <span className="badge amber">On: <span lang="ja" className="jp">{sel.on}</span></span>}
          {sel.kun && <span className="badge">Kun: <span lang="ja" className="jp">{sel.kun}</span></span>}
        </div>
      </div>
      <div className="card flat"><h3>Words</h3><div className="list mt">{sel.words.map(w => <div key={w.f} className="li"><div className="grow"><Furi f={w.f} className="jp-l" furigana /><div className="small muted">{w.en}</div></div><SpeakBtn text={w.f.replace(/\[[^\]]+\]/g, '')} /></div>)}</div></div>
      <p className="small muted">On-readings (katakana) came from Chinese and appear mostly in compound words. Kun-readings (hiragana) are native Japanese.</p>
      <div className="row"><Link className="btn line" to="/handwriting" state={{ ch: sel.k }}><Icon n="draw" s={18} />Write it</Link><Link className="btn" to={`/session?m=kanji&set=${sel.k}`}>Quiz this kanji</Link></div>
    </Screen>
  );
  return (
    <Screen back title="Kanji — N5">
      <div className="row between"><p className="small muted grow">{KANJI.length} kanji. Tap one for readings and example words.</p><Link className="btn sm" to="/session?m=kanji">Quiz 10</Link></div>
      <div className="kana-grid">
        {KANJI.map(k => { const it = map.get(kanjiId(k.k)); return <button key={k.k} lang="ja" className={`kana-cell ${isKnown(it) ? 'known' : it && it.status !== 'new' ? 'weak' : ''}`} onClick={() => setQ({ k: k.k })}>{k.k}<small>{k.en.split(',')[0]}</small></button>; })}
      </div>
      <div className="wip"><Icon n="flag" s={18} /><div>This set covers the standard N5 kanji. N4–N1 kanji and stroke-order diagrams are not included yet.</div></div>
    </Screen>
  );
}

export function VocabList() {
  const { map } = useItems();
  const [open, setOpen] = useState<string>('');
  const groups = [...PACKS.map(p => ({ id: p.id, title: p.title, words: p.words, pack: true })), ...LESSONS.filter(l => !l.kana).map(l => ({ id: l.id, title: l.title, words: l.vocab, pack: false }))];
  return (
    <Screen back title="Vocabulary">
      <p className="small muted">Topic packs first, then the words from each lesson.</p>
      {groups.map(g => {
        const known = g.words.filter(w => isKnown(map.get(vocabId(w.jp)))).length;
        return (
          <div key={g.id} className="card flat">
            <button className="row between" style={{ width: '100%', minHeight: 44, textAlign: 'left' }} onClick={() => setOpen(open === g.id ? '' : g.id)} aria-expanded={open === g.id}>
              <div><h3>{g.title}</h3><span className="small muted num">{known}/{g.words.length} known</span></div><Icon n={open === g.id ? 'close' : 'next'} s={18} />
            </button>
            {open === g.id && <>
              <div className="list mt">{g.words.map(w => <div key={w.jp} className="li"><div className="grow"><span className="jp jp-m" lang="ja" style={{ fontWeight: 600 }}>{w.jp}</span>{w.kana !== w.jp && <span className="small muted jp" lang="ja">（{w.kana}）</span>}<div className="small muted">{w.en}</div></div><SpeakBtn text={w.jp} /></div>)}</div>
              <Link className="btn sm mt" to={g.pack ? `/session?m=pack&id=${g.id}` : `/lesson/${g.id}`}>{g.pack ? 'Practise this pack' : 'Open lesson'}</Link>
            </>}
          </div>
        );
      })}
    </Screen>
  );
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
