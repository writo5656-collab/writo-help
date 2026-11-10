/**
 * NPC Studio — poseEditor.js : Blender-style posing.
 *
 * LIVE GIZMO (like pressing R / G in Blender): pick a bone, then just LOOK AROUND — the bone
 * follows your view. Hotbar: 9 = done, 7 = cancel (frozen mode: Sneak = apply, Jump = cancel),
 * V3.3: walk around while posing (Pose tab > Walk in Pose Mode), red / green / blue axes at the feet,
 * scroll/tap hotbar = change axis,
 * hit/swing = switch Rotate <-> Move. Works on touch, controller and mouse.
 * Plus precise sliders, nudge pad, mirror, copy/paste, undo/redo, pose library, scale.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { InputPermissionCategory } from "@minecraft/server";
import { world, system, menu, modal, msg, sfx, editorHudReset, actionbar, corner, clearCorner, ICON, clamp, wrapDeg, round, getJson, setJson, forward, right } from "./core.js";
import { BONES, getRot, setRot, getPos, setPos, getScale, setScale, readPose, applyPose, mirrorPose, expandPreset, pushUndo, undo, redo, historySize, snapPos, POS_LIMIT, getAnim, setAnim } from "./rig.js";
import { POSE_CATEGORIES, LOOP_ANIMS } from "./poses.js";
import { swapHotbar, restoreHotbar } from "./hotbar.js";

const editorState = new Map(); // player.id -> { bone, sens, snap }
const clipboard = new Map(); // player.id -> pose
function stateFor(player) {
  let s = editorState.get(player.id);
  if (!s) {
    s = { bone: 2, sens: 1.0, snap: false };
    editorState.set(player.id, s);
  }
  return s;
}

const fmt = (a) => a.map((v) => (Math.round(v * 10) / 10).toString()).join(" / ");


// =====================================================================================
// POSE EDITOR HUB
// =====================================================================================
export function openPoseEditor(player, npc, back) {
  if (!npc.isValid) return;
  const self = () => openPoseEditor(player, npc, back);
  const h = historySize(npc);
  menu("Pose Editor", "§7Tip: §fPose Mode§7 is the fastest way — look at an arm, tap Rotate, look around, sneak when it looks right.")
    .btn("§lPose Mode (Gizmo)\n§r§8look at a body part, tap Rotate or Move", ICON("gizmo"), () => startGizmo(player, npc, self))
    .btn("Pose Library §8(45+ poses)", ICON("pose_preset"), () => openPoseLibrary(player, npc, self))
    .btn("My Saved Poses", ICON("save"), () => openMyPoses(player, npc, self))
    .btn(`Undo §8(${h.undo})`, ICON("undo"), () => {
      if (!undo(npc)) msg(player, "§cNothing to undo.");
      self();
    })
    .btn(`Redo §8(${h.redo})`, ICON("redo"), () => {
      if (!redo(npc)) msg(player, "§cNothing to redo.");
      self();
    })
    .btn("Mirror Pose §8(left <-> right)", ICON("mirror"), () => {
      pushUndo(npc);
      applyPose(npc, mirrorPose(readPose(npc)));
      self();
    })
    .btn("Copy Pose", ICON("clone"), () => {
      clipboard.set(player.id, readPose(npc));
      msg(player, "§aPose copied. Open another NPC's Pose Editor and tap Paste.");
      self();
    })
    .btn(clipboard.has(player.id) ? "Paste Pose" : "§8Paste Pose (nothing copied)", ICON("paste"), () => {
      const p = clipboard.get(player.id);
      if (p) {
        pushUndo(npc);
        applyPose(npc, p);
      }
      self();
    })
    .btn("Reset Whole Pose", ICON("clear_x"), () => {
      pushUndo(npc);
      applyPose(npc, {});
      self();
    })
    .btn("Size / Height", ICON("scale"), () => openScaleMenu(player, npc, self))
    .btn(`Looping Animation: §b${getAnim(npc) ? LOOP_ANIMS[getAnim(npc) - 1] : "None"}`, ICON("animate"), () => openLoopAnims(player, npc, self))
    .btn("Advanced §8(exact numbers, nudge, settings)", ICON("sliders"), () => openAdvanced(player, npc, self))
    .back(back)
    .show(player);
}

function openAdvanced(player, npc, back) {
  const self = () => openAdvanced(player, npc, back);
  const st = stateFor(player);
  const bone = BONES[st.bone];
  menu("Advanced Posing", `§fBody part: §b${bone.label}\n§7Rotation: §f${fmt(getRot(npc, bone.key))}\n§7Position: §f${fmt(getPos(npc, bone.key))} px`)
    .btn(`Body part: ${bone.label} §8(change)`, ICON("pose_manual"), () => pickBone(player, self))
    .btn("Exact Sliders", ICON("sliders"), () => openSliders(player, npc, self))
    .btn("Nudge Pad (buttons)", ICON("move"), () => openNudge(player, npc, self))
    .btn(`Reset ${bone.label}`, ICON("clear"), () => {
      pushUndo(npc);
      setRot(npc, bone.key, [0, 0, 0]);
      setPos(npc, bone.key, [0, 0, 0]);
      self();
    })
    .btn(`Gizmo speed: ${st.sens}x  Snap: ${st.snap ? "ON" : "off"}`, ICON("fov"), () => {
      modal("Gizmo Settings")
        .slider("sens", "Speed (x0.1)", 2, 30, 1, Math.round(st.sens * 10))
        .toggle("snap", "Snap (5 degrees / 1 pixel)", st.snap)
        .show(player, (v) => {
          st.sens = v.sens / 10;
          st.snap = v.snap;
          self();
        }, self);
    })
    .back(back)
    .show(player);
}

function pickBone(player, back) {
  const st = stateFor(player);
  const m = menu("Select Bone");
  BONES.forEach((b, i) => m.btn(`${i === st.bone ? "§a> " : ""}${b.label}`, ICON("pose_manual"), () => {
    st.bone = i;
    back();
  }));
  m.back(back).show(player);
}

function openSliders(player, npc, back) {
  const st = stateFor(player);
  const bone = BONES[st.bone];
  const r = getRot(npc, bone.key);
  const p = getPos(npc, bone.key);
  modal(`${bone.label}: exact values`)
    .slider("rx", "Rotate X (tilt forward/back)", -180, 180, 1, Math.round(r[0]))
    .slider("ry", "Rotate Y (turn left/right)", -180, 180, 1, Math.round(r[1]))
    .slider("rz", "Rotate Z (roll sideways)", -180, 180, 1, Math.round(r[2]))
    .slider("px", "Move X (side, pixels)", -POS_LIMIT, POS_LIMIT, 0.25, p[0])
    .slider("py", "Move Y (up/down, pixels)", -POS_LIMIT, POS_LIMIT, 0.25, p[1])
    .slider("pz", "Move Z (forward/back, pixels)", -POS_LIMIT, POS_LIMIT, 0.25, p[2])
    .submit("Apply")
    .show(player, (v) => {
      if (!npc.isValid) return;
      pushUndo(npc);
      setRot(npc, bone.key, [v.rx, v.ry, v.rz]);
      setPos(npc, bone.key, [v.px, v.py, v.pz]);
      back();
    }, back);
}

const NUDGE_STEPS = [1, 5, 15, 45];
function openNudge(player, npc, back, stepIdx = 1) {
  if (!npc.isValid) return;
  const st = stateFor(player);
  const bone = BONES[st.bone];
  const step = NUDGE_STEPS[stepIdx];
  const pstep = step >= 15 ? 2 : step >= 5 ? 1 : 0.25;
  const self = () => openNudge(player, npc, back, stepIdx);
  const rot = (axis, d) => () => {
    pushUndo(npc);
    const r = getRot(npc, bone.key);
    r[axis] = wrapDeg(r[axis] + d);
    setRot(npc, bone.key, r);
    self();
  };
  const mov = (axis, d) => () => {
    pushUndo(npc);
    const p = getPos(npc, bone.key);
    p[axis] = snapPos(p[axis] + d);
    setPos(npc, bone.key, p);
    self();
  };
  menu(`Nudge: ${bone.label}`, `§7Rot: §f${fmt(getRot(npc, bone.key))}\n§7Pos: §f${fmt(getPos(npc, bone.key))} px`)
    .btn(`Step: ${step} deg / ${pstep} px §8(tap to change)`, ICON("fov"), () => openNudge(player, npc, back, (stepIdx + 1) % NUDGE_STEPS.length))
    .btn(`Rotate X +${step}`, ICON("turn"), rot(0, step))
    .btn(`Rotate X -${step}`, ICON("turn"), rot(0, -step))
    .btn(`Rotate Y +${step}`, ICON("turn"), rot(1, step))
    .btn(`Rotate Y -${step}`, ICON("turn"), rot(1, -step))
    .btn(`Rotate Z +${step}`, ICON("turn"), rot(2, step))
    .btn(`Rotate Z -${step}`, ICON("turn"), rot(2, -step))
    .btn(`Move Up`, ICON("move"), mov(1, pstep))
    .btn(`Move Down`, ICON("move"), mov(1, -pstep))
    .btn(`Move Left`, ICON("move"), mov(0, pstep))
    .btn(`Move Right`, ICON("move"), mov(0, -pstep))
    .btn(`Move Forward`, ICON("move"), mov(2, -pstep))
    .btn(`Move Back`, ICON("move"), mov(2, pstep))
    .btn("§aDone", ICON("done"), back)
    .show(player);
}

export function openPoseLibrary(player, npc, back) {
  const m = menu("Pose Library", "§7Pick a category. Every pose can be tweaked after with the Live Gizmo.");
  for (const cat of POSE_CATEGORIES) {
    m.btn(`${cat.name} §8(${Object.keys(cat.poses).length})`, ICON("pose_preset"), () => {
      const mm = menu(cat.name);
      for (const [name, preset] of Object.entries(cat.poses)) {
        mm.btn(name, ICON("pose_preset"), () => {
          if (!npc.isValid) return;
          pushUndo(npc);
          applyPose(npc, expandPreset(preset));
          sfx(player, "pose");
          msg(player, `§aPose: ${name}`);
          openPoseLibrary(player, npc, back);
        });
      }
      mm.back(() => openPoseLibrary(player, npc, back)).show(player);
    });
  }
  m.back(back).show(player);
}

// ---------- my poses (world storage, shared by every NPC) ----------
const POSE_PREFIX = "npcstudio:pose:";
export function listMyPoses() {
  return world.getDynamicPropertyIds().filter((k) => k.startsWith(POSE_PREFIX)).map((k) => k.slice(POSE_PREFIX.length)).sort();
}
function openMyPoses(player, npc, back) {
  const self = () => openMyPoses(player, npc, back);
  const names = listMyPoses();
  const m = menu("My Saved Poses", names.length ? "§7Tap to apply." : "§7No saved poses yet.");
  m.btn("+ Save Current Pose", ICON("plus"), () =>
    modal("Save Pose").text("name", "Pose name", "my_pose").show(player, ({ name }) => {
      name = String(name ?? "").trim().slice(0, 32);
      if (!name) return self();
      setJson(world, POSE_PREFIX + name, readPose(npc));
      msg(player, `§aSaved pose "${name}".`);
      self();
    }, self)
  );
  for (const n of names) {
    m.btn(n, ICON("pose_manual"), () => {
      menu(n)
        .btn("Apply", ICON("done"), () => {
          pushUndo(npc);
          applyPose(npc, getJson(world, POSE_PREFIX + n, {}));
          self();
        })
        .btn("Apply Mirrored", ICON("mirror"), () => {
          pushUndo(npc);
          applyPose(npc, mirrorPose(getJson(world, POSE_PREFIX + n, {})));
          self();
        })
        .btn("Delete", ICON("delete"), () => {
          world.setDynamicProperty(POSE_PREFIX + n, undefined);
          self();
        })
        .back(self)
        .show(player);
    });
  }
  m.back(back).show(player);
}

// ---------- scale ----------
export function openScaleMenu(player, npc, back) {
  const set = (s, label) => () => {
    pushUndo(npc);
    setScale(npc, s);
    msg(player, `§aSize: ${label}`);
    back();
  };
  menu("Size / Height", `§7Current: §f${Math.round(getScale(npc) * 100)}%\n§7Players are drawn at 93.75% — "Player Size" makes the NPC exactly as tall as you.`)
    .btn("Player Size (matches you)", ICON("scale"), set(0.9375, "player size"))
    .btn("Full Block Size (100%)", ICON("scale"), set(1.0, "100%"))
    .btn("Baby (50%)", ICON("scale"), set(0.5, "baby"))
    .btn("Tiny (25%)", ICON("scale"), set(0.25, "tiny"))
    .btn("Tall (125%)", ICON("scale"), set(1.25, "tall"))
    .btn("Giant (200%)", ICON("scale"), set(2.0, "giant"))
    .btn("Titan (400%)", ICON("scale"), set(4.0, "titan"))
    .btn("Custom...", ICON("sliders"), () =>
      modal("Custom Size")
        .slider("pct", "Size in %", 10, 500, 5, Math.round(getScale(npc) * 100))
        .show(player, (v) => set(v.pct / 100, `${v.pct}%`)(), back)
    )
    .back(back)
    .show(player);
}

export function openLoopAnims(player, npc, back) {
  const cur = getAnim(npc);
  const m = menu("Looping Animation", "§7Plays on top of the current pose, forever, on every client. Pick None to stop.");
  m.btn(`${cur === 0 ? "§a> " : ""}None (hold pose)`, ICON("clear_x"), () => {
    setAnim(npc, 0);
    back();
  });
  LOOP_ANIMS.forEach((name, i) => m.btn(`${cur === i + 1 ? "§a> " : ""}${name}`, ICON("animate"), () => {
    setAnim(npc, i + 1);
    back();
  }));
  m.back(back).show(player);
}

// =====================================================================================
// LIVE GIZMO
// =====================================================================================
const AXES = ["§fFree", "§cX", "§aY", "§9Z"];
const gizmos = new Map(); // player.id -> session

export function isInGizmo(player) {
  return gizmos.has(player.id);
}

/** V3.3: walk around the NPC while posing (default on). Off = the old frozen Pose Mode. */
export function poseWalkOn(player) {
  return player.getDynamicProperty("npcstudio:pose_walk") !== false;
}
export function setPoseWalk(player, on) {
  player.setDynamicProperty("npcstudio:pose_walk", on);
}

