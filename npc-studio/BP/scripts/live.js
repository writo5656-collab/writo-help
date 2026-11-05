/**
 * NPC Studio V3 — live.js : live editors.
 * Uses Mojang's data-driven CustomForm: sliders, toggles and dropdowns change the NPC / world
 * while you drag, and the menu stays open. If a game version can't show it, the same editor
 * opens as a normal form (changes apply when you press the button).
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import * as ui from "@minecraft/server-ui";
import { EasingType } from "@minecraft/server";
import { system, world, modal, sfx, clamp, orbitPoint, CAM_PRESET, npcLabel } from "./core.js";
import { getRot, setRot, getPos, setPos, getScale, setScale, pushUndo, BONES, POS_LIMIT } from "./rig.js";
import { TRIM_DATA, MATERIAL_LABELS, isTrimmable } from "./trimdata.js";
import { getEquip, equipTrim } from "./wardrobe.js";
import { FOG_PRESETS, FOG_DISTANCES, getFog, setFog } from "./fog.js";

export const HAS_LIVE = typeof ui.CustomForm === "function" && typeof ui.ObservableNumber === "function";

/**
 * live(player, title)
 *   .header(text) .label(text)
 *   .slider(label, min, max, step, value, onChange)
 *   .toggle(label, value, onChange)
 *   .dropdown(label, options, index, onChange)
 *   .button(label, onClick)          (closes the editor first)
 *   .show(onClose)
 */
export function live(player, title) {
  const rows = [];
  const api = {
    header(text) {
      rows.push({ kind: "header", text });
      return api;
    },
    label(text) {
      rows.push({ kind: "label", text });
      return api;
    },
    slider(label, min, max, step, value, onChange) {
      rows.push({ kind: "slider", label, min, max, step, value: clamp(value, min, max), onChange });
      return api;
    },
    toggle(label, value, onChange) {
      rows.push({ kind: "toggle", label, value: !!value, onChange });
      return api;
    },
    dropdown(label, options, index, onChange) {
      rows.push({ kind: "dropdown", label, options, value: clamp(index, 0, options.length - 1), onChange });
      return api;
    },
    button(label, onClick) {
      rows.push({ kind: "button", label, onClick });
      return api;
    },
    show(onClose) {
      if (HAS_LIVE) {
        try {
          return showLive(player, title, rows, onClose);
        } catch (e) {
          console.warn(`[NPC Studio] live editor fell back to a normal form: ${e}`);
        }
      }
      return showFallback(player, title, rows, onClose);
    }
  };
  return api;
}

function safe(fn, v) {
  try {
    fn?.(v);
  } catch (e) {
    console.warn(`[NPC Studio] live change: ${e}`);
  }
}

function showLive(player, title, rows, onClose, tries = 0) {
  const form = new ui.CustomForm(player, title);
  let after; // a button's action runs after the editor has closed
  for (const r of rows) {
    if (r.kind === "header") form.header(r.text);
    else if (r.kind === "label") form.label(r.text);
    else if (r.kind === "slider") {
      const o = new ui.ObservableNumber(r.value, { clientWritable: true });
      let last = r.value;
      o.subscribe((v) => {
        const snapped = Math.round(v / r.step) * r.step;
        if (snapped === last) return;
        last = snapped;
        safe(r.onChange, snapped);
      });
      form.slider(r.label, o, r.min, r.max, { step: r.step });
    } else if (r.kind === "toggle") {
      const o = new ui.ObservableBoolean(r.value, { clientWritable: true });
      o.subscribe((v) => safe(r.onChange, v));
      form.toggle(r.label, o);
    } else if (r.kind === "dropdown") {
      const o = new ui.ObservableNumber(r.value, { clientWritable: true });
      o.subscribe((v) => safe(r.onChange, v));
      form.dropdown(r.label, o, r.options.map((label, value) => ({ label, value })));
    } else if (r.kind === "button") {
      form.button(r.label, () => {
        after = r.onClick;
        form.close();
      });
    }
  }
  form.closeButton();
  return form
    .show()
    .then((reason) => {
      if (reason === "UserBusy" && tries < 40) {
        system.runTimeout(() => showLive(player, title, rows, onClose, tries + 1), 5);
        return;
      }
      sfx(player, "click");
      // wait a tick: a new menu can't open in the same tick the old one closed
      system.runTimeout(() => {
        if (after) safe(after);
        else safe(onClose);
      }, 2);
    })
    .catch((e) => {
      console.warn(`[NPC Studio] live editor "${title}": ${e}`);
      showFallback(player, title, rows, onClose);
    });
}

