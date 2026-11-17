// AI tutor service (replaceable). The app never contains an API key: it talks
// to YOUR small proxy (see /server in the project), which holds the key.
// If no proxy URL is set in Settings, the tutor is simply unavailable and the
// app says so — the scripted roleplays keep working offline.
import { loadSettings } from '../lib/settings';

export interface ChatMsg { role: 'user' | 'assistant'; content: string }
export interface TutorReply {
  jp: string;            // tutor's reply in Japanese
  kana: string;          // reading of the reply
  en: string;            // English meaning
  correction?: { said: string; better: string; why: string } | null;
}

export async function aiConfigured() { return !!(await loadSettings()).aiUrl.trim(); }

export async function tutorReply(o: { messages: ChatMsg[]; scenario: string; level: string; known: string; review?: string; persona?: string }): Promise<TutorReply> {
  const s = await loadSettings();
  if (!s.aiUrl.trim()) throw new Error('The AI tutor is not set up yet. Add your proxy URL in Settings.');
  const res = await fetch(s.aiUrl.trim(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(s.aiToken ? { 'x-app-token': s.aiToken } : {}) },
    body: JSON.stringify(o),
  });
  if (!res.ok) throw new Error(`The tutor service answered with an error (${res.status}). Check the proxy URL in Settings.`);
  const data = await res.json();
  if (!data || typeof data.jp !== 'string') throw new Error('The tutor service sent an unexpected reply.');
  return data as TutorReply;
}
