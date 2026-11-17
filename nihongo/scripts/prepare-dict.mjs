// Copies the offline reading dictionary (kuromoji) into public/ before a build.
// - files are renamed .dat.gz -> .dat.bin so no web server or Android tool
//   tries to "helpfully" decompress them on the way
// - the loader is patched to accept data that is already decompressed
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const src = 'node_modules/kuromoji', out = 'public/kuromoji';
if (!existsSync(`${out}/dict/base.dat.bin`)) {
  mkdirSync(`${out}/dict`, { recursive: true });
  for (const f of readdirSync(`${src}/dict`)) cpSync(`${src}/dict/${f}`, `${out}/dict/${f.replace(/\.gz$/, '.bin')}`);
}
let js = readFileSync(`${src}/build/kuromoji.js`, 'utf8');
js = js.replaceAll('.dat.gz', '.dat.bin');
const before = 'var gz = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer));\n        var typed_array = gz.decompress();\n        callback(null, typed_array.buffer);';
if (!js.includes(before)) throw new Error('kuromoji loader changed — update scripts/prepare-dict.mjs');
js = js.replace(before, 'var out; try { out = new zlib.Zlib.Gunzip(new Uint8Array(arraybuffer)).decompress().buffer; } catch (e) { out = arraybuffer; }\n        callback(null, out);');
writeFileSync(`${out}/kuromoji.js`, js);
console.log('reading dictionary ready');
