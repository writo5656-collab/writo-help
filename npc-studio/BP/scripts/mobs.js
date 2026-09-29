/**
 * NPC Studio — mobs.js : spawn / freeze / ride vanilla mobs as props.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { menu, modal, msg, ICON, MOB_TAG } from "./core.js";
import { openPutNpcOn, openMobPoses } from "./mount.js";

const MOB_TYPES = [
  ["horse", "Horse", true], ["donkey", "Donkey", true], ["mule", "Mule", true], ["camel", "Camel", true],
  ["pig", "Pig", true], ["strider", "Strider", true], ["llama", "Llama", true],
  ["wolf", "Wolf"], ["cat", "Cat"], ["fox", "Fox"], ["parrot", "Parrot"], ["cow", "Cow"], ["sheep", "Sheep"],
  ["chicken", "Chicken"], ["rabbit", "Rabbit"], ["villager_v2", "Villager"], ["iron_golem", "Iron Golem"],
  ["snow_golem", "Snow Golem"], ["allay", "Allay"], ["zombie", "Zombie"], ["skeleton", "Skeleton"], ["spider", "Spider"],
  ["creeper", "Creeper"], ["enderman", "Enderman"], ["witch", "Witch"], ["piglin", "Piglin"], ["warden", "Warden"],
  ["ender_dragon", "Ender Dragon"], ["axolotl", "Axolotl"], ["frog", "Frog"], ["panda", "Panda"], ["polar_bear", "Polar Bear"]
].map(([id, label, rideable]) => ({ id: `minecraft:${id}`, label, rideable: !!rideable }));

const FREEZE_TICKS = 20000000;

function freeze(mob, on) {
  try {
    if (on) mob.addEffect("slowness", FREEZE_TICKS, { amplifier: 255, showParticles: false });
    else mob.removeEffect("slowness");
  } catch {
    /* ignore */
  }
  mob.setDynamicProperty("npcstudio:frozen", on);
}

export function tryRide(player, mob) {
  try {
    return mob.getComponent("minecraft:rideable")?.addRider(player) ?? false;
  } catch {
    return false;
  }
}
export function tryDismount(player) {
  try {
    player.dismount();
    return true;
  } catch {
    return false;
  }
}

export function openMobToolMenu(player, back) {
  const m = menu("Spawn a Mob Prop", "§7Spawned mobs are named (so they never despawn) and frozen in place. Right-click one to manage it.");
  for (const def of MOB_TYPES) {
    m.btn(def.label + (def.rideable ? " §8(rideable)" : ""), def.rideable ? ICON("ride") : "textures/items/npcstudio_mob_tool", () => {
      const loc = player.getHeadLocation();
      const mob = player.dimension.spawnEntity(def.id, { x: loc.x, y: player.location.y, z: loc.z });
      mob.nameTag = def.label;
      mob.addTag(MOB_TAG);
      freeze(mob, true);
      msg(player, `§aSpawned ${def.label}.`);
    });
  }
  if (back) m.back(back);
  m.show(player);
}

export function openMobManageMenu(player, mob) {
  if (!mob.isValid) return;
  if (mob.getDynamicProperty("npcstudio:locked")) {
    return menu(mob.nameTag || "Mob", "§cLocked.")
      .btn("Unlock", ICON("lock"), () => {
        mob.setDynamicProperty("npcstudio:locked", false);
        openMobManageMenu(player, mob);
      })
      .show(player);
  }
  const frozen = !!mob.getDynamicProperty("npcstudio:frozen");
  const self = () => openMobManageMenu(player, mob);
  menu(mob.nameTag || "Mob")
    .btn("Rename", ICON("rename"), () =>
      modal("Rename Mob").text("n", "Name", "Mob", mob.nameTag || "").show(player, ({ n }) => {
        if (String(n ?? "").trim()) mob.nameTag = String(n).trim();
        self();
      }, self)
    )
    .btn(frozen ? "Unfreeze (let it move)" : "Freeze (stop moving)", ICON("freeze"), () => {
      freeze(mob, !frozen);
      self();
    })
    .btn("Put an NPC on it (ride)", ICON("spawn"), () => openPutNpcOn(player, mob, self))
    .btn("Mob Poses (rear up, sit...)", ICON("pose_preset"), () => openMobPoses(player, mob, self))
    .btn("Face My Direction", ICON("turn"), () => {
      mob.setRotation({ x: 0, y: player.getRotation().y + 180 });
      self();
    })
    .btn("Ride", ICON("ride"), () => msg(player, tryRide(player, mob) ? "§aRiding." : "§cCan't ride this mob."))
    .btn("Dismount", ICON("dismount"), () => tryDismount(player))
    .btn("Lock", ICON("lock"), () => {
      mob.setDynamicProperty("npcstudio:locked", true);
      msg(player, "§aLocked.");
    })
    .btn("§cDelete", ICON("delete"), () => {
      mob.remove();
      msg(player, "§aDeleted.");
    })
    .show(player);
}
