/**
 * NPC Studio — wardrobe.js : equipment, enchantments and armor trims.
 *
 * WHY THE OLD VERSION LOST ENCHANTS/TRIMS:
 * the Script API's equippable component only exists on players, so on our NPC the only thing
 * that worked was `/replaceitem`, which takes a bare item name — every enchantment and trim
 * was thrown away. This version uses three routes that DO keep item data:
 *
 *  1. Loot route  — `/loot replace entity @s <slot> 0 loot <table>` with generated loot tables
 *                   that apply `set_armor_trim` / enchantments. Instant, no AI involved.
 *                   Powers the in-game Trim Studio and Quick Glint.
 *  2. Pickup route — drop an exact copy of YOUR item at the NPC's feet and let the NPC pick it
 *                   up with vanilla's mob equip logic (same as a zombie grabbing armor). The copy
 *                   keeps everything: enchants, trims, custom names, dye colours.
 *                   Powers "Copy My Outfit", "Give Held Item" and Shift+Right-Click.
 *  3. Command route — `/replaceitem` (+ `/enchant` for the main hand). Plain fallback.
 *
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { EquipmentSlot, ItemStack, EntityComponentTypes, EnchantmentTypes } from "@minecraft/server";
import { world, system, menu, modal, confirm, msg, ICON, niceId, isLocked, npcsNear, getJson, TOOL_IDS, NPC_FAMILY } from "./core.js";
import { TRIM_DATA, MATERIAL_LABELS, isTrimmable, trimTablePath, glintTablePath } from "./trimdata.js";

export const SLOTS = [
  { key: "Head", slot: EquipmentSlot.Head, cmd: "slot.armor.head", icon: "textures/items/diamond_helmet" },
  { key: "Chest", slot: EquipmentSlot.Chest, cmd: "slot.armor.chest", icon: "textures/items/diamond_chestplate" },
  { key: "Legs", slot: EquipmentSlot.Legs, cmd: "slot.armor.legs", icon: "textures/items/diamond_leggings" },
  { key: "Feet", slot: EquipmentSlot.Feet, cmd: "slot.armor.feet", icon: "textures/items/diamond_boots" },
  { key: "Mainhand", slot: EquipmentSlot.Mainhand, cmd: "slot.weapon.mainhand", icon: "textures/items/diamond_sword" },
  { key: "Offhand", slot: EquipmentSlot.Offhand, cmd: "slot.weapon.offhand", icon: ICON("item_shield") }
];
const ARMOR_KEYS = ["Head", "Chest", "Legs", "Feet"];
export const slotDef = (key) => SLOTS.find((s) => s.key === key);

const TIER_LABEL = { leather: "Leather", chainmail: "Chainmail", iron: "Iron", golden: "Gold", diamond: "Diamond", netherite: "Netherite" };
const TIER_ICON = (tier, piece) => `textures/items/${tier === "golden" ? "gold" : tier}_${piece}`;

// ---------- item catalog (icon paths are vanilla texture files; they don't always match the id) ----------
const I = (id, icon) => ({ id: `minecraft:${id}`, icon: icon ? `textures/${icon}` : `textures/items/${id}` });
const CATALOG = {
  Head: [
    { name: "Mob Heads & Hats", items: [I("carved_pumpkin", "blocks/pumpkin_face_off"), I("skeleton_skull", "items/skull_skeleton"), I("wither_skeleton_skull", "items/skull_wither"), I("zombie_head", "items/skull_zombie"), I("creeper_head", "items/skull_creeper"), I("dragon_head", "items/skull_dragon"), I("piglin_head", "items/skull_piglin"), I("player_head", "items/skull_steve"), I("turtle_helmet")] }
  ],
  Chest: [{ name: "Wings", items: [I("elytra")] }],
  Mainhand: [
    { name: "Swords", items: ["wooden", "stone", "iron", "golden", "diamond", "netherite"].map((t) => I(`${t}_sword`, `items/${t === "wooden" ? "wood" : t === "golden" ? "gold" : t}_sword`)) },
    { name: "Axes", items: ["wooden", "stone", "iron", "golden", "diamond", "netherite"].map((t) => I(`${t}_axe`, `items/${t === "wooden" ? "wood" : t === "golden" ? "gold" : t}_axe`)) },
    { name: "Tools", items: [I("diamond_pickaxe"), I("netherite_pickaxe"), I("iron_pickaxe"), I("diamond_shovel"), I("diamond_hoe"), I("shears"), I("flint_and_steel"), I("fishing_rod", "items/fishing_rod_uncast"), I("brush"), I("spyglass")] },
    { name: "Ranged & Special", items: [I("bow", "items/bow_standby"), I("crossbow", "items/crossbow_standby"), I("trident"), I("mace"), I("wind_charge"), I("snowball"), I("ender_pearl"), I("egg")] },
    { name: "Magic & Props", items: [I("blaze_rod"), I("totem_of_undying", "items/totem"), I("book", "items/book_normal"), I("enchanted_book", "items/book_enchanted"), I("writable_book", "items/book_writable"), I("torch", "blocks/torch_on"), I("lantern"), I("compass", "items/compass_item"), I("clock", "items/clock_item"), I("map", "items/map_empty"), I("stick"), I("bone"), I("nether_star"), I("heart_of_the_sea"), I("goat_horn")] },
    { name: "Food & Drink", items: [I("apple"), I("golden_apple", "items/apple_golden"), I("bread"), I("cooked_beef", "items/beef_cooked"), I("cookie"), I("cake"), I("potion", "items/potion_bottle_drinkable"), I("milk_bucket", "items/bucket_milk"), I("carrot"), I("melon_slice", "items/melon")] }
  ],
  Offhand: [
    { name: "Offhand", items: [I("shield", "ui/npcstudio/icon_item_shield"), I("totem_of_undying", "items/totem"), I("torch", "blocks/torch_on"), I("lantern"), I("map", "items/map_empty"), I("firework_rocket", "items/fireworks"), I("arrow"), I("book", "items/book_normal"), I("spyglass"), I("compass", "items/compass_item"), I("clock", "items/clock_item"), I("goat_horn")] }
  ]
};

// ---------- equipment cache (our own record of what the NPC wears; reading it back isn't possible) ----------
const cacheKey = (slotKey) => `npcstudio:equip_${slotKey.toLowerCase()}`;
export function getEquip(npc, slotKey) {
  const raw = npc.getDynamicProperty(cacheKey(slotKey));
  if (raw === undefined) return undefined;
  if (typeof raw === "string" && raw.startsWith("{")) {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return { id: raw }; // v2 format: bare item id
}
function setEquipCache(npc, slotKey, info) {
  npc.setDynamicProperty(cacheKey(slotKey), info ? JSON.stringify(info) : undefined);
}
export function describeEquip(info) {
  if (!info) return "§7empty";
  let s = niceId(info.id);
  if (info.trim) s += ` §d[${info.trim.pattern}/${info.trim.material}]`;
  if (info.ench?.length || info.glint) s += " §b[Ench]";
  if (info.fromHand) s += " §a[yours]";
  return s;
}

// ---------- route 3: plain commands ----------
function cmdReplace(npc, def, itemId) {
  const name = itemId ? itemId.replace("minecraft:", "") : "air";
  const r = npc.runCommand(`replaceitem entity @s ${def.cmd} 0 ${name} 1`);
  return (r?.successCount ?? 1) > 0;
}

export function equipBasic(npc, slotKey, itemId) {
  const def = slotDef(slotKey);
  try {
    if (!cmdReplace(npc, def, itemId)) return false;
    setEquipCache(npc, slotKey, itemId ? { id: itemId } : undefined);
    return true;
  } catch (e) {
    console.warn(`[NPC Studio] equipBasic ${slotKey} ${itemId}: ${e}`);
    return false;
  }
}

export function clearSlot(npc, slotKey) {
  return equipBasic(npc, slotKey, undefined);
}

/** Main hand only: /enchant always targets the main hand, so this route is reliable there. */
function enchantMainhand(npc, itemId, enchants) {
  if (!equipBasic(npc, "Mainhand", itemId)) return { ok: false, applied: [] };
  const applied = [];
  for (const [id, lvl] of enchants) {
    try {
      const r = npc.runCommand(`enchant @s ${id} ${lvl}`);
      if ((r?.successCount ?? 1) > 0) applied.push([id, lvl]);
    } catch {
      /* incompatible enchant for this item — skip */
    }
  }
  setEquipCache(npc, "Mainhand", { id: itemId, ench: applied });
  return { ok: true, applied };
}

