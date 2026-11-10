/**
 * NPC Studio V3.2 — live.js : editors that live inside the Studio panel.
 * Sliders and steppers are panel rows (core.js menu): tapping - / + changes the NPC or the world
 * and redraws the panel at once, so the world stays in view on the right while you work.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { EasingType } from "@minecraft/server";
import { system, world, menu, keep, sfx, clamp, orbitPoint, CAM_PRESET, ICON, npcLabel } from "./core.js";
import { getRot, setRot, getPos, setPos, getScale, setScale, pushUndo, BONES, POS_LIMIT } from "./rig.js";
import { TRIM_DATA, MATERIAL_LABELS, isTrimmable } from "./trimdata.js";
import { getEquip, equipTrim } from "./wardrobe.js";
import { FOG_PRESETS, FOG_DISTANCES, getFog, setFog, presetName } from "./fog.js";

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const wrap = (i, n) => ((i % n) + n) % n;

/** One undo step per burst of taps (not one per tap). */
const lastUndo = new Map(); // npc.id -> time
export function undoOnce(npc) {
  const now = Date.now();
  if (now - (lastUndo.get(npc.id) ?? 0) > 4000) pushUndo(npc);
  lastUndo.set(npc.id, now);
}

// =====================================================================================
// Pose rows (Pose tab): pick a part, then rotate / move it with - and +
// =====================================================================================
const STEPS = [
  { name: "Fine", rot: 1, pos: 0.25 },
  { name: "Normal", rot: 5, pos: 1 },
  { name: "Big", rot: 15, pos: 2 }
];
const poseState = new Map(); // player.id -> { bone, step }
function poseOf(player) {
  let s = poseState.get(player.id);
  if (!s) poseState.set(player.id, (s = { bone: 0, step: 1 }));
  return s;
}
export function setPoseBone(player, key) {
  const i = BONES.findIndex((b) => b.key === key);
  if (i >= 0) poseOf(player).bone = i;
}

export function poseRows(m, player, npc) {
  const s = poseOf(player);
  const bone = BONES[s.bone];
  const step = STEPS[s.step];
  const rot = getRot(npc, bone.key);
  const pos = getPos(npc, bone.key);
  m.cycle("Part", bone.label, (d) => (s.bone = wrap(s.bone + d, BONES.length)));
  m.choices("Step", STEPS.map((x) => x.name), s.step, (i) => (s.step = i));
  ["Tilt", "Turn", "Roll"].forEach((name, i) =>
    m.slider(name, Math.round(rot[i] * 10) / 10, { min: -180, max: 180, step: bone.key === "root" ? Math.max(1.5, step.rot) : step.rot, unit: "°" }, (v) => {
      if (!npc.isValid) return;
      undoOnce(npc);
      const r = getRot(npc, bone.key);
      r[i] = v;
      setRot(npc, bone.key, [r[0], r[1], r[2]]);
    })
  );
  ["Move X", "Move Y", "Move Z"].forEach((name, i) =>
    m.slider(name, pos[i], { min: -POS_LIMIT, max: POS_LIMIT, step: step.pos }, (v) => {
      if (!npc.isValid) return;
      undoOnce(npc);
      const p = getPos(npc, bone.key);
      p[i] = v;
      setPos(npc, bone.key, [p[0], p[1], p[2]]);
    })
  );
}

/** Reset the part picked in the Pose rows. */
export function resetPart(player, npc) {
  const bone = BONES[poseOf(player).bone];
  undoOnce(npc);
  setRot(npc, bone.key, [0, 0, 0]);
  setPos(npc, bone.key, [0, 0, 0]);
}

/** Size + turn rows (Display tab). */
export function transformRows(m, npc) {
  m.slider("Size", Math.round(getScale(npc) * 100), { min: 10, max: 500, step: 10, unit: "%" }, (v) => {
    if (!npc.isValid) return;
    undoOnce(npc);
    setScale(npc, v / 100);
  });
  const r = getRot(npc, "root");
  m.slider("Turn", Math.round(r[1]), { min: -180, max: 180, step: 15, unit: "°" }, (v) => {
    if (!npc.isValid) return;
    undoOnce(npc);
    const now = getRot(npc, "root");
    setRot(npc, "root", [now[0], v, now[2]]);
  });
}

