# Featherlight Optimizer: what was wrong, and what's next

Latest build: `dist/Featherlight_Optimizer_v1.3.0.mcpack` (source in `pack/`, vanilla sync script in `tools/`).

## The short version

The pack spends its effort on **particles and fog**. On a weak phone playing on a server, most of the lag usually comes from other places:

| Where the lag comes from | Can a resource pack fix it? |
|---|---|
| How many chunks the game builds and draws (**Render Distance**) | No. Only the settings slider changes this. |
| Server TPS, ping, packet loss | No |
| Many entities on screen (mobs, armour stands, item frames) | **Partly.** See "Going further" below |
| JSON UI on the HUD | **Yes.** This pack was *adding* cost here (fixed) |
| Particles in fights | Yes. This pack already handles it well |
| Phone overheating and slowing itself down (thermal throttling) | No. An FPS cap / VSync helps |

## Bugs found and fixed in 1.2.0

### 1. The fog didn't apply in most biomes
Mojang's vanilla `biomes_client.json` gives **70 biomes their own fog** (`minecraft:plains` → `minecraft:fog_plains`, and so on). The pack only overrode `"default"` plus six nether/end names without the `minecraft:` prefix. A biome with its own entry never falls back to `default`, so in plains, forest, ocean, desert, jungle, taiga and so on, **vanilla fog was used and your profile fog never applied**. That's probably why the profiles felt the same.

**Fix:** every vanilla biome is now listed by its full name and pointed at the pack's fog. Vanilla water colours are kept, so swamps don't turn blue. Microsoft's [fog docs](https://learn.microsoft.com/en-us/minecraft/creator/documents/foginresourcepacks) confirm the order: biome fog sits above `default`, so a biome's own entry always wins over it.

### 2. The totem counter was running three counters every frame
`"visible": false` only hides a control. It still exists and its bindings still update. One scanner computed totem, arrow **and** pot counts over 36 slots, which comes to about **330 UI bindings evaluated every frame, all game**, even with arrow and pot turned off. JSON UI runs on the CPU, the part a cheap phone is shortest on.

**Fix:** each counter has its own scanner inside its widget, and the widget uses `"ignored"` so a counter that's off is never created. The counter is also **off by default on the Low and Ultra Low profiles**.

### 3. 263 duplicate files in the subpacks
The subpacks had copies of base-pack files that were byte-for-byte identical. A subpack sits on top of the base pack, so those copies did nothing except slow down loading. They're removed.

## The big one: fog is probably not culling anything

Fog is a colour blend applied to pixels. As far as I know, Bedrock still loads, meshes and draws **every chunk inside your Render Distance**, even the ones hidden in fog. If that's right, a 64-block fog with Render Distance at 12 hides the world from the player (bad in PvP) and saves almost nothing.

I can't run Minecraft here, so **test it** on a real phone:

1. Use the same world, the same spot and the same Render Distance.
2. Check FPS with the Ultra Low profile, then with the pack turned off.
3. If FPS is about the same, the fog isn't saving anything.

Whatever the result, tell players to **match Render Distance to their profile** (High 16, Mid 10, Low 8, Ultra 4–6). That's the biggest single FPS lever on Bedrock, and it's the "fewer chunks" idea you described.

## Added in 1.3.0 (after researching other FPS packs)

- **Far-away mob animation culling** (Low and Ultra Low). Beyond 32 or 24 blocks, cows, pigs, sheep, chickens, creepers, drowned, iron golems and squids stop animating their legs and heads. They still render and move. Attacks, charging, riding and the creeper's swelling flash are never culled. This uses `q.distance_from_camera` in the mob's `scripts.animate`, so it's a plain resource pack and works on servers.
- **Ultra Low texture bug fixed.** 22 animated textures had lost `atlas_index`, so blocks with several variants (respawn anchor, firefly bush, sculk catalyst, bubble columns) could show the wrong texture.
- **`tools/sync_vanilla.py`** regenerates every vanilla-derived file from Mojang's bedrock-samples. Run it after each Minecraft update so the pack never goes stale.

### Ideas from other packs I checked and did NOT add

| Idea | Why not |
|---|---|
| Custom shaders / `.material.bin` (point filtering, FP16) | RenderDragon ignores custom materials in normal packs; they need a patched game |
| Behavior-pack mob despawn, item merging, spawn limits | Behavior packs only run in your own worlds, never on servers |
| "Render distance limiter" packs | No documented way to do it; most likely it's fog, which hides chunks without skipping them |
| Silencing rain audio | The saving is too small to be worth losing the sound |
| Culling zombies, skeletons, villagers, players | Their vanilla files need the very latest game version, or they're too complex to override safely. They're next after in-game testing |

## About building a "Fabric-like client"

On Bedrock for phones there's no mod loader. Anything that injects code (modified APKs, injected clients) breaks Minecraft's terms, can't be shipped as a resource pack, and gets players **banned on most servers**. PC-only DLL clients exist, but they don't help the phone players this pack is for. The honest ceiling is: resource pack (particles, fog, UI, entity LOD, textures) plus the right settings.

## Settings to recommend to players

Put these in the pack description or a pinned message:

- Render Distance: match the profile
- Fancy Graphics, Beautiful Skies, Fancy Leaves, Smooth Lighting: **off**
- Render Clouds: **off**
- Vibrant Visuals (if the device has it): **off**
- Particle-heavy options on the server (if it has a menu): off
- On Android, turn off battery saver while playing; let the phone cool down between sessions