// ---------- route 1: loot tables ----------
function lootReplace(npc, slotKey, table) {
  const def = slotDef(slotKey);
  try {
    const r = npc.runCommand(`loot replace entity @s ${def.cmd} 0 loot "${table}"`);
    return (r?.successCount ?? 1) > 0;
  } catch (e) {
    console.warn(`[NPC Studio] loot ${table}: ${e}`);
    return false;
  }
}

export function equipTrim(npc, slotKey, itemId, pattern, material, glint) {
  if (!isTrimmable(itemId)) return false;
  if (!lootReplace(npc, slotKey, trimTablePath(itemId, pattern, material, glint))) return false;
  setEquipCache(npc, slotKey, { id: itemId, trim: { pattern, material }, glint: !!glint });
  return true;
}

export function equipGlint(npc, slotKey, itemId) {
  if (slotKey === "Mainhand") return enchantMainhand(npc, itemId, [["unbreaking", 1]]).ok;
  const table = glintTablePath(itemId);
  if (!table || !lootReplace(npc, slotKey, table)) return false;
  setEquipCache(npc, slotKey, { id: itemId, glint: true });
  return true;
}

// ---------- route 2: pickup (exact copies of real items) ----------
const pickupBusy = new Set();

function infoFromStack(stack, fromHand) {
  const info = { id: stack.typeId };
  try {
    const ench = stack.getComponent("minecraft:enchantable")?.getEnchantments() ?? [];
    if (ench.length) info.ench = ench.map((e) => [e.type.id.replace("minecraft:", ""), e.level]);
  } catch {
    /* not enchantable */
  }
  if (fromHand) info.fromHand = true;
  if (stack.nameTag) info.name = stack.nameTag;
  return info;
}

