/**
 * NPC Studio — main.js (entry point: events + tool wiring)
 * Copyright (c) 2026 NoxeelMC. All rights reserved.
 * youtube.com/@NoxeelMC
 *
 * You may use this add-on freely and redistribute the packaged .mcaddon as-is with
 * credit intact. You may NOT copy, modify, or reuse this script file (in whole or in
 * part) in your own add-on/mod without written permission from NoxeelMC.
 * See LICENSE.md in this pack for full terms.
 */
import { ItemStack, EquipmentSlot, EntityComponentTypes, CommandPermissionLevel, CustomCommandStatus } from "@minecraft/server";
import { world, system, safeOn, msg, actionbar, NPC_ID, CAMERA_ID, WAND_ID, CAMERA_TOOL_ID, MOB_TOOL_ID, MOB_TAG, TOOL_IDS, isLocked } from "./core.js";
import { openMainMenu, openManageMenu, getLookedAtNPC, startLookLoop } from "./npc.js";
import { openCameraToolMenu, openCameraPanel, camState, viewThrough, exitView, isViewing } from "./camera.js";
import { openMobToolMenu, openMobManageMenu, tryRide, tryDismount } from "./mobs.js";
import { quickEquip } from "./wardrobe.js";
import { isInGizmo, endGizmo, gizmoCycleAxis, gizmoToggleMode, restoreAfterRejoin, cleanupGizmos } from "./poseEditor.js";
import { inCinema, exitCinema, restoreCinemaAfterRejoin } from "./cinema.js";
import { startMountLoop, reapplyMobPoses } from "./mount.js";
import { applyPose, expandPreset, pushUndo } from "./rig.js";
import { ALL_POSES, QUICK_CYCLE } from "./poses.js";

const STARTER_ITEMS = [WAND_ID, CAMERA_TOOL_ID, MOB_TOOL_ID];

system.run(() => {
  world.sendMessage("§8[§bNPC Studio§8] §7Studio loaded — grab your wand and roll camera. §8by NoxeelMC");
});

startLookLoop();
startMountLoop();
system.runTimeout(cleanupGizmos, 20);

// ---------- slash commands: /exitcam  /npc  /cameras ----------
safeOn(() => system.beforeEvents.startup, (ev) => {
  const reg = ev.customCommandRegistry;
  const add = (name, description, fn) => {
    try {
      reg.registerCommand({ name: `npcstudio:${name}`, description, permissionLevel: CommandPermissionLevel.Any, cheatsRequired: false }, (origin) => {
        const player = origin.sourceEntity;
        if (player?.typeId !== "minecraft:player") return { status: CustomCommandStatus.Failure, message: "Only players can use this." };
        system.run(() => fn(player));
        return { status: CustomCommandStatus.Success };
      });
    } catch (e) {
      console.warn(`[NPC Studio] couldn't register /${name}: ${e}`);
    }
  };
  add("exitcam", "Leave NPC Studio camera view", (p) => {
    if (inCinema(p)) exitCinema(p);
    else {
      exitCinema(p, { fade: false });
      msg(p, "§7You're not in a camera view (reset anyway).");
    }
  });
  add("npc", "Open the NPC Studio menu", (p) => openMainMenu(p));
  add("cameras", "Open the NPC Studio camera menu", (p) => openCameraToolMenu(p));
}, "startup");

// ---------- join: welcome + tools ----------
safeOn(() => world.afterEvents.playerSpawn, (ev) => {
  const player = ev.player;
  restoreAfterRejoin(player);
  restoreCinemaAfterRejoin(player);
  system.runTimeout(reapplyMobPoses, 60);
  if (!ev.initialSpawn) return;
  system.runTimeout(() => {
    if (!player.isValid) return;
    try {
      player.onScreenDisplay.setTitle("§l§bNPC STUDIO", { subtitle: "§fwelcome to §bStudio Mode", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 20 });
      player.playSound("random.levelup", { pitch: 0.8, volume: 0.6 });
    } catch {
      /* ignore */
    }
    msg(player, "§b§l» WELCOME TO NPC STUDIO MODE");
    msg(player, "§fYou're the director now. §7Right-click air with the §bWand§7 to start, or type §e/npc§7.");
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return;
    for (const itemId of STARTER_ITEMS) {
      let has = false;
      for (let i = 0; i < inv.size; i++) if (inv.getItem(i)?.typeId === itemId) has = true;
      if (!has) {
        try {
          inv.addItem(new ItemStack(itemId, 1));
        } catch {
          /* inventory full */
        }
      }
    }
  }, 40);
}, "playerSpawn");

