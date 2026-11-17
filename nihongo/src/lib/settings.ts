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
  paper: 'lined' | 'grid';
}
export const DEFAULTS: Settings = {
  onboarded: false, name: '', level: 'zero', showFurigana: true, showRomaji: false, autoplay: true,
  rate: 1, textScale: 1, reducedMotion: false, showStreak: false, reminder: false, reminderTime: '19:30',
  aiUrl: '', aiToken: '', paper: 'lined',
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