/** Where would the NPC put this item? */
export function slotForItem(itemId) {
  const id = itemId.replace("minecraft:", "");
  if (/_helmet$/.test(id) || /(_skull|_head)$/.test(id) || id === "carved_pumpkin") return "Head";
  if (/_chestplate$/.test(id) || id === "elytra") return "Chest";
  if (/_leggings$/.test(id)) return "Legs";
  if (/_boots$/.test(id)) return "Feet";
  if (["totem_of_undying", "shield", "map", "filled_map", "firework_rocket", "arrow"].includes(id)) return "Offhand";
  return "Mainhand";
}

/**
 * Give the NPC exact copies of item stacks.
 * entries: [{ slotKey, stack, fromHand }]
 * Items that can't be picked up (offhand, heads, or if pickup fails) fall back to commands.
 */
export function giveExact(player, npc, entries, onDone) {
  if (!npc.isValid) return;
  if (pickupBusy.has(npc.id)) return msg(player, "§eThat NPC is still putting on the last items — give it a second.");

  const viaPickup = [];
  const report = [];
  for (const e of entries) {
    const id = e.stack.typeId;
    // Heads/pumpkins and the offhand never get picked up into the right slot, so use commands.
    const pickupOk = e.slotKey !== "Offhand" && !(e.slotKey === "Head" && !/_helmet$/.test(id));
    if (pickupOk) {
      viaPickup.push(e);
    } else {
      const info = infoFromStack(e.stack, e.fromHand);
      if (e.slotKey === "Mainhand" && info.ench?.length) enchantMainhand(npc, id, info.ench);
      else if (info.ench?.length && glintTablePath(id) && e.slotKey !== "Mainhand") equipGlint(npc, e.slotKey, id);
      else equipBasic(npc, e.slotKey, id);
      report.push(`${e.slotKey}: ${niceId(id)}`);
    }
  }
  if (viaPickup.length === 0) {
    if (report.length) msg(player, `§aEquipped ${report.join(", ")}.`);
    return onDone?.();
  }

  // Keep players from grabbing the copy first (that would duplicate the item).
  const tooClose = () => [...npc.dimension.getPlayers({ location: npc.location, maxDistance: 2.6 })].length > 0;
  let waited = 0;
  const waitForSpace = () => {
    if (!npc.isValid) return;
    if (tooClose()) {
      if (waited === 0) msg(player, "§eStep back 3 blocks — the NPC is about to pick up the gear.");
      if (waited > 200) return msg(player, "§cCancelled: stand at least 3 blocks away from the NPC and try again.");
      waited += 10;
      return system.runTimeout(waitForSpace, 10);
    }
    startPickup(player, npc, viaPickup, report, onDone);
  };
  waitForSpace();
}