// =====================================================================================
// Trim Studio (in the panel): the camera swings to the NPC, every tap shows on the armor
// =====================================================================================
const TIER_NAMES = { leather: "Leather", chainmail: "Chainmail", iron: "Iron", golden: "Gold", diamond: "Diamond", netherite: "Netherite" };
const PIECE_KEYS = ["Head", "Chest", "Legs", "Feet"];
const PIECE_NAMES = ["Helmet", "Chestplate", "Leggings", "Boots"];
const fitting = new Map(); // player.id -> settings

function closeUp(player, npc, angle) {
  const s = getScale(npc);
  const center = { x: npc.location.x, y: npc.location.y + 1.1 * s, z: npc.location.z };
  const yaw = npc.getRotation().y + angle;
  const at = orbitPoint(center, 2.6 * Math.max(0.6, s), yaw, 0.25 * s);
  try {
    player.camera.setCamera(CAM_PRESET, { location: at, facingLocation: center, easeOptions: { easeTime: 0.35, easeType: EasingType.OutCubic } });
  } catch {
    /* ignore */
  }
}

export function trimPage(player, npc, back, onlySlots) {
  if (!npc.isValid) return back?.();
  const st = fitting.get(player.id) ?? { pattern: 13, material: 7, tier: 4, glint: false, pieces: [true, true, true, true], angle: 0 };
  fitting.set(player.id, st);
  if (onlySlots) st.pieces = PIECE_KEYS.map((k) => onlySlots.includes(k));
  const self = () => trimPage(player, npc, back);
  const apply = () => {
    if (!npc.isValid) return;
    const pattern = TRIM_DATA.patterns[st.pattern];
    const material = TRIM_DATA.materials[st.material];
    PIECE_KEYS.forEach((key, i) => {
      if (!st.pieces[i]) return;
      const piece = TRIM_DATA.pieces[key];
      const cur = getEquip(npc, key)?.id;
      const tier = TRIM_DATA.tiers[st.tier];
      const itemId = tier ? `minecraft:${tier}_${piece}` : isTrimmable(cur) ? cur : `minecraft:diamond_${piece}`;
      equipTrim(npc, key, itemId, pattern, material, st.glint);
    });
    sfx(player, "trim");
  };
  const change = (fn) => (d) => {
    fn(d);
    apply();
  };
  closeUp(player, npc, st.angle);
  const m = menu("Trim Studio", `§7Fitting §f${npcLabel(npc)}§7: every change shows on the armor`)
    .reopen(self)
    .onLeave(() => {
      try {
        player.camera.clear();
      } catch {
        /* ignore */
      }
    });
  m.section("trim", "Trim", ICON("trim"));
  m.cycle("Pattern", cap(TRIM_DATA.patterns[st.pattern]), change((d) => (st.pattern = wrap(st.pattern + d, TRIM_DATA.patterns.length))));
  const mat = TRIM_DATA.materials[st.material];
  m.cycle("Material", MATERIAL_LABELS[mat] ?? cap(mat), change((d) => (st.material = wrap(st.material + d, TRIM_DATA.materials.length))));
  const tier = TRIM_DATA.tiers[st.tier];
  m.cycle("Armor", TIER_NAMES[tier] ?? cap(tier), change((d) => (st.tier = wrap(st.tier + d, TRIM_DATA.tiers.length))));
  m.toggle("Enchant glint", st.glint, keep(() => ((st.glint = !st.glint), apply(), self())));
  m.section("pieces", "Pieces", ICON("equip"));
  PIECE_NAMES.forEach((name, i) => m.toggle(name, st.pieces[i], keep(() => ((st.pieces[i] = !st.pieces[i]), st.pieces[i] && apply(), self()))));
  m.section("view", "View", ICON("eye"));
  m.cycle("Turn view", `${st.angle}°`, (d) => (st.angle = wrap(st.angle + d * 45 + 180, 360) - 180));
  m.back(() => back?.(), "Done");
  m.show(player);
}

