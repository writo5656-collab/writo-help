/**
 * NPC Studio — shots.js : one-tap cinematic camera shots around any NPC (or two NPCs).
 * 30 shot types (orbits, dolly zoom, crane, drone fly-by, over-the-shoulder, whip pan...),
 * adjustable length/distance/height/easing, handheld sway, fades, and a shot sequencer that
 * plays a list of shots back-to-back like an edited video. Sneak to stop any time.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { EasingType, HudVisibility } from "@minecraft/server";
import {
  world, system, menu, modal, msg, ICON, CAM_PRESET, NPC_FAMILY, EASE, EASE_KEYS, EASE_LABELS,
  lerp, lerp3, add, sub, scale3, forward, right, orbitPoint, clamp, toRad, getJson, setJson, npcLabel
} from "./core.js";
import { playAllTimelines } from "./animator.js";

const DISTANCES = [
  { label: "Close (2.5 blocks)", r: 2.5 },
  { label: "Medium (5 blocks)", r: 5 },
  { label: "Far (9 blocks)", r: 9 },
  { label: "Extreme (16 blocks)", r: 16 }
];
const HEIGHTS = [
  { label: "Low (knee)", h: -1.0 },
  { label: "Eye level", h: 0 },
  { label: "High", h: 2.2 },
  { label: "Very high", h: 6 }
];

const up = (p, dy) => ({ x: p.x, y: p.y + dy, z: p.z });
const fwd3 = (yaw, d) => {
  const f = forward(yaw);
  return { x: f.x * d, y: 0, z: f.z * d };
};
const rgt3 = (yaw, d) => {
  const r = right(yaw);
  return { x: r.x * d, y: 0, z: r.z * d };
};

/** Every shot: gen(ctx) -> (t, live, liveB) => { loc, look, fov?, cut? } */
export const SHOTS = [
  { id: "orbit_left", name: "Orbit Left", desc: "Half circle around the subject", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 180 * t, s.eye + c.h), look: s.head }) },
  { id: "orbit_right", name: "Orbit Right", desc: "Half circle the other way", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw - 180 * t, s.eye + c.h), look: s.head }) },
  { id: "spiral", name: "Spiral Rise", desc: "Full circle while climbing", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r, c.r * 0.7, t), c.yaw + 360 * t, lerp(0.3, 5.5, t) + c.h), look: s.head }) },
  { id: "snap_orbit", name: "360 Snap Orbit", desc: "Fast full spin (use Snap easing)", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 360 * t, s.eye + c.h), look: s.head }) },
  { id: "push_in", name: "Push In", desc: "Slowly moves toward the face", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r * 1.6, c.r * 0.4, t), c.yaw, s.eye + c.h), look: s.head }) },
  { id: "pull_out", name: "Pull Out", desc: "Starts close, reveals the scene", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r * 0.4, c.r * 2.2, t), c.yaw, s.eye + c.h + t * 1.5), look: s.head }) },
  {
    id: "dolly_zoom", name: "Dolly Zoom (Vertigo)", desc: "Moves in while zooming out — background warps",
    gen: (c) => {
      const k = c.r * 1.8 * Math.tan(toRad(30) / 2);
      return (t, s) => {
        const fov = lerp(30, 85, t);
        return { loc: orbitPoint(s.base, Math.max(1.2, k / Math.tan(toRad(fov) / 2)), c.yaw, s.eye + c.h), look: s.head, fov };
      };
    }
  },
  {
    id: "reverse_dolly", name: "Reverse Dolly Zoom", desc: "Moves out while zooming in",
    gen: (c) => {
      const k = c.r * 0.6 * Math.tan(toRad(85) / 2);
      return (t, s) => {
        const fov = lerp(85, 30, t);
        return { loc: orbitPoint(s.base, Math.max(1.2, k / Math.tan(toRad(fov) / 2)), c.yaw, s.eye + c.h), look: s.head, fov };
      };
    }
  },
  { id: "crane_up", name: "Crane Up", desc: "Rises straight up, still looking at them", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 15, lerp(0.3, 8, t)), look: s.head }) },
  { id: "crane_down", name: "Crane Down", desc: "Drops down from the sky", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 15, lerp(8, 1.2, t)), look: s.head }) },
  { id: "hero_low", name: "Low-Angle Hero", desc: "From below — makes them look powerful", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r * 1.1, c.r * 0.75, t), c.yaw + 25, 0.25), look: up(s.head, 0.4) }) },
  { id: "high_angle", name: "High Angle", desc: "Looking down, slow drift", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 30 * t, 4.5 + c.h), look: s.head }) },
  { id: "birds_eye", name: "Bird's Eye (top-down)", desc: "Straight down, slowly turning", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, 0.05, c.yaw + 90 * t, c.r + 4 - t * 2), look: s.base }) },
  {
    id: "aerial_dive", name: "Aerial Dive", desc: "Swoops from the sky to their face",
    gen: (c) => (t, s) => {
      const a = orbitPoint(s.base, c.r * 2.5, c.yaw + 160, 12);
      const mid = orbitPoint(s.base, c.r * 1.2, c.yaw + 80, 7);
      const b = orbitPoint(s.base, c.r * 0.6, c.yaw, s.eye);
      const ab = lerp3(a, mid, t), bc = lerp3(mid, b, t);
      return { loc: lerp3(ab, bc, t), look: s.head };
    }
  },
  { id: "ground_skim", name: "Ground Skim", desc: "Races in low along the ground", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r * 3, c.r * 0.7, t), c.yaw, 0.2), look: s.head }) },
  { id: "side_track", name: "Side Tracking", desc: "Slides along beside them", gen: (c) => (t, s) => ({ loc: up(add(add(s.base, rgt3(c.yaw, c.r)), fwd3(c.yaw, lerp(-3, 3, t))), s.eye + c.h), look: add(s.head, fwd3(c.yaw, lerp(-1, 1, t))) }) },
  { id: "walk_talk", name: "Walk & Talk (front)", desc: "Leads in front — great with a Walk animation", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(c.r * 0.8, c.r, t), s.yaw, s.eye + c.h), look: s.head }) },
  { id: "chase", name: "Chase Cam (behind)", desc: "Follows from behind, looking ahead", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r * 0.8, s.yaw + 180, s.eye + 0.8 + c.h), look: add(s.head, fwd3(s.yaw, 4)) }) },
  {
    id: "ots", name: "Over The Shoulder", desc: "Behind their shoulder (looks at 2nd NPC if set)",
    gen: (c) => (t, s, b) => ({ loc: up(add(add(s.head, fwd3(s.yaw, -1.3)), rgt3(s.yaw, -0.6)), 0.15 + c.h * 0.2), look: b ? b.head : add(s.head, fwd3(s.yaw, 8)) })
  },
  { id: "reveal", name: "Reveal (back to front)", desc: "Starts behind, sweeps round to the face", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 180 - 180 * t, s.eye + c.h + 0.6 * Math.sin(Math.PI * t)), look: s.head }) },
  { id: "legs_reveal", name: "Feet-to-Face Reveal", desc: "Tilts up from boots to face", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r * 0.7, c.yaw, lerp(0.4, s.eye, t)), look: up(s.base, lerp(0.1, s.eye, t)) }) },
  { id: "closeup", name: "Face Close-Up", desc: "Tight on the face, tiny push", gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, lerp(1.5, 1.1, t), c.yaw, s.eye), look: s.head, fov: 50 }) },
  { id: "flyby", name: "Drone Fly-By", desc: "Flies past them in a straight line", gen: (c) => (t, s) => ({ loc: up(add(add(s.base, rgt3(c.yaw, c.r)), fwd3(c.yaw, lerp(c.r * 2, -c.r * 2, t))), 3 + c.h), look: s.head }) },
  { id: "parallax", name: "Parallax Slide", desc: "Slides sideways in front of them", gen: (c) => (t, s) => ({ loc: up(add(add(s.base, fwd3(c.yaw, c.r)), rgt3(c.yaw, lerp(-2.5, 2.5, t))), s.eye + c.h), look: s.head }) },
  { id: "pov", name: "POV (their eyes)", desc: "See through the NPC's eyes", gen: (c) => (t, s) => ({ loc: add(s.head, fwd3(s.yaw, 0.3)), look: add(s.head, fwd3(s.yaw + lerp(-20, 20, t), 10)) }) },
  { id: "handheld", name: "Handheld", desc: "Static shot with natural shake", sway: 2.5, gen: (c) => (t, s) => ({ loc: orbitPoint(s.base, c.r, c.yaw + 10, s.eye + c.h), look: s.head }) },
  // ---- two-subject shots ----
  {
    id: "two_shot", name: "Two-Shot Push", desc: "Both NPCs in frame, slow push in", needsTwo: true,
    gen: (c) => (t, a, b) => {
      const mid = lerp3(a.head, b.head, 0.5);
      const d = sub(b.base, a.base);
      const yaw = (Math.atan2(d.z, d.x) * 180) / Math.PI;
      const span = Math.max(2, Math.hypot(d.x, d.z));
      return { loc: up(add(mid, fwd3(yaw + c.side, lerp(span * 1.6, span * 1.1, t))), c.h * 0.5), look: mid };
    }
  },
  {
    id: "whip_pan", name: "Whip Pan", desc: "Holds on NPC 1, whips over to NPC 2", needsTwo: true,
    gen: (c) => (t, a, b) => {
      const mid = lerp3(a.base, b.base, 0.5);
      const d = sub(b.base, a.base);
      const yaw = (Math.atan2(d.z, d.x) * 180) / Math.PI;
      const loc = up(add(mid, fwd3(yaw + c.side, Math.max(4, Math.hypot(d.x, d.z)))), 1.6 + c.h * 0.3);
      const u = t < 0.4 ? 0 : t > 0.6 ? 1 : EASE.snap((t - 0.4) / 0.2);
      return { loc, look: lerp3(a.head, b.head, u) };
    }
  },
  {
    id: "duel", name: "Duel (shot / reverse shot)", desc: "Over NPC 1's shoulder, then cuts to NPC 2's", needsTwo: true,
    gen: () => (t, a, b) => {
      const [p, q] = t < 0.5 ? [a, b] : [b, a];
      const d = sub(q.head, p.head);
      const yaw = (Math.atan2(-d.x, d.z) * 180) / Math.PI;
      return { loc: up(add(add(p.head, fwd3(yaw, -1.3)), rgt3(yaw, -0.6)), 0.15), look: q.head, cut: Math.abs(t - 0.5) < 0.02 };
    }
  },
  {
    id: "standoff", name: "Standoff (wide)", desc: "Low wide side view of both, creeping in", needsTwo: true,
    gen: (c) => (t, a, b) => {
      const mid = lerp3(a.base, b.base, 0.5);
      const d = sub(b.base, a.base);
      const yaw = (Math.atan2(d.z, d.x) * 180) / Math.PI;
      const span = Math.max(3, Math.hypot(d.x, d.z));
      return { loc: up(add(mid, fwd3(yaw + c.side, lerp(span * 1.8, span * 1.3, t))), 0.4), look: up(mid, 1.3) };
    }
  }
];

