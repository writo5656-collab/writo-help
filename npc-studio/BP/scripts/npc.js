/**
 * NPC Studio — npc.js : spawning, cloning, presets, look-at-player, and the main menus.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { StructureSaveMode } from "@minecraft/server";
import {
  world, system, menu, modal, msg, confirm, ICON, NPC_ID, NPC_FAMILY, clamp, wrapDeg, toDeg,
  getJson, setJson, isLocked, npcsNear, npcLabel, forward, right
} from "./core.js";
import { readPose, applyPose, pushUndo, getScale, setScale, getAnim, setAnim, getRot, setRot, expandPreset } from "./rig.js";
import { ALL_POSES, LOOP_ANIMS } from "./poses.js";
import { openPoseEditor, openPoseLibrary, openScaleMenu, openLoopAnims } from "./poseEditor.js";
import { openWardrobe, openBulkWardrobe, readAllEquip, applyEquipInfo, SLOTS } from "./wardrobe.js";
import { pickSkin, setSkin, skinPlainName, npcHead } from "./skins.js";
import { openAnimator, playAllTimelines, stopAllTimelines, getTimeline } from "./animator.js";
import { openShotsMenu } from "./shots.js";
import { openRideMenu, isMounted } from "./mount.js";
import { openHandbook } from "./handbook.js";
import { openCameraToolMenu, flyCam } from "./camera.js";

// ---------- spawning ----------
function initNpc(npc, skin, rot, name) {
  npc.setRotation({ x: 0, y: rot.y });
  setSkin(npc, skin);
  applyPose(npc, {});
  npc.nameTag = name;
}

export function spawnNpcs(player, skin, count) {
  const rot = player.getRotation();
  const f = forward(rot.y);
  const r = right(rot.y);
  const cols = Math.ceil(Math.sqrt(count));
  const base = { x: player.location.x + f.x * 2, y: player.location.y, z: player.location.z + f.z * 2 };
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols - (cols - 1) / 2;
    const loc = count === 1 ? base : { x: base.x + r.x * col * 1.5 + f.x * row * 1.5, y: base.y, z: base.z + r.z * col * 1.5 + f.z * row * 1.5 };
    const npc = player.dimension.spawnEntity(NPC_ID, loc);
    // face the player
    initNpc(npc, skin, { y: rot.y + 180 }, count === 1 ? `${skinPlainName(skin)}` : `${skinPlainName(skin)} ${i + 1}`);
  }
  msg(player, `§aSpawned ${count} NPC${count > 1 ? "s" : ""}.`);
}

// ---------- exact copies via structures (keeps enchants, trims, everything) ----------
function blockOf(loc) {
  return { x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) };
}

function structureCopy(npc, id, mode) {
  const b = blockOf(npc.location);
  try {
    world.structureManager.delete(id);
  } catch {
    /* didn't exist */
  }
  world.structureManager.createFromWorld(id, npc.dimension, b, b, { includeBlocks: false, includeEntities: true, saveMode: mode });
}

function placeCopy(id, dimension, atBlock) {
  const before = new Set([...dimension.getEntities({ families: [NPC_FAMILY], location: { x: atBlock.x + 0.5, y: atBlock.y + 0.5, z: atBlock.z + 0.5 }, maxDistance: 2 })].map((e) => e.id));
  world.structureManager.place(id, dimension, atBlock, { includeBlocks: false, includeEntities: true });
  return [...dimension.getEntities({ families: [NPC_FAMILY], location: { x: atBlock.x + 0.5, y: atBlock.y + 0.5, z: atBlock.z + 0.5 }, maxDistance: 2 })].filter((e) => !before.has(e.id));
}

