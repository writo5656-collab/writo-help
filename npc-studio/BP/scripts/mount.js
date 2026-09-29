/**
 * NPC Studio — mount.js : NPCs riding animals + mob poses.
 *
 * Riding: boats/minecarts use real riding. Animals only accept players or zombies as riders,
 * so for them the NPC is "seated": it's kept on the animal's saddle every tick, facing the
 * way the animal faces, in the Riding pose. Works on any mob (horses, camels, even a warden).
 *
 * Mob poses: horse rearing (custom animation), wolf/cat/fox/panda/camel sitting, fox sleeping,
 * panda lying, allay dancing, warden roar... played with /playanimation and re-applied so
 * players who join later see them too.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system, menu, modal, msg, ICON, NPC_FAMILY, NPC_ID, MOB_TAG, CAMERA_ID, forward, right, getJson, setJson, npcLabel, npcsNear } from "./core.js";
import { applyPose, expandPreset, pushUndo, getScale, getRot, setRot } from "./rig.js";
import { ALL_POSES } from "./poses.js";

// saddle height (blocks) and forward offset, from vanilla seat positions
const SEATS = {
  horse: [1.1, -0.2], donkey: [0.925, -0.2], mule: [0.975, -0.2], skeleton_horse: [1.1, -0.2], zombie_horse: [1.1, -0.2],
  camel: [1.905, 0.5], llama: [1.17, -0.3], trader_llama: [1.17, -0.3], pig: [0.7, 0], strider: [1.7, -0.2],
  cow: [1.0, 0], mooshroom: [1.0, 0], sheep: [0.9, 0], goat: [1.0, 0], wolf: [0.625, -0.1], cat: [0.35, 0], ocelot: [0.35, 0],
  chicken: [0.48, 0], spider: [0.54, -0.1], cave_spider: [0.325, 0], panda: [0.75, -0.2], polar_bear: [1.25, -0.1],
  ravager: [2.025, -0.3], hoglin: [1.125, -0.3], zoglin: [1.125, -0.3], iron_golem: [2.55, 0], warden: [2.85, 0],
  ender_dragon: [3.2, 1.0], happy_ghast: [3.8, 1.7], sniffer: [1.9, 0], armadillo: [0.5, 0], turtle: [0.4, 0], fox: [0.5, 0],
  rabbit: [0.4, 0], frog: [0.45, 0], axolotl: [0.35, 0], nautilus: [0.925, 0]
};
const seatFor = (typeId) => SEATS[typeId.replace("minecraft:", "")] ?? [1.0, 0];

const MOUNT_KEY = "npcstudio:mount";
const mounted = new Map(); // npc.id -> npc

export function isMounted(npc) {
  return npc.getDynamicProperty(MOUNT_KEY) !== undefined;
}

function rideable(entity) {
  try {
    return entity.getComponent("minecraft:rideable");
  } catch {
    return undefined;
  }
}

export function mountNpc(player, npc, mob) {
  if (!npc.isValid || !mob.isValid) return;
  unmountNpc(npc, true);
  pushUndo(npc);
  applyPose(npc, expandPreset(ALL_POSES["Riding"]));
  // real riding first (boats, minecarts, anything without a rider whitelist)
  let real = false;
  try {
    real = !!rideable(mob)?.addRider(npc);
  } catch {
    real = false;
  }
  setJson(npc, MOUNT_KEY, { id: mob.id, real, dy: 0, dz: 0, dx: 0, turn: 0 });
  if (!real) {
    try {
      npc.triggerEvent("npcstudio:mounted_on");
    } catch {
      /* ignore */
    }
    mounted.set(npc.id, npc);
  }
  msg(player, `§a${npcLabel(npc)} is riding the ${mob.nameTag || mob.typeId.replace("minecraft:", "").replace(/_/g, " ")}. §7Open Ride menu to adjust the seat.`);
}

