// AI tutor service (replaceable). Three ways to connect, chosen in Settings:
//  1. Proxy  — your own small server holds the API key (safest; see /server).
//  2. Claude — paste an Anthropic API key; requests go straight from this phone.
//  3. Gemini — paste a Google AI Studio key (has a free tier); straight from this phone.
// Direct keys are stored only on this device and are never included in backups.
import { loadSettings, saveSettings } from '../lib/settings';
import { tutorSystem, withOpener, REPLY_SCHEMA, type TutorRequest } from './tutorPrompt';

export interface ChatMsg { role: 'user' | 'assistant'; content: string }
export interface TutorReply { jp: string; kana: string; en: string; correction?: { said: string; better: string; why: string } | null; hint?: { jp: string; kana: string; romaji?: string; en: string } | null }

export async function aiConfigured() {
  const s = await loadSettings();
  return s.aiMode === 'proxy' ? !!s.aiUrl.trim() : !!s.aiKey.trim();
}

function parseReply(text: string): TutorReply {
  const m = text.match(/\{[\s\S]*\}/);
  const data = JSON.parse(m ? m[0] : text);
  if (!data || typeof data.jp !== 'string') throw new Error('The tutor sent an unexpected reply.');
  const h = data.hint && typeof data.hint.jp === 'string' ? { jp: data.hint.jp, kana: data.hint.kana ?? '', romaji: data.hint.romaji ?? '', en: data.hint.en ?? '' } : null;
  return { jp: data.jp, kana: data.kana ?? '', en: data.en ?? '', correction: data.correction ?? null, hint: h };
}

async function viaClaude(o: TutorRequest, key: string, model: string): Promise<TutorReply> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  try {
    const r = await client.beta.messages.create({
      model: model || 'claude-opus-5-5',
      max_tokens: 2000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: REPLY_SCHEMA as unknown as Record<string, unknown> } },
      system: tutorSystem(o),
      messages: withOpener(o.messages),
    });
    if (r.stop_reason === 'refusal') throw new Error('The tutor could not answer that. Try saying it another way.');
    const text = r.content.flatMap(b => (b.type === 'text' ? [b.text] : [])).join('');
    return parseReply(text);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new Error('The Claude API key is not valid. Check it in Settings → AI tutor.');
    if (e instanceof Anthropic.RateLimitError) throw new Error('Too many requests — wait a moment and try again.');
    if (e instanceof Anthropic.APIError) throw new Error(`Claude API error (${e.status ?? 'network'}).`);
    throw e;
  }
}

