/**
 * NPC Studio — trimdata.js
 * Shared with tools/build.py, which generates one loot table per (item, pattern, material)
 * from the JSON block below. Keep the block valid JSON.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
export const TRIM_DATA = /*JSON-START*/ {
  "patterns": ["sentry", "dune", "coast", "wild", "ward", "eye", "vex", "tide", "snout", "rib", "spire", "wayfinder", "shaper", "silence", "raiser", "host", "flow", "bolt"],
  "materials": ["quartz", "iron", "netherite", "redstone", "copper", "gold", "emerald", "diamond", "lapis", "amethyst", "resin"],
  "tiers": ["leather", "chainmail", "iron", "golden", "diamond", "netherite"],
  "pieces": { "Head": "helmet", "Chest": "chestplate", "Legs": "leggings", "Feet": "boots" },
  "extraTrimmable": ["minecraft:turtle_helmet"],
  "glintItems": [
    "minecraft:leather_helmet", "minecraft:leather_chestplate", "minecraft:leather_leggings", "minecraft:leather_boots",
    "minecraft:chainmail_helmet", "minecraft:chainmail_chestplate", "minecraft:chainmail_leggings", "minecraft:chainmail_boots",
    "minecraft:iron_helmet", "minecraft:iron_chestplate", "minecraft:iron_leggings", "minecraft:iron_boots",
    "minecraft:golden_helmet", "minecraft:golden_chestplate", "minecraft:golden_leggings", "minecraft:golden_boots",
    "minecraft:diamond_helmet", "minecraft:diamond_chestplate", "minecraft:diamond_leggings", "minecraft:diamond_boots",
    "minecraft:netherite_helmet", "minecraft:netherite_chestplate", "minecraft:netherite_leggings", "minecraft:netherite_boots",
    "minecraft:turtle_helmet", "minecraft:elytra", "minecraft:shield",
    "minecraft:wooden_sword", "minecraft:stone_sword", "minecraft:iron_sword", "minecraft:golden_sword", "minecraft:diamond_sword", "minecraft:netherite_sword",
    "minecraft:wooden_axe", "minecraft:stone_axe", "minecraft:iron_axe", "minecraft:golden_axe", "minecraft:diamond_axe", "minecraft:netherite_axe",
    "minecraft:iron_pickaxe", "minecraft:golden_pickaxe", "minecraft:diamond_pickaxe", "minecraft:netherite_pickaxe",
    "minecraft:iron_shovel", "minecraft:diamond_shovel", "minecraft:netherite_shovel",
    "minecraft:iron_hoe", "minecraft:diamond_hoe", "minecraft:netherite_hoe",
    "minecraft:bow", "minecraft:crossbow", "minecraft:trident", "minecraft:mace", "minecraft:fishing_rod",
    "minecraft:shears", "minecraft:flint_and_steel", "minecraft:carrot_on_a_stick", "minecraft:brush"
  ]
} /*JSON-END*/;

export const MATERIAL_LABELS = {
  quartz: "Quartz (white)", iron: "Iron (silver)", netherite: "Netherite (dark)", redstone: "Redstone (red)",
  copper: "Copper (orange)", gold: "Gold (yellow)", emerald: "Emerald (green)", diamond: "Diamond (cyan)",
  lapis: "Lapis (blue)", amethyst: "Amethyst (purple)", resin: "Resin (amber)"
};

export function isTrimmable(id) {
  if (!id) return false;
  if (TRIM_DATA.extraTrimmable.includes(id)) return true;
  const m = /^minecraft:(\w+?)_(helmet|chestplate|leggings|boots)$/.exec(id);
  return !!m && TRIM_DATA.tiers.includes(m[1]);
}

export function trimTablePath(itemId, pattern, material, glint) {
  const item = itemId.replace("minecraft:", "");
  return `npcstudio/${glint ? "trim_glint" : "trim"}/${item}/${pattern}_${material}`;
}

export function glintTablePath(itemId) {
  return TRIM_DATA.glintItems.includes(itemId) ? `npcstudio/glint/${itemId.replace("minecraft:", "")}` : undefined;
}