function setWalk(player, allowed) {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.LateralMovement, allowed);
  } catch {
    /* older versions: player can still walk, gizmo still works */
  }
}

// ---------- the visible gizmo (red/green/blue arrows = move, rings = rotate) ----------
const GIZMO_ID = "npcstudio:gizmo";
// bone pivot in model pixels: [side (+ = NPC's left), up, forward/back]
const PIVOTS = { head: [0, 24, 0], body: [0, 24, 0], right_arm: [-5, 22, 0], left_arm: [5, 22, 0], right_leg: [-1.9, 12, 0], left_leg: [1.9, 12, 0], root: [0, 0, 0] };

function gizmoWorldPos(npc, boneKey, pos) {
  const sc = getScale(npc);
  const yaw = npc.getRotation().y;
  const f = forward(yaw);
  const r = right(yaw);
  const pv = PIVOTS[boneKey] ?? [0, 0, 0];
  const side = -(pv[0] + pos[0]) / 16 * sc; // model +x = NPC's left
  const upDist = (pv[1] + pos[1]) / 16 * sc;
  const fwd = -(pv[2] + pos[2]) / 16 * sc;
  const l = npc.location;
  return { x: l.x + r.x * side + f.x * fwd, y: l.y + upDist, z: l.z + r.z * side + f.z * fwd };
}