/** Flash chat models ranked best-first: stable before preview, newest version first. */
export function rankGeminiModels(names: string[]): string[] {
  const ok = names.map(n => n.replace(/^models\//, '')).filter(n => /^gemini-/.test(n) && /flash/.test(n) && !/(image|tts|audio|live|embedding|vision|thinking|native)/.test(n));
  const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? '0');
  const score = (n: string) => ver(n) * 100 - (/lite/.test(n) ? 5 : 0) - (/(preview|exp)/.test(n) ? 20 : 0) - (/-\d{3,}$|\d{2}-\d{2}/.test(n) ? 2 : 0) + (/latest/.test(n) ? 1 : 0);
  return ok.sort((a, b) => score(b) - score(a));
}
export const pickGeminiModel = (names: string[]) => rankGeminiModels(names)[0];

let modelCache: { key: string; list: string[] } | null = null;
async function rankedFor(key: string) {
  if (modelCache?.key !== key) modelCache = { key, list: rankGeminiModels(await geminiModels(key)) };
  return modelCache.list;
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Ask Google which models this key can use (only ones that can chat). */
export async function geminiModels(key: string): Promise<string[]> {
  const out: string[] = [];
  let page = '';
  for (let i = 0; i < 3; i++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=100${page ? `&pageToken=${page}` : ''}`, { headers: { 'x-goog-api-key': key } });
    if (r.status === 400 || r.status === 403) throw new Error('Gemini rejected the API key — copy it again from AI Studio.');
    if (!r.ok) throw new Error(`Could not list Gemini models (${r.status}).`);
    const j = await r.json();
    for (const m of j.models ?? []) if ((m.supportedGenerationMethods ?? []).includes('generateContent')) out.push(String(m.name).replace(/^models\//, ''));
    page = j.nextPageToken ?? ''; if (!page) break;
  }
  return out;
}

/** One request to one model. Returns the HTTP status and, on success, the parsed reply. */
async function geminiOnce(o: TutorRequest, key: string, m: string): Promise<{ status: number; reply?: TutorReply }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: tutorSystem(o) }] },
      contents: withOpener(o.messages).map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  if (!res.ok) return { status: res.status };
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  return { status: 200, reply: parseReply(text) };
}

/**
 * Gemini with automatic recovery:
 *  - 404 (model retired): pick a current model and remember it.
 *  - 503/500 (Google busy): wait and retry, then try the next Flash model for this message.
 *  - 429 (free limit for that model): try the next model, which has its own free limit.
 */
async function viaGemini(o: TutorRequest, key: string, model: string): Promise<TutorReply> {
  let ranked: string[] = [];
  try { ranked = await rankedFor(key); } catch (e) { if (!model) throw e; }
  const first = model || ranked[0] || 'gemini-flash-latest';
  if (!model) await saveSettings({ aiModel: first });
  const order = [first, ...ranked.filter(m => m !== first)].slice(0, 4);
  let last = 0;
  for (let i = 0; i < order.length; i++) {
    const m = order[i];
    for (let attempt = 0; attempt < (i === 0 ? 2 : 1); attempt++) {
      const r = await geminiOnce(o, key, m);
      if (r.reply) {
        if (i > 0 && last === 404) await saveSettings({ aiModel: m }); // the saved one is gone for good
        return r.reply;
      }
      last = r.status;
      if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error('Gemini rejected the request — check the API key in Settings.');
      if (r.status === 503 || r.status === 500) { await wait(1200 * (attempt + 1)); continue; }
      break; // 404 or 429: move straight to the next model
    }
  }
  if (last === 429) throw new Error('Gemini\'s free limit is used up for now on every model. Try again later (limits reset daily).');
  if (last === 503 || last === 500) throw new Error('Google\'s Gemini servers are busy right now. Wait a minute and try again.');
  throw new Error(`Gemini error (${last}).`);
}

export async function tutorReply(o: TutorRequest): Promise<TutorReply> {
  const s = await loadSettings();
  if (s.aiMode === 'claude') { if (!s.aiKey) throw new Error('Add your Claude API key in Settings → AI tutor.'); return viaClaude(o, s.aiKey.trim(), s.aiModel.trim()); }
  if (s.aiMode === 'gemini') { if (!s.aiKey) throw new Error('Add your Gemini API key in Settings → AI tutor.'); return viaGemini(o, s.aiKey.trim(), s.aiModel.trim()); }
  if (!s.aiUrl.trim()) throw new Error('The AI tutor is not set up yet. Choose a connection in Settings → AI tutor.');
  const res = await fetch(s.aiUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(s.aiToken ? { 'x-app-token': s.aiToken } : {}), ...(s.aiProxyKey ? { Authorization: `Bearer ${s.aiProxyKey}`, apikey: s.aiProxyKey } : {}) },
    body: JSON.stringify(o),
  });
  if (res.status === 401) { const t = await res.text(); throw new Error(/passphrase/i.test(t) ? 'Wrong app passphrase — it must match APP_TOKEN on Supabase.' : 'Supabase asked for a login: turn off "Verify JWT" for the function, or paste your anon key in Settings → AI tutor → Supabase key.'); }
  if (!res.ok) throw new Error(`The tutor service answered with an error (${res.status}). Check the proxy address in Settings.`);
  return parseReply(JSON.stringify(await res.json()));
}
