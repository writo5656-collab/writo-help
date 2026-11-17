// App shell: routes, bottom tabs, settings provider and time tracking.
import { useEffect, useRef, useState } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { useSettings } from './lib/settings';
import { addSeconds } from './lib/db';
import { setSfx } from './services/sfx';
import { syncPortraits } from './services/portraits';
import { PictureGate } from './components/PictureGate';
import { Characters } from './screens/Characters';
import Call from './screens/Call';
import Plan from './screens/Plan';
import Grammar from './screens/Grammar';
import { useDaily } from './lib/hooks';
import { scheduleStreakReminders } from './services/notify';
import { updateWidget } from './services/widget';
import { dailyCast, CAST } from './content/cast';
import { Portrait } from './components/Portrait';
import { sfx } from './services/sfx';
import { speakSeq } from './services/tts';
import { getKV, setKV } from './lib/db';
import { SettingsCtx, Icon } from './components/ui';
import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import Learn from './screens/Learn';
import Lesson from './screens/Lesson';
import Session from './screens/Session';
import { KanaChart, KanjiList, VocabList, ReadingList } from './screens/Library';
import Practice from './screens/Practice';
import { Notebook, NotePage, Handwriting } from './screens/Notebook';
import { Mistakes, Sunday } from './screens/Review';
import { Speak, Roleplay, Tutor } from './screens/Speak';
import Progress from './screens/Progress';
import Settings from './screens/Settings';

const TABS = [
  { to: '/', icon: 'home', label: 'Home' },
  { to: '/learn', icon: 'book', label: 'Learn' },
  { to: '/notebook', icon: 'pen', label: 'Notebook' },
  { to: '/practice', icon: 'retry', label: 'Practice' },
  { to: '/speak', icon: 'mic', label: 'Speak' },
];

function Tabs() {
  const { pathname } = useLocation();
  if (!TABS.some(t => t.to === pathname)) return null;
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-in">
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} end className={({ isActive }) => `tab ${isActive ? 'on' : ''}`}>
            <span className="tab-ic"><Icon n={t.icon} s={21} /></span>{t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Counts study time only while the app is visible and being used. */
function useStudyClock() {
  const last = useRef(Date.now());
  useEffect(() => {
    const touch = () => { last.current = Date.now(); };
    window.addEventListener('pointerdown', touch); window.addEventListener('keydown', touch);
    const t = setInterval(() => { if (!document.hidden && Date.now() - last.current < 90000) void addSeconds(15); }, 15000);
    return () => { clearInterval(t); window.removeEventListener('pointerdown', touch); window.removeEventListener('keydown', touch); };
  }, []);
}

/** Remount a screen when its query string changes (e.g. a different drill). */
function Keyed({ children }: { children: React.ReactNode }) { const { search } = useLocation(); return <div key={search} style={{ display: 'contents' }}>{children}</div>; }

/** Keeps reminders and the widget in sync, and celebrates finishing today's 25 minutes. */
function StreakKeeper() {
  const s = useSettings();
  const d = useDaily();
  const [party, setParty] = useState<number | null>(null);
  const sig = d && s ? `${d.today}|${d.info.current}|${d.info.freezes}|${d.info.todayDone}|${Math.floor(d.seconds / 60)}|${s.reminder}|${s.reminderTime}` : '';
  useEffect(() => {
    if (!d || !s) return;
    const g = CAST[dailyCast().guide];
    void updateWidget({ day: d.today, streak: d.info.current, freezes: d.info.freezes, minutes: Math.floor(d.seconds / 60), done: d.info.todayDone, teacher: g.name.split(' ')[0] });
  }, [sig]); // eslint-disable-line
  useEffect(() => {
    if (!d || !s) return;
    void scheduleStreakReminders({ on: s.reminder, time: s.reminderTime, streak: d.info.current, todayDone: d.info.todayDone, freezes: d.info.freezes });
  }, [d?.today, d?.info.todayDone, d?.info.current, s?.reminder, s?.reminderTime]); // eslint-disable-line
  useEffect(() => {
    if (!d?.info.todayDone) return;
    void getKV<string>('celebrated', '').then(async last => {
      if (last === d.today) return;
      await setKV('celebrated', d.today);
      setParty(d.info.current);
      sfx.complete();
      const g = CAST[dailyCast().guide];
      if (s?.charVoices) void speakSeq([{ text: 'やったね！ 今日の目標、達成！', who: g.id }]);
      void g;
    });
  }, [d?.info.todayDone]); // eslint-disable-line
  if (party === null || !d) return null;
  // Monday-to-Sunday week, like a calendar.
  const now = new Date(); const dow = (now.getDay() + 6) % 7;
  const weekDays = Array.from({ length: 7 }, (_, i) => { const x = new Date(now); x.setDate(now.getDate() - dow + i); return x; });
  const keyOfD = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const left = 6 - dow;
  return (
    <div className="streak-screen" role="dialog" aria-label="Streak">
      <div className="flame-big" aria-hidden="true">
        <svg viewBox="0 0 120 150" width="150" height="180"><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffb347" /><stop offset="1" stopColor="#e8361c" /></linearGradient></defs>
          <path d="M60 6c6 22 44 40 44 84a44 44 0 0 1-88 0c0-20 9-32 18-40 2 12 8 20 16 22C48 50 50 26 60 6z" fill="url(#fg)" stroke="#d9261c" strokeWidth="5" strokeLinejoin="round" />
          <path d="M60 70c4 12 20 18 20 36a20 20 0 0 1-40 0c0-10 6-16 10-20 2 6 6 8 10 8-2-10-2-16 0-24z" fill="#ffe28a" />
          <circle cx="60" cy="108" r="10" fill="#fff" opacity=".9" /></svg>
      </div>
      <div className="big-num num">{party}</div>
      <div className="big-label">day streak</div>
      <div className="wk">
        {weekDays.map((x, i) => { const st = d.info.status.get(keyOfD(x)); return <span key={i} className={`wkd ${st ?? ''} ${i === dow ? 'now' : ''}`}><small>{'MTWTFSS'[i]}</small><i>{st === 'done' ? '✓' : st === 'frozen' ? '❄' : ''}</i></span>; })}
      </div>
      <p className="center">{left > 0 ? <>Practise <b style={{ color: '#ff6a3d' }}>{left} more day{left > 1 ? 's' : ''}</b> this week for a Perfect Week!</> : <>Perfect Week complete! 🎉</>}</p>
      <div className="row gap-s" style={{ alignItems: 'center' }}><Portrait id={dailyCast().guide} mood="happy" size={44} /><span className="small">{CAST[dailyCast().guide].name.split(' ')[0]}: "Today's 25 minutes are done. See you tomorrow!"</span></div>
      <button className="btn" style={{ maxWidth: 360 }} onClick={() => setParty(null)}>Nice{s?.name ? `, ${s.name}` : ''}!</button>
    </div>
  );
}

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); }, [pathname]); return null; }