function showFallback(player, title, rows, onClose) {
  const f = modal(title);
  const inputs = rows.filter((r) => ["slider", "toggle", "dropdown"].includes(r.kind));
  inputs.forEach((r, i) => {
    if (r.kind === "slider") f.slider(`v${i}`, r.label, r.min, r.max, r.step, r.value);
    else if (r.kind === "toggle") f.toggle(`v${i}`, r.label, r.value);
    else f.dropdown(`v${i}`, r.label, r.options, r.value);
  });
  const buttons = rows.filter((r) => r.kind === "button");
  if (buttons.length) f.dropdown("after", "Then", ["Done", ...buttons.map((b) => b.label)], 0);
  f.submit("Apply");
  return f.show(player, (v) => {
    inputs.forEach((r, i) => {
      if (v[`v${i}`] !== r.value) safe(r.onChange, v[`v${i}`]);
    });
    if (v.after > 0) safe(buttons[v.after - 1].onClick);
    else safe(onClose);
  }, onClose);
}

// =====================================================================================
// Editors
// =====================================================================================

/** Size: 10% to 500%. */
export function liveSize(player, npc, back) {
  if (!npc.isValid) return back?.();
  pushUndo(npc);
  live(player, `Size · ${npcLabel(npc)}`)
    .label("§7100% = player size. Drag and watch the NPC.")
    .slider("Size %", 10, 500, 5, Math.round(getScale(npc) * 100), (v) => npc.isValid && setScale(npc, v / 100))
    .button("Player size (100%)", () => {
      setScale(npc, 1);
      liveSize(player, npc, back);
    })
    .show(back);
}

/** Exact pose sliders for one body part (rotation + position). */
export function livePose(player, npc, boneKey, back) {
  if (!npc.isValid) return back?.();
  const bone = BONES.find((b) => b.key === boneKey) ?? BONES[0];
  pushUndo(npc);
  const rot = [...getRot(npc, bone.key)];
  const pos = [...getPos(npc, bone.key)];
  const L = POS_LIMIT;
  const e = live(player, `${bone.label} · ${npcLabel(npc)}`).header("Rotate");
  ["X (tilt)", "Y (turn)", "Z (roll)"].forEach((name, i) =>
    e.slider(name, -180, 180, bone.key === "root" ? 1.5 : 1, Math.round(rot[i]), (v) => {
      rot[i] = v;
      if (npc.isValid) setRot(npc, bone.key, [rot[0], rot[1], rot[2]]);
    })
  );
  e.header("Move (pixels)");
  ["X (left/right)", "Y (up/down)", "Z (forward/back)"].forEach((name, i) =>
    e.slider(name, -L, L, 0.25, pos[i], (v) => {
      pos[i] = v;
      if (npc.isValid) setPos(npc, bone.key, [pos[0], pos[1], pos[2]]);
    })
  );
  e.button("Reset this part", () => {
    setRot(npc, bone.key, [0, 0, 0]);
    setPos(npc, bone.key, [0, 0, 0]);
    livePose(player, npc, boneKey, back);
  }).show(back);
}

// ---------- Trim Studio: the Fitting Room ----------
const TIER_NAMES = { leather: "Leather", chainmail: "Chainmail", iron: "Iron", golden: "Gold", diamond: "Diamond", netherite: "Netherite" };
const PIECE_KEYS = ["Head", "Chest", "Legs", "Feet"];
const fitting = new Map(); // player.id -> last settings

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

export function liveTrim(player, npc, back) {
  if (!npc.isValid) return back?.();
  const st = fitting.get(player.id) ?? { pattern: 13, material: 7, tier: 4, glint: false, pieces: [true, true, true, true], angle: 0 };
  fitting.set(player.id, st);
  const apply = () => {
    if (!npc.isValid) return;
    const pattern = TRIM_DATA.patterns[st.pattern];
    const material = TRIM_DATA.materials[st.material];
    PIECE_KEYS.forEach((key, i) => {
      if (!st.pieces[i]) return;
      const piece = TRIM_DATA.pieces[key];
      const cur = getEquip(npc, key)?.id;
      const itemId = TRIM_DATA.tiers[st.tier] ? `minecraft:${TRIM_DATA.tiers[st.tier]}_${piece}` : isTrimmable(cur) ? cur : `minecraft:diamond_${piece}`;
      equipTrim(npc, key, itemId, pattern, material, st.glint);
    });
    sfx(player, "trim");
  };
  closeUp(player, npc, st.angle);
  apply();
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  live(player, "Trim Studio")
    .label("§7Every change shows on the NPC right away.")
    .dropdown("Pattern", TRIM_DATA.patterns.map(cap), st.pattern, (v) => {
      st.pattern = v;
      apply();
    })
    .dropdown("Material (colour)", TRIM_DATA.materials.map((m) => MATERIAL_LABELS[m] ?? cap(m)), st.material, (v) => {
      st.material = v;
      apply();
    })
    .dropdown("Armor", TRIM_DATA.tiers.map((t) => TIER_NAMES[t] ?? cap(t)), st.tier, (v) => {
      st.tier = v;
      apply();
    })
    .toggle("Enchant glint", st.glint, (v) => {
      st.glint = v;
      apply();
    })
    .header("Pieces")
    .toggle("Helmet", st.pieces[0], (v) => (st.pieces[0] = v, apply()))
    .toggle("Chestplate", st.pieces[1], (v) => (st.pieces[1] = v, apply()))
    .toggle("Leggings", st.pieces[2], (v) => (st.pieces[2] = v, apply()))
    .toggle("Boots", st.pieces[3], (v) => (st.pieces[3] = v, apply()))
    .header("View")
    .slider("Turn the view", -180, 180, 15, st.angle, (v) => {
      st.angle = v;
      closeUp(player, npc, v);
    })
    .show(() => {
      try {
        player.camera.clear();
      } catch {
        /* ignore */
      }
      back?.();
    });
}

