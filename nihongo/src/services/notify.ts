// Streak reminders, sent by your teachers. Local notifications only — no server.
// Scheduled for the coming week at three times each evening, skipping today
// once today's 25 minutes are done. Rescheduled whenever the app is opened.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { NUDGES } from '../lib/daily';
import { CAST } from '../content/cast';

export const remindersSupported = () => Capacitor.isNativePlatform();
const IDS = Array.from({ length: 30 }, (_, i) => 300 + i);

/** Ask for permission (called when the user switches reminders on). */
export async function setReminder(on: boolean, _time?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await LocalNotifications.cancel({ notifications: [{ id: 1 }, ...IDS.map(id => ({ id }))] }).catch(() => undefined);
  if (!on) return true;
  const perm = await LocalNotifications.requestPermissions();
  return perm.display === 'granted';
}

export interface Planned { id: number; title: string; body: string; at: Date; kind: string; who: string }

/** Work out the coming week's messages (pure, so it can be previewed anywhere). */
export function planReminders(o: { time: string; streak: number; todayDone: boolean; freezes: number; now?: Date }): Planned[] {
  const now = o.now ?? new Date();
  const [h, m] = o.time.split(':').map(Number);
  const out: Planned[] = [];
  const pick = (at: string, seed: number) => { const pool = NUDGES.filter(n => n.at === at); return pool[seed % pool.length]; };
  for (let day = 0; day < 7; day++) {
    const base = new Date(now); base.setDate(now.getDate() + day);
    const seed = base.getFullYear() * 400 + base.getMonth() * 31 + base.getDate();
    const n = o.streak + (day > 0 ? day - (o.todayDone ? 0 : 1) : 0);
    const slots: { at: string; h: number; m: number }[] = [{ at: base.getDay() === 0 ? 'sunday' : 'morning', h: 8, m: 30 }];
    if (!(day === 0 && o.todayDone)) {
      slots.push({ at: 'evening', h: h ?? 19, m: m ?? 30 }, { at: [6, 13, 29, 49, 99].includes(n) ? 'milestone' : 'late', h: 22, m: 0 }, { at: o.freezes === 0 && n > 0 ? 'freeze' : 'last', h: 23, m: 15 });
    }
    slots.forEach((sl, k) => {
      const at = new Date(base); at.setHours(sl.h, sl.m, 0, 0);
      if (at.getTime() < now.getTime() + 60000) return;
      const nd = pick(sl.at, seed + k * 7);
      const who = CAST[nd.who];
      out.push({ id: 300 + day * 4 + k, title: who ? `${who.name} 🌸` : 'Nihongo', body: nd.text(Math.max(0, n)), at, kind: sl.at, who: nd.who });
    });
  }
  return out;
}

// Teacher messages ring with the app's own little tune (res/raw/nihongo_chime.wav).
// Android fixes a channel's sound once it is created, so the tune lives on its own channel id.
const CHANNEL = 'teacher-chime-1';
let channelReady: Promise<void> | null = null;
function ensureChannel(): Promise<void> {
  if (!channelReady) channelReady = LocalNotifications.createChannel({
    id: CHANNEL, name: 'Messages from your teacher', description: 'Reminders and messages, with the Nihongo chime',
    importance: 4, visibility: 1, sound: 'nihongo_chime.wav', vibration: true, lights: true, lightColor: '#E9C46A',
  }).catch(() => undefined);
  return channelReady;
}

export async function scheduleStreakReminders(o: { on: boolean; time: string; streak: number; todayDone: boolean; freezes: number }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await LocalNotifications.cancel({ notifications: IDS.map(id => ({ id })) });
    if (!o.on) return;
    if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
    await ensureChannel();
    const list = planReminders(o).map(p => ({ id: p.id, title: p.title, body: p.body, schedule: { at: p.at }, group: 'nihongo', channelId: CHANNEL, smallIcon: 'ic_stat_nihongo', largeIcon: 'ic_large_nihongo', iconColor: '#1F4D3A', extra: { go: '/plan' } }));
    if (list.length) await LocalNotifications.schedule({ notifications: list });
  } catch { /* reminders are best-effort */ }
}

/** Send one sample notification a few seconds from now, to check they work. */
export async function testNotification(): Promise<string> {
  const nd = NUDGES[Math.floor(Math.random() * NUDGES.length)];
  const who = CAST[nd.who];
  if (!Capacitor.isNativePlatform()) return `Notifications only work in the Android app. This is what one looks like:\n${who?.name}: ${nd.text(7)}`;
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return 'Notifications are blocked. Allow them in Android Settings → Apps → Nihongo → Notifications.';
  await ensureChannel();
  await LocalNotifications.schedule({ notifications: [{ id: 399, channelId: CHANNEL, title: `${who?.name ?? 'Nihongo'} 🌸`, body: nd.text(7), schedule: { at: new Date(Date.now() + 5000) }, smallIcon: 'ic_stat_nihongo', largeIcon: 'ic_large_nihongo', iconColor: '#1F4D3A', extra: { go: '/plan' } }] });
  return 'A test notification will arrive in about 5 seconds. You can lock your phone to see it.';
}

/** Tapping a notification opens today's plan. */
export function onNotificationTap(go: (path: string) => void) {
  if (!Capacitor.isNativePlatform()) return () => undefined;
  const h = LocalNotifications.addListener('localNotificationActionPerformed', e => go((e.notification.extra as { go?: string } | undefined)?.go ?? '/plan'));
  return () => { void h.then(x => x.remove()); };
}