function startPickup(player, npc, entries, report, onDone) {
  pickupBusy.add(npc.id);
  const anchor = { loc: { ...npc.location }, rot: npc.getRotation() };
  for (const e of entries) {
    try {
      cmdReplace(npc, slotDef(e.slotKey), undefined);
    } catch {
      /* ignore */
    }
  }
  try {
    npc.triggerEvent("npcstudio:pickup_on");
  } catch (e) {
    console.warn(`[NPC Studio] pickup_on failed: ${e}`);
  }

  const drops = [];
  system.runTimeout(() => {
    for (const e of entries) {
      try {
        const item = npc.dimension.spawnItem(e.stack.clone(), { x: anchor.loc.x, y: anchor.loc.y + 0.1, z: anchor.loc.z });
        try {
          item.clearVelocity();
        } catch {
          /* ignore */
        }
        drops.push({ e, item });
      } catch (err) {
        console.warn(`[NPC Studio] spawnItem failed: ${err}`);
      }
    }
  }, 2);

  let ticks = 0;
  const id = system.runInterval(() => {
    ticks += 4;
    const alive = drops.filter((d) => d.item.isValid);
    if (npc.isValid) {
      try {
        npc.teleport(anchor.loc, { rotation: anchor.rot });
      } catch {
        /* ignore */
      }
    }
    if ((drops.length > 0 && alive.length === 0) || ticks >= 120 || !npc.isValid) {
      system.clearRun(id);
      finishPickup(player, npc, drops, anchor, report, onDone);
    }
  }, 4);
}

function finishPickup(player, npc, drops, anchor, report, onDone) {
  pickupBusy.delete(npc.id);
  if (!npc.isValid) return;
  try {
    npc.triggerEvent("npcstudio:pickup_off");
    npc.teleport(anchor.loc, { rotation: anchor.rot });
  } catch {
    /* ignore */
  }
  let exact = 0;
  const fallback = [];
  for (const { e, item } of drops) {
    const info = infoFromStack(e.stack, e.fromHand);
    if (!item.isValid) {
      setEquipCache(npc, e.slotKey, info);
      exact++;
      report.push(`${e.slotKey}: ${niceId(info.id)}`);
    } else {
      try {
        item.remove();
      } catch {
        /* ignore */
      }
      // Fallback: keep the look as close as we can.
      if (e.slotKey === "Mainhand" && info.ench?.length) enchantMainhand(npc, info.id, info.ench);
      else if (info.ench?.length && glintTablePath(info.id)) equipGlint(npc, e.slotKey, info.id);
      else equipBasic(npc, e.slotKey, info.id);
      fallback.push(niceId(info.id));
    }
  }
  if (report.length) msg(player, `§aEquipped ${report.join(", ")}${exact ? " §7(exact copies — enchants & trims kept)" : ""}.`);
  if (fallback.length) {
    msg(player, `§e${fallback.join(", ")}: the NPC couldn't pick ${fallback.length > 1 ? "these" : "this"} up, so I used the basic method (item shows, trims won't). Use Trim Studio for trims.`);
  }
  onDone?.();
}

// ---------- reading the player's own gear ----------
function playerEquipment(player) {
  return player.getComponent(EntityComponentTypes.Equippable);
}
function heldItem(player) {
  try {
    return playerEquipment(player)?.getEquipment(EquipmentSlot.Mainhand);
  } catch {
    return undefined;
  }
}

