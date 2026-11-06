/**
 * NPC Studio — core.js (shared constants + helpers)
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system, InputPermissionCategory } from "@minecraft/server";
import { ActionFormData, ModalFormData, MessageFormData } from "@minecraft/server-ui";

export const NPC_ID = "npcstudio:npc";
export const NPC_FAMILY = "npcstudio_npc";
export const WAND_ID = "npcstudio:wand";
export const CAMERA_ID = "npcstudio:camera_marker";
export const CAMERA_TOOL_ID = "npcstudio:camera_tool";
export const MOB_TOOL_ID = "npcstudio:mob_tool";
export const MOB_TAG = "npcstudio_mob";
export const HANDBOOK_ID = "npcstudio:handbook";
export const MONITOR_ID = "npcstudio:monitor";
export const STAMP_ID = "npcstudio:stamp";
export const ROTATOR_ID = "npcstudio:rotator";
export const TELEPORTER_ID = "npcstudio:teleporter";
export const TOOL_IDS = [WAND_ID, CAMERA_TOOL_ID, MOB_TOOL_ID, HANDBOOK_ID, MONITOR_ID, STAMP_ID, ROTATOR_ID, TELEPORTER_ID];
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
// Button labels: just the name. V3 panel: light text on dark buttons, so most colour codes are
// removed; §b (cyan) = active / on, §c (red) = delete. §a (green, "active" in V2) becomes cyan.
// Descriptions ("\n..." lines, "§8(...)" hints, trailing "(...)") are removed: the Handbook explains features.
export function cleanLabel(text) {
  if (typeof text !== "string") return text; // translated/raw labels (skin names)
  let t = text.split("\n")[0].replace(/§r/g, "");
  t = t.replace(/\s+(§[0-9a-fl])*§8.*$/, ""); // "Name §8(hint)"
  t = t.replace(/\s*\([^)]*\)\s*$/, ""); // "Name (hint)"
  t = t.replace(/§a/g, "§b").replace(/§([^bcl])/g, "");
  return t.trim();
}

// V3.2 editor: every NPC Studio menu uses one fixed button layout that RP/ui/server_form.json draws
// like the website editor (tools/make_ui.py):
//   0-5 tabs · 6-29 NPC heads (right rail, scrolls) · 30-37 bottom tools · 38+ rows, 4 buttons per row
// Each row is [main, a, b, c]. An empty label hides a slot. The tag at the start of a label picks the look.
// Every look has ONE tag of its own, because Bedrock's UI gets long and/or conditions wrong:
//   main: §o§r button row · §j§r§h§r open section · §j§r§i§r folded section · §e§r slot tile
//         §q§r + §w§r checkbox · §f§r field · §s§r slider (icon = track picture) · §t§r stepper
//   a:    §k§r small button left of the control column (minus / previous) · §e§r tile
//   b:    §p§r small button (plus) · §y§r wide value box (stepper) · §e§r tile
//   c:    §v§r value box · §m§r small button (next) · §z§r "Choose" button (field) · §e§r tile
const EDITOR_TAG = "§n§p§s§r";
export const TAB_MARK = "§u§r";
const PLAIN = "§o§r", HDR_OPEN = "§j§r§h§r", HDR_SHUT = "§j§r§i§r", TILE = "§e§r";
const CHECK = "§q§r§w§r", FIELD = "§q§r§f§r", SLIDE = "§q§r§s§r", STEP = "§q§r§t§r";
const A_SMALL = "§k§r", B_SMALL = "§p§r", B_WIDE = "§y§r", C_VALUE = "§v§r", C_SMALL = "§m§r", C_CHOOSE = "§z§r";
const RAIL_N = 24, BAR_N = 8, ROW_N = 48; // + button 38 = hide / show the panel; rows start at 39
// Body tags (the body is a global binding, so the UI can read them anywhere):
//   §g§r  thirds grid over the free space      §x§r  panel hidden (only the › handle, grid, hint)
const GRID_TAG = "§g§r", MINI_TAG = "§x§r";
// Slot tiles are off until the in-game crash is found (rows are used instead): RP layout flag NPCS_TILES
const TILES = false;
export const CHECKBOX = (on) => ICON(on ? "check_on" : "check_off");
export const SWITCH = CHECKBOX;
const TRACK = (frac) => `textures/ui/npcstudio/slider/s${String(clamp(Math.round(frac * 20), 0, 20)).padStart(2, "0")}`;

/** panel.js fills these in: default tabs, the NPC heads on the right and the bottom tools. */
const hooks = { tabs: (_player) => null, rail: (_player) => [], bar: (_player) => [], grid: (_player) => false };
export function setEditorHooks(h) {
  Object.assign(hooks, h);
}