// ---------- subject snapshots ----------
function snap(entity) {
  const base = entity.location;
  let head;
  try {
    head = entity.getHeadLocation();
  } catch {
    head = up(base, 1.6);
  }
  if (entity.typeId === "npcstudio:npc") {
    const sc = entity.getProperty("npcstudio:scale") ?? 0.9375;
    head = up(base, 1.52 * sc);
  }
  return { base: { ...base }, head, eye: head.y - base.y, yaw: entity.getRotation().y };
}

// ---------- runner ----------
const running = new Map(); // player.id -> { stop() }

export function isShooting(player) {
  return running.has(player.id);
}

function hideForShot(player, hidden, subjects, hideNames) {
  try {
    player.onScreenDisplay.setHudVisibility(hidden ? HudVisibility.Hide : HudVisibility.Reset);
  } catch {
    /* ignore */
  }
  const isSubject = subjects.some((s) => s?.id === player.id);
  if (!isSubject) {
    try {
      if (hidden) player.addEffect("invisibility", 20 * 600, { amplifier: 0, showParticles: false });
      else player.removeEffect("invisibility");
    } catch {
      /* ignore */
    }
  }
  if (hideNames) {
    for (const npc of player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: 128 })) {
      try {
        if (hidden) {
          if (npc.getDynamicProperty("npcstudio:shot_name") === undefined) npc.setDynamicProperty("npcstudio:shot_name", npc.nameTag || "");
          npc.nameTag = "";
        } else {
          const prev = npc.getDynamicProperty("npcstudio:shot_name");
          if (prev !== undefined) {
            npc.nameTag = prev;
            npc.setDynamicProperty("npcstudio:shot_name", undefined);
          }
        }
      } catch {
        /* ignore */
      }
    }
  }
}

