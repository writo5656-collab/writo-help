/**
 * NPC Studio V3 — fog.js : Depth Fog (per player).
 * Far things fade into a colour while close things stay sharp, which gives shots depth and makes
 * the NPC stand out (the Java NPC Studio's depth-map shader idea, done with Bedrock's own fog).
 * Fog files: RP/fogs/npcstudio_<preset>_<distance>.json (tools/make_models.py).
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { system, getJson, setJson } from "./core.js";

export const FOG_PRESETS = [
  { id: "white", name: "Depth White" },
  { id: "black", name: "Depth Black" },
  { id: "haze", name: "Cinematic Haze" },
  { id: "sunset", name: "Sunset" },
  { id: "night", name: "Night Blue" },
  { id: "horror", name: "Horror" },
  { id: "dream", name: "Dream Pink" },
  { id: "smoke", name: "Smoke" }
];
export const FOG_DISTANCES = [6, 10, 16, 24, 32, 48, 64, 96, 128];
const KEY = "npcstudio:fog";
const STACK = "npcstudio_depth";

export function getFog(player) {
  const f = getJson(player, KEY, {});
  return { on: !!f.on, preset: FOG_PRESETS.some((p) => p.id === f.preset) ? f.preset : "white", dist: FOG_DISTANCES.includes(f.dist) ? f.dist : 32 };
}

function run(player, cmd) {
  try {
    player.runCommand(cmd);
  } catch {
    /* fog stack empty etc. */
  }
}

export function applyFog(player, f = getFog(player)) {
  run(player, `fog @s remove ${STACK}`);
  if (f.on) run(player, `fog @s push npcstudio:fog_${f.preset}_${f.dist} ${STACK}`);
}

export function setFog(player, changes) {
  const f = { ...getFog(player), ...changes };
  setJson(player, KEY, f);
  applyFog(player, f);
  return f;
}

/** Nearest allowed distance for a slider value. */
export function snapDistance(v) {
  return FOG_DISTANCES.reduce((best, d) => (Math.abs(d - v) < Math.abs(best - v) ? d : best), FOG_DISTANCES[0]);
}

export function presetName(id) {
  return FOG_PRESETS.find((p) => p.id === id)?.name ?? id;
}

/** Fog is not always kept across rejoin: put it back. */
export function restoreFog(player) {
  system.runTimeout(() => {
    if (player.isValid && getFog(player).on) applyFog(player);
  }, 20);
}