const folded = new Map(); // player.id -> Set(section ids)
function isFolded(player, id) {
  return folded.get(player.id)?.has(id) ?? false;
}
function toggleFold(player, id) {
  let s = folded.get(player.id);
  if (!s) folded.set(player.id, (s = new Set()));
  if (s.has(id)) s.delete(id);
  else s.add(id);
}

// ---------- free look: while the Studio panel is open you can turn your view in the free space on the
// right (the menu screen lets touches through, RP/ui/server_form.json) but not walk, jump, break,
// place or hit. Tapping an NPC there selects it (viewport.js). ----------
const editing = new Set(); // player ids with the Studio panel open
const lockedByEditor = new Map(); // player.id -> categories we switched off
const LOCK_CATS = [InputPermissionCategory.LateralMovement, InputPermissionCategory.Jump, InputPermissionCategory.Sneak];
export function isEditing(player) {
  return editing.has(player.id);
}
const LOCK_INPUT = false; // free look is off until the panel works in game (it only matters with free look)
export function editorLock(player, on) {
  if (on) editing.add(player.id);
  else editing.delete(player.id);
  if (!LOCK_INPUT) return;
  try {
    const perms = player.inputPermissions;
    if (on) {
      if (lockedByEditor.has(player.id)) return;
      // only switch off what is on now, so Pose Mode / camera view keep their own locks
      const cats = LOCK_CATS.filter((c) => perms.isPermissionCategoryEnabled(c));
      cats.forEach((c) => perms.setPermissionCategory(c, false));
      lockedByEditor.set(player.id, cats);
    } else {
      const cats = lockedByEditor.get(player.id) ?? [];
      lockedByEditor.delete(player.id);
      cats.forEach((c) => perms.setPermissionCategory(c, true));
    }
  } catch {
    /* player left */
  }
}

/** Marks a button action that keeps the player on the same screen (no onLeave). */
export function keep(fn) {
  fn.stay = true;
  return fn;
}

/** Numbers on value boxes: whole numbers stay whole, others get up to 2 decimals. */
export function fmtNum(v) {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
}

/**
 * menu(title, body)
 *   .section(id, title, icon)              foldable section header; rows after it belong to it
 *   .btn(text, icon, fn)                   button row
 *   .field(label, value, icon, fn)         caption + "Choose" button showing the value
 *   .toggle(text, on, fn)                  caption + checkbox
 *   .slider(label, value, opts, set)       caption, -, track, +, value box; opts {min,max,step,unit}
 *   .cycle(label, value, step)             caption, <, value, >; step(dir) with dir = -1 / +1
 *   .reopen(fn)                            how to redraw after a slider / cycle tap (default: show again)
 *   .onLeave(fn)                           runs when the player leaves this screen (close, or any other button)
 *   .tabs(names, active, onTab) · .back(fn) · .grid() (kept for old callers) · .show(player)
 * Sliders and steppers redraw the same screen at once, so the NPC changes in the world while the
 * panel stays open on the left.
 */
/** The panel tucked away: only a › handle on the left, the thirds grid and a hint. */
function showMini(player, reopen) {
  const form = new ActionFormData().title(EDITOR_TAG + "Studio").body(MINI_TAG + GRID_TAG + "Panel hidden");
  for (let i = 0; i < 38; i++) form.button("");
  form.button(" ", ICON("next"));
  editorLock(player, true);
  showWithRetry(form, player)
    .then((res) => {
      editorLock(player, false);
      if (!res.canceled && res.selection === 38) {
        sfx(player, "click");
        reopen();
      }
    })
    .catch((e) => {
      editorLock(player, false);
      console.warn(`[NPC Studio] hidden panel: ${e}`);
    });
}