export function fade(player, secs = 0.35) {
  try {
    player.camera.fade({ fadeTime: { fadeInTime: secs, holdTime: 0.15, fadeOutTime: secs }, fadeColor: { red: 0, green: 0, blue: 0 } });
  } catch {
    /* ignore */
  }
}

/**
 * cfg: { shot, a, b?, secs, dist, height, ease, sway, fadeIn, keepView, hideNames }
 * a/b are entities. onEnd(completed:boolean)
 */
export function runShot(player, cfg, onEnd) {
  stopShot(player, false);
  const def = SHOTS.find((s) => s.id === cfg.shot) ?? SHOTS[0];
  if (!cfg.a?.isValid) return msg(player, "§cThe shot's target is gone.");
  if (def.needsTwo && !cfg.b?.isValid) return msg(player, `§c${def.name} needs a second NPC.`);
  const s0 = snap(cfg.a);
  const ctx = { r: DISTANCES[cfg.dist ?? 1].r, h: HEIGHTS[cfg.height ?? 1].h, yaw: s0.yaw, side: cfg.flip ? 180 : 0 };
  const frameFn = def.gen(ctx);
  const ease = EASE[cfg.ease] ?? EASE.smooth;
  const total = Math.max(10, Math.round((cfg.secs ?? 6) * 20));
  const swayAmt = (def.sway ?? 0) + (cfg.sway ? 1 : 0);
  let tick = 0;
  let lastFov = -1;
  let sneakWas = player.isSneaking;
  let done = false;

  hideForShot(player, true, [cfg.a, cfg.b], cfg.hideNames !== false);
  if (cfg.fadeIn) fade(player);

  const finish = (completed) => {
    if (done) return;
    done = true;
    system.clearRun(h);
    running.delete(player.id);
    if (!player.isValid) return;
    if (!cfg.keepView || !completed) {
      try {
        player.camera.clear();
        player.camera.setFov();
      } catch {
        /* ignore */
      }
      hideForShot(player, false, [cfg.a, cfg.b], cfg.hideNames !== false);
    }
    onEnd?.(completed);
  };

  const h = system.runInterval(() => {
    if (!player.isValid) return finish(false);
    // sneak = stop
    const sn = player.isSneaking;
    if (sn && !sneakWas) {
      msg(player, "§7Shot stopped.");
      return finish(false);
    }
    sneakWas = sn;
    if (!cfg.a.isValid || (def.needsTwo && !cfg.b?.isValid)) return finish(false);

    const t = ease(clamp(tick / total, 0, 1));
    const f = frameFn(t, snap(cfg.a), cfg.b?.isValid ? snap(cfg.b) : undefined);
    let loc = f.loc;
    let look = f.look;
    if (swayAmt > 0) {
      const time = tick / 20;
      const w = 0.035 * swayAmt;
      loc = add(loc, { x: Math.sin(time * 1.7) * w, y: Math.sin(time * 2.3 + 1) * w * 0.7, z: Math.cos(time * 1.3) * w });
      look = add(look, { x: Math.sin(time * 0.9 + 2) * w * 2, y: Math.cos(time * 1.1) * w * 1.5, z: 0 });
    }
    try {
      const opts = { location: loc, facingLocation: look };
      if (tick > 0 && !f.cut) opts.easeOptions = { easeTime: 0.1, easeType: EasingType.Linear };
      player.camera.setCamera(CAM_PRESET, opts);
      const fov = f.fov ?? cfg.fov ?? 70;
      if (Math.abs(fov - lastFov) > 0.4) {
        player.camera.setFov({ fov, easeOptions: { easeTime: 0.1, easeType: EasingType.Linear } });
        lastFov = fov;
      }
    } catch (e) {
      console.warn(`[NPC Studio] shot frame failed: ${e}`);
      return finish(false);
    }
    tick++;
    if (tick > total) finish(true);
  }, 1);

  running.set(player.id, { stop: finish });
}

