/**
 * NPC Studio V3.1 — panel.js : the Studio editor (website layout).
 *   Display · Pose · Presets · World · Camera · Layers
 * Opened by the Director's Baton, tapping an NPC, /npcstudio:npc. Checkboxes flip in one tap; sliders and
 * steppers (- / +) change the NPC right away and redraw the panel, so the world stays in view.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { VERSION } from "./version.js";
import { inCinema } from "./cinema.js";
import { itemStateRow } from "./itemstate.js";
import {
  isSneaking, setSneak, isLiving, setLiving, lookAtPlayer, flip, isOnFire, setOnFire, worldBright, setWorldBright, GAMERULES, ruleOn, setRule
} from "./extras.js";
import { menu, modal, msg, confirm, ICON, npcLabel, npcsNear, isLocked, setEditorHooks, NPC_FAMILY } from "./core.js";
import { getAnim, readPose, applyPose, mirrorPose, pushUndo, undo, redo, historySize } from "./rig.js";
import { LOOP_ANIMS } from "./poses.js";
import { pickSkin, setSkin, skinPlainName, npcHead } from "./skins.js";
import { openWardrobe, openSlotMenu, getEquip, equipIcon, SLOTS } from "./wardrobe.js";
import { openPoseEditor, openPoseLibrary, openLoopAnims, startGizmo, poseWalkOn, setPoseWalk } from "./poseEditor.js";
import { openAnimator, playAllTimelines, stopAllTimelines } from "./animator.js";
import { openShotsMenu } from "./shots.js";
import { openRideMenu, isMounted } from "./mount.js";
import { openMobToolMenu } from "./mobs.js";
import { openHandbook } from "./handbook.js";
import {
  cloneNpc, savePreset, openSpawnMenu, openPresetsMenu, openBulkMenu, openMoveMenu, pickNpc, getLookedAtNPC, setLookAtPlayers, isLooking
} from "./npc.js";
import { placeCameraAtView, openCameraPanel, flyCam, allCameras, getSelectedCamera, openLiveCamera, exitView, isViewing } from "./camera.js";
import {
  select, selectMany, clearSelection, getSelection, isBright, setBright, getCape, setCape, CAPE_NAMES, isProp, areOutlinesHidden, setOutlinesHidden,
  getOutlineLook, setOutlineLook, THICKNESS, OUTLINE_STYLES, refreshOutline
} from "./selection.js";
import { poseRows, resetPart, transformRows, trimPage, timeRows, fogRows, setPoseBone } from "./live.js";
import {
  peek, photoMode, layerShot, placeBackdrop, removeBackdrop, getBackdrop, BACKDROP_COLORS, npcsHidden, setNpcsHidden,
  camerasHidden, setCamerasHidden, nameTagsHidden, setNameTagsHidden, guidesOn, setGuides, guideStyle, setGuideStyle, GUIDE_STYLES,
  depthOn, setDepth, depthStart, depthLength, setDepthStart, setDepthLength, DEPTH_STARTS, DEPTH_LENGTHS, chunks,
  HAZE_LEVELS, hazeLevel, setHazeLevel
} from "./studio.js";
import { openPropMenu, openParticleMenu, openCrowdMenu, openScenesMenu, openToolsMenu, openStudioRules } from "./props.js";

export const TABS = ["Display", "Pose", "Presets", "World", "Camera", "Layers"];
const lastTab = new Map(); // player.id -> tab

/** The NPC the editor works on: your selection, else the one you look at. */
function currentNpc(player) {
  const sel = getSelection(player);
  if (sel.length) return sel[0];
  const looked = getLookedAtNPC(player);
  if (looked) select(player, looked);
  return looked;
}

