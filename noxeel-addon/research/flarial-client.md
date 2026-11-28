# Flarial Client – Research Notes

Collected 2026-11-28. Sources: Flarial's open-source repo (`flarialmc/dll-oss`, read directly),
plus search-result summaries of flarial.xyz pages. flarial.xyz itself could not be opened from
this environment (network blocked), so anything marked *(site, via search)* is second-hand.

---

## 1. What Flarial is

- A **modded client** for Minecraft Bedrock Edition: QoL, HUD, visuals, performance.
  Markets itself as *not* a cheat client.
- **Not an add-on / resource pack.** It is a native Windows **DLL** (C++) that is loaded
  into the running `Minecraft.Windows.exe` process and patches the game from inside.
- Open source **in part**: `github.com/flarialmc/dll-oss`, license **AGPL-3.0**.
  - "Key portions" are kept private.
  - The public repo is deliberately **one Minecraft version behind** (signatures/offsets
    stay on the previous version).
  - PRs are reviewed by two core devs and may be merged into the closed-source build.
- ~4,000 commits, ~220 stars, ~80 forks at time of reading.

## 2. How it works (PC, from the source code)

**Loading**
1. Flarial **Launcher** (recommended) picks/installs a supported game version, starts
   Minecraft, then **injects** the DLL automatically. *(site, via search)*
2. Or manual: raw DLL + any DLL injector. You handle version matching yourself.
   Repo ships `auto-inject.bat` / `kill-mc.bat` dev helpers.
3. Builds after **1.21.120 use the GDK** (Win32) game instead of the old UWP/Store app;
   the launcher handles both, and bypasses the PC bootstrapper for GDK builds.
   *(site, via search)* – source has hooks for both `CreateSwapChainForCoreWindow` (UWP)
   and `CreateSwapChainForHwnd` (GDK/Win32).

**Finding game code** – `SignatureAndOffsetManager` + `VersionUtils`: byte-pattern
signatures and struct offsets per Minecraft version. Every MC update breaks these, which is
why Flarial needs an update for each new game version.

**Hooking** – uses **MinHook** (function detours) and **kiero** (DirectX vtable hooks).
Hook categories in `src/Client/Hook/Hooks/`:
- *Render*: DXGI swapchain Present/Resize/CommandList (draws its own UI on top of the
  frame), level render, camera update, cubemap, item renderer, chunk visibility, bgfx.
- *Game*: packet send/receive, client tick, actor tick, attack, chat screen, HUD screen,
  container screen, sound engine, time of day, sensitivity, view perspective, swing speed,
  splash text, file reads, third-party server list.
- *Input*: keyboard, mouse, cursor clip, tab-out fix.
- *Visual*: FOV, gamma, fog colour, hurt colour, tint, particles, text/font, block outline.

**UI** – own ClickGUI drawn with Direct2D/DirectX + **ImGui**; fonts via FreeType.

**Event system** – hooks fire events (`EventManager`); modules subscribe to them.

**Scripting** – built-in **Lua** (luabridge). Libraries exposed to scripts: Audio, Client,
Constraints, FS, GUI, ImGui, Network, Objects, Player, Script, Server, Settings, Util, World.
Scripts can be **modules** or **commands**; there's a **Script Marketplace** in-client.

**Other libs** – curl / HTTPRequest (online features, VIP/online-user lookups),
crow + asio (local web server), miniaudio, miniz, glm, nlohmann json, xorstr.

**Extras** – Discord Rich Presence, capes (CapeManager), pack changer, config save/load,
commands (`CommandManager`), crash logs, uninject.

## 3. Modules (public repo, ~120)

HUD/info: FPS, CPS, Keystrokes, Mousestrokes, Coordinates, DirectionHUD, PingCounter,
HitPing, ReachCounter, OpponentReach, ComboCounter, SpeedDisplay, PitchDisplay, Time,
Stopwatch, ArrowCounter, PotCounter, TotemCounter, ItemCounter, EntityCounter, PotionHUD,
ExperienceInfo, DurabilityWarning, LowHealthIndicator, IPDisplay, Waila, TabList,
PaperDoll, Memory, DebugMenu, Subtitles, Waypoints, TNTTimer, PlayerNotifier.