// ---------- world ----------
const WEATHER = ["Keep as is", "Clear", "Rain", "Thunder"];
export function liveTime(player, back) {
  const dim = player.dimension;
  const cmd = (c) => {
    try {
      dim.runCommand(c);
    } catch {
      /* ignore */
    }
  };
  let time = 0;
  try {
    time = world.getTimeOfDay();
  } catch {
    /* ignore */
  }
  let frozen = false;
  try {
    frozen = world.gameRules.doDayLightCycle === false;
  } catch {
    /* ignore */
  }
  live(player, "Time & Weather")
    .label("§70 = sunrise · 6000 = noon · 12000 = sunset · 18000 = midnight")
    .slider("Time of day", 0, 24000, 250, Math.round(time / 250) * 250, (v) => cmd(`time set ${v}`))
    .toggle("Freeze time", frozen, (v) => cmd(`gamerule dodaylightcycle ${v ? "false" : "true"}`))
    .dropdown("Weather", WEATHER, 0, (v) => {
      if (v === 1) cmd("weather clear 999999");
      if (v === 2) cmd("weather rain 999999");
      if (v === 3) cmd("weather thunder 999999");
    })
    .toggle("Lock weather", false, (v) => cmd(`gamerule doweathercycle ${v ? "false" : "true"}`))
    .show(back);
}

export function liveFog(player, back) {
  const f = getFog(player);
  live(player, "Depth Fog")
    .label("§7Far away fades into a colour, close things stay sharp. Only you see it.")
    .toggle("Depth Fog on", f.on, (v) => setFog(player, { on: v }))
    .dropdown("Look", FOG_PRESETS.map((p) => p.name), Math.max(0, FOG_PRESETS.findIndex((p) => p.id === f.preset)), (v) =>
      setFog(player, { preset: FOG_PRESETS[v].id, on: true })
    )
    .slider("Distance (step)", 0, FOG_DISTANCES.length - 1, 1, Math.max(0, FOG_DISTANCES.indexOf(f.dist)), (v) => {
      const d = FOG_DISTANCES[clamp(v, 0, FOG_DISTANCES.length - 1)];
      setFog(player, { dist: d, on: true });
    })
    .label(`§7Steps: ${FOG_DISTANCES.join(" · ")} blocks`)
    .show(back);
}

// ---------- camera lens + framing ----------
/**
 * hooks: { state(marker) -> {location, rotX, rotY, fov}, save(marker, state), view(marker) }
 */
export function liveCamera(player, marker, hooks, back) {
  if (!marker.isValid) return back?.();
  const base = hooks.state(marker);
  const off = { fwd: 0, side: 0, up: 0 };
  const cur = { ...base, location: { ...base.location } };
  const push = () => {
    if (!marker.isValid) return;
    const r = (cur.rotY * Math.PI) / 180;
    cur.location = {
      x: base.location.x - Math.sin(r) * off.fwd - Math.cos(r) * off.side,
      y: base.location.y + off.up,
      z: base.location.z + Math.cos(r) * off.fwd - Math.sin(r) * off.side
    };
    hooks.save(marker, cur);
    hooks.view(marker);
  };
  hooks.view(marker);
  live(player, `${marker.nameTag || "Camera"} · Lens & Framing`)
    .label("§7You're looking through the camera: every change shows live.")
    .slider("FOV (zoom)", 20, 110, 1, Math.round(base.fov), (v) => ((cur.fov = v), push()))
    .slider("Turn", -180, 180, 1, Math.round(((base.rotY + 540) % 360) - 180), (v) => ((cur.rotY = v), push()))
    .slider("Tilt", -90, 90, 1, Math.round(base.rotX), (v) => ((cur.rotX = v), push()))
    .header("Move (blocks)")
    .slider("Forward / back", -6, 6, 0.1, 0, (v) => ((off.fwd = v), push()))
    .slider("Left / right", -6, 6, 0.1, 0, (v) => ((off.side = v), push()))
    .slider("Up / down", -6, 6, 0.1, 0, (v) => ((off.up = v), push()))
    .show(back);
}

