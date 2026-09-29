/**
 * NPC Studio — camera.js : placeable camera props.
 * v3: FOV actually works now (the old code passed `fovValue`, the API wants `fov`),
 * camera paths are smooth Catmull-Rom splines with per-point timing + FOV, "Snap to my view"
 * for fast framing, and the control panel is split into short sub-menus.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { EasingType, HudVisibility } from "@minecraft/server";
import { world, system, menu, modal, msg, ICON, CAMERA_ID, CAM_PRESET, NPC_FAMILY, MOB_TAG, catmull, lerp, wrapDeg, getJson, setJson, EASE, npcLabel } from "./core.js";

const FOVS = [30, 40, 50, 60, 70, 80, 90, 100, 110];
const MOVE_STEPS = [0.1, 0.25, 0.5, 1, 2, 4];
const TURN_STEPS = [2, 5, 10, 22.5, 45];

function nextName() {
  const n = Number(world.getDynamicProperty("npcstudio:camera_count") ?? 0) + 1;
  world.setDynamicProperty("npcstudio:camera_count", n);
  return `Camera ${n}`;
}

export function camState(marker) {
  const r = marker.getRotation();
  return {
    location: { ...marker.location },
    rotX: marker.getDynamicProperty("npcstudio:cam_rx") ?? r.x,
    rotY: r.y,
    fov: marker.getDynamicProperty("npcstudio:cam_fovdeg") ?? [30, 50, 70, 90, 110][marker.getDynamicProperty("npcstudio:cam_fov") ?? 2] ?? 70
  };
}
function saveState(marker, s) {
  marker.teleport(s.location, { rotation: { x: s.rotX, y: s.rotY } });
  marker.setDynamicProperty("npcstudio:cam_rx", s.rotX);
  marker.setDynamicProperty("npcstudio:cam_fovdeg", s.fov);
}

const inView = new Set();
function setViewing(player, on) {
  if (on === inView.has(player.id)) return;
  if (on) inView.add(player.id);
  else inView.delete(player.id);
  try {
    player.onScreenDisplay.setHudVisibility(on ? HudVisibility.Hide : HudVisibility.Reset);
  } catch {
    /* ignore */
  }
  try {
    if (on) player.addEffect("invisibility", 20 * 3600, { amplifier: 0, showParticles: false });
    else player.removeEffect("invisibility");
  } catch {
    /* ignore */
  }
}

const pendingSnap = new Map(); // player.id -> marker
const lookTargets = new Map(); // marker.id -> entity
const follows = new Map(); // marker.id -> run handle

export function viewThrough(player, s, smooth, facing) {
  const eye = { x: s.location.x, y: s.location.y + 0.15, z: s.location.z };
  const opts = { location: eye };
  if (facing?.isValid) opts.facingEntity = facing;
  else opts.rotation = { x: s.rotX, y: s.rotY };
  if (smooth) opts.easeOptions = { easeTime: 0.3, easeType: EasingType.OutCubic };
  try {
    player.camera.setCamera(CAM_PRESET, opts);
    player.camera.setFov({ fov: s.fov, easeOptions: smooth ? { easeTime: 0.3, easeType: EasingType.OutCubic } : undefined });
  } catch (e) {
    msg(player, `§c(Camera error: ${e})`);
  }
  setViewing(player, true);
}

export function exitView(player) {
  try {
    player.camera.clear();
    player.camera.setFov();
  } catch {
    /* ignore */
  }
  setViewing(player, false);
}

function moveRel(loc, yaw, fwd, side, upDist) {
  const r = (yaw * Math.PI) / 180;
  return { x: loc.x - Math.sin(r) * fwd - Math.cos(r) * side, y: loc.y + upDist, z: loc.z + Math.cos(r) * fwd - Math.sin(r) * side };
}

function spawnCamera(player) {
  const marker = player.dimension.spawnEntity(CAMERA_ID, player.getHeadLocation());
  const rot = player.getRotation();
  marker.setRotation(rot);
  marker.nameTag = nextName();
  marker.setDynamicProperty("npcstudio:cam_rx", rot.x);
  marker.setDynamicProperty("npcstudio:cam_fovdeg", 70);
  return marker;
}

