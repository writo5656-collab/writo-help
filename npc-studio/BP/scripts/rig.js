/**
 * NPC Studio — rig.js
 * The NPC's "skeleton": every bone's rotation + position, the whole-body (root) transform,
 * scale, plus undo/redo history and pose snapshots.
 *
 * Positions are packed 3-per-int (base 256, 0.25 px steps => +/-32 px per axis) and the
 * root rotation is packed the same way in 1.5 degree steps. Bedrock allows only 32 entity
 * properties, so packing is what lets us have full per-bone transforms.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { clamp, round } from "./core.js";

export const BONES = [
  { key: "head", label: "Head", rot: true },
  { key: "body", label: "Body", rot: true },
  { key: "right_arm", label: "Right Arm", rot: true },
  { key: "left_arm", label: "Left Arm", rot: true },
  { key: "right_leg", label: "Right Leg", rot: true },
  { key: "left_leg", label: "Left Leg", rot: true },
  { key: "root", label: "Whole Body", rot: true }
];

export const POS_STEP = 0.25; // pixels
export const POS_LIMIT = 31.75;
export const ROOT_ROT_STEP = 1.5; // degrees
export const PACK_CENTER = 8421504; // (128,128,128)

const P = (k) => `npcstudio:${k}`;

function pack3(a, b, c, step) {
  const e = (v) => clamp(Math.round(v / step), -128, 127) + 128;
  return e(a) + e(b) * 256 + e(c) * 65536;
}
function unpack3(v, step) {
  v = Math.max(0, Math.floor(v ?? PACK_CENTER));
  return [((v % 256) - 128) * step, ((Math.floor(v / 256) % 256) - 128) * step, (Math.floor(v / 65536) - 128) * step];
}

function safeGet(npc, key, def) {
  try {
    const v = npc.getProperty(P(key));
    return v === undefined ? def : v;
  } catch {
    return def;
  }
}
function safeSet(npc, key, value) {
  try {
    npc.setProperty(P(key), value);
  } catch (e) {
    console.warn(`[NPC Studio] setProperty ${key} failed: ${e}`);
  }
}

export function getRot(npc, bone) {
  if (bone === "root") return unpack3(safeGet(npc, "root_rot", PACK_CENTER), ROOT_ROT_STEP);
  return ["x", "y", "z"].map((a) => safeGet(npc, `${bone}_${a}`, 0));
}
export function setRot(npc, bone, [x, y, z]) {
  if (bone === "root") return safeSet(npc, "root_rot", pack3(x, y, z, ROOT_ROT_STEP));
  const c = (v) => clamp(v, -180, 180);
  safeSet(npc, `${bone}_x`, c(x));
  safeSet(npc, `${bone}_y`, c(y));
  safeSet(npc, `${bone}_z`, c(z));
}
export function getPos(npc, bone) {
  return unpack3(safeGet(npc, `${bone}_pos`, PACK_CENTER), POS_STEP);
}
export function setPos(npc, bone, [x, y, z]) {
  safeSet(npc, `${bone}_pos`, pack3(x, y, z, POS_STEP));
}
export function getScale(npc) {
  return safeGet(npc, "scale", 0.9375);
}
export function setScale(npc, s) {
  safeSet(npc, "scale", clamp(s, 0.1, 5));
}
export function getAnim(npc) {
  return safeGet(npc, "anim", 0);
}
export function setAnim(npc, i) {
  safeSet(npc, "anim", clamp(Math.round(i), 0, 31));
}

/** Full pose snapshot: { bone: {r:[x,y,z], p:[x,y,z]} } */
export function readPose(npc) {
  const out = {};
  for (const { key } of BONES) out[key] = { r: getRot(npc, key), p: getPos(npc, key) };
  return out;
}

/**
 * Apply a pose. Accepts both the new format ({bone:{r,p}}) and the old v2 format
 * ({bone:[x,y,z]}) so presets saved with older versions still load.
 */
export function applyPose(npc, pose) {
  for (const { key } of BONES) {
    const v = pose?.[key];
    if (Array.isArray(v)) {
      setRot(npc, key, v);
      setPos(npc, key, [0, 0, 0]);
    } else {
      setRot(npc, key, v?.r ?? [0, 0, 0]);
      setPos(npc, key, v?.p ?? [0, 0, 0]);
    }
  }
}

export function mirrorPose(pose) {
  const m = (v) => ({ r: [v.r[0], -v.r[1], -v.r[2]], p: [-v.p[0], v.p[1], v.p[2]] });
  const g = (k) => pose[k] ?? { r: [0, 0, 0], p: [0, 0, 0] };
  return {
    head: m(g("head")),
    body: m(g("body")),
    root: m(g("root")),
    right_arm: m(g("left_arm")),
    left_arm: m(g("right_arm")),
    right_leg: m(g("left_leg")),
    left_leg: m(g("right_leg"))
  };
}

export function lerpPose(a, b, t) {
  const out = {};
  for (const { key } of BONES) {
    const A = a[key] ?? { r: [0, 0, 0], p: [0, 0, 0] };
    const B = b[key] ?? { r: [0, 0, 0], p: [0, 0, 0] };
    out[key] = { r: A.r.map((v, i) => v + (B.r[i] - v) * t), p: A.p.map((v, i) => v + (B.p[i] - v) * t) };
  }
  return out;
}

/** Compact preset format: {bone:[rx,ry,rz, px,py,pz]} with anything omitted = 0. */
export function expandPreset(preset) {
  const out = {};
  for (const { key } of BONES) {
    const v = preset[key] ?? [];
    out[key] = { r: [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0], p: [v[3] ?? 0, v[4] ?? 0, v[5] ?? 0] };
  }
  return out;
}

export function snapPos(v) {
  return clamp(round(v, POS_STEP), -POS_LIMIT, POS_LIMIT);
}

// ---------- undo / redo (per NPC, in memory) ----------
const history = new Map();
const MAX_HISTORY = 40;

function stackFor(npc) {
  let h = history.get(npc.id);
  if (!h) {
    h = { undo: [], redo: [] };
    history.set(npc.id, h);
  }
  return h;
}

/** Call BEFORE changing a pose so the change can be undone. */
export function pushUndo(npc) {
  const h = stackFor(npc);
  h.undo.push({ pose: readPose(npc), scale: getScale(npc) });
  if (h.undo.length > MAX_HISTORY) h.undo.shift();
  h.redo.length = 0;
}
export function undo(npc) {
  const h = stackFor(npc);
  const s = h.undo.pop();
  if (!s) return false;
  h.redo.push({ pose: readPose(npc), scale: getScale(npc) });
  applyPose(npc, s.pose);
  setScale(npc, s.scale);
  return true;
}
export function redo(npc) {
  const h = stackFor(npc);
  const s = h.redo.pop();
  if (!s) return false;
  h.undo.push({ pose: readPose(npc), scale: getScale(npc) });
  applyPose(npc, s.pose);
  setScale(npc, s.scale);
  return true;
}
export function historySize(npc) {
  const h = stackFor(npc);
  return { undo: h.undo.length, redo: h.redo.length };
}