export function stopShot(player, notify) {
  const r = running.get(player.id);
  if (r) {
    r.stop(false);
    if (notify) msg(player, "§7Shot stopped.");
  }
}

/** Release the camera after a "keep view" shot/sequence. */
export function releaseView(player) {
  stopShot(player, false);
  try {
    player.camera.clear();
    player.camera.setFov();
  } catch {
    /* ignore */
  }
  hideForShot(player, false, [], true);
}

// =====================================================================================
// MENUS
// =====================================================================================
const lastCfg = new Map();
function defaults(player) {
  return lastCfg.get(player.id) ?? { shot: 0, secs: 6, dist: 1, height: 1, ease: 0, sway: false, fadeIn: true, keepView: false, flip: false, fov: 70 };
}

function targetList(player) {
  const npcs = [...player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: 96 })];
  npcs.sort((x, y) => (x.nameTag || "").localeCompare(y.nameTag || ""));
  return npcs;
}

export function openShotsMenu(player, back, presetTarget) {
  const self = () => openShotsMenu(player, back, presetTarget);
  menu("Cinematic Shots", "§7One-tap camera moves around your NPCs. §fSneak§7 stops a shot any time.")
    .btn("§lNew Shot", ICON("film"), () => openShotConfig(player, self, presetTarget))
    .btn("Shot Sequence (edit & play)", ICON("sequence"), () => openSequence(player, self))
    .btn("Browse Shot Types", ICON("camera"), () => {
      const m = menu("Shot Types", SHOTS.map((s) => `§f${s.name}${s.needsTwo ? " §e(2 NPCs)" : ""}§7 — ${s.desc}`).join("\n"));
      m.back(self).show(player);
    })
    .btn("Release Camera (back to normal)", ICON("exit"), () => {
      releaseView(player);
      self();
    })
    .back(back)
    .show(player);
}