export function copyOutfit(player, npc, includeHands, onDone) {
  const eq = playerEquipment(player);
  if (!eq) return msg(player, "§cCouldn't read your equipment.");
  const entries = [];
  for (const def of SLOTS) {
    if (!includeHands && !ARMOR_KEYS.includes(def.key)) continue;
    let stack;
    try {
      stack = eq.getEquipment(def.slot);
    } catch {
      stack = undefined;
    }
    if (!stack || TOOL_IDS.includes(stack.typeId)) continue;
    entries.push({ slotKey: def.key, stack, fromHand: true });
  }
  if (entries.length === 0) return msg(player, "§cYou aren't wearing anything to copy. Put on armor (trim it at a smithing table, enchant it) first!");
  giveExact(player, npc, entries, onDone);
}

export function giveHeld(player, npc, onDone) {
  const stack = heldItem(player);
  if (!stack || TOOL_IDS.includes(stack.typeId)) return msg(player, "§cHold the item you want to give (not an NPC Studio tool).");
  giveExact(player, npc, [{ slotKey: slotForItem(stack.typeId), stack, fromHand: true }], onDone);
}

/** Shift + right-click with any item. */
export function quickEquip(player, npc, stack) {
  if (!npc.isValid || isLocked(npc)) return msg(player, "§cThat NPC is locked.");
  const slotKey = slotForItem(stack.typeId);
  const cur = getEquip(npc, slotKey);
  const go = () => giveExact(player, npc, [{ slotKey, stack, fromHand: true }]);
  if (cur) confirm(player, "Replace item?", `${slotKey} has ${niceId(cur.id)}.\nReplace it with ${niceId(stack.typeId)}?`, "Replace", go);
  else go();
}

// ---------- re-applying saved gear (presets / clones) ----------
export function applyEquipInfo(npc, slotKey, info) {
  if (!info) return clearSlot(npc, slotKey);
  if (info.trim) return equipTrim(npc, slotKey, info.id, info.trim.pattern, info.trim.material, info.glint);
  if (slotKey === "Mainhand" && info.ench?.length) return enchantMainhand(npc, info.id, info.ench).ok;
  if (info.glint || info.ench?.length) {
    if (equipGlint(npc, slotKey, info.id)) return true;
  }
  return equipBasic(npc, slotKey, info.id);
}
export function readAllEquip(npc) {
  const out = {};
  for (const { key } of SLOTS) out[key] = getEquip(npc, key) ?? null;
  return out;
}

// =====================================================================================
// MENUS
// =====================================================================================
export function openWardrobe(player, npc, back) {
  if (!npc.isValid) return;
  const self = () => openWardrobe(player, npc, back);
  const lines = SLOTS.map(({ key }) => `§f${key}: ${describeEquip(getEquip(npc, key))}`).join("\n");
  const m = menu(`Wardrobe: ${npc.nameTag || "NPC"}`, `${lines}\n\n§7Tip: trim & enchant armor normally (smithing table / anvil), wear it, then use §fCopy My Outfit§7 — the NPC gets exact copies.`)
    .btn("Copy My Outfit\n§8armor + hands, keeps enchants & trims", ICON("copy_outfit"), () => copyOutfit(player, npc, true, self))
    .btn("Give Item In My Hand\n§8exact copy, auto-picks the slot", ICON("equip"), () => giveHeld(player, npc, self))
    .btn("Trim Studio\n§8add armor trims from a menu", ICON("trim"), () => openTrimStudio(player, npc, self))
    .btn("Full Armor Sets", ICON("armor_set"), () => openArmorSets(player, npc, self));
  for (const def of SLOTS) m.btn(`${def.key}\n§8${describeEquip(getEquip(npc, def.key)).replace(/§./g, "")}`, def.icon, () => openSlotMenu(player, npc, def.key, self));
  m.btn("Clear Everything", ICON("clear_x"), () =>
    confirm(player, "Clear all gear?", "Remove every item from this NPC?", "Clear", () => {
      SLOTS.forEach(({ key }) => clearSlot(npc, key));
      msg(player, "§aAll gear removed.");
      self();
    }, self)
  );
  if (back) m.back(back);
  m.show(player);
}

