// Nihongo AI tutor — phone-friendly, single-file version (Gemini, free tier).
// Paste this whole file into Supabase → Edge Functions → Deploy a new function → Via Editor.
// Secrets (Edge Functions → Secrets):  GEMINI_API_KEY (required), APP_TOKEN (recommended), GEMINI_MODEL (optional — chosen automatically if empty)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-app-token, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const SCENARIOS: Record<string, string> = {
  free: "Have a friendly everyday conversation.",
  call: "This is a friendly video call. Talk naturally about the learner's day, plans and interests. Ask one question at a time.",
  sunday: "This is the learner's weekly review. Revisit the items under 'Recent mistakes' through conversation.",
  lesson: "This is a relaxed, CASUAL call about what the learner studied TODAY, like chatting with a friend. Use casual plain-form Japanese, one short sentence, mostly words from today's material, and ONE simple question about it at a time. Accept any answer (even one word or English), reply warmly, and show how to say it. Stay within today's material.",
};

// Google renames models over time, so ask which Flash model this key can use (cached per instance).
let cachedModel = "";
async function bestModel(key: string): Promise<string> {
  if (cachedModel) return cachedModel;
  const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=100", { headers: { "x-goog-api-key": key } });
  const j = r.ok ? await r.json() : { models: [] };
  const names: string[] = (j.models ?? []).filter((m: { supportedGenerationMethods?: string[] }) => (m.supportedGenerationMethods ?? []).includes("generateContent")).map((m: { name: string }) => m.name.replace(/^models\//, ""));
  const ok = names.filter((n) => /^gemini-/.test(n) && /flash/.test(n) && !/(image|tts|audio|live|embedding|vision|thinking|native)/.test(n));
  const ver = (n: string) => parseFloat(n.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? "0");
  const score = (n: string) => ver(n) * 100 - (/lite/.test(n) ? 5 : 0) - (/(preview|exp)/.test(n) ? 20 : 0);
  cachedModel = ok.sort((a, b) => score(b) - score(a))[0] ?? "gemini-flash-latest";
  return cachedModel;
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const token = Deno.env.get("APP_TOKEN");
  if (token && req.headers.get("x-app-token") !== token) return json({ error: "Wrong app passphrase" }, 401);
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "GEMINI_API_KEY secret is missing" }, 500);

  let body: { messages?: { role: string; content: string }[]; scenario?: string; level?: string; known?: string; review?: string; persona?: string; lesson?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const history = (body.messages ?? []).filter((m) => typeof m.content === "string" && m.content.trim()).slice(-30);
  if (!history.length || history[0].role !== "user") history.unshift({ role: "user", content: "（会話を始めてください）" });

  const system = [
    "You are a warm, patient Japanese conversation tutor for one adult learner who plans to live, study and work in Japan.",
    `Learner level: ${String(body.level ?? "beginner").slice(0, 200)}. Lessons done: ${String(body.known ?? "").slice(0, 1500)}.`,
    SCENARIOS[body.scenario ?? "free"] ?? SCENARIOS.free,
    body.persona ? `Speak in the friendly tone of ${String(body.persona).slice(0, 120)}, with your own original lines only.` : "",
    body.scenario === "sunday" ? `Recent mistakes: ${String(body.review ?? "none").slice(0, 3000)}` : "",
    body.lesson ? `Today's material:\n${String(body.lesson).slice(0, 2500)}` : "",
    "Reply in simple, polite Japanese (one to three short sentences) that ends with something the learner can answer.",
    "If the learner's last message has a real mistake, add a gentle correction; otherwise correction is null. Never scold.",
    'Always include "hint": a very short easy example answer the learner could give.',
    'Reply ONLY with JSON: {"jp": string, "kana": string (kana only), "en": string, "correction": {"said": string, "better": string, "why": string} or null, "hint": {"jp": string, "kana": string, "romaji": string, "en": string}}',
  ].filter(Boolean).join("\n");

  const model = Deno.env.get("GEMINI_MODEL") || (await bestModel(key));
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content.slice(0, 2000) }] })),
      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
    }),
  });
  if (r.status === 429) return json({ error: "Gemini free limit reached — try again later." }, 429);
  if (!r.ok) return json({ error: `Gemini error ${r.status}` }, 502);
  try {
    const j = await r.json();
    const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
    const d = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
    if (typeof d.jp !== "string") throw new Error("bad");
    return json({ jp: d.jp, kana: d.kana ?? "", en: d.en ?? "", correction: d.correction ?? null, hint: d.hint ?? null });
  } catch {
    return json({ error: "The tutor sent an unexpected reply. Try again." }, 502);
  }
}

Deno.serve(handler);
