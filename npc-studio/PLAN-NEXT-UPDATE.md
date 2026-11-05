# NPC Studio V3 — update plan (nothing built yet)

Everything NoxeelMC asked for, checked against what Minecraft Bedrock can and can't do.
We build it all at once after the list is approved.

Legend: ✅ can be done fully · 🟡 can be done a different way (explained) · ❌ Bedrock can't do it

Reference pictures saved in `art/reference/`, new logo in `art/logo-source.jpg`.

---

## 1. Camera redesign ✅
**Ask:** replace the blue box camera with the "pyramid" camera from the reference pictures: a
rectangle (the picture frame) with all 4 corners joined to one point (the lens).

**Plan**
- New camera model made of thin glowing lines: lens point → 4 corners + the frame rectangle
  (+ the "X" across the frame when you look at it from the front, like the reference).
- The frame has the real shape of the shot (16:9) and gets wider/narrower when you change the
  camera's FOV, so you can see what the camera sees from outside.
- Colours: **selected camera = green**, other cameras = blue, locked camera = grey.
- Glowing (lit even at night), no box, thin lines only.
- Still hidden while filming (already works).

## 2. Shaders 🟡
**Ask:** a depth-map / depth-fog toggle like the Java mod (the DMS pack: near = white,
far = black) for colour grading and highlights.

**Truth:** Bedrock doesn't allow custom shaders. Iris/OptiFine-style packs (`.fsh/.vsh` files)
can't run. So the exact grey depth map isn't possible.

**What we can do**
- **Depth Fog toggle** (works on every device, Vibrant Visuals or not): uses Bedrock's custom fog.
  Things far away fade into a colour, close things stay sharp. This gives depth and makes the NPC
  stand out.
  - Presets: *Depth White*, *Depth Black* (closest to the DMS look), *Cinematic Haze*,
    *Sunset*, *Night Blue*, *Horror*, *Dream Pink*, *Green Screen* (see #8).
  - Distance slider (fog start/end): from 4 blocks to 128 blocks.
  - Per player: only you see it, so other players aren't affected.
- **Cinematic Look** (only with Vibrant Visuals on): a pack setting with colour grading
  (contrast, saturation, warm/cool highlights). Bedrock only lets this be chosen in the
  pack settings, not switched by a button in game.

## 3. Trim Studio preview ✅
**Ask:** people don't understand buttons alone; show a preview, like the structure block.

**Plan: "Fitting Room"**
- Opening Trim Studio / Wardrobe moves your camera to a slow-orbit close-up of the NPC.
- The menu becomes a **side panel on the left** so the NPC stays visible on the right
  (same idea as the Java editor in picture 1).
- Every button shows a picture: the trim pattern icons and the material icons
  (gold, diamond, amethyst…).
- Tapping a pattern/material puts it on the NPC **instantly**: you see it live, then pick
  **Keep** or **Undo**.
- The same live preview for armor, held items and skins.
- Risk: the side-panel menu needs a UI file that Mojang changes sometimes. If it breaks, the
  menu goes back to normal and the live preview still works.

## 4. Outline on the selected NPC ✅
**Ask:** a glowing outline on the selected NPC, visible to everyone, so you know which NPC is
selected in a crowd.

**Plan**
- A coloured glow outline around the selected NPC (around its armor and held item too).
- Everyone in the world sees it (stored on the NPC, not only on your screen).
- Each player gets their own colour, so on a server you can see who is editing which NPC.
- Turns off automatically while filming so it's never in a shot.
- To test first: the cleanest outline method (a slightly bigger glowing copy of the model behind
  the NPC). Backup method if that looks bad on some devices: a pulsing coloured tint +
  corner brackets like the "Face Target" box in picture 1.

## 5. New logo ✅
**Ask:** replace the AI logo with the real one (NPC letters with the blocky character).

**Plan:** use it for both pack icons, the Handbook cover, the welcome screen, the website
(Skin Pack Builder + favicon) and the CurseForge logo. Crop the light border and make clean
sizes (256 px for packs, 512 px for CurseForge).

## 6. Live camera preview in the corner 🟡
**Ask:** a small window in the bottom right that shows what Camera 1 sees, live, while you build.

**Truth:** Bedrock can't draw a second view of the world on screen. No add-on can do
picture-in-picture.

**What we can do (gets the same job done, faster than now)**
- **Camera Monitor (hold to peek):** a new tool. Hold it → your screen *is* the selected camera.
  Switch hotbar slot → you're back. No menus, no exit button, instant.
- **Camera switcher** on screen: `< Camera 1 >`. Tap left/right to change which camera you peek
  through (like in picture 1).
- **Frustum lines** from #1: from outside you see exactly where the frame is, so you know if
  something is in the shot without peeking.
- **Quick re-frame:** while peeking you can nudge the camera (move/turn/zoom) and it saves,
  so the "check → fix → check" loop happens in one place.

## 7. Direct export (save a picture to your device) ❌ → 🟡
**Ask:** a button that takes the picture and saves it to your device storage.

**Truth:** add-ons can't take screenshots or save files. Mojang doesn't allow it, on any device.

**What we can do**
- **Photo Mode button:** one tap → the HUD, your hand, the crosshair, name tags, gizmos,
  outlines, camera models and chat all disappear, then a 3…2…1 countdown and a "flash" so you
  know when to press your device's screenshot (phone: power + volume down; PC: Win + Shift + S /
  Game Bar). Everything comes back after a few seconds or on tap.