function openArmorSets(player, npc, back) {
  const m = menu("Full Armor Sets", "Equip a whole set in one tap. Open Trim Studio after to add trims to it.");
  for (const tier of TRIM_DATA.tiers) {
    m.btn(`${TIER_LABEL[tier]} Set`, TIER_ICON(tier, "chestplate"), () => {
      for (const key of ARMOR_KEYS) equipBasic(npc, key, `minecraft:${tier}_${TRIM_DATA.pieces[key]}`);
      msg(player, `§a${TIER_LABEL[tier]} set equipped.`);
      back();
    });
  }
  m.btn(`Enchanted Netherite Set §b(glint)`, TIER_ICON("netherite", "chestplate"), () => {
    for (const key of ARMOR_KEYS) equipGlint(npc, key, `minecraft:netherite_${TRIM_DATA.pieces[key]}`);
    msg(player, "§aGlinting netherite set equipped.");
    back();
  });
  m.back(back).show(player);
}

function openSlotMenu(player, npc, slotKey, back) {
  const self = () => openSlotMenu(player, npc, slotKey, back);
  const cur = getEquip(npc, slotKey);
  const m = menu(`${slotKey} Slot`, `Currently: ${describeEquip(cur)}`);
  if (ARMOR_KEYS.includes(slotKey)) {
    const piece = TRIM_DATA.pieces[slotKey];
    m.btn("Armor (pick tier)", TIER_ICON("diamond", piece), () => {
      const mm = menu(`${slotKey}: Armor`);
      for (const tier of TRIM_DATA.tiers) {
        const id = `minecraft:${tier}_${piece}`;
        mm.btn(TIER_LABEL[tier], TIER_ICON(tier, piece), () => {
          equipBasic(npc, slotKey, id);
          msg(player, `§a${slotKey}: ${niceId(id)}.`);
          self();
        });
      }
      mm.back(self).show(player);
    });
  }
  for (const cat of CATALOG[slotKey] ?? []) {
    m.btn(cat.name, cat.items[0]?.icon, () => openCatalog(player, npc, slotKey, cat, self));
  }
  m.btn("Give Item In My Hand", ICON("equip"), () => {
    const stack = heldItem(player);
    if (!stack || TOOL_IDS.includes(stack.typeId)) return msg(player, "§cHold an item first.");
    giveExact(player, npc, [{ slotKey, stack, fromHand: true }], self);
  });
  m.btn("Type Any Item ID...", ICON("custom"), () =>
    modal(`${slotKey}: any item`)
      .text("id", "Item ID (e.g. minecraft:nether_star or mymod:gun)", "minecraft:diamond_sword", cur?.id ?? "")
      .show(player, ({ id }) => {
        id = String(id ?? "").trim();
        if (!id) return self();
        if (!id.includes(":")) id = `minecraft:${id}`;
        try {
          new ItemStack(id, 1);
        } catch {
          msg(player, `§cUnknown item: ${id}`);
          return self();
        }
        msg(player, equipBasic(npc, slotKey, id) ? `§a${slotKey}: ${niceId(id)}.` : `§cCouldn't equip ${id}.`);
        self();
      }, self)
  );
  if (cur) {
    if (ARMOR_KEYS.includes(slotKey) && isTrimmable(cur.id)) m.btn("Add / Change Trim", ICON("trim"), () => openTrimStudio(player, npc, self, [slotKey]));
    m.btn("Enchant This Item...", ICON("enchant"), () => openEnchantEditor(player, npc, slotKey, self));
    m.btn("Quick Glint (shiny)", ICON("enchant"), () => {
      msg(player, equipGlint(npc, slotKey, cur.id) ? "§bGlint added." : "§cThis item can't glow from the menu — enchant it yourself and use Give Item In My Hand.");
      self();
    });
    m.btn("Clear Slot", ICON("clear_x"), () => {
      clearSlot(npc, slotKey);
      self();
    });
  }
  m.back(back).show(player);
}

