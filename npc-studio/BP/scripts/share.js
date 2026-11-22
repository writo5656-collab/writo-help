/**
 * NPC Studio — share.js : share presets as text codes, and load presets from preset packs.
 *
 *   Share code   "NPCS1-..." (letters, digits, - and _): the preset as JSON, compressed (LZW) so a
 *                full NPC with armor, trims and enchants is well under 1000 characters. Works on every
 *                device: copy it out of a text box, paste it into another player's game.
 *   Preset pack  a small behavior pack (Pack Builder website > Presets) with a tick function that sends
 *                "scriptevent npcstudio:preset <code>" while the scoreboard gate npcs_load #npcs is 1.
 *                NPC Studio opens the gate for a few ticks when the world loads, so every preset pack
 *                in the world reports its presets once. Many preset packs can be active together.
 *   PC files     .mcstructure files exported with a structure block, put in a behavior pack under
 *                structures/npcstudio_presets/; listed with getPackStructureIds().
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system } from "@minecraft/server";

// ---------- UTF-8 <-> bytes (names can have any letters) ----------
function utf8(s) {
  const out = [];
  for (const ch of s) {
    let c = ch.codePointAt(0);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return out;
}
function fromUtf8(b) {
  let s = "";
  for (let i = 0; i < b.length; ) {
    const c = b[i++];
    if (c < 0x80) s += String.fromCodePoint(c);
    else if (c < 0xe0) s += String.fromCodePoint(((c & 31) << 6) | (b[i++] & 63));
    else if (c < 0xf0) s += String.fromCodePoint(((c & 15) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
    else s += String.fromCodePoint(((c & 7) << 18) | ((b[i++] & 63) << 12) | ((b[i++] & 63) << 6) | (b[i++] & 63));
  }
  return s;
}

// ---------- LZW with growing code width, packed into 6-bit URL-safe characters ----------
const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const bitsFor = (n) => Math.max(9, Math.ceil(Math.log2(n + 1)));
export function pack(text) {
  const bytes = utf8(text);
  const dict = new Map();
  for (let i = 0; i < 256; i++) dict.set(String.fromCharCode(i), i);
  let next = 256, w = "";
  const codes = [];
  for (const b of bytes) {
    const c = String.fromCharCode(b), wc = w + c;
    if (dict.has(wc)) w = wc;
    else {
      codes.push([dict.get(w), bitsFor(next)]);
      dict.set(wc, next++);
      w = c;
    }
  }
  if (w) codes.push([dict.get(w), bitsFor(next)]);
  let acc = 0, n = 0, out = "";
  for (const [code, width] of codes) {
    for (let k = width - 1; k >= 0; k--) {
      acc = (acc << 1) | ((code >> k) & 1);
      if (++n === 6) { out += ABC[acc]; acc = 0; n = 0; }
    }
  }
  if (n) out += ABC[acc << (6 - n)];
  return out;
}
export function unpack(s) {
  const bits = [];
  for (const ch of s) {
    const v = ABC.indexOf(ch);
    if (v < 0) throw new Error("bad character");
    for (let k = 5; k >= 0; k--) bits.push((v >> k) & 1);
  }
  const dict = [];
  for (let i = 0; i < 256; i++) dict.push([i]);
  let pos = 0, next = 256;
  const read = (width) => {
    if (pos + width > bits.length) return -1;
    let v = 0;
    for (let k = 0; k < width; k++) v = (v << 1) | bits[pos++];
    return v;
  };
  let code = read(bitsFor(next));
  if (code < 0 || code > 255) throw new Error("empty");
  let w = dict[code];
  const out = [...w];
  for (;;) {
    code = read(bitsFor(next + 1));
    if (code < 0) break;
    let entry;
    if (code < dict.length) entry = dict[code];
    else if (code === dict.length) entry = [...w, w[0]];
    else throw new Error("broken code");
    out.push(...entry);
    dict.push([...w, entry[0]]);
    next++;
    w = entry;
  }
  return fromUtf8(out);
}

// ---------- preset <-> code ----------
const PREFIX = "NPCS1-";
const MC = "minecraft:";
function strip(v) { // shorter: no "minecraft:" in item ids, no all-zero pose parts
  if (typeof v === "string") return v.startsWith(MC) ? "~" + v.slice(MC.length) : v;
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) {
      if (Array.isArray(x) && x.length && x.every((n) => n === 0)) continue;
      o[k] = strip(x);
    }
    return o;
  }
  return v;
}
function unstrip(v) {
  if (typeof v === "string") return v.startsWith("~") ? MC + v.slice(1) : v;
  if (Array.isArray(v)) return v.map(unstrip);
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, unstrip(x)]));
  return v;
}
/** Text code for a preset (its data plus a title). */
export function presetToCode(title, data) {
  const { struct: _s, ...rest } = data;
  return PREFIX + pack(JSON.stringify(strip({ ...rest, t: title })));
}
/** { title, data } from a code, or throws with a message a player can read. */
export function codeToPreset(code) {
  const c = String(code ?? "").replace(/\s+/g, "");
  if (!c.startsWith(PREFIX)) throw new Error("That isn't an NPC Studio code. Codes start with NPCS1-");
  let data;
  try {
    data = unstrip(JSON.parse(unpack(c.slice(PREFIX.length))));
  } catch {
    throw new Error("That code is broken or cut off. Copy the whole code again.");
  }
  if (!data || typeof data !== "object" || !data.pose) throw new Error("That code has no NPC in it.");
  const title = String(data.t || "Shared preset").slice(0, 32);
  delete data.t;
  return { title, data };
}

// ---------- presets from preset packs (scriptevent) ----------
const fromPacks = new Map(); // title -> { title, data, pack }
export const packPresets = () => [...fromPacks.values()].sort((a, b) => a.title.localeCompare(b.title));
system.afterEvents.scriptEventReceive.subscribe((e) => {
  if (e.id !== "npcstudio:preset") return;
  try {
    const p = codeToPreset(e.message);
    fromPacks.set(p.title, p);
  } catch (err) {
    console.warn(`[NPC Studio] preset pack sent a bad code: ${err.message}`);
  }
});
/** Ask every preset pack in the world to send its presets (they listen while npcs_load #npcs is 1). */
export function callPresetPacks() {
  try {
    const sb = world.scoreboard;
    const obj = sb.getObjective("npcs_load") ?? sb.addObjective("npcs_load", "NPC Studio");
    obj.setScore("#npcs", 1);
    system.runTimeout(() => {
      try {
        obj.setScore("#npcs", 0);
      } catch {
        /* removed */
      }
    }, 4);
  } catch (e) {
    console.warn(`[NPC Studio] preset packs: ${e}`);
  }
}
world.afterEvents.worldLoad?.subscribe?.(() => system.runTimeout(callPresetPacks, 20));

// ---------- exact copies from .mcstructure files in behavior packs (PC export) ----------
export function packStructures() {
  try {
    return world.structureManager.getPackStructureIds().filter((id) => id.startsWith("npcstudio_presets:"));
  } catch {
    return [];
  }
}
