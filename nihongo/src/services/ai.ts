// AI tutor service (replaceable). Three ways to connect, chosen in Settings:
//  1. Proxy  — your own small server holds the API key (safest; see /server).
//  2. Claude — paste an Anthropic API key; requests go straight from this phone.
//  3. Gemini — paste a Google AI Studio key (has a free tier); straight from this phone.
// Direct keys are stored only on this device and are never included in backups.
import { loadSettings } from '../lib/settings';
import { tutorSystem, withOpener, REPLY_SCHEMA, type TutorRequest } from './tutorPrompt';

export interface ChatMsg { role: 'user' | 'assistant'; content: string }
export interface TutorReply { jp: string; kana: string; en: string; correction?: { said: string; better: string; why: string } | null }

export async function aiConfigured() {
  const s = await loadSettings();
  return s.aiMode === 'proxy' ? !!s.aiUrl.trim() : !!s.aiKey.trim();
}

function parseReply(text: string): TutorReply {
  const m = text.match(/\{[\s\S]*\}/);
  const data = JSON.parse(m ? m[0] : text);
  if (!data || typeof data.jp !== 'string') throw new Error('The tutor sent an unexpected reply.');
  return { jp: data.jp, kana: data.kana ?? '', en: data.en ?? '', correction: data.correction ?? null };
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

async function viaGemini(o: TutorRequest, key: string, model: string): Promise<TutorReply> {
  const m = model || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: tutorSystem(o) }] },
      contents: withOpener(o.messages).map(x => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  if (res.status === 400 || res.status === 403) throw new Error('Gemini rejected the request — check the API key and model name in Settings.');
  if (res.status === 429) throw new Error('Gemini\'s free limit was reached for now. Try again in a minute.');
  if (!res.ok) throw new Error(`Gemini error (${res.status}).`);
  const j = await res.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('');
  return parseReply(text);
}

export async function tutorReply(o: TutorRequest): Promise<TutorReply> {
  const s = await loadSettings();
  if (s.aiMode === 'claude') { if (!s.aiKey) throw new Error('Add your Claude API key in Settings → AI tutor.'); return viaClaude(o, s.aiKey.trim(), s.aiModel.trim()); }
  if (s.aiMode === 'gemini') { if (!s.aiKey) throw new Error('Add your Gemini API key in Settings → AI tutor.'); return viaGemini(o, s.aiKey.trim(), s.aiModel.trim()); }
  if (!s.aiUrl.trim()) throw new Error('The AI tutor is not set up yet. Choose a connection in Settings → AI tutor.');
  const res = await fetch(s.aiUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(s.aiToken ? { 'x-app-token': s.aiToken } : {}) },
    body: JSON.stringify(o),
  });
  if (!res.ok) throw new Error(`The tutor service answered with an error (${res.status}). Check the proxy address in Settings.`);
  return parseReply(JSON.stringify(await res.json()));
}
