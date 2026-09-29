/**
 * NPC Studio — core.js (shared constants + helpers)
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

export const NPC_ID = "npcstudio:npc";
export const NPC_FAMILY = "npcstudio_npc";
export const WAND_ID = "npcstudio:wand";
export const CAMERA_ID = "npcstudio:camera_marker";
export const CAMERA_TOOL_ID = "npcstudio:camera_tool";
export const MOB_TOOL_ID = "npcstudio:mob_tool";
export const MOB_TAG = "npcstudio_mob";
export const TOOL_IDS = [WAND_ID, CAMERA_TOOL_ID, MOB_TOOL_ID];
export const CAM_PRESET = "npcstudio:cam_free";

// Every feature button uses NPC Studio's own drawn icon set (tools/make_icons.py).
export const ICON = (name) => `textures/ui/npcstudio/icon_${name}`;

// ---------- sound effects ----------
const SOUNDS = {
  error: ["mob.villager.no", 1, 1],
  ok: ["random.orb", 0.35, 1.6],
  click: ["random.click", 0.25, 1.4],
  shutter: ["camera.take_picture", 0.9, 1],
  open: ["item.book.page_turn", 0.6, 1.1],
  equip: ["armor.equip_diamond", 0.8, 1],
  trim: ["smithing_table.use", 0.7, 1],
  pose: ["random.pop", 0.4, 1.3],
  start: ["beacon.activate", 0.5, 1.4],
  bell: ["note.bell", 0.6, 1.2]
};
export function sfx(player, kind) {
  const s = SOUNDS[kind];
  if (!s) return;
  try {
    player.playSound(s[0], { volume: s[1], pitch: s[2] });
  } catch {
    /* ignore */
  }
}

// ---------- safe event subscription: one missing/renamed API must never kill the whole script ----------
export function safeOn(getEvent, handler, label) {
  try {
    const ev = getEvent();
    if (ev && typeof ev.subscribe === "function") {
      ev.subscribe((e) => {
        try {
          handler(e);
        } catch (err) {
          console.warn(`[NPC Studio] ${label} handler error: ${err}`);
        }
      });
    } else {
      console.warn(`[NPC Studio] Event "${label}" isn't available on this game version — skipped.`);
    }
  } catch (e) {
    console.warn(`[NPC Studio] Failed to subscribe to "${label}": ${e}`);
  }
}

// ---------- math ----------
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const round = (v, step) => Math.round(v / step) * step;
export const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;

export const EASE = {
  linear: (t) => t,
  smooth: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  in: (t) => t * t * t,
  out: (t) => 1 - Math.pow(1 - t, 3),
  inout: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  snap: (t) => 1 - Math.pow(1 - t, 6)
};
export const EASE_KEYS = ["smooth", "linear", "in", "out", "inout", "back", "snap"];
export const EASE_LABELS = ["Smooth (in-out sine)", "Linear", "Ease in", "Ease out", "Strong in-out", "Overshoot", "Snap"];

export const v3 = (x, y, z) => ({ x, y, z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale3 = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const lerp3 = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) });
export const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** Minecraft yaw convention: forward(yaw) = (-sin, cos). */
export function forward(yawDeg) {
  const r = toRad(yawDeg);
  return { x: -Math.sin(r), z: Math.cos(r) };
}
export function right(yawDeg) {
  const r = toRad(yawDeg);
  return { x: -Math.cos(r), z: -Math.sin(r) };
}
/** Point on a horizontal circle around `center`, where angle uses the same convention as yaw. */
export function orbitPoint(center, radius, angleDeg, dy = 0) {
  const f = forward(angleDeg);
  return { x: center.x + f.x * radius, y: center.y + dy, z: center.z + f.z * radius };
}
/** Catmull-Rom interpolation between p1 and p2. */
export function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) };
}

// ---------- json dynamic-property helpers ----------
export function getJson(holder, key, fallback) {
  try {
    const raw = holder.getDynamicProperty(key);
    return raw === undefined ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
export function setJson(holder, key, value) {
  holder.setDynamicProperty(key, value === undefined ? undefined : JSON.stringify(value));
}

export function niceId(id) {
  return String(id ?? "").replace("minecraft:", "").replace(/_/g, " ");
}

export function isLocked(npc) {
  try {
    return !!npc.getProperty("npcstudio:locked");
  } catch {
    return false;
  }
}

export function npcsNear(player, radius = 64) {
  return [...player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: radius })];
}

