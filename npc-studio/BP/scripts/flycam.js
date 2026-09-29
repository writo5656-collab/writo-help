/**
 * NPC Studio — flycam.js : fly the camera with your normal controls (joystick / WASD).
 *
 * You fly invisibly (creative flight), and the view follows you with a smooth drone-like lag.
 * Tap / hit (swing) or /lockcam locks the shot:
 *  - "camera" mode: places a camera right there and keeps looking through it
 *  - "reframe" mode: moves an existing camera there
 *  - "path" mode: every tap adds a point to a camera path; /lockcam finishes it
 * Zoom: scroll or tap the hotbar. Leave any time: /exitcam.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { EasingType } from "@minecraft/server";
import { world, system, msg, sfx, actionbar, CAM_PRESET, setJson } from "./core.js";
import { enterCinema, exitCinema, lockCinema, freeCinema } from "./cinema.js";

const FOVS = [30, 40, 50, 60, 70, 80, 90, 100, 110];
const sessions = new Map(); // player.id -> session

export function inFlyCam(player) {
  return sessions.has(player.id);
}

/**
 * mode: "camera" | "reframe" | "path"
 * hooks: { spawnCamera(player, loc, rot, fov) -> marker, reframe(marker, loc, rot, fov), openPanel(player, marker) }
 */
export function startFlyCam(player, mode, hooks, marker) {
  if (sessions.has(player.id)) return;
  const s = { mode, hooks, marker, fovIdx: 4, path: [], slot: player.selectedSlotIndex, smooth: 0.3, lastSwing: 0 };
  sessions.set(player.id, s);
  enterCinema(player, () => stopLoop(player), { freeMove: true, creative: true, quiet: true });
  freeCinema(player); // also covers starting from inside another camera view
  try {
    player.onScreenDisplay.setTitle("§l§bFLY CAM", { subtitle: "§ffly with your joystick · §etap§f to lock the shot", fadeInDuration: 5, stayDuration: 50, fadeOutDuration: 15 });
  } catch {
    /* ignore */
  }
  sfx(player, "start");
  msg(player, "§b§l» Fly Cam");
  msg(player, "§fFly: §7joystick / WASD, double-tap jump to take off, jump & sneak for up/down.");
  msg(player, `§fZoom: §7scroll or tap the hotbar.  §fLock: §etap / hit§7 or §e/lockcam§7.  §fLeave: §e/exitcam`);
  if (mode === "path") msg(player, "§fPath mode: §7each tap adds a point. §e/lockcam§7 when you're done.");
  s.run = system.runInterval(() => tick(player, s), 1);
}

function tick(player, s) {
  if (!player.isValid) return stopLoop(player);
  const head = player.getHeadLocation();
  const r = player.getRotation();
  try {
    player.camera.setCamera(CAM_PRESET, { location: head, rotation: { x: r.x, y: r.y }, easeOptions: { easeTime: s.smooth, easeType: EasingType.Linear } });
    if (s.fovApplied !== s.fovIdx) {
      player.camera.setFov({ fov: FOVS[s.fovIdx], easeOptions: { easeTime: 0.3, easeType: EasingType.OutSine } });
      s.fovApplied = s.fovIdx;
    }
  } catch {
    /* ignore */
  }
  const extra = s.mode === "path" ? `§7Points: §f${s.path.length}  §etap§7 = add point, §e/lockcam§7 = finish` : "§etap§7 or §e/lockcam§7 = lock this shot";
  actionbar(player, `§b§lFLY CAM§r  §7Zoom §f${FOVS[s.fovIdx]}°  §8|  ${extra}  §8|  §7/exitcam`);
}

function stopLoop(player) {
  const s = sessions.get(player.id);
  if (!s) return;
  system.clearRun(s.run);
  sessions.delete(player.id);
}

/** Hotbar scroll = zoom. Returns true if handled. */
export function flyCamZoom(player, newSlot) {
  const s = sessions.get(player.id);
  if (!s) return false;
  if (newSlot === s.slot) return true;
  const up = (newSlot - s.slot + 9) % 9 <= 4; // scrolled right
  s.fovIdx = Math.max(0, Math.min(FOVS.length - 1, s.fovIdx + (up ? 1 : -1)));
  sfx(player, "click");
  try {
    player.selectedSlotIndex = s.slot; // keep your hands empty so nothing shows in the shot
  } catch {
    /* ignore */
  }
  return true;
}

/** Swing or /lockcam. */
export function flyCamLock(player, fromCommand) {
  const s = sessions.get(player.id);
  if (!s) return false;
  const now = system.currentTick;
  if (!fromCommand && now - s.lastSwing < 6) return true; // one tap can fire twice
  s.lastSwing = now;
  const head = player.getHeadLocation();
  const r = player.getRotation();
  const fov = FOVS[s.fovIdx];

  if (s.mode === "path") {
    if (!fromCommand) {
      s.path.push({ l: { x: head.x, y: head.y - 0.15, z: head.z }, rx: r.x, ry: r.y, fov, secs: 2 });
      sfx(player, "bell");
      actionbar(player, `§aPoint ${s.path.length} added.`);
      return true;
    }
    if (s.path.length < 2) {
      msg(player, "§cAdd at least 2 points first (tap in different spots).");
      return true;
    }
    stopLoop(player);
    const first = s.path[0];
    const marker = s.hooks.spawnCamera(player, first.l, { x: first.rx, y: first.ry }, first.fov);
    setJson(marker, "npcstudio:path2", s.path);
    finish(player, marker, `§aCamera path saved with ${s.path.length} points on ${marker.nameTag}. Open it and tap Play Path.`, s.hooks);
    return true;
  }

  stopLoop(player);
  let marker = s.marker;
  const loc = { x: head.x, y: head.y - 0.15, z: head.z };
  if (s.mode === "reframe" && marker?.isValid) s.hooks.reframe(marker, loc, { x: r.x, y: r.y }, fov);
  else marker = s.hooks.spawnCamera(player, loc, { x: r.x, y: r.y }, fov);
  finish(player, marker, `§aShot locked on ${marker.nameTag}.`, s.hooks);
  return true;
}

function finish(player, marker, text, hooks) {
  sfx(player, "shutter");
  lockCinema(player);
  msg(player, text);
  msg(player, "§7Still looking through it. §e/exitcam§7 to leave, §e/cameras§7 for the camera menu.");
  system.runTimeout(() => {
    if (player.isValid && marker?.isValid) hooks.openPanel(player, marker);
  }, 8);
}

export function stopFlyCam(player) {
  if (sessions.has(player.id)) exitCinema(player);
}

export { world };
