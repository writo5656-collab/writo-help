// Character pictures. Nothing is bundled with the app: on first use each
// picture is downloaded from AniList (the public anime database) and saved on
// the device so it also works offline. You can replace any picture — or add
// separate "happy" and "oops" reaction pictures — with your own images.
import { db, type PortraitRec } from '../lib/db';
import { CAST } from '../content/cast';
import { loadSettings } from '../lib/settings';

export type Mood = 'teach' | 'happy' | 'oops';
const MONTH = 30 * 86400000;
let running: Promise<void> | null = null;

function toDataUrl(b: Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

/** Ask AniList for the current picture addresses (they occasionally change). */
async function freshUrls(): Promise<Record<number, string>> {
  const ids = Object.values(CAST).map(c => c.al?.[0]).filter(Boolean);
  const r = await fetch('https://graphql.anilist.co', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: `{ Page(perPage: 50) { characters(id_in: [${ids.join(',')}]) { id image { large } } } }` }),
  });
  if (!r.ok) throw new Error(`AniList ${r.status}`);
  const j = await r.json();
  return Object.fromEntries((j.data?.Page?.characters ?? []).map((c: { id: number; image: { large: string } }) => [c.id, c.image.large]));
}

/** Download and store any missing or month-old pictures. Safe to call often. */
export function syncPortraits(force = false, onProgress?: (done: number, total: number) => void): Promise<void> {
  return (running ??= (async () => {
    if (!(await loadSettings()).pictures || (typeof navigator !== 'undefined' && navigator.onLine === false)) return;
    const have = new Map((await db.portraits.toArray()).map(p => [p.id, p]));
    const todo = Object.values(CAST).filter(c => c.al && (force || !have.get(c.id)?.data || Date.now() - (have.get(c.id)?.fetched ?? 0) > MONTH));
    if (!todo.length) return;
    let urls: Record<number, string> = {};
    try { urls = await freshUrls(); } catch { /* use the saved addresses */ }
    let n = 0; onProgress?.(0, todo.length);
    for (const c of todo) {
      onProgress?.(n++, todo.length);
      const url = urls[c.al![0]] ?? c.al![1];
      try {
        // 'reload' skips the browser's copy from <img> loads, which cannot be read back.
        const res = await fetch(url, { cache: 'reload', mode: 'cors' });
        if (!res.ok) continue;
        const data = await toDataUrl(await res.blob());
        await db.portraits.put({ ...(have.get(c.id) ?? { id: c.id }), id: c.id, data, url, fetched: Date.now() });
      } catch { await db.portraits.put({ ...(have.get(c.id) ?? { id: c.id }), id: c.id, url }); }
    }
    onProgress?.(todo.length, todo.length);
  })().finally(() => { running = null; }));
}

export function pick(rec: PortraitRec | undefined, id: string, mood: Mood): string | undefined {
  return rec?.custom?.[mood] ?? rec?.custom?.teach ?? rec?.data ?? rec?.url ?? CAST[id]?.al?.[1];
}

export async function setCustom(id: string, mood: Mood, data: string | null) {
  const rec = (await db.portraits.get(id)) ?? { id };
  const custom = { ...(rec.custom ?? {}) };
  if (data) custom[mood] = data; else delete custom[mood];
  await db.portraits.put({ ...rec, custom });
}

/** Shrink a picked photo so the database stays small. */
export async function fileToPortrait(file: File, max = 640): Promise<string> {
  const img = new Image();
  img.src = URL.createObjectURL(file);
  await img.decode();
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  URL.revokeObjectURL(img.src);
  return c.toDataURL('image/webp', 0.85);
}

/** Extra pictures from MyAnimeList (via the Jikan API) to use as reactions. */
export async function gallery(name: string): Promise<string[]> {
  const s = await fetch(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(name)}&order_by=favorites&sort=desc&limit=1`);
  if (!s.ok) throw new Error('Could not reach MyAnimeList right now.');
  const id = (await s.json()).data?.[0]?.mal_id;
  if (!id) return [];
  const p = await fetch(`https://api.jikan.moe/v4/characters/${id}/pictures`);
  if (!p.ok) throw new Error('Could not reach MyAnimeList right now.');
  return ((await p.json()).data ?? []).map((x: { jpg?: { image_url?: string } }) => x.jpg?.image_url).filter(Boolean).slice(0, 12);
}

export async function urlToData(url: string): Promise<string> {
  const r = await fetch(url, { cache: 'reload', mode: 'cors' }); if (!r.ok) throw new Error(String(r.status));
  return toDataUrl(await r.blob());
}

export async function picturesReady(): Promise<{ have: number; total: number }> {
  const total = Object.values(CAST).filter(c => c.al).length;
  const have = (await db.portraits.toArray()).filter(p => p.data).length;
  return { have, total };
}
