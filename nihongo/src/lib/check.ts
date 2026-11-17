// Answer checking for typed Japanese sentences.
// Philosophy: never silently mark a valid variant wrong, and always explain.
import { parseFuri, normalize, answerRegex, toKanaUsing, looksLatin, toHiragana } from './jp';

export interface SentenceLike { f: string; en: string; alt?: string[]; note?: string }
export interface CheckResult {
  ok: boolean;
  /** Short, friendly lines explaining what happened. */
  notes: string[];
  /** Per-character comparison against the expected kana (for highlighting). */
  diff?: { ch: string; ok: boolean }[];
}

export const PARTICLE_INFO: Record<string, string> = {
  は: 'は (wa) marks the topic — what the sentence is about.',
  が: 'が marks the subject, and is used with あります / います / すき.',
  を: 'を marks the direct object — the thing the action is done to.',
  に: 'に marks a destination, a point in time, or where something exists.',
  へ: 'へ (e) marks the direction of movement.',
  で: 'で marks where an action happens, or the means/tool used.',
  と: 'と means "with" (a person) or "and" (between nouns).',
  も: 'も means "also / too" and replaces は, が or を.',
  の: 'の links nouns: A の B = "B of A / A\'s B".',
  か: 'か at the end turns a sentence into a question.',
  から: 'から means "from" (a starting point or time).',
  まで: 'まで means "until / as far as".',
};
const PARTICLES = Object.keys(PARTICLE_INFO).sort((a, b) => b.length - a.length);

function variants(s: SentenceLike): string[] {
  const all = [s.f, ...(s.alt ?? [])];
  // Dropping 私は is natural Japanese, so accept it automatically.
  for (const f of [...all]) {
    const m = f.match(/^私\[わたし\]\{?は\}?\s+(.+)$/);
    if (m) all.push(m[1]);
  }
  return all;
}

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** Longest-common-subsequence diff of the user's kana against the expected kana. */
function diffChars(user: string, exp: string) {
  const n = user.length, m = exp.length;
  const t = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    t[i][j] = user[i] === exp[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const out: { ch: string; ok: boolean }[] = [];
  let i = 0, j = 0;
  while (j < m) {
    if (i < n && user[i] === exp[j]) { out.push({ ch: exp[j], ok: true }); i++; j++; }
    else if (i < n && t[i + 1][j] >= t[i][j + 1]) i++;
    else { out.push({ ch: exp[j], ok: false }); j++; }
  }
  return out;
}

export function checkSentence(s: SentenceLike, rawInput: string): CheckResult {
  const input = normalize(rawInput);
  if (!input) return { ok: false, notes: ['Nothing written yet — type your answer on the page first.'] };

  const all = variants(s);
  for (let i = 0; i < all.length; i++) {
    if (answerRegex(all[i]).test(input)) {
      const notes: string[] = [];
      if (i > 0) notes.push(`Your version is also correct. Another natural way: ${parseFuri(s.f).jp}`);
      if (s.note) notes.push(s.note);
      return { ok: true, notes };
    }
  }

  // --- Not accepted: work out the most useful explanation -----------------
  const notes: string[] = [];
  if (looksLatin(rawInput)) {
    notes.push('This looks like romaji. Switch your keyboard to Japanese, or turn on "Romaji → kana" above the page so your typing becomes kana.');
    return { ok: false, notes };
  }

  // Compare in kana against the closest accepted variant.
  let best = all[0], bestD = Infinity, bestUser = input;
  for (const f of all) {
    const exp = normalize(parseFuri(f).kana);
    const u = toKanaUsing(input, f);
    const d = lev(u, exp);
    if (d < bestD) { bestD = d; best = f; bestUser = u; }
  }
  const p = parseFuri(best);
  const expKana = normalize(p.kana);

  if (toHiragana(bestUser) === toHiragana(expKana)) {
    notes.push('The sounds are right, but check the script: loanwords are written in katakana and native words in hiragana.');
  }

  // Particles: look for "stem + different particle".
  for (const c of p.chunks) {
    const k = normalize(c.kana);
    const part = c.particle ?? PARTICLES.find(x => k.endsWith(x) && k.length > x.length && /[はがをにへでとも]$/.test(k) && c.segs.length > 1);
    if (!part || !k.endsWith(part)) continue;
    const stem = k.slice(0, -part.length);
    if (!stem || bestUser.includes(k)) continue;
    const at = bestUser.indexOf(stem);
    if (at < 0) continue;
    const after = bestUser.slice(at + stem.length);
    const used = PARTICLES.find(x => after.startsWith(x));
    if (used && used !== part) notes.push(`Particle: you wrote ${used} after ${c.jp.slice(0, -part.length)}, but this sentence needs ${part}. ${PARTICLE_INFO[part]}`);
    else if (!used) notes.push(`A particle is missing after ${c.jp.slice(0, -part.length)}: it needs ${part}. ${PARTICLE_INFO[part]}`);
  }

  // Politeness level.
  const polite = /(です|ます|ません|ました|でした|ましょう|ください)(か)?$/;
  if (polite.test(expKana) && !polite.test(bestUser)) {
    notes.push('Politeness: this exercise uses the polite form (です / ます), which is the safe default with people you do not know well.');
  }

  // Word order: all chunks present but shuffled.
  const chunks = p.chunks.map(c => normalize(c.kana));
  if (notes.length === 0 && chunks.every(c => bestUser.includes(c)) && bestUser.length === expKana.length) {
    notes.push('All the right pieces are here, but the order differs. Japanese usually puts the topic first and the verb last.');
  }

  // Missing chunks.
  const missing = p.chunks.filter(c => {
    const k = normalize(c.kana); const stem = c.particle ? k.slice(0, -c.particle.length) : k;
    return stem.length > 1 && !bestUser.includes(stem.slice(0, Math.max(2, stem.length - 2)));
  });
  if (missing.length && missing.length < p.chunks.length) {
    notes.push(`Missing or different: ${missing.map(c => c.jp).join('、 ')}`);
  }

  if (notes.length === 0) {
    notes.push(bestD <= 2
      ? 'Very close! Compare the highlighted characters — watch small っ, long vowels and ゛ marks.'
      : 'This differs from the expected sentence. Compare it with the model answer above.');
  }
  if (s.note) notes.push(s.note);
  return { ok: false, notes, diff: diffChars(bestUser, expKana) };
}

/** Loose check used for single words/kana (accept kana or kanji form). */
export function checkWord(expectedJp: string, expectedKana: string, raw: string): boolean {
  const u = normalize(raw);
  return u === normalize(expectedJp) || u === normalize(expectedKana);
}

/** 0–1 similarity of two strings (1 = identical), on normalised text. */
export function similarity(a: string, b: string): number {
  a = normalize(a); b = normalize(b);
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}
