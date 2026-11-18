// Speech-to-text service (replaceable). Uses the phone's own recogniser.
// Live mode: what you say appears on screen while you speak; tap the mic
// again to finish, or it finishes by itself after a pause.
// Honest note: recognisers are imperfect — the app shows what was heard and
// never presents it as a precise pronunciation score.
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const native = Capacitor.isNativePlatform();
const WebSR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

export async function sttAvailable(): Promise<boolean> {
  if (native) { try { return (await SpeechRecognition.available()).available; } catch { return false; } }
  return !!WebSR;
}

let finishNow: (() => void) | null = null;
/** Finish the current listening early (the user tapped the mic again). */
export async function stopListening() {
  finishNow?.();
  if (native) await SpeechRecognition.stop().catch(() => undefined);
}

/**
 * Listen and return what was heard (best guess first).
 * `onPartial` receives the live transcript while the person is speaking.
 */
export async function listenOnce(onPartial?: (text: string) => void, maxMs = 15000): Promise<string[]> {
  if (native) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission was not granted. Allow it in Android Settings → Apps → Nihongo → Permissions.');
    let latest: string[] = [];
    const handles: PluginListenerHandle[] = [];
    try {
      return await new Promise<string[]>(async resolve => {
        let settled = false;
        const finish = () => { if (settled) return; settled = true; finishNow = null; resolve(latest); };
        finishNow = finish;
        handles.push(await SpeechRecognition.addListener('partialResults', d => { if (d.matches?.length) { latest = d.matches; onPartial?.(d.matches[0]); } }));
        handles.push(await SpeechRecognition.addListener('listeningState', d => { if (d.status === 'stopped') setTimeout(finish, 250); }));
        setTimeout(() => { void SpeechRecognition.stop().catch(() => undefined); setTimeout(finish, 400); }, maxMs);
        try {
          // With partialResults the call returns at once; words arrive through the listener above.
          const r = await SpeechRecognition.start({ language: 'ja-JP', maxResults: 5, partialResults: true, popup: false });
          if (r?.matches?.length) { latest = r.matches; finish(); }
        } catch (e) { latest = []; finish(); void e; }
      });
    } finally {
      for (const h of handles) void h.remove();
    }
  }
  if (!WebSR) throw new Error('Speech recognition is not available here.');
  return new Promise((resolve, reject) => {
    const r = new WebSR();
    r.lang = 'ja-JP'; r.maxAlternatives = 5; r.interimResults = true; r.continuous = false;
    let best: string[] = [];
    let done = false;
    const finish = () => { if (done) return; done = true; finishNow = null; resolve(best); };
    finishNow = () => { try { r.stop(); } catch { /* already stopped */ } setTimeout(finish, 300); };
    r.onresult = (e: any) => {
      const res = e.results[e.results.length - 1];
      const alts = Array.from(res).map((a: any) => a.transcript as string);
      const text = Array.from(e.results).map((x: any) => x[0].transcript).join('');
      best = [text, ...alts.filter(a => a !== text)];
      onPartial?.(text);
      if (res.isFinal) finish();
    };
    r.onerror = (e: any) => { if (e.error === 'no-speech' || e.error === 'aborted') return finish(); done = true; reject(new Error(e.error === 'not-allowed' ? 'Microphone permission was not granted.' : `Could not hear anything (${e.error}).`)); };
    r.onend = () => finish();
    r.start();
    setTimeout(() => finishNow?.(), maxMs);
  });
}
