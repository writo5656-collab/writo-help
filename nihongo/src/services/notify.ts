// Daily reminder. Works inside the Android app (local notification, no server).
// In a plain browser there is no reliable scheduled notification, so the
// setting is stored but nothing is scheduled.
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export const remindersSupported = () => Capacitor.isNativePlatform();

export async function setReminder(on: boolean, time: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await LocalNotifications.cancel({ notifications: [{ id: 1 }] }).catch(() => undefined);
  if (!on) return true;
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') return false;
  const [hour, minute] = time.split(':').map(Number);
  await LocalNotifications.schedule({ notifications: [{
    id: 1, title: 'Nihongo', body: 'A few minutes of Japanese? Your review is ready whenever you are.',
    schedule: { on: { hour, minute }, allowWhileIdle: true },
  }] });
  return true;
}
