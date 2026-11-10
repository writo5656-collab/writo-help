## NPC Studio V3.5: your own capes and 3D models

- Empty custom skin slots now show Steve (with the slot number on the head) instead of the coloured placeholder skins
- 7 custom cape slots: Display > Cloak, after the 8 built-in capes
- 10 custom 3D model slots: Display > 3D model (Blockbench Bedrock models; bones named like a player can be posed)
- Pack Builder website: Skins / Capes / Models tabs, get a skin or cape by player name, Steve as the preview

## NPC Studio V3.4: closer to the Java editor

- Outline hugs the NPC: skins without a hat / jacket layer get a tight outline (it floated away from the head and shoulders before)
- Camera markers no longer fill your screen when you stand inside one
- Display tab in the Java order: Model (Classic / Slim / Mobs), Skin, Cloak, Nametag, Sneak, Living, Animation, then Inventory, Transform, Effects
- Transform: Rotation X / Y / Z and Scale sliders, Look At me / Head / Flip
- New switches: Sneak, Living, On Fire, World Bright
- World tab: Gamerules (day cycle, weather cycle, mob spawn, fire spread, keep inventory, block drops) and Lighting
- Camera tab: Guide Off / Thirds / Cross; cameras show in the strip on the right next to the NPC heads

## NPC Studio V3.3: Pose Lab

- Panel: one section open at a time (no scrolling), short buttons in two columns, HUD stays hidden between menus, faster opening
- Gizmo: thin axis lines, drawn through the NPC and blocks
- Walk around while you pose (Pose tab > Walk in Pose Mode); Cancel and Done on the hotbar
- New gizmo: red / green / blue axis arrows at the NPC's feet, rings or arrows on the part you edit
- Item State: bow pull, crossbow loading / charged / firework, trident raise, shield block, spyglass look, goat horn play

## NPC Studio V3.2: editing inside the panel

- Depth Map pack + Layers > Depth map (/npcstudio:depth): white world, near white, far black, black sky, for depth passes
- Full-screen thirds grid with a switch (Layers > Grid)
- Tap a slider's number for a real drag slider; - / + still work in the panel
- Java-style choice buttons, inventory tiles and X / Y / Z boxes

- Sliders live in the panel now: size, pose, Trim Studio, time, fog and camera lens no longer open a grey popup that hides your NPC
- Java NPC Studio style rows: a label column, then a Choose button, a checkbox, a - / + slider with a value box, or < / > steppers
- Pose tab: pick a body part and a step size, then Tilt, Turn, Roll and Move it while you watch
- Tap any value box to type an exact number
- NPC heads on the right scroll, so 20+ NPCs all fit; the Spawn button sits at the top and never moves
- Thinner, brighter cyan outline (Thin is the new default, Medium and Thick still in Display, Outline)
- Inventory section shows the NPC's 6 slots as tiles; tap one to change it
- Section headers in cyan with their icon; tab names fit
- Spawn, rename, presets and every other input form open in the same dark panel instead of a grey box

## NPC Studio V3: the studio update

**New look**
- 🗂️ **Studio Panel**: every menu is now a dark panel on the left with six tabs: Display, Pose, Presets, World, Camera, Layers
- 🔘 One-tap switches, head grids for skins, instant tab switching
- 🎛️ **Live editors**: drag a slider and the NPC changes while the menu stays open (size, exact pose, camera lens, time, fog)
- 🆕 New NPC Studio logo

**New features**
- 🛡️ **Trim Studio fitting room**: the camera moves close to the NPC and every pattern, colour and glint shows right away
- 🔷 **Cyan outline** on the selected NPC that every player sees (hidden while filming), plus multi-select
- 📐 **Pyramid cameras**: lens point + frame that shows the real shot size. Green = selected, blue = others, grey = locked
- 🖥️ **Camera Monitor**: tap to look through your cameras, tap again for the next one. Thirds guide for framing
- 📸 **Photo Mode**: 3-2-1, everything disappears (HUD, hand, outlines, cameras, name tags), flash, take your screenshot
- 🟩 **Green screen + Layer Shot**: NPC on green and the background without NPCs, from the same camera, so layers line up in any editor
- 🌫️ **Depth Fog**: 8 looks (white, black, haze, sunset, night, horror, dream, smoke) and 9 distances
- 🧱 **Block & item props**: floating blocks or items you can move, turn and scale
- ✨ **Particle props**: fire, smoke, hearts, sparks and more that keep playing in your scene
- 👥 **Crowds**: copy an NPC into a grid, line, circle or random scatter with random turns and poses
- 🎬 **Scene presets**: save everything around you and place it anywhere
- 🧣 **Capes** (8), **name tag colours / hide**, **NPC Bright** (fully lit in dark scenes)
- 🛠️ **New tools**: NPC Stamp (copy/paste), NPC Rotator (face me), Teleporter, Camera Monitor
- 🚤 Boats, minecarts and armor stands as props
- 🌍 **Studio World Rules**: one tap for a calm filming world
- 📖 Handbook chapter "New In V3"

**Improved**
- Pose Mode asks "Keep this pose?" when you finish
- Skin picker is one grid of 32 heads
- Skin Pack Builder website updated: https://noxeelmc-art.github.io/npc-studio-skins/

Requires Minecraft Bedrock 26.30 or newer. No experiments needed.
