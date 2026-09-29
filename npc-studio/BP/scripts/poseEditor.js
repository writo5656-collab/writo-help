/**
 * NPC Studio — poseEditor.js : Blender-style posing.
 *
 * LIVE GIZMO (like pressing R / G in Blender): pick a bone, then just LOOK AROUND — the bone
 * follows your view. Sneak = apply, Jump = cancel, scroll/tap hotbar = change axis,
 * hit/swing = switch Rotate <-> Move. Works on touch, controller and mouse.
 * Plus precise sliders, nudge pad, mirror, copy/paste, undo/redo, pose library, scale.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { InputPermissionCategory } from "@minecraft/server";
import { world, system, menu, modal, msg, actionbar, ICON, clamp, wrapDeg, round, getJson, setJson, forward, right } from "./core.js";
import { BONES, getRot, setRot, getPos, setPos, getScale, setScale, readPose, applyPose, mirrorPose, expandPreset, pushUndo, undo, redo, historySize, snapPos, POS_LIMIT, getAnim, setAnim } from "./rig.js";
import { POSE_CATEGORIES, LOOP_ANIMS } from "./poses.js";

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

function highlight(npc) {
  try {
    npc.addEffect("glowing", 200, { amplifier: 0, showParticles: false });
  } catch {
    /* cosmetic */
  }
}