export function openCameraToolMenu(player, back) {
  const cams = [...player.dimension.getEntities({ type: CAMERA_ID })];
  const m = menu("Cameras", "§7Place cameras around your scene, then look through them, animate paths between points, or use Cinematic Shots for automatic moves.");
  const pending = pendingSnap.get(player.id);
  if (pending?.isValid) {
    m.btn(`§aSnap "${pending.nameTag}" Here §r§8(my position & view)`, ICON("done"), () => {
      pendingSnap.delete(player.id);
      const r = player.getRotation();
      saveState(pending, { ...camState(pending), location: player.getHeadLocation(), rotX: r.x, rotY: r.y });
      openCameraPanel(player, pending);
    });
  }
  m.btn("+ Place Camera At My View", ICON("plus"), () => {
    const c = spawnCamera(player);
    msg(player, `§aPlaced ${c.nameTag}.`);
    openCameraPanel(player, c);
  });
  cams.forEach((c) => m.btn(c.nameTag || "Camera", ICON("camera"), () => openCameraPanel(player, c)));
  m.btn("Exit Camera View", ICON("exit"), () => exitView(player));
  if (back) m.back(back);
  m.show(player);
}

export function openCameraPanel(player, marker, skipView) {
  if (!marker.isValid) return;
  const s = camState(marker);
  if (!skipView) viewThrough(player, s, true, lookTargets.get(marker.id));
  const self = () => openCameraPanel(player, marker, true);
  const path = getJson(marker, "npcstudio:path2", []);
  menu(marker.nameTag || "Camera", `§7FOV §f${s.fov}°  §7Path points §f${path.length}${lookTargets.get(marker.id)?.isValid ? `  §7Aiming at §f${npcLabel(lookTargets.get(marker.id))}` : ""}${follows.has(marker.id) ? "  §aFollowing" : ""}`)
    .btn("§lFrame It Myself §r§8(walk there & look)", ICON("waypoint"), () => {
      exitView(player);
      pendingSnap.set(player.id, marker);
      msg(player, "§eGo to where the camera should be and look at your shot, then right-click with the §fCamera Tool§e and tap §aSnap Here§e.");
    })
    .btn("Move & Turn (nudge)", ICON("move"), () => openNudge(player, marker, self))
    .btn(`Lens / FOV (${s.fov}°)`, ICON("fov"), () => openLens(player, marker, self))
    .btn("Aim At / Follow", ICON("manage"), () => openTracking(player, marker, self))
    .btn("Camera Path (smooth spline)", ICON("play"), () => openPath(player, marker, self))
    .btn("Shake", ICON("shake"), () => {
      shake(player, marker);
    })
    .btn("Rename", ICON("rename"), () =>
      modal("Rename Camera").text("n", "Name", "Camera", marker.nameTag || "").show(player, ({ n }) => {
        if (String(n ?? "").trim()) marker.nameTag = String(n).trim();
        self();
      }, self)
    )
    .btn("§aDone (keep looking through it)", ICON("done"), () => msg(player, "§7Camera view stays on. Hit the camera or use the Camera tool to exit."))
    .btn("Exit Camera View", ICON("exit"), () => exitView(player))
    .btn("§cDelete Camera", ICON("delete"), () => {
      stopFollow(marker);
      marker.remove();
      exitView(player);
      msg(player, "§aCamera deleted.");
    })
    .show(player);
}

