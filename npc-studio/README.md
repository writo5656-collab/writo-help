# NPC Studio V2 (Minecraft Bedrock add-on by NoxeelMC)

Spawn, pose, dress, animate and film custom NPCs for thumbnails and cinematics.
Download: `dist/NPCStudio-V2.mcaddon`

"V2" is the public name of this update. The pack manifests keep counting up internally
(currently 3.5.0) so Minecraft always treats it as newer than the 2.9.0 release players have. (open it on your device and Minecraft imports both packs).

## Latest changes
- Renamed to **NPC Studio V2** (pack names, welcome, menus, Handbook, file name).
- Pose Mode corner readout: smaller, fully on screen, above the attack button, 3 lines.
- The "how to get out" line is back in chat whenever you enter camera view, lock a Fly Cam shot
  or start Fly Cam.

## v3.4 changes
- **New tools:** Director's Baton (wand), Cine Camera (camera tool), Beast Whistle (mob tool).
- **NPC Studio Handbook:** a book every new player gets. Chapters for every feature, each with
  its icon; tap one to read what it does. Also in the main menu and `/npcstudio:handbook`.
- **Clean, professional buttons:** just the name in a strong colour; all descriptions moved into
  the Handbook.
- **Pose Mode readout in the top-right corner** (transparent, no background): body part, mode,
  axis and colour-coded X / Y / Z. Implemented in `RP/ui/hud_screen.json` via titles prefixed `npcs:`.
- **Blue dots in camera view fixed:** your own invisible body is drawn as a dotted ghost when the
  camera is inside it. The Fly Cam lens now sits in front of your face, and locking a shot moves
  your body back to where you started.

## v3.3
- **Clean camera view:** no chat messages or hint bars while filming. Instructions live in the
  menus (Fly Cam explains itself once before it starts).
- **Tap the screen to leave camera view.** An invisible item sits in your hand while filming, so
  tapping (or right-clicking) always gets you out. Fly Cam: tap = lock the shot, tap again = leave;
  path mode: tap = add point, double-tap = finish. Backups: `/exitcam`, `/npcstudio:exit`,
  double-tap sneak. After a script reload, anyone stuck in a camera is released automatically.
- **Pose Mode (new gizmo UX):** a Blender-style toolbar on your hotbar — Select (just look at a
  body part), Rotate, Move, Axis, Undo, Reset, Done. Sneak = done, Jump = cancel everything.
  Your hotbar items are put away and returned. The 3D gizmo shows a yellow frame on the selected part.
- **Skin heads:** every skin button shows that skin's face; NPC lists show each NPC's head.
  The Skin Pack Builder now makes heads for custom skins too.
- **All-new icon set** for every feature (Minecraft item art is only used for real items).

## v3.2
- **Fly Cam:** fly the camera with your normal joystick / WASD; the view follows with smooth
  drone lag. **Tap (swing) or `/lockcam`** locks the shot as a camera. Hotbar scroll = zoom.
  Fly Cam Path: every tap drops a path point, `/lockcam` saves the path. "Re-frame With Fly Cam"
  moves an existing camera.
- **Nothing of yours in the shot:** v3.1's spectator mode drew you as a floating see-through head.
  Now you go invisible and your armor + held items move into your inventory while filming, and
  come back when you exit.
- **Frozen mobs really freeze:** slowness 255 wraps around to almost nothing (effect levels are one
  byte). Frozen mobs now get a proper slowness level plus a position lock, so poses don't fight
  the walking animation. Pose errors are reported in chat.
- **Sound effects:** villager "hmm" on errors, soft chime on success, shutter when a shot starts or
  locks, page turn/click on menus, armor/smithing sounds when equipping and trimming.
- **New icons:** real Minecraft item art where an item fits, and a redrawn outlined icon set for
  the rest (undo/redo, gizmo, play, record, lock...).

## v3.1
- **Visible 3D gizmo** on the body part you're posing: arrows (move) or rings (rotate),
  red = X, green = Y, blue = Z, the axis you control glows yellow. Clearer start screen.
- **Camera view hides you completely:** you switch to spectator while filming, so held items and
  armor no longer float in the shot. Walking is locked and you return to the exact spot/game mode.
- **`/exitcam`** (or double-tap sneak) leaves camera view; you're told this every time you enter.
  Also `/npc` (menu) and `/cameras`. Chat fallback: `!exitcam`.
- Smoother camera: fade in/out, eased moves between framings, softer per-frame easing on shots and paths.
- **NPCs ride mobs:** NPC menu > Ride a Mob (or Mob Tool > mob > Put an NPC on it). Seat nudges,
  sit sideways, surfing stance, riding poses (sword raised, waving, charge).