function openShotConfig(player, back, presetTarget, onConfigured) {
  const npcs = targetList(player);
  if (npcs.length === 0) {
    msg(player, "§cNo NPCs within 96 blocks. Spawn one first.");
    return back();
  }
  const d = defaults(player);
  const names = npcs.map((n, i) => `${i + 1}. ${npcLabel(n)}`);
  const aIdx = Math.max(0, presetTarget ? npcs.findIndex((n) => n.id === presetTarget.id) : 0);
  modal(onConfigured ? "Add Shot to Sequence" : "New Shot")
    .dropdown("shot", "Shot type", SHOTS.map((s) => (s.needsTwo ? `${s.name} (2 NPCs)` : s.name)), d.shot)
    .dropdown("a", "Main NPC", names, aIdx)
    .dropdown("b", "Second NPC (for 2-NPC shots / OTS)", ["(none)", ...names], d.b ?? 0)
    .slider("secs", "Length (seconds)", 1, 30, 1, d.secs)
    .dropdown("dist", "Distance", DISTANCES.map((x) => x.label), d.dist)
    .dropdown("height", "Camera height", HEIGHTS.map((x) => x.label), d.height)
    .dropdown("ease", "Motion feel", EASE_LABELS, d.ease)
    .slider("fov", "Lens (field of view)", 30, 110, 5, d.fov)
    .toggle("sway", "Handheld sway", d.sway)
    .toggle("fadeIn", "Fade in from black", d.fadeIn)
    .toggle("flip", "Other side (flip 180)", d.flip)
    .toggle("keepView", "Hold the last frame when done", d.keepView)
    .submit(onConfigured ? "Add" : "Action!")
    .show(player, (v) => {
      lastCfg.set(player.id, v);
      const cfg = {
        shot: SHOTS[v.shot].id,
        a: npcs[v.a],
        b: v.b > 0 ? npcs[v.b - 1] : undefined,
        secs: v.secs,
        dist: v.dist,
        height: v.height,
        ease: EASE_KEYS[v.ease],
        fov: v.fov,
        sway: v.sway,
        fadeIn: v.fadeIn,
        flip: v.flip,
        keepView: v.keepView
      };
      if (onConfigured) return onConfigured(cfg);
      runShot(player, cfg);
    }, back);
}

