/**
 * NPC Studio — handbook.js : the in-game manual (the "NPC Studio Handbook" item).
 * Menus only show short names; this book explains what every feature does.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { menu, ICON, sfx } from "./core.js";

const P = (icon, title, lines) => ({ icon, title, text: lines.join("\n") });

export const CHAPTERS = [
  {
    name: "New In V3",
    icon: "layers",
    pages: [
      P("outline", "The Studio Panel", [
        "Everything now lives in one panel on the left with six tabs:",
        "§bDisplay§f — skin, size, wardrobe, cape, name tag",
        "§bPose§f — Pose Mode, exact sliders, library, undo",
        "§bPresets§f — presets, scenes, crowds, props, tools",
        "§bWorld§f — time, weather, Depth Fog, studio rules",
        "§bCamera§f — Fly Cam, cameras, Peek, shots",
        "§bLayers§f — green screen, hide/show, Photo Mode",
        "",
        "§7Switches flip with one tap. The ☰ / X closes the panel so you can move."
      ]),
      P("scale", "Live Editors", [
        "Size, exact pose sliders, Trim Studio, time, fog and camera lens open a §bgrey live editor§f.",
        "",
        "§7Drag a slider and the NPC or world changes right away. The editor stays open until you close it."
      ]),
      P("trim", "Trim Studio (Fitting Room)", [
        "The camera moves close to the NPC. Change pattern, material, armor and glint and see each change on the NPC immediately.",
        "§7'Turn the view' walks the camera around the NPC."
      ]),
      P("outline", "Cyan Outline", [
        "The NPC you're editing gets a cyan outline that every player sees, so you always know which one is selected.",
        "",
        "§7Outlines hide automatically while anyone is filming. §fPresets > Select All Nearby§7 selects many NPCs at once."
      ]),
      P("camera", "Pyramid Cameras", [
        "Cameras are drawn as a lens point joined to a frame. The frame shows the camera's real shot size: a narrow FOV makes a small frame.",
        "",
        "§aGreen§f = your selected camera, §9blue§f = others, §7grey§f = locked."
      ]),
      P("monitor", "Peek (Camera Monitor)", [
        "Tap with the §bCamera Monitor§f: your screen becomes the selected camera.",
        "§7• Tap again: next camera  • Double-tap sneak or §f/exitcam§7: back to you",
        "",
        "§7The thirds guide helps framing (Camera tab switch). It never shows in Photo Mode."
      ]),
      P("fog", "Depth Fog", [
        "Far things fade into a colour while close things stay sharp. Gives depth and makes NPCs stand out.",
        "",
        "§78 looks (white, black, haze, sunset, night, horror, dream, smoke) and 9 distances. Only you see it."
      ]),
      P("photo", "Photo Mode", [
        "3-2-1, then the HUD, your hand, outlines, cameras and name tags disappear and the screen flashes.",
        "§fTake your device screenshot§7 (phone: power + volume down). Tap the screen to come back.",
        "",
        "§7Add-ons can't save pictures by themselves, so the screenshot is yours to take."
      ]),
      P("backdrop", "Green Screen & Layers", [
        "§bGreen Screen§f puts a flat green box around your scene. Remove the green in any editor (CapCut, PicsArt, Photopea) for a clean NPC picture.",
        "",
        "§bLayer Shot§f takes 3 photos from the same camera: full shot, NPCs on green, background only. They line up perfectly.",
        "§7Use a flat area: blocks between camera and NPC still show."
      ]),
      P("prop", "Block, Item & Particle Props", [
        "§fBlock & Item Props§7: a floating block or item you move, turn (Display > Turn The Prop) and scale.",
        "§fParticle Props§7: a spot that keeps playing fire, smoke, hearts, sparks..."
      ]),
      P("crowd", "Crowds & Scenes", [
        "§fMake A Crowd§7 copies the selected NPC into a grid, line, circle or random scatter, with random turns and poses.",
        "§fScene Presets§7 save everything around you (NPCs, mobs, props, cameras) and place it anywhere."
      ]),
      P("tools", "New Tools", [
        "§bNPC Stamp§f — tap an NPC to copy, tap a block to paste.",
        "§bNPC Rotator§f — tap an NPC to make it face you.",
        "§bTeleporter§f — go where you look.",
        "§7Get them in Presets > Studio Tools."
      ]),
      P("cape", "Capes, Name Tags, NPC Bright", [
        "§fCape§7: 8 capes for any NPC.",
        "§fName Tag§7: colour, bold, or hide it.",
        "§fNPC Bright§7: the NPC stays fully lit in dark scenes."
      ])
    ]
  },
  {
    name: "Getting Started",
    icon: "debug",
    pages: [
      P("spawn", "Your Tools", [
        "§bDirector's Baton§f — your main tool.",
        "§7• Tap / right-click the air: the Studio Panel.",
        "§7• Tap an NPC: select it and edit it in the panel.",
        "§7• Hit an NPC: cycle quick poses.",
        "",
        "§bCine Camera§f — place cameras and fly the camera.",
        "§bCamera Monitor§f — peek through your cameras.",
        "§bBeast Whistle§f — spawn animals and mobs as props.",
        "§bHandbook§f — this book.",
        "",
        "§7Lost a tool? Type §f/npc§7 for the menu."
      ]),
      P("spawn", "Spawn NPC", [
        "Choose how many NPCs, then pick a skin by its face.",
        "",
        "§7More than one spawns a neat grid in front of you, all facing you."
      ]),
      P("manage", "Edit An NPC", [
        "Opens the NPC you're looking at, or a list of nearby NPCs with their faces.",
        "",
        "§7Everything about one NPC lives here: pose, wardrobe, skin, size, animation, riding, shots, clone and save."
      ])
    ]
  },
  {
    name: "Posing",
    icon: "gizmo",
    pages: [
      P("gizmo", "Pose Mode (Gizmo)", [
        "Your hotbar turns into a toolbar:",
        "§e1 Select§f — just look at a body part to pick it.",
        "§b2 Rotate§f / §63 Move§f — look around to turn or move it.",
        "§f4 Axis§f — Free, or lock to §cX§f, §aY§f or §9Z§f.",
        "§f5 Undo  6 Reset part  9 Done",
        "",
        "§aSneak§f = done, §cJump§f = cancel everything.",
        "§7The live numbers show in the top-right corner. Your hotbar items come back when you finish."
      ]),
      P("pose_preset", "Pose Library", [
        "45+ ready poses in 5 groups: Basic, Action, Sit & Lie, Emotes, Fun.",
        "",
        "§7Pick one, then fine-tune it in Pose Mode."
      ]),
      P("save", "My Saved Poses", ["Save the current pose under a name and put it on any NPC later (also mirrored)."]),
      P("mirror", "Mirror / Copy / Paste", ["§fMirror§7 swaps left and right.", "§fCopy§7 a pose, open another NPC, §fPaste§7."]),
      P("undo", "Undo & Redo", ["Up to 40 steps per NPC. Works for poses, sizes and Pose Mode."]),
      P("scale", "Size / Height", ["§fPlayer Size§7 makes the NPC exactly as tall as you.", "§7Baby, giant, or any size from 10% to 500%."]),
      P("sliders", "Advanced", ["Exact number sliders, a nudge pad with buttons, and Pose Mode speed / snapping."])
    ]
  },
  {
    name: "Wardrobe",
    icon: "equip",
    pages: [
      P("copy_outfit", "Copy My Outfit", [
        "Gives the NPC exact copies of the armor and items you're wearing — §fenchantments and trims included§7.",
        "",
        "§7Stand 3+ blocks away so the NPC can pick them up."
      ]),
      P("equip", "Give Item In My Hand", ["Exact copy of the item you're holding. It goes to the right slot by itself.", "", "§7Shortcut: sneak + tap an NPC while holding an item."]),
      P("trim", "Trim Studio", ["Add armor trims from a menu: pattern, colour, armor type and optional glint.", "", "§7Pick which pieces to trim."]),
      P("enchant", "Enchant / Quick Glint", ["Choose enchantments and levels, or add a quick shiny glint."]),
      P("armor_set", "Full Armor Sets", ["Leather to Netherite in one tap, plus a glinting netherite set."])
    ]
  },
  {
    name: "Skins",
    icon: "skin",
    pages: [
      P("skin", "Skins & Arms", ["12 premade skins and 20 custom slots, each shown by its face.", "", "§fArm Model§7: Classic (Steve) or Slim (Alex)."]),
      P("custom", "Your Own Skins", [
        "Minecraft only loads pictures from resource packs, so custom skins come in a small pack:",
        "§71. Open the §fSkin Pack Builder§7 web page.",
        "§72. Pick up to 20 PNG skins and name them.",
        "§73. Download, open with Minecraft, activate it §fabove§7 NPC Studio.",
        "",
        "§7Your skins appear in Custom Slots with their names and faces."
      ])
    ]
  },
  {
    name: "Animation",
    icon: "animate",
    pages: [
      P("animate", "Looping Animations", ["19 loops on top of any pose: breathing, walking, running, jumping, waving, talking, dancing, clapping, push-ups and more."]),
      P("record", "Keyframe Animator", [
        "Pose and place the NPC, §fAdd Keyframe§7, change it, add another… then §fPlay§7.",
        "",
        "§fRecord My Movement§7: walk a path and the NPC replays it."
      ]),
      P("eye", "Look At Players", ["The NPC's head follows the nearest player."]),
      P("play", "Play All Animations", ["Main menu: start every NPC's keyframes at once, for a whole scene."])
    ]
  },
  {
    name: "Riding & Mobs",
    icon: "ride",
    pages: [
      P("ride", "Ride a Mob", ["Seat an NPC on any mob: horses, camels, wolves — even a warden.", "", "§7Nudge the seat, sit sideways or stand on it (surfing)."]),
      P("pose_preset", "Mob Poses", ["Horses rear up or hold their head high. Wolves, cats, foxes, pandas and camels sit. Allays dance, wardens roar.", "", "§7Riders lean back with a rearing horse."]),
      P("freeze", "Beast Whistle", ["Spawn mob props. They're named (never despawn) and frozen in place.", "", "§7Tap a mob to freeze, ride, pose or put an NPC on it."])
    ]
  },
  {
    name: "Camera",
    icon: "camera",
    pages: [
      P("flycam", "Fly Cam", [
        "Become an invisible flying camera. Fly with your joystick; the view glides like a drone.",
        "§f• Tap the screen§7 to lock the shot.",
        "§f• Tap again§7 to leave camera view.",
        "§f• Hotbar§7 = zoom.",
        "",
        "§fFly Cam Path§7: tap to drop points, double-tap to finish."
      ]),
      P("camera", "Cameras", ["Placed cameras you can look through, move, zoom, aim at an NPC, follow a mob, shake, or animate along a smooth path."]),
      P("film", "Cinematic Shots", ["30 automatic camera moves: orbits, dolly zoom, crane, drone fly-by, over-the-shoulder, duel shots…", "", "§7Choose NPC, length, distance, height and lens."]),
      P("sequence", "Shot Sequence", ["Line up shots and play them back-to-back with fades, like an edited video."]),
      P("exit", "Leaving Camera View", [
        "§fTap the screen§7 (right-click on PC).",
        "",
        "§7Backups: double-tap sneak, §f/exitcam§7, or §f/npcstudio:exit§7.",
        "§7No text appears while you film."
      ])
    ]
  },
  {
    name: "Scenes & Tools",
    icon: "bulkequip",
    pages: [
      P("clone", "Clone", ["An exact copy next to the original, gear and trims included."]),
      P("preset", "Presets", ["Save an NPC as a preset. Spawn exact copies later, apply it to one NPC, or to a whole crowd."]),
      P("bulkequip", "Bulk Tools", ["Change many NPCs at once: gear, trims, poses, animations, size, face me, look at players, delete."]),
      P("world", "World Controls", ["Time of day, freeze time, weather and weather lock."]),
      P("lock", "Lock", ["Protect a finished NPC from accidental edits."])
    ]
  },
  {
    name: "Commands",
    icon: "custom",
    pages: [
      P("custom", "Commands", [
        "§f/npc§7 — main menu",
        "§f/cameras§7 — camera menu",
        "§f/exitcam§7 — leave camera view",
        "§f/lockcam§7 — lock a Fly Cam shot / finish a path",
        "",
        "§7If a command isn't found, add the prefix: §f/npcstudio:npc"
      ])
    ]
  }
];

export function openHandbook(player, back) {
  sfx(player, "open");
  const m = menu("§lNPC Studio V3 Handbook", "§7Tap a chapter to see what each feature does.");
  for (const ch of CHAPTERS) m.btn(ch.name, ICON(ch.icon), () => openChapter(player, ch, () => openHandbook(player, back)));
  if (back) m.back(back);
  m.show(player);
}

function openChapter(player, ch, back) {
  sfx(player, "open");
  const m = menu(ch.name);
  for (const p of ch.pages) m.btn(p.title, ICON(p.icon), () => openPage(player, p, () => openChapter(player, ch, back)));
  m.back(back).show(player);
}

function openPage(player, p, back) {
  sfx(player, "open");
  menu(p.title, p.text).back(back).show(player);
}
