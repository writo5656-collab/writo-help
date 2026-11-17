// Speech-to-text service (replaceable). Uses the phone's own recogniser.
// Honest note: recognisers are imperfect — the app shows what was heard and
// never presents it as a precise pronunciation score.
import { Capacitor } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const native = Capacitor.isNativePlatform();
const WebSR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

export async function sttAvailable(): Promise<boolean> {
  if (native) { try { return (await SpeechRecognition.available()).available; } catch { return false; } }
  return !!WebSR;
}

/** Listen once and return what was heard (best guess first). */
export async function listenOnce(): Promise<string[]> {
  if (native) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission was not granted.');
    const r = await SpeechRecognition.start({ language: 'ja-JP', maxResults: 3, partialResults: false, popup: false });
    return r.matches ?? [];
  }
  if (!WebSR) throw new Error('Speech recognition is not available in this browser.');
  return new Promise((resolve, reject) => {
    const r = new WebSR();
    r.lang = 'ja-JP'; r.maxAlternatives = 3; r.interimResults = false;
    let done = false;
    r.onresult = (e: any) => { done = true; resolve(Array.from(e.results[0]).map((a: any) => a.transcript)); };
    r.onerror = (e: any) => { done = true; reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was not granted.' : `Could not hear anything (${e.error}).`)); };
    r.onend = () => { if (!done) resolve([]); };
    r.start();
  });
}

export async function stopListening() {
  if (native) await SpeechRecognition.stop().catch(() => undefined);
}
