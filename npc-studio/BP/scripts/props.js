/**
 * NPC Studio V3 — props.js : ideas from the Java NPC Studio, done the Bedrock way.
 *
 * - Block & item props: an NPC in "prop mode" (body hidden) holding a block or item. Move, turn,
 *   scale, clone and stamp it like any NPC: floating debris, tilted blocks, a giant sword...
 * - Particle props: a spot that keeps playing a particle (fire, smoke, hearts, sparks...).
 * - Crowds: copy one NPC into a grid, line or circle, with random turns and poses.
 * - Scene presets: save every NPC, mob, prop and camera around you and place the scene elsewhere.
 * - Tools: NPC Stamp (copy / paste), NPC Rotator (face me), Teleporter (go where you look).
 * - Studio World Rules: one tap for a calm filming world.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { ItemStack, StructureSaveMode } from "@minecraft/server";
import {
  world, system, menu, modal, msg, confirm, sfx, ICON, NPC_ID, NPC_FAMILY, MOB_TAG, CAMERA_ID, STAMP_ID, ROTATOR_ID, TELEPORTER_ID,
  MONITOR_ID, forward, right, toDeg, getJson, setJson, npcLabel, npcsNear, isLocked
} from "./core.js";
import { applyPose, expandPreset, setRot, setScale } from "./rig.js";
import { POSE_CATEGORIES } from "./poses.js";
import { equipBasic, searchItems } from "./wardrobe.js";
import { setProp, select, getSelection } from "./selection.js";

const blockOf = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });

// =====================================================================================
// Block & item props
// =====================================================================================
const BLOCK_SHORTCUTS = [
  "grass_block", "dirt", "stone", "cobblestone", "oak_planks", "oak_log", "glass", "tnt", "sand", "gravel", "obsidian",
  "diamond_block", "gold_block", "iron_block", "netherite_block", "crafting_table", "chest", "bookshelf", "barrel", "anvil",
  "netherrack", "end_stone", "ice", "deepslate", "bedrock", "beacon"
];

export function spawnProp(player, itemId) {
  const rot = player.getRotation();
  const f = forward(rot.y);
  const loc = { x: player.location.x + f.x * 2.5, y: player.location.y + 0.5, z: player.location.z + f.z * 2.5 };
  const npc = player.dimension.spawnEntity(NPC_ID, loc);
  npc.setRotation({ x: 0, y: rot.y + 180 });
  applyPose(npc, {});
  setProp(npc, true);
  if (!equipBasic(npc, "Mainhand", itemId)) {
    npc.remove();
    return msg(player, `§cCouldn't hold ${itemId}.`);
  }
  // arm straight out so the held item sits upright in front of the (hidden) body
  setRot(npc, "right_arm", [-90, 0, 0]);
  setScale(npc, 2);
  npc.nameTag = "";
  npc.setDynamicProperty("npcstudio:prop_item", itemId);
  select(player, npc);
  sfx(player, "ok");
  msg(player, `§aProp placed: ${itemId.replace("minecraft:", "").replace(/_/g, " ")}. §7Edit it like an NPC: Pose > Right Arm turns it, Size scales it.`);
  return npc;
}

export function openPropMenu(player, back) {
  const self = () => openPropMenu(player, back);
  const m = menu("Block & Item Props", "§7A floating block or item you can move, turn and scale.");
  m.btn("Use The Item In My Hand", ICON("equip"), () => {
    let held;
    try {
      held = player.getComponent("minecraft:inventory")?.container?.getItem(player.selectedSlotIndex);
    } catch {
      held = undefined;
    }
    if (!held) return msg(player, "§cHold a block or item first.");
    spawnProp(player, held.typeId);
  });
  m.btn("Search Block / Item", ICON("fov"), () =>
    modal("Search").text("q", "Type a block or item", "e.g. tnt, diamond sword, oak log").show(player, ({ q }) => {
      const hits = searchItems(String(q ?? ""));
      if (!hits.length) return msg(player, `§cNothing found for "${q}".`);
      const r = menu(`Results: ${q}`);
      hits.forEach((h) => r.btn(h.name.replace(/_/g, " "), `textures/items/${h.name}`, () => spawnProp(player, h.id)));
      r.back(self).show(player);
    }, self)
  );
  BLOCK_SHORTCUTS.forEach((b) => m.btn(b.replace(/_/g, " "), `textures/blocks/${b}`, () => spawnProp(player, `minecraft:${b}`)));
  if (back) m.back(back);
  m.show(player);
}

// =====================================================================================
// Particle props
// =====================================================================================
export const PARTICLES = [
  ["Fire", "minecraft:basic_flame_particle"],
  ["Soul Fire", "minecraft:blue_flame_particle"],
  ["Campfire Smoke", "minecraft:campfire_smoke_particle"],
  ["Hearts", "minecraft:heart_particle"],
  ["Angry", "minecraft:villager_angry"],
  ["Happy Sparkles", "minecraft:villager_happy"],
  ["Crit Sparks", "minecraft:critical_hit_emitter"],
  ["End Rod Glow", "minecraft:endrod"],
  ["Totem Burst", "minecraft:totem_particle"],
  ["Music Notes", "minecraft:note_particle"],
  ["Explosion", "minecraft:large_explosion"],
  ["Lava Pops", "minecraft:lava_particle"],
  ["Snow", "minecraft:snowflake_particle"],
  ["Electric Spark", "minecraft:electric_spark_particle"],
  ["Dragon Breath", "minecraft:dragon_breath_trail"],
  ["Soul", "minecraft:soul_particle"]
];
const PKEY = "npcstudio:particle_props";
let particleCache;

function particleProps() {
  if (!particleCache) particleCache = getJson(world, PKEY, []);
  return particleCache;
}
function saveParticles(list) {
  particleCache = list;
  setJson(world, PKEY, list);
}

export function openParticleMenu(player, back) {
  const self = () => openParticleMenu(player, back);
  const list = particleProps();
  const near = list.filter((p) => p.dim === player.dimension.id && Math.hypot(p.x - player.location.x, p.z - player.location.z) < 48);
  const m = menu("Particle Props", `§7${near.length} near you. They play while a player is within 64 blocks.`);
  PARTICLES.forEach(([name, id]) =>
    m.btn(`+ ${name}`, ICON("plus"), () => {
      const f = forward(player.getRotation().y);
      const p = { id, name, dim: player.dimension.id, x: player.location.x + f.x * 2, y: player.location.y + 1, z: player.location.z + f.z * 2, every: 4 };
      saveParticles([...particleProps(), p]);
      msg(player, `§aPlaced ${name}. §7It plays 2 blocks in front of where you stood.`);
      self();
    })
  );
  if (near.length) {
    m.btn("§cRemove Nearest", ICON("delete"), () => {
      const all = particleProps();
      let best = -1, bd = Infinity;
      all.forEach((p, i) => {
        if (p.dim !== player.dimension.id) return;
        const d = Math.hypot(p.x - player.location.x, p.y - player.location.y, p.z - player.location.z);
        if (d < bd) (bd = d), (best = i);
      });
      if (best >= 0) {
        const [gone] = all.splice(best, 1);
        saveParticles(all);
        msg(player, `§aRemoved ${gone.name}.`);
      }
      self();
    });
    m.btn("§cRemove All Near Me", ICON("clear_x"), () => {
      saveParticles(particleProps().filter((p) => !near.includes(p)));
      self();
    });
  }
  if (back) m.back(back);
  m.show(player);
}

system.runInterval(() => {
  const list = particleProps();
  if (!list.length) return;
  const t = system.currentTick;
  const players = world.getAllPlayers();
  for (const p of list) {
    if (t % (p.every ?? 4) !== 0) continue;
    if (!players.some((pl) => pl.dimension.id === p.dim && Math.hypot(pl.location.x - p.x, pl.location.z - p.z) < 64)) continue;
    try {
      world.getDimension(p.dim).spawnParticle(p.id, { x: p.x, y: p.y, z: p.z });
    } catch {
      /* chunk not loaded / unknown particle on this version */
    }
  }
}, 2);

