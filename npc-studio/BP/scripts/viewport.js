/**
 * NPC Studio V3.2 — viewport.js : the free space right of the Studio panel.
 * While the panel is open you can turn your view there (look around), but you can't walk, break,
 * place or hit. Tapping an NPC in that space selects it and the panel switches to it.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { uiManager } from "@minecraft/server-ui";
import { world, system, safeOn, isEditing, NPC_FAMILY, sfx } from "./core.js";
import { openStudioFor } from "./panel.js";

function isNpc(e) {
  try {
    return !!e?.isValid && e.matches({ families: [NPC_FAMILY] });
  } catch {
    return false;
  }
}

/** Select the tapped NPC: close the open panel, then open it again on that NPC. */
function pick(player, npc) {
  system.run(() => {
    try {
      uiManager.closeAllForms(player);
    } catch {
      /* ignore */
    }
    system.runTimeout(() => {
      if (!player.isValid || !npc.isValid) return;
      sfx(player, "click");
      openStudioFor(player, npc);
    }, 2);
  });
}

safeOn(() => world.beforeEvents.playerBreakBlock, (e) => {
  if (isEditing(e.player)) e.cancel = true;
}, "editor: no breaking");

safeOn(() => world.beforeEvents.playerInteractWithBlock, (e) => {
  if (isEditing(e.player)) e.cancel = true;
}, "editor: no placing");

safeOn(() => world.beforeEvents.playerInteractWithEntity, (e) => {
  if (!isEditing(e.player)) return;
  e.cancel = true;
  if (isNpc(e.target)) pick(e.player, e.target);
}, "editor: tap NPC");

safeOn(() => world.beforeEvents.entityHurt, (e) => {
  const p = e.damageSource?.damagingEntity;
  if (p?.typeId === "minecraft:player" && isEditing(p)) e.cancel = true;
}, "editor: no hitting");

safeOn(() => world.afterEvents.entityHitEntity, (e) => {
  const p = e.damagingEntity;
  if (p?.typeId === "minecraft:player" && isEditing(p) && isNpc(e.hitEntity)) pick(p, e.hitEntity);
}, "editor: hit NPC selects it");