// ---------- the parts every editor screen shares: tabs, NPC heads, bottom tools ----------
setEditorHooks({
  grid: (player) => guideStyle(player),
  // camera view, Preview, Photo Mode and Depth map hide the HUD themselves: leave it to them
  hudBusy: (player) => inCinema(player) || depthOn(player),
  tabs: (player) => ({ names: TABS, active: lastTab.get(player.id) ?? 0, onTab: (i) => openStudio(player, i) }),
  rail: (player) => {
    const cur = getSelection(player)[0];
    const near = npcsNear(player, 48)
      .filter((n) => n.id !== cur?.id)
      .sort((a, b) => dist(player, a) - dist(player, b))
      .slice(0, cur ? 16 : 17);
    const list = cur?.isValid ? [cur, ...near] : near;
    // Spawn sits first so it never moves when the list grows; the rail scrolls
    const slots = [{ label: "Spawn", icon: ICON("plus"), fn: () => openSpawnMenu(player, () => openStudio(player)) }];
    for (const n of list) slots.push({
      label: (n.id === cur?.id ? "§b" : "") + npcLabel(n),
      icon: npcHead(n),
      fn: () => {
        select(player, n);
        openStudio(player, lastTab.get(player.id) === 1 ? 1 : 0);
      }
    });
    // cameras share the strip, like in the Java editor
    const selCam = getSelectedCamera(player);
    for (const c of allCameras(player).slice(0, 6)) slots.push({
      label: (selCam?.id === c.id ? "§b" : "") + (c.nameTag || "Camera"),
      icon: ICON("camera"),
      fn: () => openCameraPanel(player, c)
    });
    return slots;
  },
  bar: (player) => {
    const npc = () => getSelection(player)[0];
    const need = (fn) => () => {
      const n = npc();
      if (!n?.isValid) return msg(player, "§cSelect an NPC first (tap one with the Baton, or a head on the right).");
      fn(n);
    };
    return [
      { label: "Pose Mode", icon: ICON("gizmo"), fn: need((n) => startGizmo(player, n, () => openStudio(player, 1))) },
      { label: "Place Camera", icon: ICON("camera"), fn: () => placeCameraAtView(player) },
      { label: "Preview", icon: ICON("monitor"), fn: () => peek(player) },
      { label: "Photo Mode", icon: ICON("photo"), fn: () => photoMode(player) },
      { label: "Undo", icon: ICON("undo"), fn: need((n) => (undo(n), openStudio(player))) },
      { label: "Redo", icon: ICON("redo"), fn: need((n) => (redo(n), openStudio(player))) },
      { label: "Save", icon: ICON("save"), fn: need((n) => savePrompt(player, n)) },
      { label: "Delete", icon: ICON("delete"), fn: need((n) => deleteNpc(player, n, () => openStudio(player))) }
    ];
  }
});

const dist = (p, n) => Math.hypot(n.location.x - p.location.x, n.location.z - p.location.z);

export function openStudio(player, tab) {
  if (tab === undefined) tab = lastTab.get(player.id) ?? 0;
  lastTab.set(player.id, tab);
  const npc = currentNpc(player);
  if (npc) refreshOutline(npc);
  const self = () => openStudio(player, tab);
  const sel = getSelection(player).length;
  const body = npc
    ? `§7Editing §f${npcLabel(npc)}${sel > 1 ? `§7 +${sel - 1} more` : ""}${isLocked(npc) ? " §c(locked)" : ""}`
    : "§7No NPC selected. Tap an NPC with the Baton, or a head on the right.";
  const bodyV = `${body} §8v${VERSION}`;
  const m = menu("NPC Studio", bodyV).reopen(self);
  if (npc && isLocked(npc) && (tab === 0 || tab === 1)) {
    m.btn("Unlock This NPC", ICON("lock"), () => {
      npc.setProperty("npcstudio:locked", false);
      self();
    });
    return m.show(player);
  }
  [displayTab, poseTab, presetsTab, worldTab, cameraTab, layersTab][tab](player, m, npc, self);
  m.show(player);
}

/** Opening on an NPC (Baton tap): select it and show Display (or Pose if you were posing). */
export function openStudioFor(player, npc) {
  select(player, npc);
  const t = lastTab.get(player.id);
  openStudio(player, t === 1 ? 1 : 0);
}

