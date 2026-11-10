/**
 * NPC Studio V3 — selection.js : selected NPCs + the cyan outline everyone sees.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 *
 * The outline, "NPC Bright" and the cape share one entity property (npcstudio:flags):
 *   bit 0 (1)        outline visible
 *   bit 1 (2)        NPC Bright (ignores world lighting)
 *   bits 2-5 (4..60) cape number (0 = none, 1-8)
 *   bit 6 (64)       prop mode: body hidden, only the held block/item shows
 *   bits 7-8         outline thickness (0 thin, 1 medium, 2 thick)
 *   bit 9 (512)      outline style: 0 silhouette (custom material), 1 wireframe boxes
 *   bit 10 (1024)    wears armor (silhouette sits outside the armor)
 *   bit 14 (16384)   outline hugs the head (the skin has no hat layer)
 *   bit 15 (32768)   outline hugs body and limbs (the skin has no jacket / sleeve layer)
 *   bits 11-13       Item State picture (bow pulling 0-3, crossbow 0-5), read by RP/attachables
 * Outlines are hidden for everyone while anybody is filming (camera view, peek, Photo Mode),
 * so a selection never ends up in a shot.
 */
import { world, system, NPC_FAMILY } from "./core.js";
import { SKIN_LAYERS } from "./skinmeta.js";

const selections = new Map(); // player.id -> Map(npc.id -> npc)
const filming = new Set(); // player ids currently looking through a camera / taking a photo
let outlinesHidden = false; // Layers tab: "Outline" switch

// ---------- flags ----------
export function getFlags(npc) {
  try {
    return Number(npc.getProperty("npcstudio:flags") ?? 0);
  } catch {
    return 0;
  }
}
function setFlags(npc, v) {
  try {
    if (getFlags(npc) !== v) npc.setProperty("npcstudio:flags", v);
  } catch {
    /* NPC from an older version that hasn't reloaded yet */
  }
}
export function isBright(npc) {
  return (getFlags(npc) & 2) !== 0;
}
export function setBright(npc, on) {
  const f = getFlags(npc);
  setFlags(npc, on ? f | 2 : f & ~2);
}
export function getCape(npc) {
  return (getFlags(npc) >> 2) & 15;
}
export function setCape(npc, n) {
  setFlags(npc, (getFlags(npc) & ~60) | ((n & 15) << 2));
}
// ---------- outline look (shared by everyone, stored per NPC; set from the editor) ----------
export const THICKNESS = ["Thin", "Medium", "Thick"];
export const OUTLINE_STYLES = ["Silhouette", "Wireframe"];
const outlineLook = { thick: 0, style: 0 }; // world default (thin silhouette), changed in the editor
export function getOutlineLook() {
  return { ...outlineLook };
}
export function setOutlineLook(look) {
  Object.assign(outlineLook, look);
  try {
    world.setDynamicProperty("npcstudio:outline_look", JSON.stringify(outlineLook));
  } catch {
    /* ignore */
  }
  refreshAll();
}
function lookBits(npc) {
  // the wardrobe remembers what each NPC wears (equipment can't be read from non-player entities)
  const armored = ["head", "chest", "legs", "feet"].some((k) => npc.getDynamicProperty(`npcstudio:equip_${k}`) !== undefined);
  // premade skins without an outer layer get a tight outline; custom slots are unknown, so theirs
  // stays outside where a layer could be
  const layers = SKIN_LAYERS[Number(npc.getProperty("npcstudio:skin_index") ?? 0)] ?? [true, true];
  return (outlineLook.thick << 7) | (outlineLook.style << 9) | (armored ? 1024 : 0) | (layers[0] ? 0 : 16384) | (layers[1] ? 0 : 32768);
}
system.runTimeout(() => {
  try {
    Object.assign(outlineLook, JSON.parse(String(world.getDynamicProperty("npcstudio:outline_look") ?? "{}")));
  } catch {
    /* ignore */
  }
}, 5);

