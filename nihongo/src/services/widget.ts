// Keeps the Android home-screen streak widget up to date.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const Native = registerPlugin<{ refresh(): Promise<void> }>('StreakWidget');

export async function updateWidget(d: { day: string; streak: number; freezes: number; minutes: number; done: boolean; teacher: string }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Preferences.set({ key: 'widget', value: JSON.stringify(d) });
    await Native.refresh();
  } catch { /* the widget is optional */ }
}