// =====================================================================================
// Crowds (duplicate one NPC into a formation)
// =====================================================================================
function copyTo(src) {
  const id = "npcstudio:crowd_src";
  const b = blockOf(src.location);
  try {
    world.structureManager.delete(id);
  } catch {
    /* none */
  }
  world.structureManager.createFromWorld(id, src.dimension, b, b, { includeBlocks: false, includeEntities: true, saveMode: StructureSaveMode.Memory });
  return id;
}

export function openCrowdMenu(player, src, back) {
  if (!src?.isValid) return msg(player, "§cPick an NPC first (it becomes the crowd's look).");
  const LAYOUTS = ["Grid", "Line", "Circle (facing in)", "Circle (facing out)", "Random scatter"];
  const POSE_SETS = ["Keep the same pose", "Random: Basic", "Random: Action", "Random: Emotes", "Random: everything"];
  modal(`Crowd from ${npcLabel(src)}`)
    .dropdown("layout", "Formation", LAYOUTS, 0)
    .slider("count", "How many copies", 2, 50, 1, 9)
    .slider("gap", "Spacing (blocks x10)", 8, 60, 2, 15)
    .slider("turn", "Random turn (degrees)", 0, 180, 5, 15)
    .dropdown("poses", "Poses", POSE_SETS, 0)
    .submit("Make Crowd")
    .show(player, (v) => {
      if (!src.isValid) return;
      const gap = v.gap / 10;
      const yaw0 = src.getRotation().y;
      const f = forward(yaw0), r = right(yaw0);
      const c0 = src.location;
      const spots = [];
      const n = v.count;
      for (let i = 0; i < n; i++) {
        let dx = 0, dz = 0, yaw = yaw0;
        if (v.layout === 0) {
          const cols = Math.ceil(Math.sqrt(n + 1));
          const k = i + 1;
          const col = (k % cols) - (cols - 1) / 2, row = Math.floor(k / cols);
          dx = r.x * col * gap - f.x * row * gap;
          dz = r.z * col * gap - f.z * row * gap;
        } else if (v.layout === 1) {
          dx = r.x * (i + 1) * gap;
          dz = r.z * (i + 1) * gap;
        } else if (v.layout === 2 || v.layout === 3) {
          const radius = Math.max(gap * 1.2, (gap * n) / (2 * Math.PI));
          const a = (i / n) * 360;
          const p = forward(a);
          dx = p.x * radius;
          dz = p.z * radius;
          yaw = toDeg(Math.atan2(dx, -dz)) + (v.layout === 3 ? 180 : 0);
        } else {
          const radius = gap * Math.sqrt(n) * 1.2;
          dx = (Math.random() * 2 - 1) * radius;
          dz = (Math.random() * 2 - 1) * radius;
        }
        yaw += (Math.random() * 2 - 1) * v.turn;
        spots.push({ loc: { x: c0.x + dx, y: c0.y, z: c0.z + dz }, yaw });
      }
      const pool = v.poses === 0 ? null : v.poses === 4 ? POSE_CATEGORIES.flatMap((c) => Object.values(c.poses)) : Object.values(POSE_CATEGORIES[[0, 0, 1, 3][v.poses]]?.poses ?? {});
      let made = 0;
      let id;
      try {
        id = copyTo(src);
      } catch (e) {
        return msg(player, `§cCouldn't copy that NPC: ${e}`);
      }
      for (const s of spots) {
        const at = blockOf(s.loc);
        try {
          const before = new Set([...src.dimension.getEntities({ families: [NPC_FAMILY], location: { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 }, maxDistance: 2 })].map((e) => e.id));
          world.structureManager.place(id, src.dimension, at, { includeBlocks: false, includeEntities: true });
          const fresh = [...src.dimension.getEntities({ families: [NPC_FAMILY], location: { x: at.x + 0.5, y: at.y + 0.5, z: at.z + 0.5 }, maxDistance: 2 })].filter((e) => !before.has(e.id));
          for (const c of fresh) {
            c.teleport(s.loc, { rotation: { x: 0, y: s.yaw } });
            c.nameTag = "";
            c.setDynamicProperty("npcstudio:timeline", undefined);
            if (pool?.length) applyPose(c, expandPreset(pool[Math.floor(Math.random() * pool.length)]));
            made++;
          }
        } catch (e) {
          console.warn(`[NPC Studio] crowd copy: ${e}`);
        }
      }
      msg(player, `§aCrowd made: ${made} copies of ${npcLabel(src)} (gear, trims and skin included).`);
      back?.();
    }, back);
}

