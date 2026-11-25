// Keeps the Android home-screen widget up to date: streak, today's minutes,
// and today's teacher (her picture and a little message).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { db } from '../lib/db';
import { pick } from './portraits';

const Native = registerPlugin<{ refresh(): Promise<void> }>('StreakWidget');

/** Round, small picture of the teacher for the widget (PNG, base64 without the data: prefix). */
async function roundFace(src: string, size = 192): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error('no picture')); img.src = src; });
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); g.closePath();
  g.save(); g.clip();
  // Cover-crop from the top, where the face usually is.
  const s = Math.max(size / img.width, size / img.height);
  const w = img.width * s, h = img.height * s;
  g.drawImage(img, (size - w) / 2, 0, w, h);
  g.restore();
  g.lineWidth = 4; g.strokeStyle = 'rgba(246, 241, 228, .9)'; g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2); g.stroke();
  return c.toDataURL('image/png').split(',')[1];
}

export async function updateWidget(d: { day: string; streak: number; freezes: number; minutes: number; done: boolean; teacher: string; teacherId?: string }) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    if (d.teacherId) {
      const key = `${d.day}:${d.teacherId}`;
      const last = (await Preferences.get({ key: 'widgetFace' })).value;
      if (last !== key) {
        const src = pick(await db.portraits.get(d.teacherId), d.teacherId, 'happy');
        if (src && src.startsWith('data:')) {
          const data = await roundFace(src);
          await Filesystem.writeFile({ path: 'widget_teacher.png', data, directory: Directory.Data });
          await Preferences.set({ key: 'widgetFace', value: key });
        }
      }
    }
  } catch { /* no picture yet: the widget shows a flag instead */ }
  try {
    await Preferences.set({ key: 'widget', value: JSON.stringify(d) });
    await Native.refresh();
  } catch { /* the widget is optional */ }
}