export function cloneNpc(player, npc) {
  const r = right(npc.getRotation().y);
  const b = blockOf(npc.location);
  const target = { x: b.x + Math.round(r.x * 1.5), y: b.y, z: b.z + Math.round(r.z * 1.5) };
  try {
    structureCopy(npc, "npcstudio:clipboard", StructureSaveMode.Memory);
    const made = placeCopy("npcstudio:clipboard", npc.dimension, target);
    for (const c of made) {
      c.nameTag = `${npc.nameTag || "NPC"} (Clone)`;
      c.setDynamicProperty("npcstudio:timeline", undefined);
    }
    if (made.length) return msg(player, `§aExact clone made (gear, enchants and trims included).`);
  } catch (e) {
    console.warn(`[NPC Studio] structure clone failed, using fallback: ${e}`);
  }
  // fallback: rebuild from data
  const c = npc.dimension.spawnEntity(NPC_ID, { x: target.x + (npc.location.x - b.x), y: npc.location.y, z: target.z + (npc.location.z - b.z) });
  c.setRotation(npc.getRotation());
  c.setProperty("npcstudio:skin_index", npc.getProperty("npcstudio:skin_index"));
  c.setProperty("npcstudio:slim", npc.getProperty("npcstudio:slim"));
  applyPose(c, readPose(npc));
  setScale(c, getScale(npc));
  setAnim(c, getAnim(npc));
  c.nameTag = `${npc.nameTag || "NPC"} (Clone)`;
  const eq = readAllEquip(npc);
  for (const { key } of SLOTS) if (eq[key]) applyEquipInfo(c, key, eq[key]);
  msg(player, "§aCloned.");
}

// ---------- presets ----------
const PRESET_PREFIX = "npcstudio:preset:";
const structId = (name) => `npcstudio:preset_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40)}`;
export function listPresets() {
  return world.getDynamicPropertyIds().filter((k) => k.startsWith(PRESET_PREFIX)).map((k) => k.slice(PRESET_PREFIX.length)).sort();
}

function savePreset(player, npc, name) {
  const data = {
    v: 3,
    skinIndex: npc.getProperty("npcstudio:skin_index"),
    slim: npc.getProperty("npcstudio:slim"),
    pose: readPose(npc),
    scale: getScale(npc),
    anim: getAnim(npc),
    nameTag: npc.nameTag,
    equip: readAllEquip(npc)
  };
  let exact = false;
  try {
    structureCopy(npc, structId(name), StructureSaveMode.World);
    data.struct = structId(name);
    exact = true;
  } catch (e) {
    console.warn(`[NPC Studio] preset structure save failed: ${e}`);
  }
  setJson(world, PRESET_PREFIX + name, data);
  msg(player, `§aSaved preset "${name}"${exact ? " §7(+ exact copy with enchants & trims)" : ""}.`);
}

export function applyPreset(npc, name) {
  const d = getJson(world, PRESET_PREFIX + name, undefined);
  if (!d) return false;
  npc.setProperty("npcstudio:skin_index", d.skinIndex ?? 0);
  if (d.slim !== undefined) npc.setProperty("npcstudio:slim", !!d.slim);
  applyPose(npc, d.pose ?? {});
  if (d.scale) setScale(npc, d.scale);
  setAnim(npc, d.anim ?? 0);
  if (d.nameTag) npc.nameTag = d.nameTag;
  const eq = d.equip ?? Object.fromEntries(Object.entries(d.equipment ?? {}).map(([k, v]) => [k, v ? { id: v } : null]));
  for (const { key } of SLOTS) applyEquipInfo(npc, key, eq[key]);
  return true;
}

function spawnPresetExact(player, name) {
  const d = getJson(world, PRESET_PREFIX + name, undefined);
  if (!d?.struct) return false;
  const rot = player.getRotation();
  const f = forward(rot.y);
  const at = blockOf({ x: player.location.x + f.x * 2, y: player.location.y, z: player.location.z + f.z * 2 });
  try {
    const made = placeCopy(d.struct, player.dimension, at);
    made.forEach((m) => m.setRotation({ x: 0, y: rot.y + 180 }));
    return made.length > 0;
  } catch (e) {
    console.warn(`[NPC Studio] preset place failed: ${e}`);
    return false;
  }
}

// ---------- look at nearest player ----------
const lookers = new Map(); // id -> entity
const LOOK_KEY = "npcstudio:lookat";