/** V3.3: red / green / blue axes at the NPC's feet (a 2nd gizmo in "feet" mode). */
function feetPos(npc) {
  const l = npc.location;
  return { x: l.x, y: l.y + 0.02, z: l.z };
}
function spawnFeet(s) {
  try {
    const f = s.npc.dimension.spawnEntity(GIZMO_ID, feetPos(s.npc));
    f.setRotation({ x: 0, y: s.npc.getRotation().y });
    f.setProperty("npcstudio:gmode", 3);
    f.setProperty("npcstudio:gscale", clamp(getScale(s.npc), 0.3, 4));
    s.feet = f;
  } catch (e) {
    console.warn(`[NPC Studio] feet gizmo: ${e}`);
  }
}
function syncFeet(s) {
  const f = s.feet;
  if (!f?.isValid) return;
  try {
    const p = feetPos(s.npc);
    const o = f.location;
    if (Math.abs(p.x - o.x) + Math.abs(p.y - o.y) + Math.abs(p.z - o.z) > 0.005) f.teleport(p, { rotation: { x: 0, y: s.npc.getRotation().y } });
  } catch {
    /* ignore */
  }
}

function spawnGizmo(s) {
  try {
    const g = s.npc.dimension.spawnEntity(GIZMO_ID, gizmoWorldPos(s.npc, s.bone.key, s.pos));
    g.setRotation({ x: 0, y: s.npc.getRotation().y });
    g.setProperty("npcstudio:gscale", gizmoScale(s));
    s.gizmo = g;
    syncGizmo(s);
  } catch (e) {
    console.warn(`[NPC Studio] gizmo spawn failed: ${e}`);
  }
}