function openCatalog(player, npc, slotKey, cat, back) {
  const m = menu(`${slotKey}: ${cat.name}`);
  for (const it of cat.items) {
    m.btn(niceId(it.id), it.icon, () => {
      msg(player, equipBasic(npc, slotKey, it.id) ? `§a${slotKey}: ${niceId(it.id)}.` : `§cCouldn't equip ${niceId(it.id)} on this version.`);
      back();
    });
  }
  m.back(back).show(player);
}

// ---------- Trim Studio ----------
const lastTrim = new Map();

export function openTrimStudio(player, npc, back, onlySlots) {
  const prev = lastTrim.get(player.id) ?? { pattern: 2, material: 9, glint: false, tier: 0 };
  const tierOpts = ["Keep current armor (or Diamond if none)", ...TRIM_DATA.tiers.map((t) => TIER_LABEL[t])];
  const f = modal("Trim Studio")
    .dropdown("pattern", "Trim pattern", TRIM_DATA.patterns.map((p) => p[0].toUpperCase() + p.slice(1)), prev.pattern)
    .dropdown("material", "Trim colour (material)", TRIM_DATA.materials.map((m) => MATERIAL_LABELS[m] ?? m), prev.material)
    .dropdown("tier", "Armor type", tierOpts, prev.tier)
    .toggle("glint", "Enchantment glint too", prev.glint);
  const slots = onlySlots ?? ARMOR_KEYS;
  for (const key of slots) f.toggle(`s_${key}`, `Apply to ${key}`, true);
  f.submit("Apply Trim").show(player, (v) => {
    if (!npc.isValid) return;
    lastTrim.set(player.id, { pattern: v.pattern, material: v.material, glint: v.glint, tier: v.tier });
    const pattern = TRIM_DATA.patterns[v.pattern];
    const material = TRIM_DATA.materials[v.material];
    const done = [];
    const failed = [];
    for (const key of slots) {
      if (!v[`s_${key}`]) continue;
      const piece = TRIM_DATA.pieces[key];
      let itemId;
      if (v.tier > 0) itemId = `minecraft:${TRIM_DATA.tiers[v.tier - 1]}_${piece}`;
      else {
        const cur = getEquip(npc, key)?.id;
        itemId = isTrimmable(cur) ? cur : `minecraft:diamond_${piece}`;
      }
      if (equipTrim(npc, key, itemId, pattern, material, v.glint)) done.push(key);
      else failed.push(key);
    }
    if (done.length) msg(player, `§d${pattern} trim (${material}) applied to ${done.join(", ")}.`);
    if (failed.length) msg(player, `§cCouldn't trim ${failed.join(", ")} — make sure the pack's loot tables are installed (use the .mcaddon from the release).`);
    back?.();
  }, back);
}

// ---------- Enchant editor ----------
const ENCHANTS = {
  armor: ["protection", "fire_protection", "blast_protection", "projectile_protection", "thorns", "unbreaking", "mending", "binding", "vanishing"],
  Head: ["respiration", "aqua_affinity"],
  Legs: ["swift_sneak"],
  Feet: ["feather_falling", "depth_strider", "frost_walker", "soul_speed"],
  hand: [
    "sharpness", "smite", "bane_of_arthropods", "knockback", "fire_aspect", "looting", "efficiency", "silk_touch", "fortune",
    "power", "punch", "flame", "infinity", "multishot", "piercing", "quick_charge", "loyalty", "riptide", "channeling", "impaling",
    "density", "breach", "wind_burst", "lure", "luck_of_the_sea", "unbreaking", "mending", "vanishing"
  ]
};
function enchantsFor(slotKey) {
  if (ARMOR_KEYS.includes(slotKey)) return [...ENCHANTS.armor, ...(ENCHANTS[slotKey] ?? [])];
  return ENCHANTS.hand;
}

