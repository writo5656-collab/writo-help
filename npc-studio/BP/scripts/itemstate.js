/**
 * NPC Studio V3.3 — itemstate.js : Item State. The NPC uses its item the way a player does:
 * bow pulled back, crossbow loaded / charged, trident raised, shield blocking, spyglass at the eye,
 * goat horn played. Each step sets the arms; bows and crossbows also show Minecraft's own pulling /
 * charged pictures (bits 11-13 of npcstudio:flags, read by RP/attachables/bow.json + crossbow.json).
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { setRot, pushUndo } from "./rig.js";
import { getEquip } from "./wardrobe.js";
import { setItemFrame } from "./selection.js";

const AIM = { right_arm: [-90, -15, 0], left_arm: [-90, 35, 0] };
// arm angles in degrees ([x raise forward, y turn, z roll]); hand = which hand holds it
// Trident raise: the arm also turns 180° so the trident points forward over the shoulder (the item
// sits in the hand pointing forward; raising the arm alone swung it round to point backwards).
const ITEMS = {
  "minecraft:bow": {
    states: ["Idle", "Pull 1", "Pull 2", "Pull 3"],
    frame: (s) => s,
    pose: (s) => (s === 0 ? { right_arm: [-14, 0, 0], left_arm: [0, 0, 0] } : { right_arm: AIM.right_arm, left_arm: [-90, 25 + 5 * s, 0] })
  },
  "minecraft:crossbow": {
    states: ["Empty", "Loading 1", "Loading 2", "Loading 3", "Charged", "Firework"],
    frame: (s) => s,
    pose: (s) => (s <= 3 ? { right_arm: [-30 - 8 * s, 0, 0], left_arm: [-40 - 8 * s, 20, 0] } : AIM)
  },
  "minecraft:trident": {
    states: ["Hold", "Raise to throw"],
    frame: () => 0,
    pose: (s) => (s === 0 ? { right_arm: [-18, 0, 0], left_arm: [0, 0, 0] } : { right_arm: [-170, 180, 0], left_arm: [-20, 0, 0] })
  },
  "minecraft:spyglass": {
    states: ["Hold", "Look"],
    frame: () => 0,
    pose: (s) => (s === 0 ? { right_arm: [-14, 0, 0] } : { right_arm: [-115, -30, 0] })
  },
  "minecraft:goat_horn": {
    states: ["Hold", "Play"],
    frame: () => 0,
    pose: (s) => (s === 0 ? { right_arm: [-14, 0, 0] } : { right_arm: [-110, -35, 0] })
  }
};
const SHIELD = {
  states: ["Hold", "Block"],
  frame: () => 0,
  pose: (s, hand) => {
    const key = hand === "Offhand" ? "left_arm" : "right_arm";
    const sign = hand === "Offhand" ? 1 : -1;
    return s === 0 ? { [key]: [-14, 0, 0] } : { [key]: [-80, 40 * sign, 0] };
  }
};

/** What the NPC holds that has states: { item, hand, def } or undefined. */
export function itemStateFor(npc) {
  const main = getEquip(npc, "Mainhand")?.id;
  if (main && ITEMS[main]) return { item: main, hand: "Mainhand", def: ITEMS[main] };
  if (main === "minecraft:shield") return { item: main, hand: "Mainhand", def: SHIELD };
  const off = getEquip(npc, "Offhand")?.id;
  if (off === "minecraft:shield") return { item: off, hand: "Offhand", def: SHIELD };
  return undefined;
}

export function getItemState(npc) {
  const info = itemStateFor(npc);
  if (!info) return 0;
  const s = Number(npc.getDynamicProperty("npcstudio:item_state") ?? 0);
  return Math.max(0, Math.min(info.def.states.length - 1, s));
}

export function setItemState(npc, s) {
  const info = itemStateFor(npc);
  if (!info) return;
  s = Math.max(0, Math.min(info.def.states.length - 1, s));
  pushUndo(npc);
  npc.setDynamicProperty("npcstudio:item_state", s);
  const pose = info.def.pose(s, info.hand);
  for (const [bone, rot] of Object.entries(pose)) setRot(npc, bone, rot);
  setItemFrame(npc, info.def.frame(s));
}

/** Panel row: "Item State  < Pull 2 >" (only when the NPC holds a bow, crossbow, trident, shield, spyglass or goat horn). */
export function itemStateRow(m, npc) {
  const info = itemStateFor(npc);
  if (!info) return;
  const s = getItemState(npc);
  m.cycle("Item State", info.def.states[s], (d) => setItemState(npc, s + d));
}