function syncGizmo(s) {
  const g = s.gizmo;
  if (!g?.isValid) return;
  try {
    const mode = s.mode === "rot" ? 1 : s.mode === "pos" ? 0 : 2;
    if (g.getProperty("npcstudio:gmode") !== mode) g.setProperty("npcstudio:gmode", mode);
    if (g.getProperty("npcstudio:gaxis") !== s.axis) g.setProperty("npcstudio:gaxis", s.axis);
    const sc = gizmoScale(s);
    if (Math.abs((g.getProperty("npcstudio:gscale") ?? 1) - sc) > 0.01) g.setProperty("npcstudio:gscale", sc);
    const p = gizmoWorldPos(s.npc, s.bone.key, s.pos);
    const o = g.location;
    if (Math.abs(p.x - o.x) + Math.abs(p.y - o.y) + Math.abs(p.z - o.z) > 0.005) g.teleport(p, { rotation: { x: 0, y: s.npc.getRotation().y } });
  } catch {
    /* ignore */
  }
}

/** Remove leftover gizmos (e.g. after a crash or someone leaving mid-edit). */
export function cleanupGizmos() {
  for (const d of ["overworld", "nether", "the_end"]) {
    try {
      for (const g of world.getDimension(d).getEntities({ type: GIZMO_ID })) {
        if (![...gizmos.values()].some((s) => s.gizmo?.id === g.id || s.feet?.id === g.id)) g.remove();
      }
    } catch {
      /* ignore */
    }
  }
}

