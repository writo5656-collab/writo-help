/**
 * NPC Studio — hotbar.js : temporary tool items on the player's hotbar.
 * Your own hotbar items are moved to free inventory slots and put back afterwards.
 * Everything is recorded on the player, so a crash or leaving the world can't lose items.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { ItemStack } from "@minecraft/server";
import { getJson, setJson } from "./core.js";

const KEY = "npcstudio:hotbar_swap";
export const isStudioTempItem = (id) => typeof id === "string" && (id.startsWith("npcstudio:tool_") || id.startsWith("npcstudio:cam_"));

function inv(player) {
  try {
    return player.getComponent("minecraft:inventory")?.container;
  } catch {
    return undefined;
  }
}

/** Remove every temporary NPC Studio item from the inventory. */
export function purgeTempItems(player) {
  const c = inv(player);
  if (!c) return;
  for (let i = 0; i < c.size; i++) {
    const it = c.getItem(i);
    if (it && isStudioTempItem(it.typeId)) c.setItem(i, undefined);
  }
}

/**
 * Put tools on the hotbar. tools: array of up to 9 item ids (undefined = empty slot).
 * Returns false (and changes nothing) if there isn't room to put your items away.
 */
export function swapHotbar(player, tools) {
  const c = inv(player);
  if (!c) return false;
  if (player.getDynamicProperty(KEY) !== undefined) restoreHotbar(player);
  const moves = [];
  const free = [];
  for (let i = 9; i < c.size; i++) if (!c.getItem(i)) free.push(i);
  const needed = [];
  for (let i = 0; i < 9; i++) if (c.getItem(i) && !isStudioTempItem(c.getItem(i).typeId)) needed.push(i);
  if (needed.length > free.length) return false;
  for (const from of needed) {
    const to = free.shift();
    const item = c.getItem(from);
    c.setItem(to, item);
    c.setItem(from, undefined);
    moves.push({ from, to, typeId: item.typeId });
  }
  setJson(player, KEY, { moves, sel: player.selectedSlotIndex });
  tools.forEach((id, i) => {
    if (id) c.setItem(i, new ItemStack(id, 1));
  });
  return true;
}

export function restoreHotbar(player) {
  const c = inv(player);
  const saved = getJson(player, KEY, undefined);
  if (!c) return;
  purgeTempItems(player);
  if (!saved) return;
  for (const m of saved.moves ?? []) {
    const it = c.getItem(m.to);
    if (it && it.typeId === m.typeId && !c.getItem(m.from)) {
      c.setItem(m.from, it);
      c.setItem(m.to, undefined);
    }
  }
  try {
    player.selectedSlotIndex = saved.sel ?? 0;
  } catch {
    /* ignore */
  }
  player.setDynamicProperty(KEY, undefined);
}

/** Put a single temporary item in the currently selected slot (must be empty). */
export function holdTempItem(player, id) {
  const c = inv(player);
  if (!c) return false;
  const slot = player.selectedSlotIndex;
  const cur = c.getItem(slot);
  if (cur && !isStudioTempItem(cur.typeId)) return false;
  c.setItem(slot, new ItemStack(id, 1));
  return true;
}
