// Nihongo AI tutor proxy — a Supabase Edge Function.
//
// The phone app never holds the API key. It sends the conversation here; this
// function adds the key (stored as a Supabase secret) and calls Claude.
//
// Secrets to set (see ../../README.md) — use ONE of the two AI providers:
//   GEMINI_API_KEY      a Google AI Studio key (has a free tier)  ← free option
//   ANTHROPIC_API_KEY   an Anthropic API key (paid per use)
//   APP_TOKEN           any passphrase you invent; the app must send the same one
//   GEMINI_MODEL        optional, default gemini-2.5-flash
import Anthropic from "npm:@anthropic-ai/sdk";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";
import { z } from "npm:zod";

const Reply = z.object({
  jp: z.string().describe("The tutor's reply in natural Japanese"),
  kana: z.string().describe("The same reply written only in hiragana/katakana"),
  en: z.string().describe("Natural English translation of the reply"),
  correction: z.object({
    said: z.string().describe("The part of the learner's last message that had a problem"),
    better: z.string().describe("A corrected, natural version"),
    why: z.string().describe("One short, kind explanation in English"),
  }).nullable().describe("null when the learner's last message was fine or there was none"),
  hint: z.object({ jp: z.string(), kana: z.string(), romaji: z.string(), en: z.string() }).describe("A very short, easy example answer the learner could give"),
});

const SCENARIOS: Record<string, string> = {
  free: "Have a friendly everyday conversation.",
  intro: "Roleplay: you are a classmate meeting the learner for the first time. Practise self-introductions.",
  restaurant: "Roleplay: you are staff at a casual restaurant in Japan. The learner is a customer ordering food.",
  shopping: "Roleplay: you are a cashier at a convenience store. The learner is buying things.",
  hotel: "Roleplay: you are a hotel receptionist. The learner is checking in.",
  directions: "Roleplay: you are a passer-by. The learner asks you for directions.",
  university: "Roleplay: you are a fellow university student chatting before class.",
  work: "Roleplay: you are a colleague at a Japanese office. Use polite workplace Japanese.",
  lesson: "This is a relaxed, CASUAL call about what the learner studied TODAY, like chatting with a friend. Use casual plain-form Japanese, one short sentence, mostly words from today's material, and ONE simple question about it at a time. Accept any answer (even one word or English), reply warmly, and show how to say it. Stay within today's material.",
  explain: "EXPLAIN MODE — do not chat. The learner's message describes one exercise and the answer they gave. Write the explanation in simple, friendly English in \"en\" (3 to 6 short sentences, no long lectures): first say if their answer is right; if it is wrong, say exactly what differs and why; then explain the key word or grammar point and how the sentence is built. Put ONE new short example sentence that uses the same point in \"jp\" (with its kana in \"kana\"). Set \"correction\" to null. Make \"hint\" another short example.",
  call: "This is a friendly video call. Talk naturally about the learner's day, plans and interests, and ask one question at a time.",
  sunday: "This is the learner's relaxed weekly review. Through friendly conversation and short questions, revisit the items listed under 'Recent mistakes'. After about eight exchanges, give a brief summary in English inside the 'en' field: strengths, weak points and what to focus on next.",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-app-token, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const client = GEMINI_KEY ? null : new Anthropic(); // reads ANTHROPIC_API_KEY from the function's secrets

async function viaGemini(system: string, history: { role: string; content: string }[]) {
  const model = Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash";
  const ask = (think: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(30000),
    headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system + '\nReply ONLY with JSON: {"jp","kana","en","correction": {"said","better","why"} or null,"hint": {"jp","kana","romaji","en"}}.' }] },
      contents: history.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { responseMimeType: "application/json", temperature: 0.7, ...(think ? {} : { thinkingConfig: { thinkingBudget: 0 } }) },
    }),
  });
  let r = await ask(false);
  if (r.status === 400) r = await ask(true); // model does not accept thinkingConfig
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const data = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? text);
  return Reply.parse({ jp: data.jp, kana: data.kana ?? "", en: data.en ?? "", correction: data.correction ?? null, hint: { jp: data.hint?.jp ?? "", kana: data.hint?.kana ?? "", romaji: data.hint?.romaji ?? "", en: data.hint?.en ?? "" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const expected = Deno.env.get("APP_TOKEN");
  if (expected && req.headers.get("x-app-token") !== expected) return json({ error: "Wrong app passphrase" }, 401);

  let body: { messages?: { role: "user" | "assistant"; content: string }[]; scenario?: string; level?: string; known?: string; review?: string; persona?: string; lesson?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const history = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-30)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  // The API needs the conversation to start with the learner; if the tutor is asked to begin, add a neutral opener.
  if (history.length === 0 || history[0].role !== "user") history.unshift({ role: "user", content: "（会話を始めてください）" });

  const system = [
    "You are a warm, patient Japanese conversation tutor for one adult learner who plans to live, study and work in Japan.",
    `Learner level: ${String(body.level ?? "beginner").slice(0, 200)}. Lessons completed so far: ${String(body.known ?? "unknown").slice(0, 1500)}.`,
    SCENARIOS[body.scenario ?? "free"] ?? SCENARIOS.free,
    body.lesson ? `Today's material:\n${String(body.lesson).slice(0, 2500)}` : "",
    body.persona ? `Speak in the friendly, recognisable tone of ${String(body.persona).slice(0, 120)}. Keep it light and in character, but write only your own original lines (never quote the show) and keep the Japanese simple.` : "",
    body.scenario === "sunday" ? `Recent mistakes: ${String(body.review ?? "none").slice(0, 3000)}` : "",
    "Rules:",
    "- Reply in Japanese pitched just slightly above the learner's level: short sentences, common words, polite です/ます form unless the scenario needs otherwise.",
    body.scenario === "explain" ? "- In explain mode, ignore the length rule below: explain in English in 'en'." : "",
    "- Keep each reply to one to three short sentences and end with something the learner can answer.",
    "- If the learner's last message has a real mistake (particle, verb form, word choice, politeness), fill in 'correction' with a gentle, specific note. Ignore missing punctuation and do not correct things that are merely one of several natural options. Otherwise set 'correction' to null.",
    "- Never scold. Mistakes are welcome.",
    "- 'kana' must contain no kanji.",
  ].filter(Boolean).join("\n");

  try {
    if (GEMINI_KEY) return json(await viaGemini(system, history));
    const response = await client!.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low", format: zodOutputFormat(Reply) },
      system,
      messages: history,
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) return json({ error: "The tutor could not answer that. Try rephrasing." }, 502);
    return json(response.parsed_output);
  } catch (err) {
    if (GEMINI_KEY) return json({ error: "Gemini request failed — check GEMINI_API_KEY and the free-tier limit." }, 502);
    if (err instanceof Anthropic.AuthenticationError) return json({ error: "The API key on the proxy is missing or invalid." }, 500);
    if (err instanceof Anthropic.RateLimitError) return json({ error: "Rate limited. Wait a moment and try again." }, 429);
    if (err instanceof Anthropic.APIError) return json({ error: `Tutor service error (${err.status ?? "network"}).` }, 502);
    return json({ error: "Unexpected proxy error." }, 500);
  }
});
