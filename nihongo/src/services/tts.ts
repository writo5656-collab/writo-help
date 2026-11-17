// Text-to-speech service. The rest of the app only calls speak()/stop(), so
// the provider can be swapped (e.g. for a cloud voice) without touching screens.
// - Inside the Android app: the phone's built-in Japanese voice (native plugin).
// - In a browser: the Web Speech API.
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const native = Capacitor.isNativePlatform();
let token = 0;

function webVoice(): SpeechSynthesisVoice | undefined {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  return vs.find(v => v.lang === 'ja-JP' && /Google|Natural|Kyoko|O-ren/i.test(v.name)) ?? vs.find(v => v.lang?.startsWith('ja'));
}

export function ttsAvailable(): boolean {
  return native || typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function speakOne(text: string, rate: number): Promise<void> {
  const clean = text.replace(/\s+/g, '');
  if (native) return TextToSpeech.speak({ text: clean, lang: 'ja-JP', rate, pitch: 1, volume: 1 }).catch(() => undefined);
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) return resolve();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = 'ja-JP'; u.rate = rate;
    const v = webVoice(); if (v) u.voice = v;
    u.onend = () => resolve(); u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
    setTimeout(resolve, 15000); // never hang the UI if the engine stays silent
  });
}

export async function stop() {
  token++;
  if (native) await TextToSpeech.stop().catch(() => undefined);
  else window.speechSynthesis?.cancel();
}

/** Speak a sentence. `slow` plays at 60% of the chosen speed. */
export async function speak(text: string, opts: { rate?: number; slow?: boolean } = {}) {
  await stop();
  await speakOne(text, (opts.rate ?? 1) * (opts.slow ? 0.6 : 1));
}

/** Word-by-word playback with a short pause between chunks. */
export async function speakChunks(chunks: string[], rate = 1, onChunk?: (i: number) => void) {
  await stop();
  const my = token;
  for (let i = 0; i < chunks.length; i++) {
    if (my !== token) return;
    onChunk?.(i);
    await speakOne(chunks[i], rate * 0.8);
    await new Promise(r => setTimeout(r, 350));
  }
  onChunk?.(-1);
}