function pickAndSelect(player, back) {
  pickNpc(player, "Pick an NPC", (n) => {
    select(player, n);
    back();
  }, back);
}

function noNpc(m, player, self) {
  m.section("start", "Get started", ICON("spawn"));
  m.btn("Spawn NPC", ICON("spawn"), () => openSpawnMenu(player, self));
  m.btn("Pick An NPC", ICON("manage"), () => pickAndSelect(player, self));
  m.btn("Handbook", ICON("debug"), () => openHandbook(player, self));
}

function savePrompt(player, npc) {
  modal("Save Preset").text("n", "Preset name", "knight_guard").show(player, ({ n }) => {
    n = String(n ?? "").trim().slice(0, 40);
    if (n) savePreset(player, npc, n);
    openStudio(player);
  }, () => openStudio(player));
}

function deleteNpc(player, npc, back) {
  confirm(player, "Delete?", `Delete ${npcLabel(npc)}? This can't be undone.`, "Delete", () => {
    npc.remove();
    msg(player, "§aDeleted.");
    back();
  }, back);
}

// =====================================================================================
// Display
// =====================================================================================
function displayTab(player, m, npc, self) {
  if (!npc) return noNpc(m, player, self);
  if (isProp(npc)) {
    m.section("prop", "Prop", ICON("prop"));
    transformRows(m, npc);
    m.btn("Turn The Prop", ICON("turn"), () => (setPoseBone(player, "right_arm"), openStudio(player, 1)));
    m.btn("Move / Turn", ICON("move"), () => openMoveMenu(player, npc, self));
    m.btn("Clone", ICON("clone"), () => (cloneNpc(player, npc), self()));
    return;
  }
  // Same order as the Java editor's Display tab: Model settings, Inventory, Transform
  const slim = !!npc.getProperty("npcstudio:slim");
  const anim = getAnim(npc);
  const cape = getCape(npc);
  const setSlim = (v) => () => npc.setProperty("npcstudio:slim", v);
  m.section("model", "Model settings", ICON("skin"));
  m.trio("Model", [
    { text: "Classic", on: !slim, fn: setSlim(false), stay: true },
    { text: "Slim", on: slim, fn: setSlim(true), stay: true },
    { text: "Mobs", fn: () => openMobToolMenu(player, self) }
  ]);
  m.field("Skin", skinPlainName(npc.getProperty("npcstudio:skin_index") ?? 0), npcHead(npc), () =>
    pickSkin(player, "Choose Skin", (i) => (setSkin(npc, i), self()), self),
    () => setSkin(npc, 0)
  );
  m.cycle("Cloak", cape ? CAPE_NAMES[cape - 1] : "None", (d) => setCape(npc, (cape + d + 9) % 9));
  m.field("Nametag", npc.getDynamicProperty("npcstudio:real_name") !== undefined ? "Hidden" : npcLabel(npc), ICON("nametag"), () => openNameTag(player, npc, self));
  m.toggle("Sneak", isSneaking(npc), () => (setSneak(npc, !isSneaking(npc)), self()));
  m.toggle("Living", isLiving(npc), () => (setLiving(npc, !isLiving(npc)), self()));
  m.field("Animation", anim ? LOOP_ANIMS[anim - 1] : "Idle", ICON("animate"), () => openLoopAnims(player, npc, self));

  m.section("inv", "Inventory", ICON("equip"));
  const slot = (def) => ({ label: def.key, icon: equipIcon(npc, def.key), on: !!getEquip(npc, def.key), fn: () => openSlotMenu(player, npc, def.key, self) });
  m.tiles(SLOTS.map(slot), "Slots");
  itemStateRow(m, npc); // bow pull, crossbow charge, trident raise, shield block...
  m.btn("Wardrobe", ICON("equip"), () => openWardrobe(player, npc, self));
  m.btn("Trim Studio", ICON("trim"), () => trimPage(player, npc, self));

  m.section("tr", "Transform", ICON("move"));
  const at = npc.location;
  const move = () => openMoveMenu(player, npc, self);
  m.trio("Position", [at.x, at.y, at.z].map((v) => ({ text: (Math.round(v * 10) / 10).toFixed(1), fn: move })));
  transformRows(m, npc);
  m.trio("Look", [
    { text: "At me", fn: () => lookAtPlayer(npc, player), stay: true },
    { text: "Head", on: isLooking(npc), fn: () => setLookAtPlayers(npc, !isLooking(npc)), stay: true },
    { text: "Flip", fn: () => flip(npc), stay: true }
  ]);

  m.section("fx", "Effects", ICON("bright"));
  m.toggle("NPC Bright", isBright(npc), () => (setBright(npc, !isBright(npc)), self()));
  m.toggle("On Fire", isOnFire(npc), () => (setOnFire(npc, !isOnFire(npc)), self()));

  const look = getOutlineLook();
  m.section("ol", "Outline", ICON("outline"));
  m.toggle("Show outline", !areOutlinesHidden(), () => (setOutlinesHidden(!areOutlinesHidden()), self()));
  m.choices("Thickness", THICKNESS, look.thick, (i) => setOutlineLook({ thick: i }));
  m.choices("Style", OUTLINE_STYLES, look.style, (i) => setOutlineLook({ style: i }));

  m.section("more", "More", ICON("manage"));
  m.btn("Animator", ICON("record"), () => openAnimator(player, npc, self));
  m.btn(isMounted(npc) ? "§bRiding" : "Ride A Mob", ICON("ride"), () => openRideMenu(player, npc, self));
  m.btn("Cine Shot", ICON("film"), () => openShotsMenu(player, self, npc));
  m.btn("Clone", ICON("clone"), () => (cloneNpc(player, npc), self()));
  m.btn("Lock", ICON("lock"), () => {
    npc.setProperty("npcstudio:locked", true);
    msg(player, "§aLocked.");
    self();
  });
}