// ---------- right-click with a tool ----------
safeOn(() => world.beforeEvents.itemUse, (ev) => {
  const itemId = ev.itemStack?.typeId;
  if (!TOOL_IDS.includes(itemId)) return;
  ev.cancel = true;
  const player = ev.source;
  system.run(() => {
    if (isInGizmo(player)) return endGizmo(player, true);
    if (itemId === WAND_ID) {
      const npc = getLookedAtNPC(player);
      if (npc) openManageMenu(player, npc);
      else openMainMenu(player);
    } else if (itemId === CAMERA_TOOL_ID) {
      openCameraToolMenu(player);
    } else if (itemId === MOB_TOOL_ID) {
      openMobToolMenu(player);
    }
  });
}, "itemUse");

// ---------- right-click directly on things ----------
safeOn(() => world.beforeEvents.playerInteractWithEntity, (ev) => {
  const { player, target } = ev;
  if (!target) return;
  if (target.typeId === CAMERA_ID) {
    ev.cancel = true;
    system.run(() => openCameraPanel(player, target));
  } else if (target.hasTag?.(MOB_TAG)) {
    ev.cancel = true;
    system.run(() => openMobManageMenu(player, target));
  } else if (target.typeId === NPC_ID) {
    // Always cancel so nothing native (container / npc dialogue) can hijack the click.
    ev.cancel = true;
    let held;
    try {
      held = player.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
    } catch {
      held = undefined;
    }
    const sneaking = player.isSneaking;
    system.run(() => {
      if (isInGizmo(player)) return;
      if (sneaking && held && !TOOL_IDS.includes(held.typeId)) return quickEquip(player, target, held);
      if (!held || held.typeId === WAND_ID) openManageMenu(player, target);
    });
  }
}, "playerInteractWithEntity");

// ---------- left-click shortcuts ----------
safeOn(() => world.afterEvents.entityHitEntity, (ev) => {
  const attacker = ev.damagingEntity;
  const target = ev.hitEntity;
  if (attacker?.typeId !== "minecraft:player") return;
  if (isInGizmo(attacker)) return; // swing handled below
  let held;
  try {
    held = attacker.getComponent(EntityComponentTypes.Equippable)?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    held = undefined;
  }

  if (target?.typeId === CAMERA_ID) {
    if (isViewing(attacker)) {
      exitView(attacker);
      actionbar(attacker, "§7Left camera view.");
    } else {
      viewThrough(attacker, camState(target), true);
      actionbar(attacker, `§7Looking through ${target.nameTag}. Hit it again to exit.`);
    }
    return;
  }
  if (target?.hasTag?.(MOB_TAG) && held?.typeId === MOB_TOOL_ID) {
    if (tryDismount(attacker)) actionbar(attacker, "§7Dismounted.");
    else actionbar(attacker, tryRide(attacker, target) ? "§7Riding." : "§cCan't ride this mob.");
    return;
  }
  if (target?.typeId === NPC_ID && held?.typeId === WAND_ID) {
    if (isLocked(target)) return actionbar(attacker, "§cThat NPC is locked.");
    const idx = ((target.getDynamicProperty("npcstudio:preset_cycle") ?? -1) + 1) % QUICK_CYCLE.length;
    const name = QUICK_CYCLE[idx];
    pushUndo(target);
    applyPose(target, expandPreset(ALL_POSES[name]));
    target.setDynamicProperty("npcstudio:preset_cycle", idx);
    actionbar(attacker, `§7Quick pose: §f${name} §8(${idx + 1}/${QUICK_CYCLE.length})`);
  }
}, "entityHitEntity");

// ---------- gizmo controls ----------
safeOn(() => world.afterEvents.playerHotbarSelectedSlotChange, (ev) => {
  if (isInGizmo(ev.player)) gizmoCycleAxis(ev.player, ev.newSlotSelected);
}, "playerHotbarSelectedSlotChange");

safeOn(() => world.afterEvents.playerSwingStart, (ev) => {
  if (isInGizmo(ev.player)) gizmoToggleMode(ev.player);
}, "playerSwingStart");

// ---------- chat fallback ----------
safeOn(() => world.beforeEvents.chatSend, (ev) => {
  const m = ev.message.trim().toLowerCase();
  if (m === "!npc") {
    ev.cancel = true;
    system.run(() => openMainMenu(ev.sender));
  } else if (m === "!exitcam" || m === "!exit") {
    ev.cancel = true;
    system.run(() => exitCinema(ev.sender));
  }
}, "chatSend");