function openNudge(player, marker, back, mi = 2, ti = 2) {
  if (!marker.isValid) return;
  const self = () => openNudge(player, marker, back, mi, ti);
  const step = MOVE_STEPS[mi];
  const turn = TURN_STEPS[ti];
  const act = (fn) => () => {
    const s = camState(marker);
    fn(s);
    s.rotX = Math.max(-90, Math.min(90, s.rotX));
    saveState(marker, s);
    viewThrough(player, s, true, lookTargets.get(marker.id));
    self();
  };
  menu("Move & Turn", `§7Move ${step} blocks / Turn ${turn}° per tap`)
    .btn(`Move step: ${step} §8(change)`, ICON("fov"), () => openNudge(player, marker, back, (mi + 1) % MOVE_STEPS.length, ti))
    .btn(`Turn step: ${turn}° §8(change)`, ICON("fov"), () => openNudge(player, marker, back, mi, (ti + 1) % TURN_STEPS.length))
    .btn("Forward", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, step, 0, 0))))
    .btn("Back", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, -step, 0, 0))))
    .btn("Left", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, 0, -step, 0))))
    .btn("Right", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, 0, step, 0))))
    .btn("Up", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, 0, 0, step))))
    .btn("Down", ICON("move"), act((s) => (s.location = moveRel(s.location, s.rotY, 0, 0, -step))))
    .btn("Turn Left", ICON("turn"), act((s) => (s.rotY -= turn)))
    .btn("Turn Right", ICON("turn"), act((s) => (s.rotY += turn)))
    .btn("Tilt Up", ICON("turn"), act((s) => (s.rotX -= turn)))
    .btn("Tilt Down", ICON("turn"), act((s) => (s.rotX += turn)))
    .back(back)
    .show(player);
}

function openLens(player, marker, back) {
  const s = camState(marker);
  const m = menu("Lens / FOV", "§730° = telephoto (flat, dramatic)  70° = normal  110° = wide / fisheye");
  FOVS.forEach((f) => m.btn(`${f === s.fov ? "§a> " : ""}${f}°`, ICON("fov"), () => {
    saveState(marker, { ...camState(marker), fov: f });
    viewThrough(player, camState(marker), true, lookTargets.get(marker.id));
    back();
  }));
  m.back(back).show(player);
}

function targets(player) {
  return [...player.dimension.getEntities({ families: [NPC_FAMILY] }), ...player.dimension.getEntities({ tags: [MOB_TAG] })];
}

function openTracking(player, marker, back) {
  const list = targets(player);
  const m = menu("Aim At / Follow");
  m.btn("Free look (stop aiming)", ICON("clear_x"), () => {
    lookTargets.delete(marker.id);
    viewThrough(player, camState(marker), true);
    back();
  });
  m.btn(follows.has(marker.id) ? "§cStop Following" : "Follow a target...", ICON("ride"), () => {
    if (follows.has(marker.id)) {
      stopFollow(marker);
      return back();
    }
    const mm = menu("Follow Which?");
    list.forEach((t) => mm.btn(npcLabel(t), ICON("ride"), () => {
      startFollow(player, marker, t);
      back();
    }));
    mm.back(back).show(player);
  });
  list.forEach((t) => m.btn(`Aim at: ${npcLabel(t)}`, ICON("manage"), () => {
    lookTargets.set(marker.id, t);
    viewThrough(player, camState(marker), true, t);
    back();
  }));
  m.back(back).show(player);
}

function stopFollow(marker) {
  const h = follows.get(marker.id);
  if (h !== undefined) system.clearRun(h);
  follows.delete(marker.id);
}
function startFollow(player, marker, target) {
  stopFollow(marker);
  const off = { x: marker.location.x - target.location.x, y: marker.location.y - target.location.y, z: marker.location.z - target.location.z };
  const h = system.runInterval(() => {
    if (!marker.isValid || !target.isValid) return stopFollow(marker);
    const s = camState(marker);
    s.location = { x: target.location.x + off.x, y: target.location.y + off.y, z: target.location.z + off.z };
    saveState(marker, s);
    if (inView.has(player.id)) viewThrough(player, s, true, lookTargets.get(marker.id));
  }, 2);
  follows.set(marker.id, h);
}

// ---------- spline path ----------
function openPath(player, marker, back) {
  const self = () => openPath(player, marker, back);
  const path = getJson(marker, "npcstudio:path2", []);
  const m = menu(
    "Camera Path",
    path.length
      ? path.map((p, i) => `§f${i + 1}. §7${p.secs ?? 2}s to next, FOV ${p.fov}°`).join("\n")
      : "§7Add points: snap/nudge the camera to a spot, tap Add Point, move, Add Point... then Play. The camera glides through all points on a smooth curve."
  );
  m.btn("+ Add Point (current camera spot)", ICON("plus"), () =>
    modal("Add Point").slider("secs", "Seconds from this point to the next", 1, 20, 1, 2).show(player, (v) => {
      const s = camState(marker);
      path.push({ l: s.location, rx: s.rotX, ry: s.rotY, fov: s.fov, secs: v.secs });
      setJson(marker, "npcstudio:path2", path);
      self();
    }, self)
  );
  m.btn("§aPlay Path", ICON("play"), () => playPath(player, marker, path, false));
  m.btn("§aPlay Path (loop until sneak)", ICON("refresh"), () => playPath(player, marker, path, true));
  m.btn("Show Path (particles)", ICON("waypoint"), () => showPath(player, path));
  m.btn("Remove Last Point", ICON("undo"), () => {
    path.pop();
    setJson(marker, "npcstudio:path2", path);
    self();
  });
  m.btn("Clear Path", ICON("delete"), () => {
    setJson(marker, "npcstudio:path2", []);
    self();
  });
  m.back(back).show(player);
}

