// Streak reminders, sent by your teachers. Local notifications only — no server.
// Scheduled for the coming week at three times each evening, skipping today
// once today's 25 minutes are done. Rescheduled whenever the app is opened.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NUDGES } from '../lib/daily';
import { CAST } from '../content/cast';

export const remindersSupported = () => Capacitor.isNativePlatform();
const IDS = Array.from({ length: 21 }, (_, i) => 300 + i);

/** Ask for permission (called when the user switches reminders on). */
export async function setReminder(on: boolean, _time?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await LocalNotifications.cancel({ notifications: [{ id: 1 }, ...IDS.map(id => ({ id }))] }).catch(() => undefined);
  if (!on) return true;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

export async function scheduleStreakReminders(o: { on: boolean; time: string; streak: number; todayDone: boolean; freezes: number }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: IDS.map(id => ({ id })) });
    if (!o.on) return;
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    const [h, m] = o.time.split(':').map(Number);
    const slots: { at: 'evening' | 'late' | 'last'; h: number; m: number }[] = [
      { at: 'evening', h: h ?? 19, m: m ?? 30 }, { at: 'late', h: 22, m: 0 }, { at: 'last', h: 23, m: 15 },
    ];
    const now = Date.now();
    const list = [];
    for (let day = 0; day < 7; day++) {
      if (day === 0 && o.todayDone) continue;
      for (let k = 0; k < slots.length; k++) {
        const d = new Date(); d.setDate(d.getDate() + day); d.setHours(slots[k].h, slots[k].m, 0, 0);
        if (d.getTime() < now + 60000) continue;
        const pool = NUDGES.filter(n => n.at === slots[k].at);
        const nudge = pool[(d.getDate() + k) % pool.length];
        const who = CAST[nudge.who];
        const streak = o.streak + (day > 0 ? day - 1 : 0);
        list.push({ id: 300 + day * 3 + k, title: who ? `${who.name} 🌸` : 'Nihongo', body: nudge.text(streak), schedule: { at: d }, group: 'streak' });
      }
    }
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch { /* reminders are best-effort */ }
}