/** Prop mode (bit 6): body hidden, only the held item shows (block / item props). */
export function isProp(npc) {
  return (getFlags(npc) & 64) !== 0;
}
export function setProp(npc, on) {
  const f = getFlags(npc);
  setFlags(npc, on ? f | 64 : f & ~64);
}
/** Item State picture for bows / crossbows held by this NPC (RP/attachables read it). */
export function getItemFrame(npc) {
  return (getFlags(npc) >> 11) & 7;
}
export function setItemFrame(npc, n) {
  setFlags(npc, (getFlags(npc) & ~(7 << 11)) | ((n & 7) << 11));
}
export const CAPE_NAMES = ["Studio Cyan", "Crimson", "Shadow", "Snow", "Royal", "Gold", "Forest", "Ocean"];
// capes 9-15 are custom slots a player's pack fills (tools/make_custom.py); names come from the pack
export const CAPE_COUNT = 16; // 0 = none
export function capeLabel(c) {
  if (!c) return "None";
  if (c <= CAPE_NAMES.length) return CAPE_NAMES[c - 1];
  return { rawtext: [{ translate: `npcstudio.cape.${c}` }] };
}

// ---------- selection ----------
function mapOf(player) {
  let m = selections.get(player.id);
  if (!m) selections.set(player.id, (m = new Map()));
  return m;
}
export function getSelection(player) {
  const m = mapOf(player);
  for (const [id, npc] of m) if (!npc.isValid) m.delete(id);
  return [...m.values()];
}
export function isSelected(player, npc) {
  return mapOf(player).has(npc.id);
}
/** Select one NPC (replacing the selection) or add it (additive). */
export function select(player, npc, additive = false) {
  const m = mapOf(player);
  const before = [...m.values()];
  if (!additive) m.clear();
  m.set(npc.id, npc);
  refresh([...before, npc]);
}
export function toggleSelect(player, npc) {
  const m = mapOf(player);
  if (m.has(npc.id)) m.delete(npc.id);
  else m.set(npc.id, npc);
  refresh([npc]);
}
export function selectMany(player, npcs) {
  const m = mapOf(player);
  const before = [...m.values()];
  m.clear();
  npcs.forEach((n) => m.set(n.id, n));
  refresh([...before, ...npcs]);
}
export function clearSelection(player) {
  const m = mapOf(player);
  const before = [...m.values()];
  m.clear();
  refresh(before);
}
export function dropPlayer(player) {
  clearSelection(player);
  selections.delete(player.id);
  setFilming(player, false);
}

function selectedByAnyone(npc) {
  for (const m of selections.values()) if (m.has(npc.id)) return true;
  return false;
}
function refresh(npcs) {
  const show = !outlinesHidden && filming.size === 0;
  for (const npc of npcs) {
    if (!npc?.isValid) continue;
    const f = getFlags(npc) & ~(1 | (3 << 7) | 512 | 1024 | 16384 | 32768);
    setFlags(npc, show && selectedByAnyone(npc) ? f | 1 | lookBits(npc) : f);
  }
}
function refreshAll() {
  const all = new Map();
  for (const m of selections.values()) for (const [id, n] of m) all.set(id, n);
  refresh([...all.values()]);
}

// ---------- filming / layers ----------
export function setFilming(player, on) {
  const had = filming.has(player.id);
  if (on) filming.add(player.id);
  else filming.delete(player.id);
  if (had !== on) refreshAll();
}
export function areOutlinesHidden() {
  return outlinesHidden;
}
export function setOutlinesHidden(on) {
  outlinesHidden = on;
  refreshAll();
}

// After a /reload nobody has a selection any more: clear leftover outline bits.
system.runTimeout(() => {
  for (const d of ["overworld", "nether", "the_end"]) {
    try {
      for (const n of world.getDimension(d).getEntities({ families: [NPC_FAMILY] })) {
        const f = getFlags(n);
        if (f & 1) setFlags(n, f & ~1);
      }
    } catch {
      /* ignore */
    }
  }
}, 30);

/** Re-apply the outline look (e.g. after the NPC put armor on). */
export function refreshOutline(npc) {
  refresh([npc]);
}
