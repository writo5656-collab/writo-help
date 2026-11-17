// User settings, stored in the local database and shared through a React hook.
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setKV } from './db';

export interface Settings {
  onboarded: boolean;
  name: string;
  level: 'zero' | 'kana' | 'n5' | 'n4';
  showFurigana: boolean;
  showRomaji: boolean;
  autoplay: boolean;
  rate: number;            // speech speed, 1 = normal
  textScale: number;       // 1 = normal
  reducedMotion: boolean;
  showStreak: boolean;
  reminder: boolean;
  reminderTime: string;    // "19:30"
  aiUrl: string;           // your own proxy URL — the API key never lives in the app
  aiToken: string;         // optional shared passphrase for your proxy
  aiMode: 'proxy' | 'claude' | 'gemini'; // how the AI tutor connects
  aiKey: string;           // direct-mode API key (stored only on this device)
  aiModel: string;         // optional model override for direct modes
  paper: 'lined' | 'grid';
  sfx: boolean;            // sound effects
  keyboard: 'app' | 'phone'; // in-app kana keyboard, or the phone's own keyboard
  romajiInput: boolean;    // with the phone keyboard: convert romaji to kana
  speakKeys: boolean;      // say each kana aloud as you tap it
  charVoices: boolean;     // characters react out loud in Japanese
  pictures: boolean;       // download character pictures from AniList
  haptics: boolean;        // vibrate on right / wrong answers
  autoNext: boolean;       // move on automatically after a right answer
  short: boolean;          // shorter practice sessions
}
export const DEFAULTS: Settings = {
  onboarded: false, name: '', level: 'zero', showFurigana: true, showRomaji: false, autoplay: true,
  rate: 1, textScale: 1, reducedMotion: false, showStreak: false, reminder: false, reminderTime: '19:30',
  aiUrl: '', aiToken: '', aiMode: 'proxy', aiKey: '', aiModel: '', paper: 'lined', sfx: true, keyboard: 'app', romajiInput: false, speakKeys: true, charVoices: true, pictures: true, haptics: true, autoNext: true, short: false,
};

export function useSettings(): Settings | undefined {
  return useLiveQuery(async () => {
    const r = await db.kv.get('settings');
    return { ...DEFAULTS, ...((r?.value as Partial<Settings>) ?? {}) };
  }, []);
}
export async function loadSettings(): Promise<Settings> {
  const r = await db.kv.get('settings');
  return { ...DEFAULTS, ...((r?.value as Partial<Settings>) ?? {}) };
}
export async function saveSettings(patch: Partial<Settings>) {
  await setKV('settings', { ...(await loadSettings()), ...patch });
}
