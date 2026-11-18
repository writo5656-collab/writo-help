// "Can't speak now": pause speaking questions for an hour (like Duolingo).
import { getKV, setKV } from '../lib/db';
let offUntil = 0;
void getKV<number>('speakOffUntil', 0).then(v => { offUntil = v; });
export const speakingOff = () => Date.now() < offUntil;
export async function pauseSpeaking(ms = 3600000) { offUntil = Date.now() + ms; await setKV('speakOffUntil', offUntil); }
