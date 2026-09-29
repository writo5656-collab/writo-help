/**
 * NPC Studio — skins.js : skin slots, custom slot names, classic/slim arms.
 *
 * Bedrock can only load textures from resource packs, so a script can never import a PNG at
 * runtime. What we CAN do: 20 custom slots whose names come from a language key, so a small
 * "skin pack" (made with tools/skin-pack-builder.html, right on your phone) can replace the
 * pictures AND the names without touching NPC Studio's files. Names can also be set in-game.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, menu, modal, msg, ICON } from "./core.js";

export const PREMADE = ["Steve", "Alex", "Dream", "Technoblade", "Warden", "Soldier", "Knight", "Mage", "Assassin", "NoxeelMC", "Mercenary", "Scientist"];
export const CUSTOM_COUNT = 20;
export const SKIN_COUNT = PREMADE.length + CUSTOM_COUNT; // must match RP texture count (32)
const SLIM_BY_DEFAULT = new Set([1]); // Alex

const nameKey = (i) => `npcstudio:skinname:${i}`;

/** Button label: in-game name > skin-pack language name > default. */
export function skinLabel(i) {
  const custom = world.getDynamicProperty(nameKey(i));
  if (custom) return String(custom);
  if (i < PREMADE.length) return PREMADE[i];
  return { rawtext: [{ translate: `npcstudio.skin.${i}` }] };
}
export function skinPlainName(i) {
  const custom = world.getDynamicProperty(nameKey(i));
  if (custom) return String(custom);
  return i < PREMADE.length ? PREMADE[i] : `Custom ${i - PREMADE.length + 1}`;
}

export function setSkin(npc, i, autoSlim = true) {
  npc.setProperty("npcstudio:skin_index", i);
  if (autoSlim) {
    const slimPref = world.getDynamicProperty(`npcstudio:skinslim:${i}`);
    npc.setProperty("npcstudio:slim", slimPref !== undefined ? !!slimPref : SLIM_BY_DEFAULT.has(i));
  }
}

/** Pick a skin; calls onPick(index). */
export function pickSkin(player, title, onPick, back) {
  const m = menu(title, "§7Want your own skins? See §fCustom Skin Slots§7 below.");
  m.btn("§lPremade skins", ICON("skin"), () => {
    const mm = menu("Premade Skins");
    PREMADE.forEach((_, i) => mm.btn(skinLabel(i), ICON("skin"), () => onPick(i)));
    mm.back(() => pickSkin(player, title, onPick, back)).show(player);
  });
  m.btn("§lCustom skin slots (1-20)", ICON("custom"), () => {
    const mm = menu("Custom Skin Slots");
    for (let i = PREMADE.length; i < SKIN_COUNT; i++) mm.btn(skinLabel(i), ICON("custom"), () => onPick(i));
    mm.back(() => pickSkin(player, title, onPick, back)).show(player);
  });
  m.btn("How to add my own skins", ICON("debug"), () => showSkinHelp(player, () => pickSkin(player, title, onPick, back)));
  m.btn("Rename a custom slot", ICON("rename"), () => renameSlot(player, () => pickSkin(player, title, onPick, back)));
  if (back) m.back(back);
  m.show(player);
}

function showSkinHelp(player, back) {
  menu(
    "Add Your Own Skins",
    [
      "§fMinecraft doesn't let add-ons load pictures while the game is running, so skins have to come in a resource pack. It only takes a minute:",
      "",
      "§e1.§f Open §bSkin Pack Builder§f (link on the NPC Studio page) in your browser.",
      "§e2.§f Pick up to 20 skin PNGs (normal 64x64 Minecraft skins) and name them.",
      "§e3.§f Tap §aDownload .mcpack§f and open it — Minecraft imports it.",
      "§e4.§f Activate it in this world's Resource Packs, §lABOVE§r§f NPC Studio.",
      "",
      "§7Your skins show up as Custom Slots 1-20 with the names you chose. Update the pack any time — NPCs keep their slot.",
      "§7Slim (Alex-style) arms: Manage NPC > Skin & Size > Arm Model."
    ].join("\n")
  )
    .back(back)
    .show(player);
}

function renameSlot(player, back) {
  const opts = [];
  for (let i = PREMADE.length; i < SKIN_COUNT; i++) opts.push(`Slot ${i - PREMADE.length + 1}: ${skinPlainName(i)}`);
  modal("Rename Custom Slot")
    .dropdown("slot", "Which slot", opts, 0)
    .text("name", "New name (leave empty to reset)", "Ninja")
    .toggle("slim", "This skin uses slim (Alex) arms", false)
    .show(player, (v) => {
      const i = PREMADE.length + v.slot;
      const name = String(v.name ?? "").trim();
      world.setDynamicProperty(nameKey(i), name || undefined);
      world.setDynamicProperty(`npcstudio:skinslim:${i}`, v.slim);
      msg(player, `§aSlot ${v.slot + 1} is now "${skinPlainName(i)}".`);
      back();
    }, back);
}
