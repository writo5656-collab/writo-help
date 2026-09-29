/**
 * NPC Studio — cinema.js : what happens to YOU while you look through a camera.
 *
 * - You turn invisible and your armor + held items are moved into your inventory while
 *   filming (and put back after), so nothing of yours floats in the shot. v3.1 used spectator
 *   mode, but spectators are drawn as a floating see-through head.
 * - Walking is locked and your exact spot is saved, so you come back where you were.
 * - HUD hidden, NPC name tags hidden, smooth fade in/out.
 * - Every time you enter, you're told how to get out: /exitcam, or double-tap sneak.
 * - If you leave the world mid-shot, everything is restored when you come back.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { GameMode, HudVisibility, InputPermissionCategory, EquipmentSlot } from "@minecraft/server";
import { world, system, msg, actionbar, NPC_FAMILY, getJson, setJson } from "./core.js";

const STATE_KEY = "npcstudio:cinema";
const active = new Map(); // player.id -> { onExit, sneakTaps, lastSneak, hint }
const exitHandlers = new Map(); // player.id -> fn called when the user exits (stop shots/paths)
const pendingRestore = new Map(); // player.id -> timeout handle

export function inCinema(player) {
  return active.has(player.id);
}

export function fadeBlack(player, inT = 0.25, hold = 0.1, outT = 0.35) {
  try {
    player.camera.fade({ fadeTime: { fadeInTime: inT, holdTime: hold, fadeOutTime: outT }, fadeColor: { red: 0, green: 0, blue: 0 } });
  } catch {
    /* ignore */
  }
}

function setNames(player, hidden) {
  for (const npc of player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: 160 })) {
    try {
      if (hidden) {
        if (npc.getDynamicProperty("npcstudio:shot_name") === undefined) npc.setDynamicProperty("npcstudio:shot_name", npc.nameTag || "");
        npc.nameTag = "";
      } else {
        const prev = npc.getDynamicProperty("npcstudio:shot_name");
        if (prev !== undefined) {
          npc.nameTag = prev;
          npc.setDynamicProperty("npcstudio:shot_name", undefined);
        }
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Enter camera view. `onExit` runs when the player leaves it (command, double sneak, menu).
 * Safe to call repeatedly — only the first call changes the player.
 */
export function enterCinema(player, onExit, opts = {}) {
  if (onExit) {
    // a new camera activity replaces the old one (e.g. a shot started during Fly Cam)
    const old = exitHandlers.get(player.id);
    exitHandlers.set(player.id, onExit);
    if (old && old !== onExit) {
      try {
        old();
      } catch {
        /* ignore */
      }
    }
  }
  if (active.has(player.id)) return;
  // re-entering during an exit fade: cancel the pending restore and keep the original saved state
  const pending = pendingRestore.get(player.id);
  if (pending !== undefined) {
    system.clearRun(pending);
    pendingRestore.delete(player.id);
  }
  if (player.getDynamicProperty(STATE_KEY) === undefined) {
    const r = player.getRotation();
    let mode;
    try {
      mode = player.getGameMode();
    } catch {
      mode = undefined;
    }
    if (mode === GameMode.Spectator) mode = undefined; // never "restore" someone into spectator
    const gear = stashGear(player);
    setJson(player, STATE_KEY, { mode, loc: { ...player.location }, rot: { x: r.x, y: r.y }, dim: player.dimension.id, gear, sel: player.selectedSlotIndex });
    if (gear.some((g) => g.skipped)) msg(player, "§eYour inventory is full, so some gear couldn't be hidden and may show in the shot.");
  }
  active.set(player.id, { sneakTaps: 0, lastSneak: false, lastTapTick: 0, freeMove: !!opts.freeMove });

  if (opts.fade !== false) fadeBlack(player);
  try {
    player.addEffect("invisibility", 20 * 3600, { amplifier: 0, showParticles: false });
  } catch {
    /* ignore */
  }
  if (opts.creative) {
    try {
      player.setGameMode(GameMode.Creative);
    } catch {
      /* ignore */
    }
  }
  if (!opts.freeMove) {
    try {
      player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, false);
    } catch {
      /* ignore */
    }
  }
  try {
    player.onScreenDisplay.setHudVisibility(HudVisibility.Hide);
  } catch {
    /* ignore */
  }
  if (opts.hideNames !== false) setNames(player, true);
  if (!opts.quiet) msg(player, "§b§l» Camera view §r§7— type §e/exitcam§7 or §edouble-tap sneak§7 to get out.");
}

// ---------- hiding your gear: armor + hands go into your inventory while filming ----------
const GEAR_SLOTS = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, EquipmentSlot.Offhand, EquipmentSlot.Mainhand];

function stashGear(player) {
  const out = [];
  let eq, inv;
  try {
    eq = player.getComponent("minecraft:equippable");
    inv = player.getComponent("minecraft:inventory")?.container;
  } catch {
    return out;
  }
  if (!eq || !inv) return out;
  const used = new Set();
  const freeSlot = () => {
    for (let i = 9; i < inv.size; i++) if (!used.has(i) && !inv.getItem(i)) return i;
    for (let i = 0; i < 9; i++) if (i !== player.selectedSlotIndex && !used.has(i) && !inv.getItem(i)) return i;
    return -1;
  };
  for (const slot of GEAR_SLOTS) {
    try {
      const item = eq.getEquipment(slot);
      if (!item) continue;
      const i = freeSlot();
      if (i < 0) {
        out.push({ slot, skipped: true });
        continue;
      }
      inv.setItem(i, item);
      eq.setEquipment(slot, undefined);
      used.add(i);
      out.push({ slot, idx: i, typeId: item.typeId });
    } catch (e) {
      console.warn(`[NPC Studio] stash ${slot}: ${e}`);
    }
  }
  return out;
}

function unstashGear(player, gear, sel) {
  let eq, inv;
  try {
    eq = player.getComponent("minecraft:equippable");
    inv = player.getComponent("minecraft:inventory")?.container;
  } catch {
    return;
  }
  if (!eq || !inv) return;
  if (typeof sel === "number") {
    try {
      player.selectedSlotIndex = sel;
    } catch {
      /* ignore */
    }
  }
  for (const g of gear ?? []) {
    if (g.skipped || g.idx === undefined) continue;
    try {
      const item = inv.getItem(g.idx);
      if (!item || item.typeId !== g.typeId || eq.getEquipment(g.slot)) continue;
      eq.setEquipment(g.slot, item);
      inv.setItem(g.idx, undefined);
    } catch (e) {
      console.warn(`[NPC Studio] unstash ${g.slot}: ${e}`);
    }
  }
}

/** Let the player fly around while staying in camera view (used by Fly Cam). */
export function freeCinema(player) {
  const st = active.get(player.id);
  if (!st) return;
  st.freeMove = true;
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, true);
    player.setGameMode(GameMode.Creative);
  } catch {
    /* ignore */
  }
}