export function unmountNpc(npc, silent) {
  const d = getJson(npc, MOUNT_KEY, undefined);
  if (!d) return;
  npc.setDynamicProperty(MOUNT_KEY, undefined);
  mounted.delete(npc.id);
  if (d.real) {
    try {
      rideable(world.getEntity(d.id))?.ejectRider(npc);
    } catch {
      /* ignore */
    }
  } else {
    try {
      npc.triggerEvent("npcstudio:mounted_off");
    } catch {
      /* ignore */
    }
    const mob = world.getEntity(d.id);
    if (mob?.isValid && !silent) {
      const f = right(mob.getRotation().y);
      npc.teleport({ x: mob.location.x + f.x * 1.2, y: mob.location.y, z: mob.location.z + f.z * 1.2 });
    }
  }
  if (!silent) {
    pushUndo(npc);
    applyPose(npc, {});
  }
}

function seatPosition(npc, mob, d) {
  const [sy, sz] = seatFor(mob.typeId);
  const yaw = mob.getRotation().y;
  const f = forward(yaw);
  const r = right(yaw);
  const z = sz + (d.dz ?? 0);
  const x = d.dx ?? 0;
  const l = mob.location;
  return {
    pos: { x: l.x + f.x * z + r.x * x, y: l.y + sy - 0.6 * getScale(npc) + (d.dy ?? 0), z: l.z + f.z * z + r.z * x },
    yaw: yaw + (d.turn ?? 0)
  };
}

function rescan() {
  for (const dim of ["overworld", "nether", "the_end"]) {
    try {
      for (const npc of world.getDimension(dim).getEntities({ families: [NPC_FAMILY] })) {
        const d = getJson(npc, MOUNT_KEY, undefined);
        if (d && !d.real) mounted.set(npc.id, npc);
      }
    } catch {
      /* ignore */
    }
  }
}

export function startMountLoop() {
  system.runTimeout(rescan, 40);
  system.runInterval(rescan, 200);
  system.runInterval(() => {
    for (const [id, npc] of mounted) {
      if (!npc.isValid) {
        mounted.delete(id);
        continue;
      }
      const d = getJson(npc, MOUNT_KEY, undefined);
      const mob = d ? world.getEntity(d.id) : undefined;
      if (!mob?.isValid) {
        // the animal is gone (or its chunk unloaded): keep the NPC where it is
        if (d && !mob) continue;
        unmountNpc(npc, true);
        continue;
      }
      const { pos, yaw } = seatPosition(npc, mob, d);
      const l = npc.location;
      const ry = npc.getRotation().y;
      if (Math.abs(pos.x - l.x) + Math.abs(pos.y - l.y) + Math.abs(pos.z - l.z) > 0.01 || Math.abs(ry - yaw) > 0.5) {
        try {
          npc.teleport(pos, { rotation: { x: 0, y: yaw } });
        } catch {
          /* ignore */
        }
      }
    }
  }, 1);
  system.runInterval(reapplyMobPoses, 600);
}

// ---------- which mobs can a player pick? ----------
function nearbyMobs(player, radius = 16) {
  const skip = new Set(["minecraft:player", NPC_ID, CAMERA_ID, "minecraft:item", "npcstudio:gizmo", "minecraft:xp_orb", "minecraft:arrow"]);
  return [...player.dimension.getEntities({ location: player.location, maxDistance: radius })]
    .filter((e) => !skip.has(e.typeId) && !e.typeId.startsWith("npcstudio:"))
    .sort((a, b) => dist(player, a) - dist(player, b))
    .slice(0, 30);
}
const dist = (p, e) => Math.hypot(e.location.x - p.location.x, e.location.z - p.location.z);
const mobName = (m) => m.nameTag || m.typeId.replace("minecraft:", "").replace(/_/g, " ");