Movable vanilla UI: MovableHUD, MovableHotbar, MovableChat, MovableScoreboard,
MovableBossbar, MovableTitle, MovableCoordinates, MovableDayCounter.

Visual: Zoom, Freelook, FOVChanger, JavaDynamicFOV, Fullbright, MotionBlur,
DepthOfField, ChunkBorder, Hitbox, BlockOutline, BlockBreakIndicator, Crosshair,
CustomCrosshair, GlintColor, FogColor, HueChanger, HurtColor, TimeChanger,
WeatherChanger, ParticleMultiplier, ItemPhysics, ViewModel, SwingAnimations,
Animations, BlockHit, NoHurtCam, InstantHurtAnimation, Java/MinimalViewBobbing,
NametagModifier, Deepfry, UpsideDown, DVD Screen, Doom, CinematicCamera, RenderOptions,
GuiScale, MaterialBinLoader (custom shaders), PatarHD.

Gameplay QoL: ToggleSprint (Sprint), Sneak, AutoGG, AutoPerspective, SnapLook,
FasterInventory, JavaInventoryHotkeys, InventoryLock, CommandHotkey, TextHotkey,
CompactChat, ClearChat, ClearScoreboard, MessageLogger, DeathLogger, Nick, SkinStealer,
SensMultiplier, BowSensitivity, CPSLimiter, RawInputBuffer, ItemUseDelayFix,
DisableMouseWheel, ModernKeybindHandling, NullMovement, MumbleLink, 202020 (eye-break timer).

Server-specific: HiveUtils, HiveStat, ZeqaUtils.

## 4. Platforms

| Platform | Status |
|---|---|
| Windows 10/11, 64-bit | ✅ Main platform (launcher + DLL) |
| Android | 🟡 **Closed beta**, Android-first. Access via Google Play beta link after joining their Discord. Works like the Windows client (not a resource pack). No official APK outside their channels – third-party APKs are fakes. *(site, via search)* |
| iOS / iPadOS | ❌ No release, "not planned" – Apple sandbox + App Store rules. *(site, via search)* |
| Xbox / PlayStation / Switch | ❌ Nothing found; consoles don't allow code injection. |
| macOS / Linux / ChromeOS | ❌ Not officially supported (Windows-only DLL). |

Minecraft versions: **1.20+**; releases usually trail the newest MC update briefly.

## 5. Servers

- **Server module blocking:** servers can send Flarial a `ScriptMessagePacket` with a
  Flarial header + JSON payload to temporarily disable modules, e.g.
  `"module.zoom.name": { "block": true }`. Blockable list includes Zoom, Hive Utils,
  Hit Ping, Opponent Reach, Inventory Offhand Hotkey, Hive Statistics, … *(site, via search –
  exact header/format not verified)*
- **The Hive:** rules ban any client mod giving an advantage vanilla doesn't; unlisted
  mods should be assumed not allowed. No source found that names Flarial specifically.
- Antivirus may flag the DLL (injection looks suspicious to heuristics).

## 6. What this means for our add-on

- A Bedrock **add-on** (behavior/resource pack + Script API) **cannot** do what Flarial
  does: no DLL hooks, no DirectX overlay, no raw input, no client-only mods on servers.
- An add-on **can** do: custom HUD via JSON UI (resource pack), forms/menus
  (`@minecraft/server-ui`), commands, custom entities/items/blocks, camera
  (`/camera`, `player.camera`), scoreboards, world-side logic – and it works on
  **every** platform (Win, Android, iOS, consoles) wherever the pack is loaded.
- So "Flarial-style" features (FPS/CPS/keystrokes/coords HUD, zoom, cinematic camera,
  waypoints) are possible as an add-on only in a world/realm/server that has the pack.

## Sources
- https://github.com/flarialmc/dll-oss (source code, read directly)
- https://www.flarial.xyz/ · https://flarial.xyz/docs/usage/ · https://flarial.xyz/bedrock-launcher
- https://flarial.xyz/docs/troubleshooting-mobile-beta/ · https://flarial.xyz/mcpe-client
- https://flarial.xyz/changelog · https://minecraft.how/blog/post/flarial-client-bedrock-guide
- https://support.playhive.com/allowed-and-denied-mods/ · https://playhive.com/rules
