# Featherlight Optimizer: what was wrong, and what's next

Fixed build: `dist/Featherlight_Optimizer_v1.2.0.mcpack` (source in `pack/`).

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

**Fix:** every vanilla biome is now listed by its full name and pointed at the pack's fog. Vanilla water colours are kept, so swamps don't turn blue.

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

## Going further (still a resource pack, no client needed)

**Entity culling by distance.** This is the closest Bedrock equivalent to Java's *EntityCulling* mod. A resource pack can override a mob's client entity file and use `q.distance_from_camera` to skip animations or hide parts beyond N blocks:

```json
"scripts": {
  "should_update_bones_and_effects_offscreen": false,
  "animate": [
    { "look_at_target": "q.distance_from_camera < 24" },
    { "move": "q.distance_from_camera < 32" }
  ]
}
```

Animation (Molang per bone per frame) is a real CPU cost when a server hub has 50+ entities in view. It needs care: vanilla entity files change between versions and each override must be kept in sync. It's worth prototyping on the 5–10 most common entities first and measuring before and after.

**Cheaper textures.** The food textures are 24×24 on a 16×16 pack. Mixed sizes can force the game to scale the whole item atlas up to the biggest texture. Test with 16×16 versions; if FPS or memory improves, the "small food" look isn't worth it.

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