/** Fly-cam finished flying: freeze the player where they are (the view stays locked). */
export function lockCinema(player) {
  const st = active.get(player.id);
  if (!st) return;
  st.freeMove = false;
  st.hint = 0;
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, false);
  } catch {
    /* ignore */
  }
}

/** Leave camera view and put the player back exactly how they were. */
export function exitCinema(player, opts = {}) {
  const handler = exitHandlers.get(player.id);
  exitHandlers.delete(player.id);
  const wasActive = active.delete(player.id);
  if (handler) {
    try {
      handler();
    } catch {
      /* ignore */
    }
  }
  if (!player.isValid) return;
  if (opts.fade !== false && wasActive) fadeBlack(player, 0.2, 0.05, 0.4);
  const restore = () => {
    try {
      player.camera.clear();
      player.camera.setFov();
    } catch {
      /* ignore */
    }
    restoreState(player);
  };
  const prev = pendingRestore.get(player.id);
  if (prev !== undefined) system.clearRun(prev);
  pendingRestore.delete(player.id);
  if (opts.fade !== false && wasActive) {
    pendingRestore.set(
      player.id,
      system.runTimeout(() => {
        pendingRestore.delete(player.id);
        if (!active.has(player.id) && player.isValid) restore();
      }, 5)
    );
  } else restore();
}

function restoreState(player) {
  const s = getJson(player, STATE_KEY, undefined);
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, true);
  } catch {
    /* ignore */
  }
  try {
    player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
  } catch {
    /* ignore */
  }
  try {
    player.removeEffect("invisibility");
  } catch {
    /* ignore */
  }
  setNames(player, false);
  if (!s) return;
  try {
    if (s.mode) player.setGameMode(s.mode);
  } catch {
    /* ignore */
  }
  unstashGear(player, s.gear, s.sel);
  try {
    player.teleport(s.loc, { dimension: world.getDimension(s.dim ?? "overworld"), rotation: s.rot });
  } catch {
    /* ignore */
  }
  player.setDynamicProperty(STATE_KEY, undefined);
}

/** Called on join: if they left mid-shot, give them their game mode, walking and HUD back. */
export function restoreCinemaAfterRejoin(player) {
  if (player.getDynamicProperty(STATE_KEY) !== undefined) {
    try {
      player.camera.clear();
    } catch {
      /* ignore */
    }
    restoreState(player);
  }
}

// Double-tap sneak = exit, plus a gentle reminder on the action bar.
system.runInterval(() => {
  for (const [id, st] of active) {
    const player = world.getEntity(id);
    if (!player?.isValid) {
      active.delete(id);
      continue;
    }
    const sn = player.isSneaking;
    if (sn && !st.lastSneak && !st.freeMove) {
      const now = system.currentTick;
      if (now - st.lastTapTick < 12) {
        exitCinema(player);
        continue;
      }
      st.lastTapTick = now;
    }
    st.lastSneak = sn;
    st.hint = (st.hint ?? 0) + 1;
    if (!st.freeMove && st.hint % 40 === 1 && st.hint < 200) actionbar(player, "§7/exitcam  or  double-tap sneak  to leave camera view");
  }
}, 1);
