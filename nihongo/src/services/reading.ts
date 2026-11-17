// Automatic kana readings for free text (kanji → kana), using the kuromoji
// dictionary bundled with the app, so it works offline. It is loaded only
// when first needed. Automatic readings are usually right but not always —
// screens that use this label it as automatic.
import { toHiragana } from 'wanakana';

let tokenizer: Promise<any> | null = null;

function load(): Promise<any> {
  if (tokenizer) return tokenizer;
  tokenizer = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = './kuromoji/kuromoji.js';
    s.onload = () => (window as any).kuromoji.builder({ dicPath: './kuromoji/dict' })
      .build((err: unknown, t: any) => (err ? reject(err) : resolve(t)));
    s.onerror = () => reject(new Error('Reading dictionary could not be loaded.'));
    document.head.appendChild(s);
  });
  tokenizer.catch(() => { tokenizer = null; });
  return tokenizer;
}

export async function readingOf(text: string): Promise<string> {
  if (!/[㐀-鿿]/.test(text)) return text;
  const t = await load();
  return text.split('\n').map(line =>
    t.tokenize(line).map((tok: any) => (tok.reading && /[㐀-鿿]/.test(tok.surface_form) ? toHiragana(tok.reading) : tok.surface_form)).join('')
  ).join('\n');
}
