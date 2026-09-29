/**
 * NPC Studio — animator.js : keyframe animation for NPCs (pose + position + turning + size).
 * "Walk 2 steps, turn to the player, jump" = 3-4 keyframes. Or record your own walk and the
 * NPC replays it. Interpolated every tick with easing.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system, menu, modal, msg, ICON, lerp, lerp3, wrapDeg, EASE, EASE_KEYS, EASE_LABELS, getJson, setJson, npcsNear, NPC_FAMILY, actionbar } from "./core.js";
import { readPose, applyPose, lerpPose, getScale, setScale, getAnim, setAnim, pushUndo } from "./rig.js";
import { LOOP_ANIMS } from "./poses.js";

const KEY = "npcstudio:timeline";
const players = new Map(); // npc.id -> run handle

export function getTimeline(npc) {
  const tl = getJson(npc, KEY, { loop: false, speed: 1, keys: [] });
  tl.keys.sort((a, b) => a.t - b.t);
  // keys without a pose reuse the previous one (keeps recordings small)
  tl.keys.forEach((k, i) => {
    if (!k.pose) k.pose = i > 0 ? tl.keys[i - 1].pose : {};
  });
  return tl;
}
function saveTimeline(npc, tl) {
  tl.keys.sort((a, b) => a.t - b.t);
  let prev;
  const keys = tl.keys.map((k) => {
    const ps = JSON.stringify(k.pose);
    const out = { ...k, loc: { x: +k.loc.x.toFixed(3), y: +k.loc.y.toFixed(3), z: +k.loc.z.toFixed(3) } };
    if (ps === prev) delete out.pose;
    prev = ps;
    return out;
  });
  try {
    setJson(npc, KEY, { ...tl, keys });
  } catch (e) {
    console.warn(`[NPC Studio] timeline save failed: ${e}`);
  }
}

function captureKey(npc, t, ease = "smooth") {
  const r = npc.getRotation();
  return { t, pose: readPose(npc), loc: { ...npc.location }, yaw: r.y, scale: getScale(npc), anim: getAnim(npc), ease };
}

function applyKeyInstant(npc, k) {
  applyPose(npc, k.pose);
  setScale(npc, k.scale ?? 0.9375);
  setAnim(npc, k.anim ?? 0);
  npc.teleport(k.loc, { rotation: { x: 0, y: k.yaw } });
}

export function isPlaying(npc) {
  return players.has(npc.id);
}

export function stopTimeline(npc) {
  const h = players.get(npc.id);
  if (h !== undefined) {
    system.clearRun(h);
    players.delete(npc.id);
  }
}

export function playTimeline(npc, onEnd) {
  stopTimeline(npc);
  const tl = getTimeline(npc);
  if (tl.keys.length < 2) return false;
  const keys = tl.keys;
  const total = keys[keys.length - 1].t;
  let time = 0;
  let lastAnim = -1;
  applyKeyInstant(npc, keys[0]);
  const h = system.runInterval(() => {
    if (!npc.isValid) return stopTimeline(npc);
    time += (1 / 20) * (tl.speed || 1);
    if (time >= total) {
      if (tl.loop) {
        time = 0;
        applyKeyInstant(npc, keys[0]);
        return;
      }
      applyKeyInstant(npc, keys[keys.length - 1]);
      stopTimeline(npc);
      onEnd?.();
      return;
    }
    let i = 0;
    while (i < keys.length - 2 && time >= keys[i + 1].t) i++;
    const a = keys[i];
    const b = keys[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    const u = (EASE[b.ease] ?? EASE.smooth)(Math.min(1, (time - a.t) / span));
    applyPose(npc, lerpPose(a.pose, b.pose, u));
    setScale(npc, lerp(a.scale ?? 0.9375, b.scale ?? 0.9375, u));
    if ((a.anim ?? 0) !== lastAnim) {
      lastAnim = a.anim ?? 0;
      setAnim(npc, lastAnim);
    }
    const yaw = a.yaw + wrapDeg(b.yaw - a.yaw) * u;
    try {
      npc.teleport(lerp3(a.loc, b.loc, u), { rotation: { x: 0, y: yaw } });
    } catch {
      /* chunk unloaded */
    }
  }, 1);
  players.set(npc.id, h);
  return true;
}