// =====================================================================================
// Scene presets
// =====================================================================================
const SCENE_PREFIX = "npcstudio:scene:";
const sceneStruct = (name) => `npcstudio:scene_${name.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40)}`;

export function listScenes() {
  return world.getDynamicPropertyIds().filter((k) => k.startsWith(SCENE_PREFIX)).map((k) => k.slice(SCENE_PREFIX.length)).sort();
}

function saveScene(player, name, radius) {
  const c = blockOf(player.location);
  const from = { x: c.x - radius, y: Math.max(-64, c.y - 8), z: c.z - radius };
  const to = { x: c.x + radius, y: Math.min(319, c.y + 24), z: c.z + radius };
  try {
    world.structureManager.delete(sceneStruct(name));
  } catch {
    /* none */
  }
  const ents = [
    ...player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: radius * 1.5 }),
    ...player.dimension.getEntities({ tags: [MOB_TAG], location: player.location, maxDistance: radius * 1.5 }),
    ...player.dimension.getEntities({ type: CAMERA_ID, location: player.location, maxDistance: radius * 1.5 })
  ];
  world.structureManager.createFromWorld(sceneStruct(name), player.dimension, from, to, { includeBlocks: false, includeEntities: true, saveMode: StructureSaveMode.World });
  setJson(world, SCENE_PREFIX + name, { radius, dy: c.y - from.y, count: ents.length, made: Date.now() });
  msg(player, `§aScene "${name}" saved: ${ents.length} NPCs, mobs, props and cameras.`);
}