export function setLookAtPlayers(npc, on) {
  if (on) {
    npc.setDynamicProperty("npcstudio:head_before_look", JSON.stringify(getRot(npc, "head")));
    npc.setDynamicProperty(LOOK_KEY, true);
    lookers.set(npc.id, npc);
  } else {
    npc.setDynamicProperty(LOOK_KEY, undefined);
    lookers.delete(npc.id);
    const prev = getJson(npc, "npcstudio:head_before_look", [0, 0, 0]);
    setRot(npc, "head", prev);
  }
}
export function isLooking(npc) {
  return !!npc.getDynamicProperty(LOOK_KEY);
}

function rescanLookers() {
  for (const dimId of ["overworld", "nether", "the_end"]) {
    try {
      for (const npc of world.getDimension(dimId).getEntities({ families: [NPC_FAMILY] })) {
        if (npc.getDynamicProperty(LOOK_KEY)) lookers.set(npc.id, npc);
      }
    } catch {
      /* ignore */
    }
  }
}

export function startLookLoop() {
  system.runTimeout(rescanLookers, 40);
  system.runInterval(rescanLookers, 200);
  system.runInterval(() => {
    for (const [id, npc] of lookers) {
      if (!npc.isValid) {
        lookers.delete(id);
        continue;
      }
      const sc = getScale(npc);
      const head = { x: npc.location.x, y: npc.location.y + 1.52 * sc, z: npc.location.z };
      let best, bestD = 24 * 24;
      for (const p of npc.dimension.getPlayers({ location: npc.location, maxDistance: 24 })) {
        const d = (p.location.x - head.x) ** 2 + (p.location.z - head.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (!best) continue;
      const t = best.getHeadLocation();
      const dx = t.x - head.x, dy = t.y - head.y, dz = t.z - head.z;
      const bodyY = npc.getProperty("npcstudio:body_y") ?? 0;
      const yaw = clamp(wrapDeg(toDeg(Math.atan2(-dx, dz)) - npc.getRotation().y - bodyY), -85, 85);
      const pitch = clamp(-toDeg(Math.atan2(dy, Math.hypot(dx, dz))), -60, 60);
      const cur = getRot(npc, "head");
      const nx = cur[0] + (pitch - cur[0]) * 0.4;
      const ny = cur[1] + (yaw - cur[1]) * 0.4;
      if (Math.abs(nx - cur[0]) > 0.3 || Math.abs(ny - cur[1]) > 0.3) setRot(npc, "head", [nx, ny, cur[2]]);
    }
  }, 2);
}

function lookAtMyView(npc, player) {
  const r = player.getRotation();
  const bodyY = npc.getProperty("npcstudio:body_y") ?? 0;
  setRot(npc, "head", [clamp(r.x, -80, 80), clamp(wrapDeg(r.y - npc.getRotation().y - bodyY), -85, 85), 0]);
}

// ---------- targeting ----------
export function getLookedAtNPC(player) {
  for (const hit of player.getEntitiesFromViewDirection({ maxDistance: 16 })) {
    if (hit.entity.matches({ families: [NPC_FAMILY] })) return hit.entity;
  }
  return undefined;
}

function pickNpc(player, title, onPick, back) {
  const npcs = npcsNear(player, 64).sort((a, b) => a.location.x - b.location.x);
  if (npcs.length === 0) return msg(player, "§cNo NPCs within 64 blocks.");
  const m = menu(title);
  npcs.forEach((n) => m.btn(`${npcLabel(n)}${isLocked(n) ? " §c(locked)" : ""}\n§8${Math.round(Math.hypot(n.location.x - player.location.x, n.location.z - player.location.z))} blocks away`, npcHead(n), () => onPick(n)));
  if (back) m.back(back);
  m.show(player);
}

// =====================================================================================
// NPC HUB
// =====================================================================================
export function openManageMenu(player, npc, back) {
  if (!npc.isValid) return;
  try {
    npc.addEffect("glowing", 200, { amplifier: 0, showParticles: false });
  } catch {
    /* cosmetic */
  }
  const self = () => openManageMenu(player, npc, back);
  if (isLocked(npc)) {
    return menu(npcLabel(npc), "§cThis NPC is locked (protected from edits).")
      .btn("Unlock", ICON("lock"), () => {
        npc.setProperty("npcstudio:locked", false);
        self();
      })
      .show(player);
  }
  const anim = getAnim(npc);
  const keys = getTimeline(npc).keys.length;
  const body = [
    `§7Skin: §f${skinPlainName(npc.getProperty("npcstudio:skin_index") ?? 0)} §7(${npc.getProperty("npcstudio:slim") ? "slim" : "classic"} arms)`,
    `§7Size: §f${Math.round(getScale(npc) * 100)}%   §7Loop anim: §f${anim ? LOOP_ANIMS[anim - 1] : "none"}   §7Keyframes: §f${keys}`,
    `§7Looks at players: §f${isLooking(npc) ? "yes" : "no"}`
  ].join("\n");
  menu(npcLabel(npc), body)
    .btn("§lPose Editor §r§8(Blender-style)", ICON("pose_manual"), () => openPoseEditor(player, npc, self))
    .btn("Pose Library (45+ poses)", ICON("pose_preset"), () => openPoseLibrary(player, npc, self))
    .btn("§lWardrobe §r§8(armor, enchants, trims)", ICON("equip"), () => openWardrobe(player, npc, self))
    .btn("Skin & Size", npcHead(npc), () => openSkinSize(player, npc, self))
    .btn("Animation §8(loops + keyframes)", ICON("animate"), () =>
      menu("Animation")
        .btn(`Looping Animation: ${anim ? LOOP_ANIMS[anim - 1] : "none"}`, ICON("animate"), () => openLoopAnims(player, npc, self))
        .btn(`Keyframe Animator (${keys} keys)`, ICON("record"), () => openAnimator(player, npc, self))
        .back(self)
        .show(player)
    )
    .btn(isLooking(npc) ? "§aLooking At Players §r§8(tap to stop)" : "Look At Players §8(head follows you)", ICON("eye"), () => {
      setLookAtPlayers(npc, !isLooking(npc));
      self();
    })
    .btn(isMounted(npc) ? "§aRiding §r§8(adjust / dismount)" : "Ride a Mob §8(horse, camel, wolf...)", ICON("ride"), () => openRideMenu(player, npc, self))
    .btn("Cinematic Shot Of This NPC", ICON("film"), () => openShotsMenu(player, self, npc))
    .btn("Move / Turn", ICON("move"), () => openMoveMenu(player, npc, self))
    .btn("Rename", ICON("rename"), () =>
      modal("Rename NPC").text("n", "Name (use § codes for colours)", "NPC", npc.nameTag || "").show(player, (v) => {
        const n = String(v.n ?? "").trim();
        if (n) npc.nameTag = n;
        self();
      }, self)
    )
    .btn("Clone (exact copy)", ICON("clone"), () => {
      cloneNpc(player, npc);
      self();
    })
    .btn("Save as Preset", ICON("save"), () =>
      modal("Save Preset").text("n", "Preset name", "knight_guard").show(player, ({ n }) => {
        n = String(n ?? "").trim().slice(0, 40);
        if (n) savePreset(player, npc, n);
        self();
      }, self)
    )
    .btn("Lock", ICON("lock"), () => {
      npc.setProperty("npcstudio:locked", true);
      msg(player, "§aLocked.");
    })
    .btn("§cDelete", ICON("delete"), () =>
      confirm(player, "Delete NPC?", `Delete ${npcLabel(npc)}? This can't be undone.`, "Delete", () => {
        npc.remove();
        msg(player, "§aDeleted.");
      }, self)
    )
    .back(back ?? (() => openMainMenu(player)))
    .show(player);
}

function openSkinSize(player, npc, back) {
  const self = () => openSkinSize(player, npc, back);
  const slim = !!npc.getProperty("npcstudio:slim");
  menu("Skin & Size", `§7Skin: §f${skinPlainName(npc.getProperty("npcstudio:skin_index") ?? 0)}\n§7Arms: §f${slim ? "Slim (3px, Alex)" : "Classic (4px, Steve)"}\n§7Size: §f${Math.round(getScale(npc) * 100)}%`)
    .btn("Change Skin", ICON("skin"), () =>
      pickSkin(player, "Choose Skin", (i) => {
        setSkin(npc, i);
        self();
      }, self)
    )
    .btn(`Arm Model: ${slim ? "Slim" : "Classic"} §8(tap to switch)`, ICON("skin"), () => {
      npc.setProperty("npcstudio:slim", !slim);
      self();
    })
    .btn("Size / Height", ICON("scale"), () => openScaleMenu(player, npc, self))
    .back(back)
    .show(player);
}

function openMoveMenu(player, npc, back, stepIdx = 1) {
  if (!npc.isValid) return;
  const STEPS = [0.1, 0.5, 1, 2];
  const step = STEPS[stepIdx];
  const self = () => openMoveMenu(player, npc, back, stepIdx);
  const go = (fwd, side, upd, turn = 0) => () => {
    const rot = npc.getRotation();
    const f = forward(rot.y);
    const r = right(rot.y);
    const l = npc.location;
    npc.teleport({ x: l.x + f.x * fwd + r.x * side, y: l.y + upd, z: l.z + f.z * fwd + r.z * side }, { rotation: { x: 0, y: rot.y + turn } });
    self();
  };
  menu(`Move: ${npcLabel(npc)}`)
    .btn(`Step: ${step} blocks §8(change)`, ICON("fov"), () => openMoveMenu(player, npc, back, (stepIdx + 1) % STEPS.length))
    .btn("Bring To Me", ICON("spawn"), () => {
      npc.teleport(player.location, { rotation: { x: 0, y: player.getRotation().y } });
      self();
    })
    .btn("Face Me", ICON("eye"), () => {
      const dx = player.location.x - npc.location.x, dz = player.location.z - npc.location.z;
      npc.setRotation({ x: 0, y: toDeg(Math.atan2(-dx, dz)) });
      self();
    })
    .btn("Head Looks Where I Look", ICON("eye"), () => {
      pushUndo(npc);
      lookAtMyView(npc, player);
      self();
    })
    .btn("Snap To Block Center", ICON("waypoint"), () => {
      const l = npc.location;
      npc.teleport({ x: Math.floor(l.x) + 0.5, y: l.y, z: Math.floor(l.z) + 0.5 });
      self();
    })
    .btn("Forward", ICON("move"), go(step, 0, 0))
    .btn("Back", ICON("move"), go(-step, 0, 0))
    .btn("Left", ICON("move"), go(0, -step, 0))
    .btn("Right", ICON("move"), go(0, step, 0))
    .btn("Up", ICON("move"), go(0, 0, step))
    .btn("Down", ICON("move"), go(0, 0, -step))
    .btn("Turn Left 15°", ICON("turn"), go(0, 0, 0, -15))
    .btn("Turn Right 15°", ICON("turn"), go(0, 0, 0, 15))
    .btn("Turn Around", ICON("turn"), go(0, 0, 0, 180))
    .back(back)
    .show(player);
}

// =====================================================================================
// MAIN MENU
// =====================================================================================
export function openMainMenu(player) {
  const self = () => openMainMenu(player);
  menu("§lNPC Studio")
    .btn("Spawn NPC", ICON("spawn"), () => openSpawnMenu(player, self))
    .btn("Edit An NPC", ICON("manage"), () => {
      const npc = getLookedAtNPC(player);
      if (npc) return openManageMenu(player, npc, self);
      pickNpc(player, "Pick an NPC", (n) => openManageMenu(player, n, self), self);
    })
    .btn("§lCinematic Shots §r§8(30 camera moves)", ICON("film"), () => openShotsMenu(player, self))
    .btn("§lFly Cam §r§8(joystick camera, tap to lock)", ICON("flycam"), () => flyCam(player, "camera"))
    .btn("Cameras (place & paths)", ICON("camera"), () => openCameraToolMenu(player, self))
    .btn("Scene: Play All NPC Animations", ICON("play"), () => {
      playAllTimelines(player);
    })
    .btn("Scene: Stop All Animations", ICON("clear_x"), () => {
      stopAllTimelines(player);
      msg(player, "§7Stopped.");
    })
    .btn("Presets", ICON("preset"), () => openPresetsMenu(player, self))
    .btn("Bulk Tools (many NPCs)", ICON("bulkequip"), () => openBulkMenu(player, self))
    .btn("World Controls", ICON("world"), () => openWorldMenu(player, self))
    .btn("Handbook", ICON("debug"), () => openHandbook(player, self))
    .show(player);
}

function openSpawnMenu(player, back) {
  modal("Spawn NPCs")
    .slider("count", "How many? (grid in front of you)", 1, 50, 1, 1)
    .show(player, ({ count }) => pickSkin(player, count > 1 ? `Choose Skin (x${count})` : "Choose Skin", (i) => spawnNpcs(player, i, count), back), back);
}

function openPresetsMenu(player, back) {
  const self = () => openPresetsMenu(player, back);
  const names = listPresets();
  const m = menu("Presets", names.length ? "§7Save presets from an NPC's menu. Tap one to use it." : "§7No presets yet. Open an NPC > Save as Preset.");
  for (const n of names) {
    const d = getJson(world, PRESET_PREFIX + n, {});
    m.btn(`${n}${d.struct ? " §b(exact)" : ""}`, ICON("preset"), () =>
      menu(n)
        .btn("Spawn Exact Copy Here §8(with trims & enchants)", ICON("spawn"), () => {
          if (!spawnPresetExact(player, n)) {
            const npc = player.dimension.spawnEntity(NPC_ID, player.location);
            applyPreset(npc, n);
          }
          msg(player, `§aSpawned "${n}".`);
        })
        .btn("Apply To NPC I'm Looking At", ICON("manage"), () => {
          const npc = getLookedAtNPC(player);
          if (!npc) return msg(player, "§cLook at an NPC first.");
          applyPreset(npc, n);
          msg(player, `§aApplied "${n}".`);
        })
        .btn("Apply To All Within Radius", ICON("bulkequip"), () =>
          modal("Radius").slider("r", "Blocks", 5, 100, 5, 20).show(player, ({ r }) => {
            let c = 0;
            for (const npc of npcsNear(player, r)) if (!isLocked(npc) && applyPreset(npc, n)) c++;
            msg(player, `§aApplied to ${c} NPCs.`);
          })
        )
        .btn("§cDelete Preset", ICON("delete"), () => {
          world.setDynamicProperty(PRESET_PREFIX + n, undefined);
          try {
            if (d.struct) world.structureManager.delete(d.struct);
          } catch {
            /* ignore */
          }
          self();
        })
        .back(self)
        .show(player)
    );
  }
  m.back(back).show(player);
}

function openBulkMenu(player, back) {
  const self = () => openBulkMenu(player, back);
  const radius = (fn) => () => modal("Radius").slider("r", "Every NPC within (blocks)", 5, 100, 5, 20).show(player, ({ r }) => fn(npcsNear(player, r).filter((n) => !isLocked(n))), self);
  menu("Bulk Tools", "§7Locked NPCs are always skipped.")
    .btn("Bulk Wardrobe (gear / trims)", ICON("equip"), () => openBulkWardrobe(player, self))
    .btn("Bulk Pose", ICON("pose_preset"), radius((npcs) => {
      const names = Object.keys(ALL_POSES);
      modal("Bulk Pose").dropdown("p", "Pose", names, 0).toggle("rand", "Also add the Breathing animation", false).show(player, (v) => {
        for (const n of npcs) {
          applyPose(n, expandPreset(ALL_POSES[names[v.p]]));
          if (v.rand) setAnim(n, 1);
        }
        msg(player, `§aPosed ${npcs.length} NPCs.`);
      });
    }))
    .btn("Bulk Looping Animation", ICON("animate"), radius((npcs) =>
      modal("Bulk Animation").dropdown("a", "Animation", ["None", ...LOOP_ANIMS], 0).show(player, (v) => {
        npcs.forEach((n) => setAnim(n, v.a));
        msg(player, `§aUpdated ${npcs.length} NPCs.`);
      })
    ))
    .btn("Bulk Look At Players (on/off)", ICON("eye"), radius((npcs) => {
      const on = !npcs.every(isLooking);
      npcs.forEach((n) => setLookAtPlayers(n, on));
      msg(player, `§a${npcs.length} NPCs ${on ? "now look at players" : "stopped looking"}.`);
    }))
    .btn("Bulk Face Me", ICON("turn"), radius((npcs) => {
      for (const n of npcs) {
        const dx = player.location.x - n.location.x, dz = player.location.z - n.location.z;
        n.setRotation({ x: 0, y: toDeg(Math.atan2(-dx, dz)) });
      }
      msg(player, `§a${npcs.length} NPCs face you.`);
    }))
    .btn("Bulk Size", ICON("scale"), radius((npcs) =>
      modal("Bulk Size").slider("s", "Size %", 10, 500, 5, 94).show(player, ({ s }) => {
        npcs.forEach((n) => setScale(n, s / 100));
        msg(player, `§aResized ${npcs.length} NPCs.`);
      })
    ))
    .btn("§cBulk Delete", ICON("delete"), radius((npcs) =>
      confirm(player, "Delete NPCs?", `Delete ${npcs.length} NPCs? This can't be undone.`, "Delete all", () => {
        npcs.forEach((n) => n.remove());
        msg(player, `§aDeleted ${npcs.length} NPCs.`);
      })
    ))
    .back(back)
    .show(player);
}

function openWorldMenu(player, back) {
  const dim = player.dimension;
  const run = (cmd, label) => () => {
    try {
      dim.runCommand(cmd);
      msg(player, `§a${label}`);
    } catch (e) {
      msg(player, `§c${e}`);
    }
    openWorldMenu(player, back);
  };
  menu("World Controls")
    .btn("Sunrise", ICON("sunset"), run("time set 23000", "Sunrise."))
    .btn("Day", ICON("day"), run("time set 1000", "Day."))
    .btn("Noon", ICON("day"), run("time set 6000", "Noon."))
    .btn("Sunset", ICON("sunset"), run("time set 12000", "Sunset."))
    .btn("Night", ICON("night"), run("time set 13000", "Night."))
    .btn("Midnight", ICON("midnight"), run("time set 18000", "Midnight."))
    .btn("Freeze Time", ICON("freeze"), run("gamerule dodaylightcycle false", "Time frozen."))
    .btn("Unfreeze Time", ICON("freeze"), run("gamerule dodaylightcycle true", "Time runs again."))
    .btn("Clear Weather", ICON("sun"), run("weather clear 999999", "Clear."))
    .btn("Rain", ICON("rain"), run("weather rain 999999", "Rain."))
    .btn("Thunderstorm", ICON("thunder"), run("weather thunder 999999", "Thunder."))
    .btn("Lock Weather", ICON("freeze"), run("gamerule doweathercycle false", "Weather locked."))
    .back(back)
    .show(player);
}

function openHelp(player, back) {
  menu(
    "NPC Studio v3.0",
    [
      "§b§lWHAT'S NEW",
      "§f- §dArmor trims & enchant glint§f: Wardrobe > Trim Studio, or trim/enchant your own armor and use Copy My Outfit.",
      "§f- §bPose Editor§f with a Blender-style Live Gizmo (look to rotate/move bones), position offsets, whole-body rotate, mirror, copy/paste, undo/redo.",
      "§f- §a45+ poses§f incl. sitting on the ground, lying, flying, kneeling.",
      "§f- §eSize / height§f (Player Size makes NPCs as tall as you).",
      "§f- §619 looping animations§f (walk, run, jump, dance, talk, wave...) + keyframe Animator + Record My Movement.",
      "§f- §cLook At Players§f: head follows the nearest player.",
      "§f- §d30 Cinematic Shots§f + shot sequences, smooth camera paths, working FOV.",
      "§f- §b20 custom skin slots§f + slim arms + Skin Pack Builder.",
      "",
      "§b§lCONTROLS",
      "§fWand: right-click NPC = edit, right-click air = this menu, left-click NPC = quick pose.",
      "§fShift + right-click an NPC holding any item = give it (exact copy).",
      "§fCamera tool: place/manage cameras. Mob tool: spawn mob props.",
      "§fSneak stops any shot or camera path.",
      "§fLeave camera view: §e/exitcam§f or double-tap sneak. Menu: §e/npc§f. Cameras: §e/cameras§f.",
      "§fFly Cam: fly with the joystick, §etap§f or §e/lockcam§f to lock the shot, hotbar = zoom.",
      "§fRide: NPC menu > Ride a Mob. Mob Tool > a mob > Mob Poses (horse rearing, sitting...)."
    ].join("\n")
  )
    .back(back)
    .show(player);
}
