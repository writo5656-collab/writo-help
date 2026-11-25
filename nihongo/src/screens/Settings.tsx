import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { saveSettings, loadSettings, type Settings as S } from '../lib/settings';
import { saveBackup, exportNotes, importData, resetAll } from '../lib/backup';
import { getKV } from '../lib/db';
import { speak, ttsAvailable } from '../services/tts';
import { setReminder, remindersSupported, testNotification, planReminders } from '../services/notify';
import { useDaily } from '../lib/hooks';
import { CAST } from '../content/cast';
import { Portrait } from '../components/Portrait';
import { tutorReply, geminiModels } from '../services/ai';
import { MicTest } from '../components/MicTest';
import { sfx } from '../services/sfx';
import { Link } from 'react-router-dom';
import { Screen, Switch, Icon, useS, fmtDate, Wip } from '../components/ui';

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <div className="li"><div className="grow"><div style={{ fontWeight: 500 }}>{title}</div>{sub && <div className="small muted">{sub}</div>}</div>{children}</div>;
}

export default function Settings() {
  const s = useS();
  const set = (p: Partial<S>) => saveSettings(p);
  const [msg, setMsg] = useState('');
  const [aiMsg, setAiMsg] = useState('');
  const [nMsg, setNMsg] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const daily = useDaily();
  const file = useRef<HTMLInputElement>(null);
  const lastBackup = useLiveQuery(() => getKV<number>('lastBackup', 0), []);
  const run = async (fn: () => Promise<string | void>) => { try { setMsg((await fn()) || 'Done.'); } catch (e) { setMsg((e as Error).message); } };
  const testAi = async () => {
    setAiMsg('Testing…');
    try { const r = await tutorReply({ messages: [{ role: 'user', content: 'こんにちは' }], scenario: 'free', level: s.level, known: 'greetings' }); const st = await loadSettings(); setAiMsg(`Connected${st.aiMode === 'gemini' ? ` (model: ${st.aiModel})` : ''}. The tutor said: ${r.jp}`); }
    catch (e) { setAiMsg((e as Error).message); }
  };
  const reminder = async (on: boolean, time = s.reminderTime) => {
    await set({ reminder: on, reminderTime: time });
    if (remindersSupported()) { const ok = await setReminder(on, time).catch(() => false); if (on && !ok) setMsg('Notification permission was not granted, so no reminder is scheduled.'); }
  };

  return (
    <Screen back title="Settings">
      <h2>Profile</h2>
      <section className="card flat"><label className="label" htmlFor="nm">Name</label><input id="nm" className="field mt" defaultValue={s.name} onBlur={e => set({ name: e.target.value.trim() })} placeholder="Your name" /></section>

      <Link to="/characters" className="card row"><span className="tile sakura"><Icon n="star" /></span><div className="grow"><h3>Characters</h3><p className="small muted">Pictures, reaction pictures and voices</p></div><Icon n="next" /></Link>

      <h2>Display</h2>
      <section className="card flat list" style={{ padding: '2px 16px' }}>
        <Row title="Furigana" sub="Kana reading above kanji"><Switch on={s.showFurigana} onChange={v => set({ showFurigana: v })} label="Furigana" /></Row>
        <Row title="Romaji" sub="Latin letters under Japanese text"><Switch on={s.showRomaji} onChange={v => set({ showRomaji: v })} label="Romaji" /></Row>
        <Row title="Text size"><div className="seg">{([['A', 0.92], ['A', 1], ['A', 1.12], ['A', 1.25]] as const).map(([l, v], i) => <button key={v} className={s.textScale === v ? 'on' : ''} style={{ fontSize: `${0.75 + i * 0.1}rem`, padding: '0 12px' }} onClick={() => set({ textScale: v })} aria-label={`Text size ${i + 1}`}>{l}</button>)}</div></Row>
        <Row title="Keyboard" sub="Kana keys built into the app, or your phone's keyboard"><div className="seg"><button className={s.keyboard === 'app' ? 'on' : ''} onClick={() => set({ keyboard: 'app' })} lang="ja">かな keys</button><button className={s.keyboard === 'phone' ? 'on' : ''} onClick={() => set({ keyboard: 'phone' })}>Phone</button></div></Row>
        <Row title="Notebook paper"><div className="seg"><button className={s.paper === 'lined' ? 'on' : ''} onClick={() => set({ paper: 'lined' })}>Lined</button><button className={s.paper === 'grid' ? 'on' : ''} onClick={() => set({ paper: 'grid' })}>Grid</button></div></Row>
        <Row title="Auto-continue" sub="Right answers move on by themselves"><Switch on={s.autoNext} onChange={v => set({ autoNext: v })} label="Auto-continue" /></Row>
        <Row title="Shorter sessions" sub="Fewer questions in reviews and drills"><Switch on={s.short} onChange={v => set({ short: v })} label="Shorter sessions" /></Row>
        <Row title="Vibration" sub="A small buzz on right and wrong answers"><Switch on={s.haptics} onChange={v => set({ haptics: v })} label="Vibration" /></Row>
        <Row title="Reduce motion" sub="Turn off animations"><Switch on={s.reducedMotion} onChange={v => set({ reducedMotion: v })} label="Reduce motion" /></Row>
        <Row title="Show streak" sub="Optional. Never the main measure."><Switch on={s.showStreak} onChange={v => set({ showStreak: v })} label="Show streak" /></Row>
      </section>

      <h2>Audio</h2>
      <section className="card flat list" style={{ padding: '2px 16px' }}>
        <Row title="Sound effects" sub="Chimes, key clicks and page sounds"><Switch on={s.sfx} onChange={v => set({ sfx: v })} label="Sound effects" /></Row>
        <Row title="Character voices" sub="Teachers and mistake-makers react out loud in Japanese"><Switch on={s.charVoices} onChange={v => set({ charVoices: v })} label="Character voices" /></Row>
        <Row title="Say kana as you type" sub="The in-app keyboard reads each letter aloud"><Switch on={s.speakKeys} onChange={v => set({ speakKeys: v })} label="Say kana as you type" /></Row>
        <Row title="Autoplay new sentences" sub="Hear each sentence when it first appears"><Switch on={s.autoplay} onChange={v => set({ autoplay: v })} label="Autoplay" /></Row>
        <div className="li" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <div className="row between"><span style={{ fontWeight: 500 }}>Speech speed</span><span className="small muted num">{s.rate.toFixed(2)}×</span></div>
          <input type="range" min={0.5} max={1.3} step={0.05} value={s.rate} onChange={e => set({ rate: Number(e.target.value) })} aria-label="Speech speed" style={{ accentColor: 'var(--forest)', width: '100%', height: 32 }} />
          <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => speak('こんにちは。日本語を勉強しましょう。', { rate: s.rate })}><Icon n="sound" s={16} />Test the voice</button>
        </div>
      </section>
      <MicTest />
      <p className="tiny muted">{ttsAvailable() ? 'Audio uses your phone\'s built-in Japanese voice, so it works offline. If you hear nothing, install Japanese in Android Settings → System → Languages → Text-to-speech output.' : 'This device has no speech engine available, so audio buttons will be silent.'}</p>

      <h2>Reminder</h2>
      <section className="card flat list" style={{ padding: '2px 16px' }}>
        <Row title="Reminders" sub="Morning hello at 8:30; evening nudges at your time, 22:00 and 23:15 if today's plan isn't done"><Switch on={s.reminder} onChange={v => reminder(v)} label="Streak reminders" /></Row>
        {s.reminder && <Row title="First reminder"><input type="time" className="field" style={{ width: 130 }} value={s.reminderTime} onChange={e => reminder(true, e.target.value)} aria-label="Reminder time" /></Row>}
      </section>
      <div className="row gap-s wrap">
        <button className="btn sm" onClick={async () => setNMsg(await testNotification())}><Icon n="bell" s={16} />Send a test notification</button>
        <button className="btn sm ghost" onClick={() => sfx.chime()}><Icon n="sound" s={16} />Hear the message tune</button>
        <button className="btn sm ghost" onClick={() => setPreview(!preview)}>{preview ? 'Hide' : 'Preview'} this week's messages</button>
      </div>
      {nMsg && <p className="small" role="status" style={{ whiteSpace: 'pre-line' }}>{nMsg}</p>}
      {preview && daily && (
        <section className="card flat list" style={{ padding: '2px 16px' }}>
          {planReminders({ time: s.reminderTime, streak: daily.info.current, todayDone: daily.info.todayDone, freezes: daily.info.freezes }).slice(0, 14).map(p => (
            <div key={p.id} className="li" style={{ alignItems: 'flex-start' }}>
              <Portrait id={p.who} size={36} />
              <div className="grow small"><b>{CAST[p.who]?.name}</b> <span className="tiny muted">· {p.at.toLocaleDateString(undefined, { weekday: 'short' })} {p.at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · {p.kind}</span><div>{p.body}</div></div>
            </div>
          ))}
          <p className="tiny muted" style={{ padding: '8px 0' }}>Evening and late messages are skipped on days you've already finished your 25 minutes.</p>
        </section>
      )}
      {!remindersSupported() && <p className="tiny muted">Reminders are delivered by the installed Android app. In a web browser this setting is saved but no notification is sent.</p>}

      <h2>AI tutor</h2>
      <section className="card flat col">
        <p className="small muted">Free-talk calls and the AI tutor need an AI service. Lessons, roleplay calls and the mistake quiz work without one. Choose how to connect:</p>
        <div className="seg" role="group" aria-label="AI connection" style={{ alignSelf: 'flex-start' }}>
          {([['proxy', 'My proxy'], ['gemini', 'Gemini key'], ['claude', 'Claude key']] as const).map(([v, l]) => <button key={v} className={s.aiMode === v ? 'on' : ''} onClick={() => set({ aiMode: v })}>{l}</button>)}
        </div>
        {s.aiMode === 'proxy' && <>
          <p className="small muted">Safest: the key stays on your own small server (see <code>server/README.md</code>). Paste its address here.</p>
          <label className="label" htmlFor="ai">Proxy address</label>
          <input id="ai" className="field" inputMode="url" defaultValue={s.aiUrl} onBlur={e => set({ aiUrl: e.target.value.trim() })} placeholder="https://…" autoCapitalize="off" autoCorrect="off" />
          <label className="label" htmlFor="tok">App passphrase (if your proxy uses one)</label>
          <input id="tok" className="field" type="password" defaultValue={s.aiToken} onBlur={e => set({ aiToken: e.target.value.trim() })} autoComplete="off" />
          <label className="label" htmlFor="pk">Supabase key (only if the test says Supabase asked for a login)</label>
          <input id="pk" className="field" type="password" defaultValue={s.aiProxyKey} onBlur={e => set({ aiProxyKey: e.target.value.trim() })} autoComplete="off" placeholder="anon / publishable key" />
        </>}
        {s.aiMode !== 'proxy' && <>
          <p className="small muted">{s.aiMode === 'gemini'
            ? 'Google AI Studio gives free API keys with a daily free limit — the free option. Get one at aistudio.google.com → "Get API key".'
            : 'Paid per use. Create a key at console.anthropic.com → API keys.'} The key is stored only on this phone, is never put in backups, and requests go straight from your phone to the service.</p>
          <label className="label" htmlFor="key">{s.aiMode === 'gemini' ? 'Gemini' : 'Claude'} API key</label>
          <input id="key" key={s.aiMode} className="field" type="password" defaultValue={s.aiKey} onBlur={e => set({ aiKey: e.target.value.trim() })} autoComplete="off" autoCapitalize="off" />
          <label className="label" htmlFor="mdl">Model (optional)</label>
          <input id="mdl" key={s.aiMode + 'm' + s.aiModel} className="field" defaultValue={s.aiModel} onBlur={e => set({ aiModel: e.target.value.trim() })} placeholder={s.aiMode === 'gemini' ? 'Leave empty — chosen automatically' : 'claude-opus-5-5'} autoCapitalize="off" />
          {s.aiMode === 'gemini' && <button className="chip" style={{ alignSelf: 'flex-start' }} disabled={!s.aiKey} onClick={async () => { try { setModels(await geminiModels(s.aiKey)); } catch (e) { setAiMsg((e as Error).message); } }}>Show models my key can use</button>}
          {models.length > 0 && <select className="field" value={s.aiModel} onChange={e => set({ aiModel: e.target.value })} aria-label="Gemini model">{['', ...models].map(m => <option key={m} value={m}>{m || 'Automatic'}</option>)}</select>}
        </>}
        <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={testAi} disabled={s.aiMode === 'proxy' ? !s.aiUrl : !s.aiKey}>Test connection</button>
        {aiMsg && <p className="small" role="status">{aiMsg}</p>}
      </section>

      <h2>Backup and data</h2>
      <section className="card flat col">
        <p className="small muted">Everything is stored on this device only. Uninstalling the app deletes it, so save a backup file now and then. {lastBackup ? `Last backup: ${fmtDate(lastBackup)}.` : 'No backup made yet.'}</p>
        <button className="btn" onClick={() => run(saveBackup)}><Icon n="download" s={18} />Save a backup file</button>
        <button className="btn ghost" onClick={() => file.current?.click()}><Icon n="upload" s={18} />Restore from a backup file</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={e => { const f = e.target.files?.[0]; if (f && confirm('Restoring replaces everything currently in the app with the backup. Continue?')) void run(async () => { await importData(await f.text()); return 'Backup restored.'; }); e.target.value = ''; }} />
        <button className="btn line" onClick={() => run(exportNotes)}><Icon n="note" s={18} />Export notebook as text</button>
        {msg && <p className="small" role="status">{msg}</p>}
        <button className="btn danger" onClick={() => { if (confirm('Erase all progress, mistakes and notes on this device? This cannot be undone.')) void resetAll(); }}><Icon n="trash" s={18} />Erase all data</button>
      </section>

      <p className="tiny muted center">Nihongo — Personal Japanese Academy · v1.0<br />No hearts, no locks, no penalties.<br />Stroke order © KanjiVG (Ulrich Apel), CC BY-SA 3.0. Dictionary data © EDRDG (JMdict, KANJIDIC), CC BY-SA 4.0.<br />Anime characters are named for personal study only; all lines are original.</p>
    </Screen>
  );
}