function samplePath(path, u) {
  // u in [0, n-1]
  const n = path.length;
  const i = Math.min(n - 2, Math.floor(u));
  const t = u - i;
  const P = (k) => path[Math.max(0, Math.min(n - 1, k))];
  const loc = catmull(P(i - 1).l, P(i).l, P(i + 1).l, P(i + 2).l, t);
  const e = EASE.smooth(t);
  return {
    location: loc,
    rotX: lerp(P(i).rx, P(i + 1).rx, e),
    rotY: P(i).ry + wrapDeg(P(i + 1).ry - P(i).ry) * e,
    fov: lerp(P(i).fov, P(i + 1).fov, e)
  };
}

function showPath(player, path) {
  if (path.length < 2) return msg(player, "§cAdd at least 2 points.");
  for (let u = 0; u <= path.length - 1; u += 0.08) {
    try {
      player.dimension.spawnParticle("minecraft:villager_happy", samplePath(path, u).location);
    } catch {
      /* ignore */
    }
  }
}

function playPath(player, marker, path, loop) {
  if (path.length < 2) return msg(player, "§cAdd at least 2 points first.");
  const segTicks = path.map((p) => Math.max(5, (p.secs ?? 2) * 20));
  let seg = 0;
  let tick = 0;
  let sneakWas = player.isSneaking;
  msg(player, "§7Playing path — sneak to stop.");
  const h = system.runInterval(() => {
    const sn = player.isSneaking;
    if (!player.isValid || (sn && !sneakWas)) {
      system.clearRun(h);
      return;
    }
    sneakWas = sn;
    const s = samplePath(path, seg + tick / segTicks[seg]);
    const eye = { x: s.location.x, y: s.location.y + 0.15, z: s.location.z };
    try {
      const look = lookTargets.get(marker.id);
      const opts = look?.isValid ? { location: eye, facingEntity: look } : { location: eye, rotation: { x: s.rotX, y: s.rotY } };
      if (seg + tick > 0) opts.easeOptions = { easeTime: 0.1, easeType: EasingType.Linear };
      player.camera.setCamera(CAM_PRESET, opts);
      player.camera.setFov({ fov: s.fov, easeOptions: { easeTime: 0.1, easeType: EasingType.Linear } });
    } catch {
      system.clearRun(h);
      return;
    }
    setViewing(player, true);
    tick++;
    if (tick >= segTicks[seg]) {
      tick = 0;
      seg++;
      if (seg >= path.length - 1) {
        if (loop) seg = 0;
        else system.clearRun(h);
      }
    }
  }, 1);
}

function shake(player, marker) {
  const base = camState(marker);
  let t = 0;
  const h = system.runInterval(() => {
    if (t >= 12 || !marker.isValid) {
      system.clearRun(h);
      return viewThrough(player, base, false, lookTargets.get(marker.id));
    }
    const k = 0.18 * (1 - t / 12);
    const loc = { x: base.location.x + (Math.random() - 0.5) * k, y: base.location.y + 0.15 + (Math.random() - 0.5) * k, z: base.location.z + (Math.random() - 0.5) * k };
    try {
      player.camera.setCamera(CAM_PRESET, { location: loc, rotation: { x: base.rotX + (Math.random() - 0.5) * k * 10, y: base.rotY + (Math.random() - 0.5) * k * 10 } });
    } catch {
      /* ignore */
    }
    t++;
  }, 1);
}

export function isViewing(player) {
  return inView.has(player.id);
}