const TAG_COLORS = [["White", "§f"], ["Cyan", "§b"], ["Gold", "§6"], ["Red", "§c"], ["Green", "§a"], ["Purple", "§d"], ["Yellow", "§e"], ["Grey", "§7"], ["Blue", "§9"]];
function plainName(npc) {
  return String(npc.getDynamicProperty("npcstudio:real_name") ?? npc.nameTag ?? "").replace(/§./g, "");
}
function openNameTag(player, npc, back) {
  const hidden = npc.getDynamicProperty("npcstudio:real_name") !== undefined;
  menu("Name Tag", `§7Now: §f${hidden ? "(hidden) " : ""}${plainName(npc)}`)
    .btn("Rename + Colour", ICON("rename"), () =>
      modal("Name Tag")
        .text("n", "Name", "Knight", plainName(npc))
        .dropdown("c", "Colour", TAG_COLORS.map((c) => c[0]), 0)
        .toggle("b", "Bold", false)
        .show(player, (v) => {
          const name = String(v.n ?? "").trim();
          if (name) {
            const full = `${TAG_COLORS[v.c][1]}${v.b ? "§l" : ""}${name}`;
            if (hidden) npc.setDynamicProperty("npcstudio:real_name", full);
            else npc.nameTag = full;
          }
          back();
        }, back)
    )
    .toggle("Hide name", hidden, () => {
      if (hidden) {
        npc.nameTag = String(npc.getDynamicProperty("npcstudio:real_name"));
        npc.setDynamicProperty("npcstudio:real_name", undefined);
      } else {
        npc.setDynamicProperty("npcstudio:real_name", npc.nameTag || "");
        npc.nameTag = "";
      }
      back();
    })
    .back(back)
    .show(player);
}