function placeScene(player, name) {
  const d = getJson(world, SCENE_PREFIX + name, undefined);
  if (!d) return;
  const c = blockOf(player.location);
  const at = { x: c.x - d.radius, y: c.y - (d.dy ?? 8), z: c.z - d.radius };
  try {
    world.structureManager.place(sceneStruct(name), player.dimension, at, { includeBlocks: false, includeEntities: true });
    msg(player, `§aPlaced scene "${name}" around you.`);
  } catch (e) {
    msg(player, `§cCouldn't place the scene: ${e}`);
  }
}

export function openScenesMenu(player, back) {
  const self = () => openScenesMenu(player, back);
  const names = listScenes();
  const m = menu("Scene Presets", "§7Save everything around you (NPCs, mobs, props, cameras) and place it anywhere.");
  m.btn("+ Save Scene Around Me", ICON("save"), () =>
    modal("Save Scene")
      .text("n", "Scene name", "castle_battle")
      .slider("r", "Radius (blocks)", 4, 31, 1, 16)
      .show(player, ({ n, r }) => {
        n = String(n ?? "").trim().slice(0, 40);
        if (n) saveScene(player, n, r);
        self();
      }, self)
  );
  for (const n of names) {
    const d = getJson(world, SCENE_PREFIX + n, {});
    m.btn(`${n}`, ICON("preset"), () =>
      menu(n, `§7${d.count ?? "?"} things · radius ${d.radius} blocks`)
        .btn("Place Here (centred on me)", ICON("spawn"), () => placeScene(player, n))
        .btn("§cDelete Scene", ICON("delete"), () =>
          confirm(player, "Delete scene?", `Delete "${n}"?`, "Delete", () => {
            world.setDynamicProperty(SCENE_PREFIX + n, undefined);
            try {
              world.structureManager.delete(sceneStruct(n));
            } catch {
              /* ignore */
            }
            self();
          }, self)
        )
        .back(self)
        .show(player)
    );
  }
  if (back) m.back(back);
  m.show(player);
}

// =====================================================================================
// Tools
// =====================================================================================
export function giveTool(player, id) {
  try {
    player.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack(id, 1));
    msg(player, "§aAdded to your inventory.");
  } catch {
    msg(player, "§cYour inventory is full.");
  }
}