// ---------- menus ----------
export function openRideMenu(player, npc, back) {
  const self = () => openRideMenu(player, npc, back);
  const d = getJson(npc, MOUNT_KEY, undefined);
  if (d) {
    const mob = world.getEntity(d.id);
    const nudge = (k, v) => () => {
      const cur = getJson(npc, MOUNT_KEY, undefined);
      if (!cur) return self();
      cur[k] = Math.round(((cur[k] ?? 0) + v) * 100) / 100;
      setJson(npc, MOUNT_KEY, cur);
      self();
    };
    const m = menu(`Riding: ${mob ? mobName(mob) : "?"}`, `§7Seat offset — up ${d.dy ?? 0}, forward ${d.dz ?? 0}, side ${d.dx ?? 0}, turn ${d.turn ?? 0}°`)
      .btn("§cDismount", ICON("dismount"), () => {
        unmountNpc(npc);
        back();
      });
    if (!d.real) {
      m.btn("Seat Up", ICON("move"), nudge("dy", 0.05))
        .btn("Seat Down", ICON("move"), nudge("dy", -0.05))
        .btn("Seat Forward", ICON("move"), nudge("dz", 0.05))
        .btn("Seat Back", ICON("move"), nudge("dz", -0.05))
        .btn("Seat Left", ICON("move"), nudge("dx", -0.05))
        .btn("Seat Right", ICON("move"), nudge("dx", 0.05))
        .btn("Sit Sideways (turn 90°)", ICON("turn"), nudge("turn", 90))
        .btn("Riding Pose", ICON("pose_preset"), () => {
          pushUndo(npc);
          applyPose(npc, expandPreset(ALL_POSES["Riding"]));
          self();
        })
        .btn("Standing On It (surf)", ICON("pose_preset"), () => {
          pushUndo(npc);
          applyPose(npc, expandPreset(ALL_POSES["Surfing"]));
          const cur = getJson(npc, MOUNT_KEY, {});
          cur.dy = 0.55;
          setJson(npc, MOUNT_KEY, cur);
          self();
        });
    }
    if (mob) m.btn(`Pose the ${mobName(mob)}`, ICON("ride"), () => openMobPoses(player, mob, self));
    return m.back(back).show(player);
  }
  const mobs = nearbyMobs(player);
  if (mobs.length === 0) {
    msg(player, "§cNo mobs within 16 blocks. Spawn one with the Mob Tool.");
    return back();
  }
  const m = menu("Ride Which Mob?", "§7Nearest first. The NPC sits in the saddle and follows the mob.");
  mobs.forEach((mob) => m.btn(`${mobName(mob)} §8(${Math.round(dist(player, mob))}m)`, ICON("ride"), () => {
    mountNpc(player, npc, mob);
    self();
  }));
  m.back(back).show(player);
}

/** From the mob's own menu: choose an NPC to put on it. */
export function openPutNpcOn(player, mob, back) {
  const npcs = npcsNear(player, 32);
  if (npcs.length === 0) {
    msg(player, "§cNo NPCs nearby.");
    return back?.();
  }
  const m = menu(`Who rides the ${mobName(mob)}?`);
  npcs.forEach((n) => m.btn(npcLabel(n), ICON("spawn"), () => {
    mountNpc(player, n, mob);
    back?.();
  }));
  if (back) m.back(back);
  m.show(player);
}

// ---------- mob poses ----------
const HORSES = ["horse", "donkey", "mule", "skeleton_horse", "zombie_horse"];
const MOB_POSES = [
  { types: HORSES, name: "Rear Up (kicking)", anim: "animation.npcstudio.mob.horse_rear", rider: { rot: -35, dy: 0.45, dz: -0.35 } },
  { types: HORSES, name: "Rear Up (hold)", anim: "animation.npcstudio.mob.horse_rear_hold", rider: { rot: -35, dy: 0.45, dz: -0.35 } },
  { types: HORSES, name: "Head Held High", anim: "animation.npcstudio.mob.horse_proud" },
  { types: ["wolf"], name: "Sit", anim: "animation.wolf.sitting" },
  { types: ["cat", "ocelot"], name: "Sit", anim: "animation.cat.sit" },
  { types: ["fox"], name: "Sit", anim: "animation.fox.sit" },
  { types: ["fox"], name: "Sleep", anim: "animation.fox.sleep" },
  { types: ["panda"], name: "Sit", anim: "animation.panda.sitting" },
  { types: ["panda"], name: "Lie Down", anim: "animation.panda.lying" },
  { types: ["camel"], name: "Sit Down", anim: "animation.camel.sit" },
  { types: ["allay"], name: "Dance", anim: "animation.allay.dance" },
  { types: ["sniffer"], name: "Happy", anim: "animation.sniffer.feeling_happy" },
  { types: ["warden"], name: "Roar (once)", anim: "animation.warden.roar", once: true }
];

