// Sound effects, synthesised with the Web Audio API — no audio files needed,
// so they work offline and add nothing to the app size.
let ctx: AudioContext | null = null;
let enabled = true;
export function setSfx(on: boolean) { enabled = on; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  try {
    ctx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

/** One soft note. */
function note(freq: number, at: number, dur: number, vol = 0.12, type: OscillatorType = 'sine', slideTo?: number) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** A short filtered noise burst (paper, key clicks). */
function noise(at: number, dur: number, vol: number, freq: number) {
  const a = ac(); if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource(); s.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination); s.start(t);
}

export const sfx = {
  /** Light tick for taps and choices. */
  tap: () => note(660, 0, 0.05, 0.05, 'triangle'),
  /** Soft wooden key click for the kana keyboard. */
  key: () => { noise(0, 0.03, 0.10, 2200); note(320, 0, 0.03, 0.03, 'triangle'); },
  /** Rising two-note chime: a correct answer. */
  correct: () => { note(784, 0, 0.14, 0.11); note(1175, 0.09, 0.26, 0.11); },
  /** Gentle low "hmm" — informative, never harsh. */
  wrong: () => { note(330, 0, 0.16, 0.09, 'sine', 262); note(247, 0.12, 0.22, 0.07); },
  /** Paper flip when moving between lesson cards. */
  flip: () => noise(0, 0.12, 0.09, 3200),
  /** Ink stamp thud on the notebook. */
  stamp: () => { note(140, 0, 0.12, 0.16, 'sine', 70); noise(0, 0.05, 0.08, 900); },
  /** Small pentatonic flourish: session complete. */
  complete: () => [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, i * 0.09, 0.32, 0.1)),
  /** Koto-like pluck for streak milestones. */
  /** The app's own message tune (the same notes as the notification sound). */
  chime: () => [1047, 1319, 1568, 1760, 2093].forEach((f, i) => note(f, [0, 0.13, 0.26, 0.45, 0.58][i], 0.7, 0.08)),
  streak: () => [587, 880].forEach((f, i) => note(f, i * 0.07, 0.4, 0.09, 'triangle')),
};
