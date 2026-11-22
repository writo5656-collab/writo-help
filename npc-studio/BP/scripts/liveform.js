/**
 * NPC Studio — liveform.js : the Live Editor, one form that never reloads.
 *
 * The Studio panel is an ActionForm: Minecraft closes it on every tap and the add-on has to open a
 * new one, so the whole screen is built again (that is the "reload"). The Live Editor uses
 * Minecraft's data-driven form (CustomForm + Observables) instead: toggles, sliders and dropdowns
 * write straight into the NPC while the form stays open, and a tab dropdown only shows or hides
 * groups of controls. One tap = one change, no reload.
 * It looks like Minecraft's own settings screens (data-driven forms can't be restyled by packs).
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import * as ui from "@minecraft/server-ui";
import { world, system, msg } from "./core.js";
import { BONES, getRot, setRot, getPos, setPos, getScale, setScale, getAnim, setAnim, readPose, applyPose, mirrorPose, undo, redo, POS_LIMIT } from "./rig.js";
import { undoOnce } from "./live.js";
import { LOOP_ANIMS } from "./poses.js";
import { SKIN_COUNT, MODEL_FIRST, MODEL_COUNT, MOB_FIRST, MOBS, skinPlainName, setSkin, setModel, setMob, partLabel } from "./skins.js";
import { getCape, setCape, isBright, setBright, areOutlinesHidden, setOutlinesHidden } from "./selection.js";
import { CAPE_COUNT, CAPE_LIST } from "./capes.js";
import { isSneaking, setSneak, isOnFire, setOnFire, lookAtPlayer, flip, worldBright, setWorldBright, GAMERULES, ruleOn, setRule } from "./extras.js";
import { GUIDE_STYLES, guideStyle, setGuideStyle, npcsHidden, setNpcsHidden, camerasHidden, setCamerasHidden, nameTagsHidden, setNameTagsHidden } from "./studio.js";

export const hasLiveEditor = () => typeof ui.CustomForm === "function" && typeof ui.ObservableBoolean === "function";
const TABS = ["Display", "Pose", "World", "Camera", "Layers"];
const open = new Map(); // player.id -> form

/** Opens the Live Editor for one NPC. onClose(action) runs after it closes ("panel" = open the Studio panel). */
export function openLiveEditor(player, npc, onClose, startTab = 0, tries = 0) {
  if (!hasLiveEditor()) return false;
  try {
    open.get(player.id)?.close?.();
  } catch {
    /* already closed */
  }
  const form = new ui.CustomForm(player, `NPC Studio · ${npc.nameTag || "NPC"}`);
  open.set(player.id, form);
  let after = null;
  const B = (v) => new ui.ObservableBoolean(!!v, { clientWritable: true });
  const N = (v) => new ui.ObservableNumber(Number(v) || 0, { clientWritable: true });
  const ok = () => npc.isValid;
  let syncing = false; // true while the script itself updates controls (no write-back)
  const watch = (obs, fn) => obs.subscribe((v) => {
    if (syncing || !ok()) return;
    try {
      fn(v);
    } catch (e) {
      console.warn(`[NPC Studio] live editor: ${e}`);
    }
  });
  const v3 = (obs) => /** @type {[number, number, number]} */ ([obs[0].getData(), obs[1].getData(), obs[2].getData()]);
  const items = (labels) => labels.map((label, value) => ({ label: String(label), value }));

  // ---------- tabs ----------
  const tab = N(startTab);
  const shown = TABS.map((_, i) => new ui.ObservableBoolean(i === startTab));
  tab.subscribe((t) => shown.forEach((o, i) => o.setData(i === t)));
  form.dropdown("Tab", tab, items(TABS));
  const sec = (i) => ({ visible: shown[i] });

  // ---------- Display ----------
  const D = sec(0);
  const skinNames = [...Array(SKIN_COUNT).keys()].map(skinPlainName)
    .concat([...Array(MODEL_COUNT).keys()].map((n) => `3D: ${skinPlainName(MODEL_FIRST + n)}`))
    .concat(MOBS.map((m) => `Mob: ${m.name}`)); // dropdown value = skin_index (0-31 skins, 32-41 models, 42+ mobs)
  const skin = N(npc.getProperty("npcstudio:skin_index") ?? 0);
  form.header("Model", D);
  form.dropdown("Skin", skin, items(skinNames), D);
  watch(skin, (i) => (i >= MOB_FIRST ? setMob(npc, i - MOB_FIRST) : i >= MODEL_FIRST ? setModel(npc, i - MODEL_FIRST + 1) : setSkin(npc, i)));
  const slim = B(npc.getProperty("npcstudio:slim"));
  form.toggle("Slim arms", slim, D);
  watch(slim, (v) => npc.setProperty("npcstudio:slim", v));
  const cape = N(getCape(npc));
  form.dropdown("Cloak", cape, items(CAPE_LIST.slice(0, CAPE_COUNT).map((n, i) => n ?? `Your cape ${i - 8}`)), D);
  watch(cape, (c) => setCape(npc, c));
  const anim = N(getAnim(npc));
  form.dropdown("Animation", anim, items(["Idle", ...LOOP_ANIMS]), D);
  watch(anim, (a) => setAnim(npc, a));
  const sneak = B(isSneaking(npc));
  form.toggle("Sneak", sneak, D);
  watch(sneak, (v) => setSneak(npc, v));
  const fire = B(isOnFire(npc));
  form.toggle("On Fire", fire, D);
  watch(fire, (v) => setOnFire(npc, v));
  const bright = B(isBright(npc));
  form.toggle("NPC Bright", bright, D);
  watch(bright, (v) => setBright(npc, v));
  const outline = B(!areOutlinesHidden());
  form.toggle("Show outline", outline, D);
  watch(outline, (v) => setOutlinesHidden(!v));
  form.header("Transform", D);
  const rootRot = getRot(npc, "root");
  const rot = [0, 1, 2].map((i) => N(Math.round(rootRot[i])));
  ["Rotation X", "Rotation Y", "Rotation Z"].forEach((label, i) => {
    form.slider(label, rot[i], -180, 180, { step: 3, ...D });
    watch(rot[i], () => {
      undoOnce(npc);
      setRot(npc, "root", v3(rot));
    });
  });
  const scale = N(Math.round(getScale(npc) * 100));
  form.slider("Scale (%)", scale, 10, 500, { step: 5, ...D });
  watch(scale, (v) => (undoOnce(npc), setScale(npc, v / 100)));
  form.button("Look at me", () => ok() && lookAtPlayer(npc, player), D);
  form.button("Flip (turn around)", () => ok() && flip(npc), D);

  // ---------- Pose ----------
  const P = sec(1);
  const part = N(0);
  const pr = [N(0), N(0), N(0)], pp = [N(0), N(0), N(0)];
  const loadPart = () => {
    syncing = true;
    const key = BONES[part.getData()].key, r = getRot(npc, key), p = getPos(npc, key);
    pr.forEach((o, i) => o.setData(Math.round(r[i])));
    pp.forEach((o, i) => o.setData(p[i]));
    syncing = false;
  };
  form.dropdown("Body part", part, items(BONES.map((b) => partLabel(npc, b.key, b.label))), P);
  part.subscribe(() => ok() && loadPart());
  ["Tilt (X)", "Turn (Y)", "Roll (Z)"].forEach((label, i) => {
    form.slider(label, pr[i], -180, 180, { step: 1, ...P });
    watch(pr[i], () => (undoOnce(npc), setRot(npc, BONES[part.getData()].key, v3(pr))));
  });
  ["Move X", "Move Y", "Move Z"].forEach((label, i) => {
    form.slider(label, pp[i], -POS_LIMIT, POS_LIMIT, { step: 0.25, ...P });
    watch(pp[i], () => (undoOnce(npc), setPos(npc, BONES[part.getData()].key, v3(pp))));
  });
  const refreshAll = () => {
    loadPart();
    syncing = true;
    const r = getRot(npc, "root");
    rot.forEach((o, i) => o.setData(Math.round(r[i])));
    scale.setData(Math.round(getScale(npc) * 100));
    syncing = false;
  };
  form.button("Reset this part", () => {
    if (!ok()) return;
    undoOnce(npc);
    const key = BONES[part.getData()].key;
    setRot(npc, key, [0, 0, 0]);
    setPos(npc, key, [0, 0, 0]);
    loadPart();
  }, P);
  form.button("Mirror pose", () => ok() && (undoOnce(npc), applyPose(npc, mirrorPose(readPose(npc))), refreshAll()), P);
  form.button("Undo", () => ok() && (undo(npc), refreshAll()), P);
  form.button("Redo", () => ok() && (redo(npc), refreshAll()), P);
  form.button("Pose Mode (gizmo)", () => ((after = "gizmo"), form.close()), P);
  loadPart();

  // ---------- World ----------
  const W = sec(2);
  const time = N(Math.round(world.getTimeOfDay() / 500) * 500);
  form.slider("Time", time, 0, 23500, { step: 500, ...W });
  watch(time, (t) => world.setTimeOfDay(t));
  const weather = N(0);
  form.dropdown("Weather", weather, items(["Clear", "Rain", "Thunder"]), W);
  watch(weather, (w) => player.dimension.runCommand(`weather ${["clear", "rain", "thunder"][w]}`));
  const wb = B(worldBright(player));
  form.toggle("World Bright", wb, W);
  watch(wb, (v) => setWorldBright(player, v));
  form.header("Gamerules", W);
  for (const [label, name] of GAMERULES) {
    const o = B(ruleOn(name));
    form.toggle(label, o, W);
    watch(o, (v) => setRule(player, name, v));
  }

  // ---------- Camera ----------
  const C = sec(3);
  const guide = N(guideStyle(player));
  form.dropdown("Guide", guide, items(GUIDE_STYLES), C);
  watch(guide, (g) => setGuideStyle(player, g));
  form.button("Place camera here", () => ((after = "camera"), form.close()), C);
  form.button("Preview", () => ((after = "peek"), form.close()), C);

  // ---------- Layers ----------
  const L = sec(4);
  const layers = [
    { label: "NPCs", get: npcsHidden, set: setNpcsHidden },
    { label: "Cameras", get: camerasHidden, set: setCamerasHidden },
    { label: "Name tags", get: nameTagsHidden, set: setNameTagsHidden }
  ];
  for (const l of layers) {
    const o = B(!l.get(player));
    form.toggle(`Show ${l.label}`, o, L);
    watch(o, (v) => l.set(player, !v));
  }

  form.divider();
  form.button("Open the Studio panel", () => ((after = "panel"), form.close()));
  form.closeButton();
  form
    .show()
    .then((reason) => {
      if (open.get(player.id) === form) open.delete(player.id);
      if (reason === "UserBusy" && tries < 40) return void system.runTimeout(() => openLiveEditor(player, npc, onClose, tab.getData(), tries + 1), 2);
      system.runTimeout(() => onClose?.(after), 2); // a new form can't open in the tick this one closed
    })
    .catch((e) => {
      console.warn(`[NPC Studio] live editor closed: ${e}`);
      onClose?.(after);
    });
  return true;
}

export function closeLiveEditor(player) {
  try {
    open.get(player.id)?.close();
  } catch {
    /* not open */
  }
}
export const liveEditorOpen = (player) => !!open.get(player.id)?.isShowing?.();