function playAnim(mob, anim, stop) {
  try {
    mob.runCommand(`playanimation @s ${anim} a 0.2 "${stop ? "1" : "0"}" npcstudio_pose`);
    return true;
  } catch (e) {
    console.warn(`[NPC Studio] playanimation failed: ${e}`);
    return false;
  }
}

function ridersOf(mob) {
  return [...mob.dimension.getEntities({ families: [NPC_FAMILY], location: mob.location, maxDistance: 6 })].filter((n) => getJson(n, MOUNT_KEY, {}).id === mob.id);
}

function setRiderLean(mob, rider) {
  for (const npc of ridersOf(mob)) {
    const d = getJson(npc, MOUNT_KEY, {});
    const r = getRot(npc, "root");
    const prevLean = d.lean ?? { rot: 0, dy: 0, dz: 0 };
    const lean = rider ?? { rot: 0, dy: 0, dz: 0 };
    setRot(npc, "root", [r[0] - prevLean.rot + lean.rot, r[1], r[2]]);
    d.dy = Math.round(((d.dy ?? 0) - prevLean.dy + lean.dy) * 100) / 100;
    d.dz = Math.round(((d.dz ?? 0) - prevLean.dz + lean.dz) * 100) / 100;
    d.lean = lean;
    setJson(npc, MOUNT_KEY, d);
  }
}

export function openMobPoses(player, mob, back) {
  const type = mob.typeId.replace("minecraft:", "");
  const poses = MOB_POSES.filter((p) => p.types.includes(type));
  const cur = mob.getDynamicProperty("npcstudio:mobpose");
  const m = menu(`Pose: ${mobName(mob)}`, poses.length ? "§7Riders lean with the mob automatically." : "§7This mob has no poses yet. Horses, wolves, cats, foxes, pandas, camels, allays, sniffers and wardens do.");
  m.btn(`${cur ? "" : "§a> "}Normal (no pose)`, ICON("clear_x"), () => {
    if (cur) playAnim(mob, cur, true);
    mob.setDynamicProperty("npcstudio:mobpose", undefined);
    setRiderLean(mob, undefined);
    back?.();
  });
  for (const p of poses) {
    m.btn(`${cur === p.anim ? "§a> " : ""}${p.name}`, ICON("ride"), () => {
      if (cur) playAnim(mob, cur, true);
      if (playAnim(mob, p.anim, false)) {
        mob.addTag(MOB_TAG);
        mob.setDynamicProperty("npcstudio:mobpose", p.once ? undefined : p.anim);
        setRiderLean(mob, p.rider);
        // mobs must stay still or the pose fights their walking animation
        if (!mob.getDynamicProperty("npcstudio:frozen")) {
          try {
            mob.addEffect("slowness", 20000000, { amplifier: 255, showParticles: false });
            mob.setDynamicProperty("npcstudio:frozen", true);
          } catch {
            /* ignore */
          }
        }
      }
      back?.();
    });
  }
  if (back) m.back(back);
  m.show(player);
}

export function reapplyMobPoses() {
  for (const dim of ["overworld", "nether", "the_end"]) {
    try {
      for (const mob of world.getDimension(dim).getEntities({ tags: [MOB_TAG] })) {
        const a = mob.getDynamicProperty("npcstudio:mobpose");
        if (a) playAnim(mob, a, false);
      }
    } catch {
      /* ignore */
    }
  }
}