export function openToolsMenu(player, back) {
  menu("Studio Tools")
    .btn("Preview Viewer", "textures/items/npcstudio_monitor", () => giveTool(player, MONITOR_ID))
    .btn("NPC Stamp", "textures/items/npcstudio_stamp", () => giveTool(player, STAMP_ID))
    .btn("NPC Rotator", "textures/items/npcstudio_rotator", () => giveTool(player, ROTATOR_ID))
    .btn("Teleporter", "textures/items/npcstudio_teleporter", () => giveTool(player, TELEPORTER_ID))
    .back(back)
    .show(player);
}

// Stamp: tap an NPC = copy it, tap anywhere else = paste where you look.
const stamped = new Map(); // player.id -> structure id
export function stampCopy(player, npc) {
  const id = `npcstudio:stamp_${player.id.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 60);
  const b = blockOf(npc.location);
  try {
    try {
      world.structureManager.delete(id);
    } catch {
      /* none */
    }
    world.structureManager.createFromWorld(id, npc.dimension, b, b, { includeBlocks: false, includeEntities: true, saveMode: StructureSaveMode.Memory });
    stamped.set(player.id, { id, yaw: npc.getRotation().y });
    sfx(player, "ok");
    msg(player, `§aStamp loaded: ${npcLabel(npc)}. §7Tap where you want a copy.`);
  } catch (e) {
    msg(player, `§cCouldn't copy: ${e}`);
  }
}
export function stampPaste(player) {
  const s = stamped.get(player.id);
  if (!s) return msg(player, "§7Tap an NPC with the Stamp to copy it first.");
  const hit = player.getBlockFromViewDirection({ maxDistance: 48 });
  if (!hit) return msg(player, "§cLook at a block to paste on.");
  const at = { x: hit.block.x, y: hit.block.y + 1, z: hit.block.z };
  try {
    const before = new Set(npcsNear(player, 96).map((e) => e.id));
    world.structureManager.place(s.id, player.dimension, at, { includeBlocks: false, includeEntities: true });
    const fresh = npcsNear(player, 96).filter((e) => !before.has(e.id));
    for (const c of fresh) {
      c.teleport({ x: at.x + 0.5, y: at.y, z: at.z + 0.5 }, { rotation: { x: 0, y: player.getRotation().y + 180 } });
      c.setDynamicProperty("npcstudio:timeline", undefined);
    }
    sfx(player, "pose");
  } catch (e) {
    msg(player, `§cCouldn't paste: ${e}`);
  }
}

// Rotator: the NPC you look at (or your selection) turns to face you.
export function rotateToMe(player, target) {
  const list = target ? [target] : getSelection(player);
  if (!list.length) return msg(player, "§7Look at an NPC (or select some) and tap.");
  for (const n of list) {
    if (!n.isValid || isLocked(n)) continue;
    const dx = player.location.x - n.location.x, dz = player.location.z - n.location.z;
    n.setRotation({ x: 0, y: toDeg(Math.atan2(-dx, dz)) });
  }
  sfx(player, "pose");
}

// Teleporter: go to the block you look at.
export function teleportLook(player) {
  const hit = player.getBlockFromViewDirection({ maxDistance: 96 });
  if (!hit) return msg(player, "§7Look at a block (up to 96 blocks away).");
  player.teleport({ x: hit.block.x + 0.5, y: hit.block.y + 1, z: hit.block.z + 0.5 }, { keepVelocity: false });
  sfx(player, "click");
}

// =====================================================================================
// Studio World Rules
// =====================================================================================
const RULES = ["gamerule domobspawning false", "gamerule dotiledrops false", "gamerule dofiretick false", "gamerule keepinventory true",
  "gamerule doweathercycle false", "gamerule dodaylightcycle false", "gamerule mobgriefing false", "time set 6000", "weather clear 999999"];

export function openStudioRules(player, back) {
  confirm(
    player,
    "Studio World Rules",
    "Sets this world up for filming:\n§7• no mobs spawning\n• no block drops\n• no fire spread\n• keep inventory\n• weather and time stop (noon, clear)\n• mobs can't break blocks",
    "Apply",
    () => {
      for (const c of RULES) {
        try {
          player.dimension.runCommand(c);
        } catch {
          /* ignore */
        }
      }
      msg(player, "§aStudio rules applied.");
      back?.();
    },
    back
  );
}

