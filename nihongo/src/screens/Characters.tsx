// See the whole cast, download their pictures, and choose your own
// "teaching", "happy" and "oops" pictures for any character.
import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../lib/db';
import { CAST, LESSON_CAST } from '../content/cast';
import { syncPortraits, setCustom, fileToPortrait, gallery, urlToData, type Mood } from '../services/portraits';
import { saveSettings } from '../lib/settings';
import { speakSeq } from '../services/tts';
import { Portrait } from '../components/Portrait';
import { Screen, Icon, Switch, useS } from '../components/ui';

const MOODS: [Mood, string][] = [['teach', 'Teaching'], ['happy', 'Happy'], ['oops', 'Oops']];

export function Characters() {
  const s = useS();
  const recs = useLiveQuery(() => db.portraits.toArray(), []) ?? [];
  const have = recs.filter(r => r.data).length;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState('');
  const sync = async () => { setBusy(true); setMsg(''); try { await syncPortraits(true); const n = (await db.portraits.toArray()).filter(r => r.data).length; setMsg(n ? `${n} pictures saved on this phone.` : 'Could not download — check your internet connection.'); } catch { setMsg('Could not download — check your internet connection.'); } setBusy(false); };
  const groups = [['Teachers', 'guide'], ['Mistake-makers', 'goof']] as const;
  return (
    <Screen back title="Characters">
      <div className="card flat col gap-s">
        <div className="row between">
          <div><h3>Character pictures</h3><p className="small muted">Official pictures from AniList, downloaded to this phone so they also work offline.</p></div>
          <Switch on={s.pictures} onChange={v => saveSettings({ pictures: v })} label="Use character pictures" />
        </div>
        <div className="row"><button className="btn sm" onClick={sync} disabled={busy || !s.pictures}><Icon n="download" s={16} />{busy ? 'Downloading…' : have ? 'Refresh pictures' : 'Download pictures'}</button><span className="small muted num">{have}/{Object.keys(CAST).length} saved</span></div>
        {msg && <p className="small" role="status">{msg}</p>}
        <p className="tiny muted">For your personal study only. Pictures belong to their creators and are never put inside the app itself.</p>
      </div>
      {groups.map(([title, role]) => (
        <section key={role} className="col gap-s">
          <h2>{title}</h2>
          {Object.values(CAST).filter(c => c.role === role).map(c => {
            const lessons = Object.entries(LESSON_CAST).filter(([, v]) => v.guide === c.id || v.goof === c.id).length;
            return (
              <div key={c.id} className="card flat col gap-s">
                <div className="row">
                  <Portrait id={c.id} size={64} />
                  <div className="grow"><h3>{c.name} <span className="small muted jp" lang="ja">{c.jp}</span></h3><p className="small muted">{c.series} · {lessons} lesson{lessons === 1 ? '' : 's'}</p></div>
                  <button className="iconbtn soft" aria-label={`Hear ${c.name}`} onClick={() => speakSeq([{ text: (c.say ?? ['こんにちは'])[0], pitch: c.role === 'guide' ? 1.3 : 0.75, rate: 1.05 }])}><Icon n="sound" /></button>
                  <button className="iconbtn soft" aria-label="Edit pictures" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? '' : c.id)}><Icon n={open === c.id ? 'close' : 'pen'} /></button>
                </div>
                {open === c.id && <Editor id={c.id} name={c.name} />}
              </div>
            );
          })}
        </section>
      ))}
      <Link to="/call" className="btn"><Icon n="mic" s={18} />Call a teacher</Link>
    </Screen>
  );
}

function Editor({ id, name }: { id: string; name: string }) {
  const file = useRef<HTMLInputElement>(null);
  const [mood, setMood] = useState<Mood>('happy');
  const [pics, setPics] = useState<string[] | null>(null);
  const [err, setErr] = useState('');
  const rec = useLiveQuery(() => db.portraits.get(id), [id]);
  const loadGallery = async () => { setErr(''); try { setPics(await gallery(name)); } catch (e) { setErr((e as Error).message); } };
  return (
    <div className="col gap-s">
      <div className="row" style={{ justifyContent: 'space-around' }}>
        {MOODS.map(([m, label]) => (
          <button key={m} className="col center" style={{ alignItems: 'center', gap: 4 }} onClick={() => setMood(m)} aria-pressed={mood === m}>
            <Portrait id={id} mood={m} size={60} fx={false} />
            <span className={`tiny ${mood === m ? '' : 'muted'}`} style={{ fontWeight: 700 }}>{label}{rec?.custom?.[m] ? ' ✓' : ''}</span>
          </button>
        ))}
      </div>
      <p className="tiny muted center">Choosing the <b>{MOODS.find(x => x[0] === mood)![1].toLowerCase()}</b> picture. It shows when this character {mood === 'happy' ? 'cheers a right answer' : mood === 'oops' ? 'reacts to a mistake' : 'teaches and talks'}.</p>
      <div className="row gap-s wrap">
        <button className="btn sm" onClick={() => file.current?.click()}><Icon n="upload" s={16} />From my phone</button>
        <button className="btn sm ghost" onClick={loadGallery}>More pictures online</button>
        {rec?.custom?.[mood] && <button className="btn sm line" onClick={() => setCustom(id, mood, null)}>Reset</button>}
      </div>
      <input ref={file} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) await setCustom(id, mood, await fileToPortrait(f)); e.target.value = ''; }} />
      {err && <p className="small" style={{ color: 'var(--bad)' }}>{err}</p>}
      {pics && (pics.length === 0 ? <p className="small muted">No extra pictures found.</p> : (
        <div className="pick-grid">
          {pics.map(u => <button key={u} onClick={async () => { try { await setCustom(id, mood, await urlToData(u)); } catch { setErr('That picture could not be saved. Try another.'); } }}><img src={u} alt="" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 12 }} loading="lazy" /></button>)}
        </div>
      ))}
      {pics && <p className="tiny muted">Extra pictures from MyAnimeList via the Jikan API.</p>}
    </div>
  );
}
