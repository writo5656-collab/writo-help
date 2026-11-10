/**
 * NPC Studio V3.4 — extras.js : the Java editor's Display / World switches that Bedrock can do.
 *   Sneak, Living (breathing), On Fire (flames around the NPC), Look At, Flip,
 *   World Bright (night vision without particles), Gamerules.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system, NPC_FAMILY, toDeg } from "./core.js";
import { getRot, getPos, setRot, setPos, getScale, getAnim, setAnim, pushUndo } from "./rig.js";
import { ALL_POSES } from "./poses.js";

// ---------- Sneak: the crouch pose on the bones it uses, the rest of the pose stays ----------
const SNEAK = ALL_POSES["Sneaking"] ?? { head: [-20], body: [30], right_leg: [-10], left_leg: [-10], root: [0, 0, 0, 0, -3, 0] };
export function isSneaking(npc) {
  return !!npc.getDynamicProperty("npcstudio:sneak");
}
export function setSneak(npc, on) {
  if (on === isSneaking(npc)) return;
  pushUndo(npc);
  if (on) {
    // remember what these bones had, so turning Sneak off gives the old pose back
    const before = {};
    for (const bone of Object.keys(SNEAK)) before[bone] = [...getRot(npc, bone), ...getPos(npc, bone)];
    npc.setDynamicProperty("npcstudio:sneak", JSON.stringify(before));
    for (const [bone, v] of Object.entries(SNEAK)) {
      setRot(npc, bone, [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0]);
      setPos(npc, bone, [v[3] ?? 0, v[4] ?? 0, v[5] ?? 0]);
    }
    return;
  }
  let before = {};
  try {
    before = JSON.parse(String(npc.getDynamicProperty("npcstudio:sneak"))) ?? {};
  } catch {
    /* old save: back to standing */
  }
  for (const bone of Object.keys(SNEAK)) {
    const v = before[bone] ?? [];
    setRot(npc, bone, [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0]);
    setPos(npc, bone, [v[3] ?? 0, v[4] ?? 0, v[5] ?? 0]);
  }
  npc.setDynamicProperty("npcstudio:sneak", undefined);
}

// ---------- Living: the breathing idle loop ----------
export const isLiving = (npc) => getAnim(npc) === 1;
export function setLiving(npc, on) {
  setAnim(npc, on ? 1 : 0);
}

// ---------- Look At / Flip ----------
export function lookAtPlayer(npc, player) {
  const dx = player.location.x - npc.location.x;
  const dz = player.location.z - npc.location.z;
  npc.setRotation({ x: 0, y: toDeg(Math.atan2(-dx, dz)) });
}
export function flip(npc) {
  npc.setRotation({ x: 0, y: npc.getRotation().y + 180 });
}

// ---------- On Fire: flames around the NPC (it takes no damage) ----------
const FIRE_KEY = "npcstudio:on_fire";
const burning = new Map(); // npc.id -> npc
export function isOnFire(npc) {
  return !!npc.getDynamicProperty(FIRE_KEY);
}
export function setOnFire(npc, on) {
  npc.setDynamicProperty(FIRE_KEY, on ? true : undefined);
  if (on) burning.set(npc.id, npc);
  else burning.delete(npc.id);
}
system.runInterval(() => {
  for (const [id, npc] of burning) {
    if (!npc.isValid) {
      burning.delete(id);
      continue;
    }
    const s = getScale(npc);
    const l = npc.location;
    for (let i = 0; i < 3; i++) {
      try {
        npc.dimension.spawnParticle("minecraft:basic_flame_particle", {
          x: l.x + (Math.random() - 0.5) * 0.7 * s,
          y: l.y + Math.random() * 1.9 * s,
          z: l.z + (Math.random() - 0.5) * 0.7 * s
        });
      } catch {
        /* chunk not loaded */
      }
    }
  }
}, 3);
// after a reload / rejoin: find the NPCs that are still set on fire
system.runTimeout(() => {
  for (const d of ["overworld", "nether", "the_end"]) {
    try {
      for (const n of world.getDimension(d).getEntities({ families: [NPC_FAMILY] })) if (isOnFire(n)) burning.set(n.id, n);
    } catch {
      /* ignore */
    }
  }
}, 40);

// ---------- World Bright: everything fully lit for you (night vision, no particles) ----------
export function worldBright(player) {
  try {
    return !!player.getEffect("night_vision");
  } catch {
    return false;
  }
}
export function setWorldBright(player, on) {
  try {
    if (on) player.addEffect("night_vision", 20000000, { showParticles: false });
    else player.removeEffect("night_vision");
  } catch {
    /* ignore */
  }
}

// ---------- Gamerules (Java: World > Gamerules) ----------
export const GAMERULES = [
  ["Day cycle", "doDayLightCycle"],
  ["Weather cycle", "doWeatherCycle"],
  ["Mob spawn", "doMobSpawning"],
  ["Fire spread", "doFireTick"],
  ["Keep inventory", "keepInventory"],
  ["Block drops", "doTileDrops"]
];
export function ruleOn(name) {
  try {
    return world.gameRules[name] !== false && world.gameRules[name] !== undefined;
  } catch {
    return false;
  }
}
export function setRule(player, name, on) {
  try {
    world.gameRules[name] = on;
  } catch {
    try {
      player.dimension.runCommand(`gamerule ${name.toLowerCase()} ${on ? "true" : "false"}`);
    } catch {
      /* ignore */
    }
  }
}
