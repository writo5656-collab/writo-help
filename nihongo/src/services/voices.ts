// Gives every character a recognisable voice: their own pitch and speed, and —
// when the phone has several Japanese voices installed (Google's engine
// usually ships four) — a different voice for the girls and the boys.
// These are text-to-speech voices; the real voice actors' recordings are not used.
import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { CAST } from '../content/cast';

const PROFILE: Record<string, [number, number]> = { // [pitch, speed]
  mai: [1.05, 0.95], rio: [0.98, 0.9], tomoe: [1.42, 1.1], mahiru: [1.2, 0.93], hori: [1.15, 1.08], kaoruko: [1.32, 1.0],
  alya: [1.1, 0.96], yuki: [1.25, 1.0], masha: [1.22, 0.88], chinatsu: [1.08, 1.02], hina: [1.34, 1.12], marin: [1.4, 1.15],
  juju: [1.48, 1.05], sakura: [1.26, 1.1], hinata: [1.3, 0.84], tsunade: [0.92, 1.0], ino: [1.2, 1.08],
  sakuta: [0.82, 0.95], amane: [0.78, 0.94], miyamura: [0.86, 0.98], rintaro: [0.7, 0.93], masachika: [0.8, 1.05],
  taiki: [0.9, 1.12], gojo: [0.86, 0.9], naruto: [0.98, 1.18], lee: [0.9, 1.16],
};

interface V { name: string; lang: string; index: number }
let list: Promise<V[]> | null = null;
function jaVoices(): Promise<V[]> {
  return (list ??= (async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const { voices } = await TextToSpeech.getSupportedVoices();
        return voices.map((v, index) => ({ name: v.name || v.voiceURI, lang: v.lang, index })).filter(v => /^ja/i.test(v.lang));
      }
      const get = () => (window.speechSynthesis?.getVoices() ?? []);
      let vs = get();
      if (!vs.length) { await new Promise(r => setTimeout(r, 400)); vs = get(); }
      return vs.map((v, index) => ({ name: v.name, lang: v.lang, index })).filter(v => /^ja/i.test(v.lang));
    } catch { return []; }
  })());
}
const MALE = /jac|jad|male|otoya|ichiro|keita|takumi|daichi/i;
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export interface VoiceParams { pitch: number; rate: number; voice?: number }
export async function voiceFor(id: string, baseRate = 1): Promise<VoiceParams> {
  const c = CAST[id];
  const [pitch, speed] = PROFILE[id] ?? (c?.role === 'goof' ? [0.82, 1] : [1.25, 1]);
  const vs = await jaVoices();
  const wantMale = c?.role === 'goof';
  const bucket = vs.filter(v => MALE.test(v.name) === wantMale);
  const pool = bucket.length ? bucket : vs;
  const voice = pool.length > 1 ? pool[hash(id) % pool.length].index : pool[0]?.index;
  // With a real male voice available, the boys need less pitch-lowering.
  const p = wantMale && bucket.length ? Math.min(1, pitch + 0.12) : pitch;
  return { pitch: p, rate: speed * baseRate, voice };
}