function openEnchantEditor(player, npc, slotKey, back) {
  const cur = getEquip(npc, slotKey);
  if (!cur) return back();
  let probe;
  try {
    probe = new ItemStack(cur.id, 1);
  } catch {
    msg(player, "§cThat item can't be enchanted.");
    return back();
  }
  const ench = probe.getComponent("minecraft:enchantable");
  const valid = [];
  for (const id of enchantsFor(slotKey)) {
    const type = EnchantmentTypes.get(id);
    if (!type) continue;
    try {
      if (!ench || ench.canAddEnchantment({ type, level: 1 })) valid.push({ id, type });
    } catch {
      /* not applicable */
    }
  }
  if (valid.length === 0) {
    msg(player, `§c${niceId(cur.id)} can't take enchantments.`);
    return back();
  }
  const have = Object.fromEntries(cur.ench ?? []);
  const f = modal(`Enchant ${niceId(cur.id)}`);
  for (const { id, type } of valid) f.slider(id, `${niceId(id)} (0 = off)`, 0, type.maxLevel, 1, have[id] ?? 0);
  f.submit("Apply Enchantments").show(player, (v) => {
    if (!npc.isValid) return;
    const chosen = valid.filter(({ id }) => v[id] > 0).map(({ id }) => [id, v[id]]);
    if (slotKey === "Mainhand") {
      const r = enchantMainhand(npc, cur.id, chosen);
      msg(player, `§bEnchanted: ${r.applied.map(([i, l]) => `${niceId(i)} ${l}`).join(", ") || "none (removed)"}.`);
      return back();
    }
    // Armor / offhand: build a real enchanted copy and hand it over.
    const stack = new ItemStack(cur.id, 1);
    const ec = stack.getComponent("minecraft:enchantable");
    for (const [id, lvl] of chosen) {
      try {
        ec?.addEnchantment({ type: EnchantmentTypes.get(id), level: lvl });
      } catch {
        /* conflicts (e.g. two protections) are skipped */
      }
    }
    if (cur.trim) msg(player, "§eNote: the enchanted copy won't have the trim. Re-apply the trim with 'Enchantment glint too' for both.");
    giveExact(player, npc, [{ slotKey, stack, fromHand: false }], back);
  }, back);
}

// ---------- bulk ----------
export function openBulkWardrobe(player, back) {
  modal("Bulk Wardrobe")
    .dropdown("what", "What to do", ["Copy my armor to all (basic, no trims)", "Apply a Trim Studio look to all", "Clear all gear"], 0)
    .slider("radius", "Every NPC within this many blocks", 5, 100, 5, 20)
    .show(player, (v) => {
      const npcs = npcsNear(player, v.radius).filter((n) => !isLocked(n));
      if (npcs.length === 0) return msg(player, "§cNo unlocked NPCs in range.");
      if (v.what === 0) {
        const eq = playerEquipment(player);
        for (const n of npcs) {
          for (const def of SLOTS) {
            const s = eq?.getEquipment(def.slot);
            if (s && !TOOL_IDS.includes(s.typeId)) equipBasic(n, def.key, s.typeId);
          }
        }
        msg(player, `§aCopied your gear onto ${npcs.length} NPCs.`);
      } else if (v.what === 1) {
        const prev = lastTrim.get(player.id) ?? { pattern: 2, material: 9, glint: false, tier: 0 };
        modal("Bulk Trim")
          .dropdown("pattern", "Trim pattern", TRIM_DATA.patterns, prev.pattern)
          .dropdown("material", "Trim material", TRIM_DATA.materials, prev.material)
          .dropdown("tier", "Armor type", TRIM_DATA.tiers.map((t) => TIER_LABEL[t]), 4)
          .toggle("glint", "Glint", prev.glint)
          .show(player, (t) => {
            for (const n of npcs)
              for (const key of ARMOR_KEYS)
                equipTrim(n, key, `minecraft:${TRIM_DATA.tiers[t.tier]}_${TRIM_DATA.pieces[key]}`, TRIM_DATA.patterns[t.pattern], TRIM_DATA.materials[t.material], t.glint);
            msg(player, `§dTrimmed armor applied to ${npcs.length} NPCs.`);
          });
      } else {
        for (const n of npcs) SLOTS.forEach(({ key }) => clearSlot(n, key));
        msg(player, `§aCleared ${npcs.length} NPCs.`);
      }
    }, back);
}

export { NPC_FAMILY, world, getJson };
