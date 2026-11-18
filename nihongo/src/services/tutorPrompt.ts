// The tutor's instructions, shared by the direct-API modes (the proxy has its own copy).
export interface TutorRequest { messages: { role: 'user' | 'assistant'; content: string }[]; scenario: string; level: string; known: string; review?: string; persona?: string; lesson?: string }

const SCENARIOS: Record<string, string> = {
  free: 'Have a friendly everyday conversation.',
  lesson: 'This is a relaxed, CASUAL call about what the learner studied TODAY, like chatting with a friend. Speak casual, friendly Japanese (plain form, e.g. 〜だよ / 〜する？), very short: one sentence of at most about 12 words. Use mostly words and patterns from today\'s material below, and ask ONE simple question about it at a time (for example, use a new word in a question about the learner\'s life). Accept ANY answer — a single word, broken Japanese, or English — and reply warmly, then show them how to say it. Do not bring in topics or grammar beyond today\'s material.',
  call: 'This is a friendly video call. Talk naturally about the learner\'s day, plans and interests, and ask one question at a time.',
  intro: 'Roleplay: you are a classmate meeting the learner for the first time.',
  restaurant: 'Roleplay: you are staff at a casual restaurant in Japan; the learner is ordering.',
  shopping: 'Roleplay: you are a convenience-store cashier.',
  hotel: 'Roleplay: you are a hotel receptionist; the learner is checking in.',
  directions: 'Roleplay: you are a passer-by; the learner asks for directions.',
  university: 'Roleplay: you are a fellow university student.',
  work: 'Roleplay: you are a colleague at a Japanese office. Use polite workplace Japanese.',
  sunday: 'This is the learner\'s relaxed weekly review. Revisit the items under "Recent mistakes" through conversation. After about eight exchanges, give a short summary in English inside the "en" field.',
};

export function tutorSystem(o: TutorRequest): string {
  return [
    'You are a warm, patient Japanese conversation tutor for one adult learner who plans to live, study and work in Japan.',
    `Learner level: ${o.level.slice(0, 200)}. Lessons completed: ${o.known.slice(0, 1500)}.`,
    SCENARIOS[o.scenario] ?? SCENARIOS.free,
    o.persona ? `Speak in the friendly, recognisable tone of ${o.persona.slice(0, 120)}, but write only your own original lines (never quote the show) and keep the Japanese simple.` : '',
    o.scenario === 'sunday' ? `Recent mistakes: ${(o.review ?? 'none').slice(0, 3000)}` : '',
    o.lesson ? `Today's material:\n${o.lesson.slice(0, 2500)}` : '',
    o.scenario === 'lesson' ? '' : 'Rules: reply in simple Japanese slightly above the learner\'s level, one to three short sentences, ending with something they can answer. Use です/ます unless the scenario needs otherwise.',
    'If the learner\'s last message has a real mistake (particle, verb form, word choice, politeness), fill "correction" with a gentle note; otherwise set it to null. Never scold.',
    'Always include "hint": a very short, easy example of what the learner could answer to your question (Japanese, its kana, its romaji with spaces between words and particles written as pronounced, e.g. "mizu o nomimasu", and English).',
    'Reply ONLY with JSON: {"jp": string, "kana": string (the reply in kana only, no kanji), "en": string, "correction": {"said": string, "better": string, "why": string} | null, "hint": {"jp": string, "kana": string, "romaji": string, "en": string}}.',
  ].filter(Boolean).join('\n');
}

export const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    jp: { type: 'string' }, kana: { type: 'string' }, en: { type: 'string' },
    correction: { anyOf: [{ type: 'null' }, { type: 'object', properties: { said: { type: 'string' }, better: { type: 'string' }, why: { type: 'string' } }, required: ['said', 'better', 'why'], additionalProperties: false }] },
    hint: { type: 'object', properties: { jp: { type: 'string' }, kana: { type: 'string' }, romaji: { type: 'string' }, en: { type: 'string' } }, required: ['jp', 'kana', 'romaji', 'en'], additionalProperties: false },
  },
  required: ['jp', 'kana', 'en', 'correction', 'hint'],
  additionalProperties: false,
} as const;

export function withOpener(msgs: TutorRequest['messages']) {
  const m = msgs.filter(x => x.content.trim()).slice(-30);
  if (!m.length || m[0].role !== 'user') m.unshift({ role: 'user', content: '（会話を始めてください）' });
  return m;
}