export function menu(title, body) {
  const rows = []; // {kind, text, icon, fn, sec, a, b, c}
  let section = null;
  let ownTabs = null;
  let page = 0;
  let redraw = null;
  let leave = null;
  const api = {
    grid() {
      return api;
    },
    tabs(names, active, onTab) {
      ownTabs = { names, active, onTab };
      return api;
    },
    reopen(fn) {
      redraw = fn;
      return api;
    },
    onLeave(fn) {
      leave = fn;
      return api;
    },
    section(id, text, icon) {
      section = id;
      rows.push({ kind: "hdr", id, text, icon });
      return api;
    },
    btn(text, icon, fn) {
      const label = cleanLabel(text);
      // translated labels (skin names) are RawMessages: put the tag in front as plain text
      const tagged = typeof label === "string" ? PLAIN + (label || " ") : { rawtext: [{ text: PLAIN }, label] };
      rows.push({ kind: "row", text: tagged, icon, fn, sec: section });
      return api;
    },
    /** Up to 4 square tiles in one row: [{ icon, on, fn }] (inventory slots). */
    tiles(items) {
      if (!TILES) {
        for (const it of items) api.btn(`${it.label ?? "Slot"}${it.on ? " §b(worn)" : ""}`, it.icon, it.fn);
        return api;
      }
      const t = items.slice(0, 4).map((it) => ({ text: TILE + (it.on ? "§b" : "") + (it.label ?? "slot"), icon: it.icon, fn: it.fn }));
      rows.push({ kind: "row", ...t[0], sec: section, a: t[1], b: t[2], c: t[3] });
      return api;
    },
    field(label, value, _icon, fn) {
      const v = String(value).replace(/§./g, "") || "None";
      rows.push({ kind: "row", text: FIELD + label, fn, sec: section, c: { text: C_CHOOSE + v, fn } });
      return api;
    },
    toggle(text, on, fn) {
      rows.push({ kind: "row", text: CHECK + (on ? "§b" : "") + cleanLabel(text).replace(/^§b/, ""), icon: CHECKBOX(on), fn, sec: section });
      return api;
    },
    slider(label, value, opts, set) {
      const { min, max, step, unit = "" } = opts;
      const v = clamp(value, min, max);
      const to = (n) => keep(() => stay(() => set(clamp(Math.round(n / step) * step, min, max))));
      const exact = keep(() =>
        modal(label)
          .text("v", `${label} (${fmtNum(min)} to ${fmtNum(max)})`, fmtNum(v), fmtNum(v))
          .show(lastPlayer, ({ v: t }) => {
            const n = parseFloat(String(t ?? "").replace(",", "."));
            if (Number.isFinite(n)) set(clamp(n, min, max));
            again();
          }, again));
      rows.push({
        kind: "row", text: SLIDE + label, icon: TRACK((v - min) / (max - min || 1)), fn: exact, sec: section,
        a: { text: A_SMALL + " ", icon: ICON("dec"), fn: to(v - step) },
        b: { text: B_SMALL + " ", icon: ICON("inc"), fn: to(v + step) },
        c: { text: C_VALUE + fmtNum(v) + unit, fn: exact }
      });
      return api;
    },
    cycle(label, value, step) {
      const go = (d) => keep(() => stay(() => step(d)));
      rows.push({
        kind: "row", text: STEP + label, fn: go(1), sec: section,
        a: { text: A_SMALL + " ", icon: ICON("prev"), fn: go(-1) },
        b: { text: B_WIDE + (String(value).replace(/§./g, "") || "None"), fn: go(1) },
        c: { text: C_SMALL + " ", icon: ICON("next"), fn: go(1) }
      });
      return api;
    },
    back(fn) {
      section = null;
      rows.push({ kind: "row", text: PLAIN + "Back", icon: ICON("back"), fn, sec: null });
      return api;
    },
    show(player) {
      lastPlayer = player;
      const form = new ActionFormData().title(EDITOR_TAG + title);
      const grid = !!hooks.grid(player);
      if (body || grid) form.body((grid ? GRID_TAG : "") + (body ?? ""));
      const actions = [];
      const add = (label, icon, fn) => {
        if (icon) form.button(label, icon);
        else form.button(label);
        actions.push(fn);
      };
      const slot = (s) => add(s ? s.text : "", s?.icon, s?.fn);
      // 0-5 tabs
      const t = ownTabs ?? hooks.tabs(player);
      for (let i = 0; i < 6; i++) {
        const name = t?.names?.[i];
        add(name ? `${TAB_MARK}${i === t.active ? "§b" : ""}${name}` : "", undefined, name ? () => t.onTab(i) : undefined);
      }
      // 6-29 NPC heads, 30-37 tools
      const rail = hooks.rail(player) ?? [];
      for (let i = 0; i < RAIL_N; i++) add(rail[i] ? rail[i].label || " " : "", rail[i]?.icon, rail[i]?.fn);
      const bar = hooks.bar(player) ?? [];
      for (let i = 0; i < BAR_N; i++) add(bar[i] ? bar[i].label || " " : "", bar[i]?.icon, bar[i]?.fn);
      // 38 hide the panel (see the whole view), the › handle brings it back
      add(" ", ICON("prev"), keep(() => showMini(player, again)));
      // 39+ rows, 4 buttons each (folded sections hide their rows)
      const visible = rows.filter((r) => r.kind === "hdr" || !r.sec || !isFolded(player, r.sec));
      const per = ROW_N - 2;
      const pages = Math.max(1, Math.ceil(visible.length / per));
      page = Math.min(page, pages - 1);
      const slice = visible.slice(page * per, page * per + per);
      const row = (r) => {
        slot(r);
        slot(r.a);
        slot(r.b);
        slot(r.c);
      };
      if (page > 0) row({ text: PLAIN + "Previous page", icon: ICON("back"), fn: keep(() => stay(() => (page -= 1), true)) });
      for (const r of slice) {
        if (r.kind === "hdr") {
          const shut = isFolded(player, r.id);
          row({ text: `${shut ? HDR_SHUT : HDR_OPEN}${r.text}`, icon: r.icon, fn: keep(() => stay(() => toggleFold(player, r.id), true)) });
        } else row({ ...r, text: r.text || PLAIN + " " });
      }
      if (page < pages - 1) row({ text: PLAIN + "Next page", icon: ICON("play"), fn: keep(() => stay(() => (page += 1), true)) });
      editorLock(player, true);
      return showWithRetry(form, player)
        .then((res) => {
          editorLock(player, false); // before the action, so Pose Mode / camera view can set their own locks
          if (res.canceled) {
            if (res.cancelationReason !== "UserBusy") runLeave();
            return;
          }
          const fn = actions[res.selection];
          if (!fn) return runLeave();
          sfx(player, "click");
          if (!fn.stay) runLeave();
          fn();
        })
        .catch((e) => {
          editorLock(player, false);
          console.warn(`[NPC Studio] menu "${title}" error: ${e}`);
        });
    }
  };
  // slider / stepper / fold taps stay on this screen; everything else leaves it
  let lastPlayer = null;
  function again() {
    if (!lastPlayer) return;
    if (redraw) redraw();
    else api.show(lastPlayer);
  }
  function stay(change, sameMenu = false) {
    try {
      change();
    } catch (e) {
      console.warn(`[NPC Studio] ${title}: ${e}`);
    }
    if (sameMenu) api.show(lastPlayer);
    else again();
  }
  function runLeave() {
    const fn = leave;
    leave = null;
    try {
      fn?.();
    } catch (e) {
      console.warn(`[NPC Studio] ${title} leave: ${e}`);
    }
  }
  return api;
}