export default function App() {
  const s = useSettings();
  useStudyClock();
  // Android back button: go back one screen, or leave the app from the first screen.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const h = NativeApp.addListener('backButton', ({ canGoBack }) => { if (canGoBack) window.history.back(); else void NativeApp.exitApp(); });
    return () => { void h.then(x => x.remove()); };
  }, []);
  useEffect(() => { if (s) document.documentElement.style.setProperty('--scale', String(s.textScale)); }, [s?.textScale]); // eslint-disable-line
  useEffect(() => { if (s) setSfx(s.sfx); }, [s?.sfx]); // eslint-disable-line
  // Download character pictures in the background (once, then monthly).
  useEffect(() => { if (s?.onboarded && s.pictures) { const t = setTimeout(() => void syncPortraits(), 1500); return () => clearTimeout(t); } }, [s?.onboarded, s?.pictures]);
  if (!s) return null;
  return (
    <SettingsCtx.Provider value={s}>
      <HashRouter>
        <ScrollTop />
        <div className={`app ${s.reducedMotion ? 'reduced' : ''}`}>
          {!s.onboarded ? <Onboarding /> : !s.pictures ? <Shell /> : <PictureGate><Shell /></PictureGate>}
        </div>
      </HashRouter>
    </SettingsCtx.Provider>
  );
}

function Shell() {
  return (
            <>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/learn" element={<Learn />} />
                <Route path="/lesson/:id" element={<Lesson />} />
                <Route path="/session" element={<Keyed><Session /></Keyed>} />
                <Route path="/kana" element={<KanaChart />} />
                <Route path="/kanji" element={<KanjiList />} />
                <Route path="/vocab" element={<VocabList />} />
                <Route path="/reading" element={<ReadingList />} />
                <Route path="/practice" element={<Practice />} />
                <Route path="/notebook" element={<Notebook />} />
                <Route path="/note/:id" element={<NotePage />} />
                <Route path="/handwriting" element={<Handwriting />} />
                <Route path="/mistakes" element={<Mistakes />} />
                <Route path="/sunday" element={<Sunday />} />
                <Route path="/speak" element={<Speak />} />
                <Route path="/roleplay/:id" element={<Roleplay />} />
                <Route path="/tutor" element={<Tutor />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/characters" element={<Characters />} />
                <Route path="/call" element={<Call />} />
                <Route path="/plan" element={<Plan />} />
                <Route path="/grammar" element={<Grammar />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <Tabs />
              <StreakKeeper />
            </>
  );
}