- Optional on-screen guides before the shot: rule of thirds, centre cross, YouTube 16:9 frame.
  They switch off for the actual photo.

## 8. Background removal (NPC only / background only) 🟡 ✅
**Ask:** players still go to Blockbench because they want an NPC picture with no background and
a background picture with no NPC, plus hiding/showing things.

**Plan: "Layers"**
- **Green Screen:** puts a pure green backdrop behind the NPCs from the selected camera's
  view: world, ground and sky become flat green. Any editor (CapCut, PicsArt, Photopea,
  remove.bg…) removes green in one tap, giving a clean NPC PNG. Also **Black** and **White**
  backdrops.
- **Background only:** hides all NPCs (and their armor, items and name tags) for the shot, and
  puts them back exactly after.
- **Layer Shot:** from the selected camera, takes you through 3 photos one after the other:
  ① full shot → ② NPCs on green → ③ background only. Same camera, so the layers line up
  perfectly in an editor.
- **Hide / Show panel:** toggles for NPCs (all or one by one), mobs, cameras, gizmos, outlines,
  particles, name tags, you.
- Limit: grass/blocks *between* the camera and the NPC still show on green. The tip in the
  Handbook says to use a flat area.

## 9. Ideas from the Java NPC Studio 1.3.8 (checked inside the mod)
Things it has that fit Bedrock:

| Java feature | For us | Status |
|---|---|---|
| **Block props (BlockNPC)**: turn blocks into props you can move, rotate, scale, float | Floating blocks/debris for explosion thumbnails, tilted blocks | ✅ |
| **Prop NPCs**: boats, minecarts, end crystal, armor stand, painting, arrows, trees | Spawn + pose these as props | ✅ |
| **Image NPC**: a PNG as a flat 2D prop | Image slots added via the website (like skins) | ✅ |
| **Particle NPC**: a placed particle that keeps playing | Fire, smoke, flames, hearts, crits, portal… stays in the scene | ✅ |
| **Duplicate / Fast Crowd**: grid, line, circle, with random pose/turn/spacing | "Make a crowd" from one NPC, with random variation | ✅ |
| **NPC Stamp**: copy/paste NPC tool | Tap NPC = copy, tap ground = paste | ✅ |
| **NPC Rotator**: make NPCs face you | One-tap tool | ✅ |
| **Teleporter**: teleport where you look | Tool | ✅ |
| **Multi-select + Select All + move group** | Select many NPCs (outlined), move/turn/pose them together | ✅ |
| **Scene presets**: save a whole scene, spawn it elsewhere | NPCs + mobs + props + cameras saved together | ✅ |
| **Capes / cloaks** | Cape on NPCs + cape slots on the website | ✅ |
| **Nametag colour, custom nametag, hide nametag** | | ✅ |
| **Camera guides**: rule of thirds, cross | On-screen overlay | ✅ |
| **TP to camera, camera lock, camera speed** | | ✅ |
| **World tab**: time override, weather, tick speed, block drops off, no mob spawning, keep inventory | "Studio World Rules" one tap (asks once per world) | ✅ |
| **NPC Bright**: NPC fully lit in dark scenes | Toggle | ✅ (to test) |
| **NPC list with heads, filter, sort by distance** | Better NPC list | ✅ |
| **Sit / sneak toggles, glow colour** | | ✅ |
| Camera roll (tilt) | Bedrock camera can't tilt sideways | ❌ |
| Skin download by username | Bedrock add-ons can't download | ❌ (use the website) |
| Batch screenshots to a folder | Can't save files (see #7) | ❌ → Layer Shot / Photo Mode |
| Block crack hammer, item glint strength | No access on Bedrock | ❌ |
| Import Blockbench models | Possible later through the website, big job | later |