// ---------- sequence (stored per world) ----------
const SEQ_KEY = "npcstudio:shot_sequence";
function loadSeq() {
  return getJson(world, SEQ_KEY, []);
}
function saveSeq(seq) {
  setJson(world, SEQ_KEY, seq);
}

function openSequence(player, back) {
  const self = () => openSequence(player, back);
  const seq = loadSeq();
  const lines = seq.length
    ? seq.map((s, i) => `§f${i + 1}. ${SHOTS.find((x) => x.id === s.shot)?.name ?? s.shot} §7(${s.secs}s) on §b${s.aName}${s.bName ? ` §7+ §b${s.bName}` : ""}`).join("\n")
    : "§7Empty. Add shots, then Play — they run back-to-back with fades, like an edited video.";
  const m = menu("Shot Sequence", lines)
    .btn("§aPlay Sequence", ICON("play"), () => playSequence(player, seq, 0))
    .btn("§aPlay + start all NPC animations", ICON("animate"), () => {
      playAllTimelines(player);
      playSequence(player, seq, 0);
    })
    .btn("+ Add Shot", ICON("plus"), () =>
      openShotConfig(player, self, undefined, (cfg) => {
        seq.push({ shot: cfg.shot, a: cfg.a.id, aName: npcLabel(cfg.a), b: cfg.b?.id, bName: cfg.b ? npcLabel(cfg.b) : undefined, secs: cfg.secs, dist: cfg.dist, height: cfg.height, ease: cfg.ease, fov: cfg.fov, sway: cfg.sway, flip: cfg.flip });
        saveSeq(seq);
        self();
      })
    );
  seq.forEach((s, i) =>
    m.btn(`${i + 1}. ${SHOTS.find((x) => x.id === s.shot)?.name ?? s.shot}`, ICON("film"), () =>
      menu(`Shot ${i + 1}`)
        .btn("Preview", ICON("play"), () => playSequence(player, [s], 0))
        .btn("Move Up", ICON("turn"), () => {
          if (i > 0) [seq[i - 1], seq[i]] = [seq[i], seq[i - 1]];
          saveSeq(seq);
          self();
        })
        .btn("Delete", ICON("delete"), () => {
          seq.splice(i, 1);
          saveSeq(seq);
          self();
        })
        .back(self)
        .show(player)
    )
  );
  m.btn("Clear All", ICON("clear_x"), () => {
    saveSeq([]);
    self();
  });
  m.back(back).show(player);
}

function playSequence(player, seq, i) {
  if (i >= seq.length) {
    if (seq.length) msg(player, "§aSequence finished.");
    return;
  }
  const s = seq[i];
  const a = world.getEntity(s.a);
  const b = s.b ? world.getEntity(s.b) : undefined;
  if (!a?.isValid) {
    msg(player, `§eShot ${i + 1}: ${s.aName} not found, skipping.`);
    return playSequence(player, seq, i + 1);
  }
  const last = i === seq.length - 1;
  runShot(player, { ...s, a, b, fadeIn: true, keepView: !last }, (completed) => {
    if (completed && !last) playSequence(player, seq, i + 1);
  });
}