// =====================================================================================
// POSE EDITOR HUB
// =====================================================================================
export function openPoseEditor(player, npc, back) {
  if (!npc.isValid) return;
  highlight(npc);
  const self = () => openPoseEditor(player, npc, back);
  const st = stateFor(player);
  const bone = BONES[st.bone];
  const h = historySize(npc);
  const body = [
    `§fSelected bone: §b${bone.label}`,
    `§7Rotation: §f${fmt(getRot(npc, bone.key))}`,
    `§7Position: §f${fmt(getPos(npc, bone.key))} px`,
    `§7Size: §f${Math.round(getScale(npc) * 100)}%   §7Undo: §f${h.undo}  §7Redo: §f${h.redo}`
  ].join("\n");
  menu("Pose Editor", body)
    .btn("§lLive Gizmo §r— look to pose\n§8Blender-style, rotate or move", ICON("gizmo"), () => openGizmoStart(player, npc, self))
    .btn(`Bone: ${bone.label} §8(tap to change)`, ICON("pose_manual"), () => pickBone(player, self))
    .btn("Precise Sliders", ICON("sliders"), () => openSliders(player, npc, self))
    .btn("Nudge Pad (buttons)", ICON("move"), () => openNudge(player, npc, self))
    .btn("Pose Library (45+ poses)", ICON("pose_preset"), () => openPoseLibrary(player, npc, self))
    .btn("My Saved Poses", ICON("save"), () => openMyPoses(player, npc, self))
    .btn("Mirror Pose (Left <-> Right)", ICON("mirror"), () => {
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
    .btn(`Undo §8(${h.undo})`, ICON("undo"), () => {
      if (!undo(npc)) msg(player, "§7Nothing to undo.");
      self();
    })
    .btn(`Redo §8(${h.redo})`, ICON("redo"), () => {
      if (!redo(npc)) msg(player, "§7Nothing to redo.");
      self();
    })
    .btn(`Reset ${bone.label}`, ICON("clear"), () => {
      pushUndo(npc);
      setRot(npc, bone.key, [0, 0, 0]);
      setPos(npc, bone.key, [0, 0, 0]);
      self();
    })
    .btn("Reset Whole Pose", ICON("clear_x"), () => {
      pushUndo(npc);
      applyPose(npc, {});
      self();
    })
    .btn("Size / Height", ICON("scale"), () => openScaleMenu(player, npc, self))
    .btn(`Looping Animation: §b${getAnim(npc) ? LOOP_ANIMS[getAnim(npc) - 1] : "None"}`, ICON("animate"), () => openLoopAnims(player, npc, self))
    .btn(`Gizmo sensitivity: ${st.sens}x  Snap: ${st.snap ? "ON" : "off"}`, ICON("fov"), () => {
      modal("Gizmo Settings")
        .slider("sens", "Sensitivity (x0.1)", 2, 30, 1, Math.round(st.sens * 10))
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
const AXES = ["§fFree §7(§cX§7+§aY§7)", "§cX only (red)", "§aY only (green)", "§9Z only (blue)"];
const gizmos = new Map(); // player.id -> session

export function isInGizmo(player) {
  return gizmos.has(player.id);
}

function openGizmoStart(player, npc, back) {
  const st = stateFor(player);
  const b = BONES[st.bone].label;
  menu(
    "Live Gizmo",
    [
      `§fBody part: §b§l${b}`,
      "",
      "§e1.§f A 3D gizmo appears on the NPC's §b" + b + "§f:",
      "   §frings = ROTATE, arrows = MOVE",
      "   §cred = X§f, §agreen = Y§f, §9blue = Z§f. §eYellow§f = the axis you control.",
      "§e2.§f Turn your head (or drag the screen). The body part follows you.",
      "§e3.§a Sneak§f to keep it. §cJump§f to undo.",
      "",
      "§7Change axis: scroll the hotbar or tap another slot.",
      "§7Switch rotate/move: swing your arm (hit / tap).",
      "§7Walking is paused while the gizmo is on."
    ].join("\n")
  )
    .btn(`§lRotate ${b}`, ICON("gizmo"), () => startGizmo(player, npc, "rot", back))
    .btn(`§lMove ${b}`, ICON("move"), () => startGizmo(player, npc, "pos", back))
    .btn("Pick another body part", ICON("pose_manual"), () => pickBone(player, () => openGizmoStart(player, npc, back)))
    .back(back)
    .show(player);
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

function spawnGizmo(s) {
  try {
    const g = s.npc.dimension.spawnEntity(GIZMO_ID, gizmoWorldPos(s.npc, s.bone.key, s.pos));
    g.setRotation({ x: 0, y: s.npc.getRotation().y });
    g.setProperty("npcstudio:gscale", clamp(getScale(s.npc) * (s.bone.key === "root" ? 1.8 : 1), 0.1, 4));
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
    const mode = s.mode === "rot" ? 1 : 0;
    if (g.getProperty("npcstudio:gmode") !== mode) g.setProperty("npcstudio:gmode", mode);
    if (g.getProperty("npcstudio:gaxis") !== s.axis) g.setProperty("npcstudio:gaxis", s.axis);
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
        if (![...gizmos.values()].some((s) => s.gizmo?.id === g.id)) g.remove();
      }
    } catch {
      /* ignore */
    }
  }
}

export function startGizmo(player, npc, mode, back) {
  if (gizmos.has(player.id)) return;
  const st = stateFor(player);
  const bone = BONES[st.bone];
  pushUndo(npc);
  const r0 = player.getRotation();
  const session = {
    npc,
    bone,
    mode,
    axis: 0,
    rot: getRot(npc, bone.key),
    pos: getPos(npc, bone.key),
    last: { x: r0.x, y: r0.y },
    sneak: player.isSneaking,
    jump: player.isJumping,
    slot: player.selectedSlotIndex,
    back,
    grace: 6
  };
  gizmos.set(player.id, session);
  setWalk(player, false);
  player.setDynamicProperty("npcstudio:gizmo", true);
  highlight(npc);
  spawnGizmo(session);
  try {
    player.onScreenDisplay.setTitle(`§b${bone.label}`, { subtitle: "§fLook around to pose it", fadeInDuration: 2, stayDuration: 30, fadeOutDuration: 8 });
  } catch {
    /* ignore */
  }
  session.run = system.runInterval(() => tickGizmo(player, session), 1);
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
  else {
    if (s.mode === "rot") {
      if (s.axis === 0) {
        s.rot[0] += dPitch * k;
        s.rot[1] += dYaw * k;
      } else s.rot[s.axis - 1] += (dPitch + dYaw) * k;
      s.rot = s.rot.map((v) => clamp(v, -180, 180));
    } else {
      const m = 0.12 * k;
      if (s.axis === 0) {
        s.pos[0] -= dYaw * m;
        s.pos[1] -= dPitch * m;
      } else s.pos[s.axis - 1] += (dPitch + dYaw) * m;
      s.pos = s.pos.map((v) => clamp(v, -POS_LIMIT, POS_LIMIT));
    }
    if (dPitch !== 0 || dYaw !== 0) {
      const r = st.snap ? s.rot.map((v) => round(v, 5)) : s.rot;
      const p = st.snap ? s.pos.map((v) => round(v, 1)) : s.pos;
      if (s.mode === "rot") setRot(s.npc, s.bone.key, r);
      else setPos(s.npc, s.bone.key, p.map(snapPos));
    }

    // controls (rising edges)
    const sneaking = player.isSneaking;
    const jumping = player.isJumping;
    if (sneaking && !s.sneak) return endGizmo(player, true);
    if (jumping && !s.jump) return endGizmo(player, false);
    s.sneak = sneaking;
    s.jump = jumping;
  }

  syncGizmo(s);
  const c = (i, v) => `${["§c", "§a", "§9"][i]}${"XYZ"[i]} ${v}`;
  const vals = s.mode === "rot" ? s.rot.map((v, i) => c(i, v.toFixed(0) + "°")).join("  ") : s.pos.map((v, i) => c(i, v.toFixed(2))).join("  ");
  actionbar(player, `${s.mode === "rot" ? "§b§lROTATE (rings)" : "§6§lMOVE (arrows)"}§r §f${s.bone.label}  §7Axis: ${AXES[s.axis]}\n${vals}\n§7Look around to pose · §aSneak§7 apply · §cJump§7 cancel · §eHotbar§7 axis · §dSwing§7 rotate/move`);
}

export function gizmoCycleAxis(player, newSlot) {
  const s = gizmos.get(player.id);
  if (!s) return false;
  if (newSlot === s.slot) return true; // this is our own "put the slot back" change
  s.axis = (s.axis + 1) % AXES.length;
  try {
    if (newSlot !== s.slot) player.selectedSlotIndex = s.slot;
  } catch {
    /* ignore */
  }
  return true;
}

export function gizmoToggleMode(player) {
  const s = gizmos.get(player.id);
  if (!s) return false;
  s.mode = s.mode === "rot" ? "pos" : "rot";
  return true;
}

export function endGizmo(player, apply) {
  const s = gizmos.get(player.id);
  if (!s) return;
  gizmos.delete(player.id);
  system.clearRun(s.run);
  try {
    if (s.gizmo?.isValid) s.gizmo.remove();
  } catch {
    /* ignore */
  }
  if (player.isValid) {
    setWalk(player, true);
    player.setDynamicProperty("npcstudio:gizmo", undefined);
    actionbar(player, apply ? "§aApplied." : "§cCancelled.");
  }
  if (!apply && s.npc.isValid) undo(s.npc);
  if (player.isValid && s.npc.isValid) system.runTimeout(() => openPoseEditor(player, s.npc, s.back), 4);
}

/** Safety net: if someone left the world mid-gizmo, give walking back when they return. */
export function restoreAfterRejoin(player) {
  if (player.getDynamicProperty("npcstudio:gizmo")) {
    setWalk(player, true);
    player.setDynamicProperty("npcstudio:gizmo", undefined);
  }
}