/**
 * Modal form with named fields. Reads results by name so adding a field never
 * shifts the others. Only input controls are used (no labels) to keep indices stable.
 */
export function modal(title) {
  // the editor tag puts this form in the dark left panel too (RP/ui/server_form.json, npcs_custom)
  const form = new ModalFormData().title(EDITOR_TAG + title);
  const names = [];
  let submitText = null;
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
      submitText = text;
      form.submitButton(text);
      return api;
    },
    show(player, onSubmit, onCancel) {
      if (!submitText) form.submitButton("Apply");
      editorLock(player, true);
      return showWithRetry(form, player)
        .then((res) => {
          editorLock(player, false);
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
        .catch((e) => {
          editorLock(player, false);
          console.warn(`[NPC Studio] modal "${title}" error: ${e}`);
        });
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

/**
 * Small readout in the top-right corner (transparent, no background). Uses a title that starts
 * with "npcs:" — RP/ui/hud_screen.json hides those from the middle of the screen and shows them
 * in the corner instead.
 */
const cornerCache = new Map();
export function corner(player, text) {
  if (cornerCache.get(player.id) === text) return;
  cornerCache.set(player.id, text);
  try {
    player.onScreenDisplay.setTitle(`npcs:${text}`, { fadeInDuration: 0, stayDuration: 2000000, fadeOutDuration: 0 });
  } catch {
    /* ignore */
  }
}
export function clearCorner(player) {
  cornerCache.delete(player.id);
  try {
    player.onScreenDisplay.setTitle("npcs:", { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
    player.onScreenDisplay.clearTitle();
  } catch {
    /* ignore */
  }
}

export { world, system };
