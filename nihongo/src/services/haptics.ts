// Small vibrations for right and wrong answers (Android app only).
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

let on = true;
export const setHaptics = (v: boolean) => { on = v; };
export const buzz = {
  ok: () => { if (on && Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined); },
  bad: () => { if (on && Capacitor.isNativePlatform()) void Haptics.notification({ type: NotificationType.Error }).catch(() => undefined); },
  tap: () => { if (on && Capacitor.isNativePlatform()) void Haptics.selectionChanged().catch(() => undefined); },
};
