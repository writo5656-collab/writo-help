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
/** Head icon made from the skin itself (tools/make_icons.py; skin packs can override it). */
export const headIcon = (i) => `textures/ui/npcstudio/heads/skin${i}`;
export const npcHead = (npc) => headIcon(npc.getProperty("npcstudio:skin_index") ?? 0);
export const SKIN_COUNT = PREMADE.length + CUSTOM_COUNT; // must match RP texture count (32)
// skin_index 32-41 = custom 3D models (tools/make_custom.py); a player's pack replaces model + texture
export const MODEL_FIRST = 32, MODEL_COUNT = 10;
export const isModelIndex = (i) => i >= MODEL_FIRST && i < MODEL_FIRST + MODEL_COUNT;
export const isCustomModel = (npc) => isModelIndex(Number(npc.getProperty("npcstudio:skin_index") ?? 0));
const BEFORE_MODEL = "npcstudio:skin_before_model";
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
  if (isModelIndex(i)) return `Custom model ${i - MODEL_FIRST + 1}`;
  return i < PREMADE.length ? PREMADE[i] : `Custom ${i - PREMADE.length + 1}`;
}

/** Show custom model n (1-10) instead of the player model; 0 goes back to the skin it had before. */
export function setModel(npc, n) {
  const now = Number(npc.getProperty("npcstudio:skin_index") ?? 0);
  if (n > 0) {
    if (!isModelIndex(now)) npc.setDynamicProperty(BEFORE_MODEL, now);
    npc.setProperty("npcstudio:skin_index", MODEL_FIRST + Math.min(n, MODEL_COUNT) - 1);
    return;
  }
  const before = Number(npc.getDynamicProperty(BEFORE_MODEL) ?? 0);
  npc.setProperty("npcstudio:skin_index", isModelIndex(before) ? 0 : before);
  npc.setDynamicProperty(BEFORE_MODEL, undefined);
}

/** Pick a custom model; calls onPick(n) with n = 1-10. */
export function pickModel(player, onPick, back) {
  const self = () => pickModel(player, onPick, back);
  const m = menu("Custom Models", "§7Models come from your own pack (Pack Builder website).").grid();
  for (let n = 1; n <= MODEL_COUNT; n++) m.btn(skinLabel(MODEL_FIRST + n - 1), headIcon(MODEL_FIRST + n - 1), () => onPick(n));
  m.btn("How to add models", ICON("debug"), () => showModelHelp(player, self));
  if (back) m.back(back);
  m.show(player);
}

function showModelHelp(player, back) {
  menu(
    "Add Your Own Models",
    [
      "§fMake a model in §bBlockbench§f (Bedrock Entity), then §bFile > Export > Export Bedrock Geometry§f and save its texture PNG.",
      "",
      "§e1.§f Open §bnoxeelmc-art.github.io/npc-studio-skins§f > §bModels§f.",
      "§e2.§f Add the .geo.json and the PNG to a slot and name it.",
      "§e3.§f Download the pack, open it, activate it §lABOVE§r§f NPC Studio.",
      "",
      "§7Name bones head, body, rightArm, leftArm, rightLeg, leftLeg and the Pose tab moves them. Position, rotation and scale work on any model.",
      "§7Custom models have no outline and no cape."
    ].join("\n")
  )
    .back(back)
    .show(player);
}

export function setSkin(npc, i, autoSlim = true) {
  npc.setProperty("npcstudio:skin_index", i);
  if (!isModelIndex(i)) npc.setDynamicProperty(BEFORE_MODEL, undefined);
  if (autoSlim) {
    const slimPref = world.getDynamicProperty(`npcstudio:skinslim:${i}`);
    npc.setProperty("npcstudio:slim", slimPref !== undefined ? !!slimPref : SLIM_BY_DEFAULT.has(i));
  }
}

/** Pick a skin; calls onPick(index). V3: one grid of heads (12 premade + 20 custom slots). */
export function pickSkin(player, title, onPick, back) {
  const self = () => pickSkin(player, title, onPick, back);
  const m = menu(title, "§7Custom slots come from your own skin pack (Skin Pack Builder).").grid();
  for (let i = 0; i < SKIN_COUNT; i++) m.btn(skinLabel(i), headIcon(i), () => onPick(i));
  m.btn("My Skins?", ICON("debug"), () => showSkinHelp(player, self));
  m.btn("Rename Slot", ICON("rename"), () => renameSlot(player, self));
  if (back) m.back(back);
  m.show(player);
}

function showSkinHelp(player, back) {
  menu(
    "Add Your Own Skins",
    [
      "§fMinecraft doesn't let add-ons load pictures while the game is running, so skins have to come in a resource pack. It only takes a minute:",
      "",
      "§e1.§f Open §bnoxeelmc-art.github.io/npc-studio-skins§f in your browser (free Skin Pack Builder).",
      "§e2.§f Pick up to 20 skin PNGs (normal 64x64 Minecraft skins) and name them.",
      "§e3.§f Tap §aDownload .mcpack§f and open it — Minecraft imports it.",
      "§e4.§f Activate it in this world's Resource Packs, §lABOVE§r§f NPC Studio.",
      "",
      "§7Your skins show up as Custom Slots 1-20 with the names you chose. Update the pack any time — NPCs keep their slot.",
      "§7Slim (Alex-style) arms: Studio panel > Display > Slim arms."
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
