// Speech-to-text service (replaceable). Uses the phone's own recogniser.
// Live mode: what you say appears on screen while you speak; tap the mic
// again to finish, or it finishes by itself after a pause.
// Honest note: recognisers are imperfect — the app shows what was heard and
// never presents it as a precise pronunciation score.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

const native = Capacitor.isNativePlatform();
const WebSR: any = typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

// The app's own Android recogniser bridge (android/.../SttPlugin.java).
interface NativeStt {
  start(o: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  cancel(): Promise<void>;
  addListener(e: 'partial', f: (d: { text: string }) => void): Promise<PluginListenerHandle>;
  addListener(e: 'result', f: (d: { matches: string[] }) => void): Promise<PluginListenerHandle>;
  addListener(e: 'error', f: (d: { code: number; message: string }) => void): Promise<PluginListenerHandle>;
  addListener(e: 'state', f: (d: { status: string }) => void): Promise<PluginListenerHandle>;
}
const Stt = registerPlugin<NativeStt>('NihongoStt');

export async function sttAvailable(): Promise<boolean> {
  if (native) { try { return (await SpeechRecognition.available()).available; } catch { return false; } }
  return !!WebSR;
}

let finishNow: (() => void) | null = null;
/** Finish the current listening early (the user tapped the mic again). Words heard so far are kept. */
export async function stopListening() {
  finishNow?.();
}

/** Last state from the recogniser, for the on-screen status ("ready", "speaking", "processing"). */
export let sttState = '';

async function nativeOnce(onPartial: ((t: string) => void) | undefined, maxMs: number, retry: boolean): Promise<string[]> {
  const handles: PluginListenerHandle[] = [];
  let latest = '';
  try {
    return await new Promise<string[]>((resolve, reject) => {
      let settled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const end = (v: string[] | Error) => {
        if (settled) return; settled = true; finishNow = null; sttState = '';
        timers.forEach(clearTimeout);
        if (v instanceof Error) reject(v); else resolve(v);
      };
      // Tap again / time limit: ask for the final words, and if they don't come soon use the live ones.
      const finish = () => {
        void Stt.stop().catch(() => undefined);
        timers.push(setTimeout(() => { void Stt.cancel().catch(() => undefined); end(latest ? [latest] : []); }, 2500));
      };
      finishNow = finish;
      void (async () => {
        handles.push(await Stt.addListener('partial', d => { latest = d.text; onPartial?.(d.text); }));
        handles.push(await Stt.addListener('state', d => { sttState = d.status; }));
        handles.push(await Stt.addListener('result', d => {
          const m = (d.matches ?? []).filter(Boolean);
          end(m.length ? m : latest ? [latest] : []);
        }));
        handles.push(await Stt.addListener('error', d => {
          if (d.message === 'nomatch' || d.message === 'silence') return end(latest ? [latest] : []);
          if ((d.message === 'busy' || d.message === 'client') && retry) {
            settled = true; finishNow = null; timers.forEach(clearTimeout);
            void Stt.cancel().catch(() => undefined);
            setTimeout(() => { nativeOnce(onPartial, maxMs, false).then(resolve, reject); }, 500);
            return;
          }
          if (d.message === 'busy' || d.message === 'client') return end(latest ? [latest] : new Error('The microphone is busy. Wait a second and tap it again.'));
          end(latest ? [latest] : new Error(d.message));
        }));
        timers.push(setTimeout(finish, maxMs));
        try { await Stt.start({ lang: 'ja-JP' }); }
        catch (e) { end(new Error((e as Error).message || 'Could not start the microphone.')); }
      })();
    });
  } finally {
    for (const h of handles) void h.remove();
  }
}

/**
 * Listen and return what was heard (best guess first).
 * `onPartial` receives the live transcript while the person is speaking.
 * Silence returns an empty list (not an error).
 */
export async function listenOnce(onPartial?: (text: string) => void, maxMs = 15000): Promise<string[]> {
  if (native) {
    const perm = await SpeechRecognition.requestPermissions();
    if (perm.speechRecognition !== 'granted') throw new Error('Microphone permission was not granted. Allow it in Android Settings → Apps → Nihongo → Permissions.');
    finishNow?.();
    return nativeOnce(onPartial, maxMs, true);
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