---

## 10. New editor panel (NoxeelMC's mockup `art/reference/panel-mockup.html`) ✅
**Ask:** replace the grey Minecraft menu boxes with a Java-style editor: a dark side panel on the
left with tabs (Display · Pose · Presets · World · Camera), the world visible on the right.

**How:** restyle the add-on's menus with a custom UI file (the same trick as the Pose Mode corner
readout). The menus keep working the same way underneath, they just *look* like the mockup:
- Docked left panel, dark theme with cyan accent (matches the new logo), tabs on top.
- Toggles and on/off buttons work in one tap; numbers (size, FOV, time) open a slider pop-up.
- Icons and NPC heads on every row, NPC names, camera names, search results (all dynamic).
- ☰ handle hides the panel so you can walk/look; Pose Mode and Fly Cam close it and bring it
  back on the same tab when done ("Keep this pose? Yes / No" step from the mockup).
- Extra tab **Layers** for #8 (hide/show, green screen, Photo Mode, Layer Shot).
- If Mojang ever changes their menu system and the custom look breaks, the menus fall back to
  the normal grey ones and everything still works.

**Why not floating panels like Effortless Building?** Their panels are 3D objects in the world,
with every word drawn into a picture beforehand (8.9 MB of pictures). That can't show NPC names,
camera names, item search or your own preset names, and it gets in the way of camera shots.
The side panel can show all of that.

### Research: how other add-ons build better menus (GitHub, Nov 2026)
| Project | How it works | What we take from it |
|---|---|---|
| **Mojang DDUI `CustomForm`** (official, `@minecraft/server-ui`) | New built-in menu system. Toggles, sliders, dropdowns and buttons work **while the menu stays open**; values update live. Sections can be shown/hidden live (= tabs without reopening). Pictures in menus from server-ui 2.3.0 (Minecraft 26.60+). | **Live editors:** size, pose sliders, FOV, fog, time, Trim Studio, so the NPC changes as you drag. Future-proof, but its look can't be restyled. |
| **MinUI** (Cookiesmuch/MinUI) | Form title carries a hidden tag; `server_form.json` swaps in a fully custom layout. Sets all menu transition times to 0. | The **side-panel look** from the mockup + **instant tab switching** (no slide animation between menus). |
| **Chest-UI** (Herobrine643928 and forks) | Same trick, draws buttons as a grid of item slots. | **Icon grids**: skins as a grid of heads, poses as tiles, trims/materials as icon tiles instead of long lists. |
| **json-ui-examples** (LeGend077) | Ready-made custom toggle, slider, scroll panel, progress bar. | Switch-style toggles, slim sliders, smooth scrolling list. |
| **Effortless Building** (in-world entity panels) | 3D panels with every word drawn into pictures. | Not used for menus (can't show names). Idea kept: hover highlight + press feedback. |

**Decision:** two layers that look like one design (dark panel, cyan accent):
1. **Navigation menus** (main hub, lists, grids, Pose Library, Wardrobe slots): custom side panel
   from the mockup with tabs, icon grids, NPC heads, instant switching.
2. **Live editors** (anything with sliders/toggles/dropdowns): DDUI CustomForm, so the NPC/world
   updates while you drag and the menu never closes.
Fallbacks: if the custom look breaks after a Mojang update, menus become plain grey but work;
on Minecraft older than 26.60, editors run without pictures.

**Sources:** github.com/Cookiesmuch/MinUI · github.com/Herobrine643928/Chest-UI ·
github.com/LeGend077/json-ui-examples · github.com/victorsigma/Bedrock-DDUI-Forms ·
wiki.bedrock.dev/json-ui/modifying-server-forms ·
learn.microsoft.com/minecraft/creator/documents/scripting/intro-to-ddui

## Decisions
- Public name: **NPC Studio V3**
- Build **all ✅ features** from #9
- Outline: **cyan for everyone**