- **Mob poses:** horse/donkey/mule rearing (kicking or hold), head held high, wolf/cat/fox/panda/camel
  sitting, fox sleeping, panda lying, allay dance, sniffer happy, warden roar. Riders lean back
  automatically when the horse rears.
- New "Welcome to NPC Studio Mode" intro.

## v3.0

### Armor trims and enchant glint (the #1 request)
The old version equipped items with `/replaceitem`, which only takes an item name, so every
enchantment and trim was thrown away. The Script API's equipment component only exists on
players, so there was no script-side fix. v3 uses three ways that keep item data:

| Feature | How it works | Keeps |
|---|---|---|
| **Trim Studio** (Wardrobe) | `/loot replace entity` with generated loot tables that use vanilla's `set_armor_trim` function. 18 patterns × 11 materials × every armor piece, with or without glint. | trims + glint |
| **Copy My Outfit / Give Item In My Hand / Shift+Right-Click** | Drops an exact copy of your item at the NPC's feet and lets the NPC pick it up with vanilla mob equip logic (the same way a zombie grabs armor). Stand 3+ blocks away. | everything: enchants, trims, names, dye |
| **Enchant editor / Quick Glint** | Main hand: `/enchant`. Armor: builds an enchanted item and hands it over. | enchants |

If an NPC can't pick an item up, the add-on falls back to the plain method and tells you so.

### Posing (Blender-style)
- **Live Gizmo:** pick a bone, then look around. The bone follows your view.
  Sneak = apply, Jump = cancel, hotbar = change axis (Free / X / Y / Z), swing = Rotate ↔ Move.
- Every bone now has **position** as well as rotation, plus a **Whole Body** bone
  (lie down, fly, sit on the ground).
- Precise sliders, nudge pad, mirror L↔R, copy/paste between NPCs, 40-step undo/redo,
  saved pose library, and 45+ built-in poses in 5 categories.
- **Size / Height:** vanilla draws players at 93.75% scale, which is why NPCs looked taller.
  NPCs now default to player size; 10–500% available.

### Animation
- 19 looping animations (breathing, walk, run, jump, wave, talk, dance, sword swing, push-ups…).
- **Keyframe Animator:** pose + position + turning + size over time with easing, loop, speed.
- **Record My Movement:** walk a path and the NPC replays it.
- **Look At Players:** head follows the nearest player.

### Camera
- 30 **Cinematic Shots** (orbits, spiral, dolly zoom, crane, bird's eye, aerial dive, drone
  fly-by, over-the-shoulder, POV, whip pan, duel shot/reverse-shot, standoff…) with length,
  distance, height, easing, lens, handheld sway and fades. Shot **sequences** play back-to-back.
- Placed cameras: FOV fixed (the old code passed `fovValue`; the API wants `fov`), smooth
  Catmull-Rom paths with per-point timing and FOV, particle path preview, "frame it myself".
- HUD, your body and NPC name tags are hidden while filming. Sneak stops any shot.

### Skins
- 20 custom slots (was 3) plus classic/slim arm toggle.
- Bedrock can't load pictures while the game runs, so skins must come in a resource pack.
  **Skin Pack Builder** (`tools/skin-pack-builder.html`) builds that pack in the browser,
  including slot names. Names can also be changed in game.

## Setup
1. Import the `.mcaddon`, enable both packs on the world (Beta APIs not required for 2.x APIs).
2. You get the Wand, Camera tool and Mob tool on first join (or `/give @s npcstudio:wand`).
3. Right-click air with the Wand for the menu; right-click an NPC to edit it.

## Building from source
```
python3 npc-studio/tools/build.py        # generates loot tables, validates, writes dist/*.mcaddon
python3 npc-studio/tools/make_assets.py  # regenerates UI icons + placeholder skins (needs Pillow)
```

## Files
- `BP/scripts/` split into modules: `core` (helpers, safe forms), `rig` (bone math, undo),
  `poses`, `poseEditor` (gizmo), `wardrobe`, `trimdata`, `skins`, `animator`, `shots`,
  `camera`, `mobs`, `npc` (menus), `main` (events).
- `RP/animations/npcstudio.freepose.json`: bone rotation + packed position properties.
  Bedrock allows 32 entity properties, so positions are packed 3 per int (base 256, ¼-pixel steps).
- `RP/animations/npcstudio.procedural.json`: the looping animations.

Older changelog: `OLD_CHANGELOG.md`.