export function npcLabel(npc) {
  return npc?.nameTag || "NPC";
}

// ---------- forms ----------
// Shows a form and retries while the player is busy (chat open, just used an item, etc.),
// which is the #1 reason "the menu didn't open" on mobile.
function showWithRetry(form, player, tries = 0) {
  return form.show(player).then((res) => {
    if (res.canceled && res.cancelationReason === "UserBusy" && tries < 40) {
      return new Promise((resolve) => system.runTimeout(resolve, 5)).then(() => showWithRetry(form, player, tries + 1));
    }
    return res;
  });
}

/**
 * Button menu where each button carries its own callback — no fragile index math.
 * menu(title, body).btn(text, icon, fn).back(fn).show(player)
 */
export function menu(title, body) {
  const form = new ActionFormData().title(title);
  if (body) form.body(body);
  const actions = [];
  let onBack;
  const api = {
    btn(text, icon, fn) {
      if (icon) form.button(text, icon);
      else form.button(text);
      actions.push(fn);
      return api;
    },
    back(fn) {
      onBack = fn;
      form.button("< Back", ICON("back"));
      actions.push(fn);
      return api;
    },
    show(player) {
      return showWithRetry(form, player)
        .then((res) => {
          if (res.canceled) return;
          sfx(player, "click");
          const fn = actions[res.selection];
          if (fn) fn();
        })
        .catch((e) => console.warn(`[NPC Studio] menu "${title}" error: ${e}`));
    }
  };
  return api;
}

/**
 * Modal form with named fields. Reads results by name so adding a field never
 * shifts the others. Only input controls are used (no labels) to keep indices stable.
 */
export function modal(title) {
  const form = new ModalFormData().title(title);
  const names = [];
  const api = {
    slider(name, label, min, max, step, def) {
      form.slider(label, min, max, { valueStep: step, defaultValue: clamp(def ?? min, min, max) });
      names.push(name);
      return api;
    },
    toggle(name, label, def) {
      form.toggle(label, { defaultValue: !!def });
      names.push(name);
      return api;
    },
    dropdown(name, label, options, def) {
      form.dropdown(label, options, { defaultValueIndex: clamp(def ?? 0, 0, options.length - 1) });
      names.push(name);
      return api;
    },
    text(name, label, placeholder, def) {
      form.textField(label, placeholder, def !== undefined ? { defaultValue: String(def) } : undefined);
      names.push(name);
      return api;
    },
    submit(text) {
      form.submitButton(text);
      return api;
    },
    show(player, onSubmit, onCancel) {
      return showWithRetry(form, player)
        .then((res) => {
          if (res.canceled) {
            if (onCancel) onCancel();
            return;
          }
          const vals = res.formValues ?? [];
          // Some versions include placeholders for non-input rows — filter them out defensively.
          const inputs = vals.length === names.length ? vals : vals.filter((v) => v !== undefined);
          const out = {};
          names.forEach((n, i) => (out[n] = inputs[i]));
          onSubmit(out);
        })
        .catch((e) => console.warn(`[NPC Studio] modal "${title}" error: ${e}`));
    }
  };
  return api;
}

export function confirm(player, title, body, yesText, onYes, onNo) {
  const form = new MessageFormData().title(title).body(body).button1("Cancel").button2(yesText);
  return showWithRetry(form, player).then((res) => {
    if (!res.canceled && res.selection === 1) onYes();
    else if (onNo) onNo();
  });
}

export function msg(player, text) {
  try {
    player.sendMessage(text);
    // red text = something went wrong (villager "hmm"), green = done
    if (text.startsWith("§c")) sfx(player, "error");
    else if (text.startsWith("§a")) sfx(player, "ok");
  } catch {
    /* player left */
  }
}

export function actionbar(player, text) {
  try {
    player.onScreenDisplay.setActionBar(text);
  } catch {
    /* ignore */
  }
}

export { world, system };