// =====================================================================================
// World rows: time, weather, fog
// =====================================================================================
const WEATHER = ["Clear", "Rain", "Thunder"];
const weatherPick = new Map(); // player.id -> index
function cmd(player, c) {
  try {
    player.dimension.runCommand(c);
  } catch {
    /* ignore */
  }
}
function rule(name, fallback) {
  try {
    const v = world.gameRules[name];
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}

export function timeRows(m, player, self) {
  let time = 0;
  try {
    time = world.getTimeOfDay();
  } catch {
    /* ignore */
  }
  m.slider("Time", Math.round(time / 500) * 500, { min: 0, max: 24000, step: 1000 }, (v) => cmd(player, `time set ${v % 24000}`));
  const frozen = rule("doDayLightCycle", true) === false;
  m.toggle("Freeze time", frozen, () => (cmd(player, `gamerule dodaylightcycle ${frozen ? "true" : "false"}`), system.runTimeout(self, 1)));
  const w = weatherPick.get(player.id) ?? 0;
  m.choices("Weather", WEATHER, w, (n) => {
    weatherPick.set(player.id, n);
    cmd(player, `weather ${WEATHER[n].toLowerCase()} 999999`);
  });
  const locked = rule("doWeatherCycle", true) === false;
  m.toggle("Lock weather", locked, () => (cmd(player, `gamerule doweathercycle ${locked ? "true" : "false"}`), system.runTimeout(self, 1)));
}

export function fogRows(m, player, self) {
  const f = getFog(player);
  m.toggle("Depth fog", f.on, () => (setFog(player, { on: !f.on }), self()));
  const pi = Math.max(0, FOG_PRESETS.findIndex((p) => p.id === f.preset));
  m.cycle("Colour", presetName(f.preset), (d) => setFog(player, { preset: FOG_PRESETS[wrap(pi + d, FOG_PRESETS.length)].id, on: true }));
  const di = Math.max(0, FOG_DISTANCES.indexOf(f.dist));
  m.cycle("Distance", `${f.dist} blocks`, (d) => setFog(player, { dist: FOG_DISTANCES[clamp(di + d, 0, FOG_DISTANCES.length - 1)], on: true }));
}

// =====================================================================================
// Camera lens + framing (in the panel, while you look through the camera)
// hooks: { state(marker) -> {location, rotX, rotY, fov}, save(marker, state), view(marker) }
// =====================================================================================
const MOVE_STEPS = [0.1, 0.5, 2];
const camStep = new Map(); // player.id -> index
export function cameraPage(player, marker, hooks, back) {
  if (!marker.isValid) return back?.();
  const self = () => cameraPage(player, marker, hooks, back);
  const s = hooks.state(marker);
  const si = camStep.get(player.id) ?? 1;
  const stepLen = MOVE_STEPS[si];
  const save = (changes) => {
    if (!marker.isValid) return;
    const cur = { ...hooks.state(marker), ...changes };
    hooks.save(marker, cur);
  };
  const move = (fwd, side, up) => {
    const cur = hooks.state(marker);
    const r = (cur.rotY * Math.PI) / 180;
    save({
      location: {
        x: cur.location.x - Math.sin(r) * fwd - Math.cos(r) * side,
        y: cur.location.y + up,
        z: cur.location.z + Math.cos(r) * fwd - Math.sin(r) * side
      }
    });
  };
  hooks.view(marker);
  const m = menu("Lens", `§7Looking through §f${marker.nameTag || "Camera"}§7: every change shows live`).reopen(self);
  m.section("lens", "Lens", ICON("fov"));
  m.slider("FOV", Math.round(s.fov), { min: 20, max: 110, step: 5, unit: "°" }, (v) => save({ fov: v }));
  m.slider("Turn", Math.round(((s.rotY + 540) % 360) - 180), { min: -180, max: 180, step: 5, unit: "°" }, (v) => save({ rotY: v }));
  m.slider("Tilt", Math.round(s.rotX), { min: -90, max: 90, step: 5, unit: "°" }, (v) => save({ rotX: v }));
  m.section("move", "Move", ICON("move"));
  m.cycle("Step", `${stepLen} block`, (d) => camStep.set(player.id, wrap(si + d, MOVE_STEPS.length)));
  m.cycle("Forward", "back · fwd", (d) => move(d * stepLen, 0, 0));
  m.cycle("Sideways", "left · right", (d) => move(0, d * stepLen, 0));
  m.cycle("Height", "down · up", (d) => move(0, 0, d * stepLen));
  m.back(() => back?.(), "Done");
  m.show(player);
}