const gizmoScale = (s) => clamp(getScale(s.npc) * (s.bone.key === "root" ? 1.8 : s.bone.key === "body" ? 1.1 : 0.8), 0.1, 4);

// =====================================================================================
// POSE MODE: a Blender-style toolbar on your hotbar
//   1 Select (look at a body part)   2 Rotate   3 Move   4 Axis   5 Undo   6 Reset part   9 Done
//   While rotating / moving: just look around. Sneak = done, Jump = cancel everything.
// =====================================================================================
const TOOLS = ["npcstudio:tool_select", "npcstudio:tool_rotate", "npcstudio:tool_move", "npcstudio:tool_axis", "npcstudio:tool_undo", "npcstudio:tool_reset", "npcstudio:tool_cancel", undefined, "npcstudio:tool_done"];
const MODE_SLOT = { select: 0, rot: 1, pos: 2 };
// where each part "is" when you look at it (model pixels)
const CENTERS = { head: [0, 28, 0], body: [0, 18, 0], right_arm: [-6, 16, 0], left_arm: [6, 16, 0], right_leg: [-2, 6, 0], left_leg: [2, 6, 0], root: [0, 0.5, 0] };

function partUnderCrosshair(player, npc) {
  const eye = player.getHeadLocation();
  const dir = player.getViewDirection();
  let best, bestAng = 16;
  BONES.forEach((b, i) => {
    const c = CENTERS[b.key];
    const p = gizmoWorldPos(npc, "root", [c[0] + getPos(npc, b.key)[0], c[1] + getPos(npc, b.key)[1], c[2]]);
    const v = { x: p.x - eye.x, y: p.y - eye.y, z: p.z - eye.z };
    const len = Math.hypot(v.x, v.y, v.z) || 1;
    const ang = (Math.acos(clamp((v.x * dir.x + v.y * dir.y + v.z * dir.z) / len, -1, 1)) * 180) / Math.PI;
    if (ang < bestAng) {
      bestAng = ang;
      best = i;
    }
  });
  return best;
}