// =====================================================================================
// Pose
// =====================================================================================
function poseTab(player, m, npc, self) {
  if (!npc) return noNpc(m, player, self);
  const h = historySize(npc);
  m.section("part", "Body part", ICON("sliders"));
  poseRows(m, player, npc);
  m.btn("Reset This Part", ICON("clear_x"), () => (resetPart(player, npc), self()));
  m.section("tools", "Pose tools", ICON("gizmo"));
  m.toggle("Walk in Pose Mode", poseWalkOn(player), () => (setPoseWalk(player, !poseWalkOn(player)), self()));
  m.btn("Pose Mode", ICON("gizmo"), () => startGizmo(player, npc, () => openStudio(player, 1)));
  m.btn("Pose Library", ICON("pose_preset"), () => openPoseLibrary(player, npc, self));
  m.btn(`Undo (${h.undo})`, ICON("undo"), () => (undo(npc), self()));
  m.btn(`Redo (${h.redo})`, ICON("redo"), () => (redo(npc), self()));
  m.btn("Mirror", ICON("mirror"), () => {
    pushUndo(npc);
    applyPose(npc, mirrorPose(readPose(npc)));
    self();
  });
  m.btn("Reset Pose", ICON("clear_x"), () => {
    pushUndo(npc);
    applyPose(npc, {});
    self();
  });
  m.section("adv", "More", ICON("pose_manual"));
  m.btn("Saved Poses", ICON("pose_manual"), () => openPoseEditor(player, npc, self));
}

// =====================================================================================
// Presets
// =====================================================================================
function presetsTab(player, m, npc, self) {
  m.section("saved", "Presets", ICON("preset"));
  m.btn("NPC Presets", ICON("preset"), () => openPresetsMenu(player, self));
  if (npc) m.btn("Save Preset", ICON("save"), () => savePrompt(player, npc));
  m.btn("Scene Presets", ICON("scene"), () => openScenesMenu(player, self));
  m.section("dup", "Duplicate", ICON("crowd"));
  if (npc) m.btn("Make A Crowd", ICON("crowd"), () => openCrowdMenu(player, npc, self));
  m.btn("Select Nearby", ICON("outline"), () => {
    const list = npcsNear(player, 24);
    selectMany(player, list);
    msg(player, `§b${list.length} NPCs selected.`);
    self();
  });
  if (getSelection(player).length) m.btn("Deselect", ICON("clear"), () => (clearSelection(player), self()));
  m.btn("Bulk Tools", ICON("bulkequip"), () => openBulkMenu(player, self));
  m.section("props", "Props", ICON("prop"));
  m.btn("Block Props", ICON("prop"), () => openPropMenu(player, self));
  m.btn("Particles", ICON("particle"), () => openParticleMenu(player, self));
  m.btn("Mob Props", "textures/items/npcstudio_mob_tool", () => openMobToolMenu(player, self));
  m.section("tools", "Tools", ICON("tools"));
  m.btn("Studio Tools", ICON("tools"), () => openToolsMenu(player, self));
  m.btn("Handbook", ICON("debug"), () => openHandbook(player, self));
}

// =====================================================================================
// World
// =====================================================================================
function worldTab(player, m, npc, self) {
  const run = (cmd) => () => {
    try {
      player.dimension.runCommand(cmd);
    } catch {
      /* ignore */
    }
    self();
  };
  m.section("time", "Time and weather", ICON("day"));
  timeRows(m, player, self);
  m.btn("Sunrise", ICON("sunset"), run("time set 23000"));
  m.btn("Noon", ICON("day"), run("time set 6000"));
  m.btn("Sunset", ICON("sunset"), run("time set 12000"));
  m.btn("Night", ICON("night"), run("time set 18000"));
  m.section("rules", "Gamerules", ICON("rules"));
  for (const [label, name] of GAMERULES) m.toggle(label, ruleOn(name), () => (setRule(player, name, !ruleOn(name)), self()));
  m.section("light", "Lighting", ICON("bright"));
  m.toggle("World Bright", worldBright(player), () => (setWorldBright(player, !worldBright(player)), self()));
  if (npc) m.toggle("NPC Bright", isBright(npc), () => (setBright(npc, !isBright(npc)), self()));
  m.section("fog", "Depth fog", ICON("fog"));
  fogRows(m, player, self);
  m.section("scene", "Scene", ICON("rules"));
  m.btn("World Rules", ICON("rules"), () => openStudioRules(player, self));
  m.btn("Play All", ICON("play"), () => (playAllTimelines(player), self()));
  m.btn("Stop All", ICON("clear_x"), () => (stopAllTimelines(player), self()));
}

