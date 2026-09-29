# NPC Studio V2: CurseForge upload kit

Copy each block into the matching box on CurseForge.

---

## 1. Project settings (Create Project page)

| Field | What to put |
|---|---|
| **Game** | Minecraft Bedrock |
| **Project type / class** | Addons |
| **Project name** | `NPC Studio V2` |
| **Main category** | Utility (or "Tools" / "Creation" if listed) |
| **Extra categories** | Cosmetic, Mobs / Entities, Adventure (any that exist) |
| **License** | **All Rights Reserved** / **Custom License** → paste `LICENSE.md` |
| **Logo / avatar** | `curseforge/logo-512.png` (square, 512×512) |
| **Source / Issues link** | leave empty (or your Discord) |
| **Website link** | `https://noxeelmc-art.github.io/npc-studio-skins/` |

### Summary (short line under the name, ~150 characters max)
```
Spawn, pose, dress and film custom NPCs for thumbnails and cinematics. Blender-style posing, armor trims, 30 camera shots, ride mobs and more.
```

---

## 2. Description (the big page text)

```markdown
# 🎬 NPC Studio V2

**Make Minecraft thumbnails and cinematics without leaving the game.**
Spawn NPCs, pose every body part, dress them in trimmed and enchanted armor, put them on horses, and film everything with 30 cinematic camera shots. No commands needed. Everything works through clean in-game menus.

---

## ✨ Features

### 🎯 Pose Mode (Blender-style)
- Look at a body part, then rotate or move it with a gizmo on your hotbar
- Sneak to finish, jump to cancel, 40-step undo/redo
- **45+ ready poses**: sitting, lying, flying, kneeling, fighting, emotes, riding
- Change size from 10% to 500%, mirror left/right, copy/paste poses between NPCs
- Save your own poses to a library

### 🛡️ Armor trims & enchant glint
- **Trim Studio**: every trim pattern and material on every armor piece
- **Copy My Outfit**: gives the NPC your exact armor, with enchants, trims, names and dye
- Enchant editor, Quick Glint, and **Search Item** for anything (works with other add-ons' items)

### 🎥 Cameras
- **Fly Cam**: fly the camera with your joystick, tap the screen to lock the shot
- **30 cinematic shots**: orbits, dolly zoom, crane, drone fly-by, bird's eye, over-the-shoulder, whip pan, duel shots and more
- Place cameras, make smooth camera paths, set FOV, fades and handheld sway
- Your body, hand items and the HUD are hidden while filming, so the shot stays clean

### 🐴 Mobs & riding
- Seat NPCs on horses, camels, wolves and other mobs
- **Mob poses**: horses rearing, wolves/cats sitting, fox sleeping, warden roar and more
- Freeze mobs in place for the perfect shot

### 🎞️ Animation
- 19 looping animations (breathing, walking, running, waving, talking, dancing, sword swing…)
- **Keyframe Animator** with easing, loop and speed
- **Record My Movement**: walk a path and the NPC replays it
- **Look At Players**: the NPC's head follows you

### 🎨 Skins
- Built-in skins + **20 custom skin slots** with head icons and slim (Alex) arms
- Make your own skin pack in your browser with the free **Skin Pack Builder**:
  👉 https://noxeelmc-art.github.io/npc-studio-skins/

### 📖 Handbook
Every player gets an in-game book that explains every feature.

---

## 🚀 How to start
1. Import the `.mcaddon` (tap it and Minecraft opens it)
2. Create or edit a world → activate **NPC Studio V2** in **Behavior Packs** (the resource pack is added automatically)
3. Join the world. You get the **Director's Baton**, **Cine Camera**, **Beast Whistle** and the **Handbook**
4. Tap the air with the **Director's Baton** to open the menu

**Handy commands:** `/npcstudio:npc` (menu) · `/npcstudio:exitcam` (leave camera) · `/npcstudio:lockcam` (lock Fly Cam) · `/npcstudio:cameras` · `/npcstudio:handbook`

---

## ⚙️ Requirements
- **Minecraft Bedrock 26.30 or newer**
- No experimental toggles needed
- Works in single player, Realms and servers

---

## 📜 Rules
✅ Use it in your videos, thumbnails, worlds and servers (credit appreciated!)
✅ Share the CurseForge link
❌ Don't reupload it as your own or sell it
❌ Don't copy the scripts into your own add-on

---

Made by **NoxeelMC**
📺 YouTube: https://youtube.com/@NoxeelMC
💬 Discord: DISCORD_LINK_HERE
```

---

## 3. Uploading the file

| Field | What to put |
|---|---|
| **File** | `NPCStudio-V2.mcaddon` |
| **Display name** | `NPC Studio V2` |
| **Release type** | **Release** |
| **Game versions** | Tick **26.30** and every newer version in the list |
| **Changelog** | see below |

> ⚠️ **Why 26.30?** The add-on uses Script API `@minecraft/server 2.8.0`, which only exists from
> Minecraft 26.30. On older versions the scripts won't load, so don't tick older versions.

### Changelog (paste into the file's changelog box)
```markdown
## NPC Studio V2 — the big update

**New**
- 🛡️ Armor trims + enchant glint on NPCs (Trim Studio, Copy My Outfit, enchant editor)
- 🎯 Pose Mode: Blender-style gizmo on your hotbar, move + rotate every body part, undo/redo
- 🤸 45+ poses, including riding, surfing, emotes and lying down
- 📏 Size 10–500% (NPCs are now exactly player size by default)
- 🎞️ 19 looping animations, Keyframe Animator, Record My Movement, Look At Players
- 🐴 NPCs ride mobs; horses rear up; wolves, cats, foxes, pandas and camels can sit or lie down
- 🚁 Fly Cam: fly the camera with your joystick, tap to lock the shot
- 🎥 30 cinematic shots + shot sequences, smooth camera paths, FOV, fades
- 🎨 20 custom skin slots with head icons + slim arms, plus the free online Skin Pack Builder
- 🔎 Search Item: type a normal name ("totem", "diamond sword"), works with other add-ons' items
- 📖 NPC Studio Handbook: in-game book explaining every feature
- 🔊 Sound effects for menus, errors, equipping and camera shots
- ✨ New tools and icons: Director's Baton, Cine Camera, Beast Whistle

**Fixed**
- Enchantments and trims were lost when equipping NPCs
- Camera FOV setting did nothing
- Your own body, head or hand items showed up in camera view
- Frozen horses kept walking instead of holding a pose
- Getting stuck in camera view (tap the screen or type /npcstudio:exitcam to leave)
```

---

## 4. Screenshots / gallery (make these in game)
CurseForge looks much better with 4–6 pictures. Good shots to take:
1. A posed NPC in trimmed armor, as a thumbnail-style picture (use this as the **featured** image)
2. A group of NPCs in a scene (fight, sitting around a campfire…)
3. An NPC riding a rearing horse
4. The Pose Mode gizmo on an NPC
5. The main menu or the Trim Studio menu
6. A Skin Pack Builder screenshot

A short YouTube trailer can be added as a video link on the project too.

---

## 5. Before you press "Submit"
- [ ] Description has your **Discord** link (replace `DISCORD_LINK_HERE`)
- [ ] File uses **Release**, versions **26.30+** ticked
- [ ] Logo uploaded
- [ ] At least 3 screenshots
- [ ] After approval (can take a few hours to a couple of days), send me the **CurseForge link**:
      I'll add it to the Skin Pack Builder website buttons.
