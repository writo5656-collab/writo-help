// Backup and restore: everything (progress, mistakes, notes, settings) as one JSON file.
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, dayKey } from './db';

const TABLES = ['kv', 'items', 'mistakes', 'answers', 'notes', 'days', 'corrections'] as const;

export async function exportData(): Promise<string> {
  const data: Record<string, unknown> = { app: 'nihongo', version: 1, exported: new Date().toISOString() };
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  // Never include the AI proxy passphrase in a backup file.
  data.kv = (data.kv as { key: string; value: any }[]).map(r => r.key === 'settings' ? { ...r, value: { ...r.value, aiToken: '' } } : r);
  return JSON.stringify(data);
}

async function deliver(name: string, text: string, mime: string): Promise<string> {
  if (Capacitor.isNativePlatform()) {
    const r = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: name, url: r.uri, dialogTitle: 'Save your Nihongo backup' });
    return 'Choose where to save it (Drive, Files, email…).';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return `Saved as ${name} in your downloads.`;
}

export async function saveBackup() {
  const msg = await deliver(`nihongo-backup-${dayKey()}.json`, await exportData(), 'application/json');
  await db.kv.put({ key: 'lastBackup', value: Date.now() });
  return msg;
}

export async function exportNotes() {
  const notes = await db.notes.orderBy('updated').reverse().toArray();
  const text = notes.map(n => `# ${n.title || 'Untitled'}\n(${n.folder} · ${new Date(n.updated).toLocaleDateString()})\n\n${n.body}\n`).join('\n---\n\n');
  return deliver(`nihongo-notes-${dayKey()}.txt`, text || 'No notes yet.', 'text/plain');
}

export async function importData(json: string) {
  const data = JSON.parse(json);
  if (data?.app !== 'nihongo') throw new Error('This file is not a Nihongo backup.');
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const t of TABLES) {
      if (!Array.isArray(data[t])) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(data[t]);
    }
  });
}

export async function resetAll() { await db.delete(); location.reload(); }