// =====================================================================================
// Camera
// =====================================================================================
function cameraTab(player, m, npc, self) {
  const sel = getSelectedCamera(player);
  m.section("fly", "Camera", ICON("camera"));
  if (isViewing(player)) m.btn("Exit Camera View", ICON("exit"), () => exitView(player));
  m.btn("Fly Cam", ICON("flycam"), () => flyCam(player, "camera"));
  m.btn("Fly Cam Path", ICON("waypoint"), () => flyCam(player, "path"));
  m.btn("Place Camera", ICON("plus"), () => placeCameraAtView(player));
  m.btn("Preview", ICON("monitor"), () => peek(player));
  m.choices("Guide", GUIDE_STYLES, guideStyle(player), (i) => setGuideStyle(player, i));
  if (sel) m.field("Lens", `${sel.nameTag || "Camera"}`, ICON("fov"), () => openLiveCamera(player, sel, self));
  m.btn("Cine Shots", ICON("film"), () => openShotsMenu(player, self));
  const cams = allCameras(player).slice(0, 30);
  if (cams.length) {
    m.section("list", "Cameras", ICON("camera"));
    for (const c of cams) {
      const name = c.getDynamicProperty("npcstudio:shot_name") || c.nameTag || "Camera";
      m.btn(sel?.id === c.id ? `§b${name}` : name, ICON("camera"), () => openCameraPanel(player, c));
    }
  }
}

// =====================================================================================
// Layers
// =====================================================================================
function layersTab(player, m, npc, self) {
  m.section("show", "Show", ICON("eye"));
  m.toggle("NPCs", !npcsHidden(player), () => (setNpcsHidden(player, !npcsHidden(player)), self()));
  m.toggle("Cameras", !camerasHidden(player), () => (setCamerasHidden(player, !camerasHidden(player)), self()));
  m.toggle("Outline", !areOutlinesHidden(), () => (setOutlinesHidden(!areOutlinesHidden()), self()));
  m.toggle("Name tags", !nameTagsHidden(player), () => (setNameTagsHidden(player, !nameTagsHidden(player)), self()));
  m.toggle("Grid", guidesOn(player), () => (setGuides(player, !guidesOn(player)), self()));
  m.section("depth", "Depth map", ICON("fog"));
  m.toggle("Depth map", depthOn(player), () => (setDepth(player, !depthOn(player)), self()));
  // the two settings of the DMS shader, in chunks like DMS
  const step = (list, cur, d) => list[Math.max(0, Math.min(list.length - 1, list.indexOf(cur) + d))];
  m.cycle("Start", chunks(depthStart(player)), (d) => setDepthStart(player, step(DEPTH_STARTS, depthStart(player), d)));
  m.cycle("Max dist.", chunks(depthLength(player)), (d) => setDepthLength(player, step(DEPTH_LENGTHS, depthLength(player), d)));
  m.cycle("Ground fog", HAZE_LEVELS[hazeLevel(player)], (d) => setHazeLevel(player, Math.max(0, Math.min(HAZE_LEVELS.length - 1, hazeLevel(player) + d))));
  const bd = getBackdrop(player);
  const cur = bd ? bd.getProperty("npcstudio:color") : -1;
  m.section("bd", "Backdrop", ICON("backdrop"));
  BACKDROP_COLORS.forEach((name, i) =>
    m.toggle(name, cur === i, () => {
      if (cur === i) removeBackdrop(player);
      else placeBackdrop(player, i);
      self();
    })
  );
  m.section("photo", "Photo", ICON("photo"));
  m.btn("Layer Shot (3 photos)", ICON("layers"), () => layerShot(player, 0));
  m.btn("Photo Mode", ICON("photo"), () => photoMode(player));
}