// =====================================================================================
// MENUS
// =====================================================================================
export function openAnimator(player, npc, back) {
  if (!npc.isValid) return;
  const self = () => openAnimator(player, npc, back);
  const tl = getTimeline(npc);
  const list = tl.keys.length
    ? tl.keys.map((k, i) => `§f${i + 1}. §b${k.t.toFixed(1)}s §7${EASE_LABELS[EASE_KEYS.indexOf(k.ease)] ?? ""}${k.anim ? ` §d+${LOOP_ANIMS[k.anim - 1]}` : ""}`).join("\n")
    : "§7No keyframes yet.\n\n§fHow it works: pose + place the NPC, tap §aAdd Keyframe§f, change the pose/position, add another... then Play. The NPC moves smoothly between them.";
  const m = menu(`Animator: ${npc.nameTag || "NPC"}`, `${list}\n\n§7Loop: §f${tl.loop ? "ON" : "off"}  §7Speed: §f${tl.speed || 1}x`);
  m.btn(isPlaying(npc) ? "§cStop" : "§aPlay", ICON("play"), () => {
    if (isPlaying(npc)) stopTimeline(npc);
    else if (!playTimeline(npc)) msg(player, "§cAdd at least 2 keyframes first.");
    self();
  });
  m.btn("+ Add Keyframe (current pose & spot)", ICON("plus"), () => {
    const nextT = tl.keys.length ? tl.keys[tl.keys.length - 1].t + 1 : 0;
    modal("Add Keyframe")
      .slider("t", "Time (tenths of a second)", 0, 1200, 1, Math.round(nextT * 10))
      .dropdown("ease", "Motion into this keyframe", EASE_LABELS, 0)
      .show(player, (v) => {
        const t = v.t / 10;
        tl.keys = tl.keys.filter((k) => Math.abs(k.t - t) > 0.001);
        tl.keys.push(captureKey(npc, t, EASE_KEYS[v.ease]));
        saveTimeline(npc, tl);
        msg(player, `§aKeyframe at ${t.toFixed(1)}s.`);
        self();
      }, self);
  });
  m.btn("Record My Movement", ICON("record"), () => openRecord(player, npc, self));
  tl.keys.forEach((k, idx) => m.btn(`Keyframe ${idx + 1} @ ${k.t.toFixed(1)}s`, ICON("waypoint"), () => openKey(player, npc, idx, self)));
  m.btn(`Loop: ${tl.loop ? "ON" : "off"}`, ICON("refresh"), () => {
    tl.loop = !tl.loop;
    saveTimeline(npc, tl);
    self();
  });
  m.btn(`Speed: ${tl.speed || 1}x`, ICON("fov"), () =>
    modal("Playback Speed").slider("s", "Speed (x0.25)", 1, 16, 1, Math.round((tl.speed || 1) * 4)).show(player, (v) => {
      tl.speed = v.s / 4;
      saveTimeline(npc, tl);
      self();
    }, self)
  );
  m.btn("Clear Timeline", ICON("delete"), () => {
    stopTimeline(npc);
    saveTimeline(npc, { loop: false, speed: 1, keys: [] });
    self();
  });
  m.back(back).show(player);
}

function openKey(player, npc, idx, back) {
  const tl = getTimeline(npc);
  const k = tl.keys[idx];
  if (!k) return back();
  menu(`Keyframe ${idx + 1} (${k.t.toFixed(1)}s)`)
    .btn("Go To (show this pose)", ICON("play"), () => {
      stopTimeline(npc);
      pushUndo(npc);
      applyKeyInstant(npc, k);
      back();
    })
    .btn("Replace With Current Pose & Spot", ICON("save"), () => {
      tl.keys[idx] = captureKey(npc, k.t, k.ease);
      saveTimeline(npc, tl);
      back();
    })
    .btn("Change Time / Motion", ICON("sliders"), () =>
      modal("Edit Keyframe")
        .slider("t", "Time (tenths of a second)", 0, 1200, 1, Math.round(k.t * 10))
        .dropdown("ease", "Motion into this keyframe", EASE_LABELS, Math.max(0, EASE_KEYS.indexOf(k.ease)))
        .dropdown("anim", "Looping animation from here", ["None", ...LOOP_ANIMS], k.anim ?? 0)
        .show(player, (v) => {
          k.t = v.t / 10;
          k.ease = EASE_KEYS[v.ease];
          k.anim = v.anim;
          saveTimeline(npc, tl);
          back();
        }, back)
    )
    .btn("Delete", ICON("delete"), () => {
      tl.keys.splice(idx, 1);
      saveTimeline(npc, tl);
      back();
    })
    .back(back)
    .show(player);
}

// ---------- record the player's own walk ----------
function openRecord(player, npc, back) {
  modal("Record My Movement")
    .slider("secs", "Record for (seconds)", 3, 30, 1, 8)
    .slider("every", "Keyframe every (tenths of a second)", 2, 20, 1, 5)
    .toggle("walk", "Use the Walk Cycle animation while moving", true)
    .submit("Start (3 second countdown)")
    .show(player, (v) => {
      let count = 3;
      const cd = system.runInterval(() => {
        if (count > 0) {
          player.onScreenDisplay.setTitle(`§e${count}`, { fadeInDuration: 0, stayDuration: 18, fadeOutDuration: 2 });
          count--;
          return;
        }
        system.clearRun(cd);
        player.onScreenDisplay.setTitle("§cREC", { fadeInDuration: 0, stayDuration: 20, fadeOutDuration: 5 });
        record(player, npc, v.secs, v.every / 10, v.walk, back);
      }, 20);
    }, back);
}

function record(player, npc, secs, every, walk, back) {
  const pose = readPose(npc);
  const scale = getScale(npc);
  const keys = [];
  let t = 0;
  const everyTicks = Math.max(2, Math.round(every * 20));
  const h = system.runInterval(() => {
    if (!player.isValid || !npc.isValid) return system.clearRun(h);
    const r = player.getRotation();
    keys.push({ t: Math.round(t * 100) / 100, pose: keys.length ? undefined : pose, loc: { ...player.location }, yaw: r.y, scale, anim: walk ? 2 : 0, ease: "linear" });
    actionbar(player, `§cREC §f${t.toFixed(1)}s / ${secs}s`);
    t += everyTicks / 20;
    if (t > secs) {
      system.clearRun(h);
      if (keys.length) keys[keys.length - 1].anim = 0;
      saveTimeline(npc, { loop: false, speed: 1, keys: keys.map((k) => ({ ...k, pose: k.pose ?? pose })) });
      msg(player, `§aRecorded ${keys.length} keyframes. Tap Play!`);
      back();
    }
  }, everyTicks);
}

// ---------- scene: play every NPC's timeline at once ----------
export function playAllTimelines(player, radius = 96) {
  let n = 0;
  for (const npc of npcsNear(player, radius)) if (playTimeline(npc)) n++;
  msg(player, n ? `§aPlaying ${n} NPC animation${n > 1 ? "s" : ""}.` : "§cNo NPCs with 2+ keyframes nearby.");
  return n;
}
export function stopAllTimelines(player, radius = 96) {
  for (const npc of npcsNear(player, radius)) stopTimeline(npc);
}

export { NPC_FAMILY, world };