export function startGizmo(player, npc, back) {
  if (gizmos.has(player.id)) return;
  if (!swapHotbar(player, TOOLS)) {
    msg(player, "§cPose Mode needs your hotbar for its tools. Free up some inventory space (up to 9 slots) and try again.");
    return;
  }
  editorHudReset(player); // Pose Mode needs the hotbar at once
  const st = stateFor(player);
  const r0 = player.getRotation();
  const s = {
    npc,
    bone: BONES[st.bone],
    mode: "select",
    axis: 0,
    rot: [0, 0, 0],
    pos: [0, 0, 0],
    last: { x: r0.x, y: r0.y },
    sneak: player.isSneaking,
    jump: player.isJumping,
    back,
    grace: 4,
    walk: poseWalkOn(player),
    start: { pose: readPose(npc), scale: getScale(npc) }
  };
  s.rot = getRot(npc, s.bone.key);
  s.pos = getPos(npc, s.bone.key);
  gizmos.set(player.id, s);
  try {
    player.selectedSlotIndex = 0;
  } catch {
    /* ignore */
  }
  if (!s.walk) setWalk(player, false); // walking on: move around freely, the gizmo stays on the NPC
  player.setDynamicProperty("npcstudio:gizmo", true);
  spawnGizmo(s);
  spawnFeet(s);
  sfx(player, "start");
  s.run = system.runInterval(() => tickGizmo(player, s), 1);
}

function setMode(player, s, mode) {
  if (s.mode === mode) return;
  s.mode = mode;
  if (mode !== "select") {
    s.pushed = false; // the first movement of this grab saves an undo step
    s.rot = getRot(s.npc, s.bone.key);
    s.pos = getPos(s.npc, s.bone.key);
    const r = player.getRotation();
    s.last = { x: r.x, y: r.y };
    s.grace = 3;
  }
  sfx(player, "click");
}

function backToModeSlot(player, s) {
  try {
    player.selectedSlotIndex = MODE_SLOT[s.mode];
  } catch {
    /* ignore */
  }
}

function refreshValues(s) {
  s.rot = getRot(s.npc, s.bone.key);
  s.pos = getPos(s.npc, s.bone.key);
}

function gizmoReadout(s) {
  const mode = s.mode === "select" ? "§eSELECT" : s.mode === "rot" ? "§bROTATE" : "§6MOVE";
  const head = `§f§l${s.bone.label.toUpperCase()}§r ${mode}${s.mode === "select" ? "" : ` §7${AXES[s.axis]}`}`;
  let vals;
  if (s.mode === "select") vals = "§7look at a body part";
  else {
    const v = s.mode === "rot" ? s.rot.map((n) => `${Math.round(n)}`) : s.pos.map((n) => n.toFixed(1));
    vals = `§cX§f${v[0]} §aY§f${v[1]} §9Z§f${v[2]}`;
  }
  const keys = s.walk ? "§7slot 9 done · slot 7 cancel · slot 1 to walk and look" : "§7sneak done · jump cancel";
  return `${head}\n${vals}\n${keys}`;
}

/** Tapping a hotbar slot. */
export function gizmoHotbar(player, slot) {
  const s = gizmos.get(player.id);
  if (!s) return false;
  if (slot === MODE_SLOT[s.mode]) return true;
  switch (slot) {
    case 0: setMode(player, s, "select"); break;
    case 1: setMode(player, s, "rot"); break;
    case 2: setMode(player, s, "pos"); break;
    case 3: gizmoToolUse(player, "npcstudio:tool_axis"); backToModeSlot(player, s); break;
    case 4: gizmoToolUse(player, "npcstudio:tool_undo"); backToModeSlot(player, s); break;
    case 5: gizmoToolUse(player, "npcstudio:tool_reset"); backToModeSlot(player, s); break;
    case 6: endGizmo(player, false); break;
    case 8: endGizmo(player, true); break;
    default: backToModeSlot(player, s);
  }
  return true;
}

/** Tapping the screen while holding a tool (handy on mobile). */
export function gizmoToolUse(player, itemId) {
  const s = gizmos.get(player.id);
  if (!s) return;
  switch (itemId) {
    case "npcstudio:tool_axis":
      s.axis = (s.axis + 1) % AXES.length;
      sfx(player, "click");
      break;
    case "npcstudio:tool_undo":
      if (undo(s.npc)) sfx(player, "pose");
      else sfx(player, "error");
      refreshValues(s);
      s.pushed = false;
      break;
    case "npcstudio:tool_reset":
      pushUndo(s.npc);
      setRot(s.npc, s.bone.key, [0, 0, 0]);
      setPos(s.npc, s.bone.key, [0, 0, 0]);
      refreshValues(s);
      s.pushed = false;
      sfx(player, "pose");
      break;
    case "npcstudio:tool_done":
      endGizmo(player, true);
      break;
    case "npcstudio:tool_cancel":
      endGizmo(player, false);
      break;
  }
}

function tickGizmo(player, s) {
  if (!player.isValid || !s.npc.isValid) return endGizmo(player, false);
  const st = stateFor(player);
  const rot = player.getRotation();
  const dPitch = rot.x - s.last.x;
  const dYaw = wrapDeg(rot.y - s.last.y);
  s.last = { x: rot.x, y: rot.y };
  const k = st.sens;

  if (s.grace > 0) s.grace--;
  else if (s.mode === "select") {
    const i = partUnderCrosshair(player, s.npc);
    if (i !== undefined && BONES[i] !== s.bone) {
      s.bone = BONES[i];
      st.bone = i;
      refreshValues(s);
      sfx(player, "click");
    }
  } else if (dPitch !== 0 || dYaw !== 0) {
    if (!s.pushed) {
      pushUndo(s.npc);
      s.pushed = true;
    }
    if (s.mode === "rot") {
      if (s.axis === 0) {
        s.rot[0] += dPitch * k;
        s.rot[1] += dYaw * k;
      } else s.rot[s.axis - 1] += (dPitch + dYaw) * k;
      s.rot = s.rot.map((v) => clamp(v, -180, 180));
      setRot(s.npc, s.bone.key, st.snap ? s.rot.map((v) => round(v, 5)) : s.rot);
    } else {
      const m = 0.12 * k;
      if (s.axis === 0) {
        s.pos[0] -= dYaw * m;
        s.pos[1] -= dPitch * m;
      } else s.pos[s.axis - 1] += (dPitch + dYaw) * m;
      s.pos = s.pos.map((v) => clamp(v, -POS_LIMIT, POS_LIMIT));
      setPos(s.npc, s.bone.key, (st.snap ? s.pos.map((v) => round(v, 1)) : s.pos).map(snapPos));
    }
  }

  // Sneak = done, Jump = cancel (rising edges) — only in the frozen mode; walking needs both keys
  if (s.grace === 0 && !s.walk) {
    const sneaking = player.isSneaking;
    const jumping = player.isJumping;
    if (sneaking && !s.sneak) return endGizmo(player, true);
    if (jumping && !s.jump) return endGizmo(player, false);
    s.sneak = sneaking;
    s.jump = jumping;
  }

  syncGizmo(s);
  syncFeet(s);
  if (system.currentTick % 2 === 0) corner(player, gizmoReadout(s));
}

export function endGizmo(player, apply) {
  const s = gizmos.get(player.id);
  if (!s) return;
  gizmos.delete(player.id);
  system.clearRun(s.run);
  for (const e of [s.gizmo, s.feet]) {
    try {
      if (e?.isValid) e.remove();
    } catch {
      /* ignore */
    }
  }
  if (!apply && s.npc.isValid) {
    applyPose(s.npc, s.start.pose);
    setScale(s.npc, s.start.scale);
  }
  if (player.isValid) {
    clearCorner(player);
    restoreHotbar(player);
    setWalk(player, true);
    player.setDynamicProperty("npcstudio:gizmo", undefined);
    actionbar(player, apply ? "§aPose saved." : "§cPose Mode cancelled — changes undone.");
    sfx(player, apply ? "ok" : "click");
  }
  if (!player.isValid || !s.npc.isValid) return;
  const after = () => (s.back ? s.back() : openPoseEditor(player, s.npc));
  system.runTimeout(() => {
    if (!apply) return after();
    // V3: one quick check before the panel comes back
    menu("Keep this pose?", "§7Closing this keeps it too.")
      .btn("Yes, keep it", ICON("done"), after)
      .btn("§cNo, undo it", ICON("undo"), () => {
        if (s.npc.isValid) {
          applyPose(s.npc, s.start.pose);
          setScale(s.npc, s.start.scale);
        }
        actionbar(player, "§7Pose undone.");
        after();
      })
      .show(player);
  }, 6);
}

/** Safety net: if someone left the world mid-edit, give walking and their hotbar back. */
export function restoreAfterRejoin(player) {
  if (gizmos.has(player.id)) return;
  if (player.getDynamicProperty("npcstudio:gizmo")) {
    setWalk(player, true);
    player.setDynamicProperty("npcstudio:gizmo", undefined);
  }
  restoreHotbar(player);
}
