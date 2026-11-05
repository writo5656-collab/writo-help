/**
 * NPC Studio V3 — panel.js : the Studio Panel (docked on the left, six tabs).
 *   Display · Pose · Presets · World · Camera · Layers
 * Opened by the Director's Baton, tapping an NPC, /npcstudio:npc. Switches flip in one tap; anything
 * with a number opens a live editor (live.js) so the NPC changes while you drag.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { menu, modal, msg, confirm, ICON, SWITCH, npcLabel, npcsNear, isLocked } from "./core.js";
import { getScale, getAnim, readPose, applyPose, mirrorPose, pushUndo, undo, redo, historySize, BONES } from "./rig.js";
import { LOOP_ANIMS } from "./poses.js";
import { pickSkin, setSkin, skinPlainName, npcHead } from "./skins.js";
import { openWardrobe } from "./wardrobe.js";
import { openPoseEditor, openPoseLibrary, openLoopAnims, startGizmo } from "./poseEditor.js";
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
  select, selectMany, clearSelection, getSelection, isBright, setBright, getCape, setCape, CAPE_NAMES, isProp, areOutlinesHidden, setOutlinesHidden
} from "./selection.js";
import { liveSize, livePose, liveTrim, liveTime, liveFog } from "./live.js";
import { getFog, setFog, presetName } from "./fog.js";
import {
  peek, photoMode, layerShot, placeBackdrop, removeBackdrop, getBackdrop, BACKDROP_COLORS, npcsHidden, setNpcsHidden,
  camerasHidden, setCamerasHidden, nameTagsHidden, setNameTagsHidden, guidesOn, setGuides
} from "./studio.js";
import { openPropMenu, openParticleMenu, openCrowdMenu, openScenesMenu, openToolsMenu, openStudioRules } from "./props.js";

export const TABS = ["Display", "Pose", "Presets", "World", "Camera", "Layers"];
const lastTab = new Map(); // player.id -> tab

/** The NPC the panel edits: your selection, else the one you look at. */
function currentNpc(player) {
  const sel = getSelection(player);
  if (sel.length) return sel[0];
  const looked = getLookedAtNPC(player);
  if (looked) select(player, looked);
  return looked;
}

export function openStudio(player, tab) {
  if (tab === undefined) tab = lastTab.get(player.id) ?? 0;
  lastTab.set(player.id, tab);
  const npc = currentNpc(player);
  const self = () => openStudio(player, tab);
  const sel = getSelection(player).length;
  const body = npc
    ? `§7Editing §f${npcLabel(npc)}${sel > 1 ? `§7 (+${sel - 1} more selected)` : ""}${isLocked(npc) ? " §c(locked)" : ""}`
    : "§7No NPC selected. Tap an NPC with the Baton, or spawn one.";
  const m = menu("NPC Studio V3", body).tabs(TABS, tab, (i) => openStudio(player, i));
  if (npc && isLocked(npc) && (tab === 0 || tab === 1)) {
    m.btn("Unlock This NPC", ICON("lock"), () => {
      npc.setProperty("npcstudio:locked", false);
      self();
    });
    m.btn("Pick Another NPC", ICON("manage"), () => pickAndSelect(player, self));
    return m.show(player);
  }
  [displayTab, poseTab, presetsTab, worldTab, cameraTab, layersTab][tab](player, m, npc, self);
  m.show(player);
}

/** Opening on an NPC (Baton tap): select it and show Display (or the last NPC tab). */
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
  m.btn("Spawn NPC", ICON("spawn"), () => openSpawnMenu(player, self));
  m.btn("Pick An NPC", ICON("manage"), () => pickAndSelect(player, self));
  m.btn("Handbook", ICON("debug"), () => openHandbook(player, self));
}

// =====================================================================================
// Display
// =====================================================================================
function displayTab(player, m, npc, self) {
  if (!npc) return noNpc(m, player, self);
  if (isProp(npc)) {
    m.btn(`Size ${Math.round(getScale(npc) * 100)}%`, ICON("scale"), () => liveSize(player, npc, self));
    m.btn("Turn The Prop", ICON("turn"), () => livePose(player, npc, "right_arm", self));
    m.btn("Move / Turn", ICON("move"), () => openMoveMenu(player, npc, self));
    m.btn("Clone", ICON("clone"), () => (cloneNpc(player, npc), self()));
    m.btn("§cDelete Prop", ICON("delete"), () => deleteNpc(player, npc, self));
    m.btn("Pick Another NPC", ICON("manage"), () => pickAndSelect(player, self));
    return;
  }
  const slim = !!npc.getProperty("npcstudio:slim");
  const anim = getAnim(npc);
  const cape = getCape(npc);
  m.btn(`Skin: ${skinPlainName(npc.getProperty("npcstudio:skin_index") ?? 0)}`, npcHead(npc), () =>
    pickSkin(player, "Choose Skin", (i) => {
      setSkin(npc, i);
      self();
    }, self)
  );
  m.btn(slim ? "§bSlim Arms" : "Slim Arms", SWITCH(slim), () => {
    npc.setProperty("npcstudio:slim", !slim);
    self();
  });
  m.btn(`Size ${Math.round(getScale(npc) * 100)}%`, ICON("scale"), () => liveSize(player, npc, self));
  m.btn("Wardrobe", ICON("equip"), () => openWardrobe(player, npc, self));
  m.btn("Trim Studio", ICON("trim"), () => liveTrim(player, npc, self));
  m.btn(`Cape: ${cape ? CAPE_NAMES[cape - 1] : "None"}`, ICON("cape"), () => openCapes(player, npc, self));
  m.btn(isLooking(npc) ? "§bLook At Players" : "Look At Players", SWITCH(isLooking(npc)), () => {
    setLookAtPlayers(npc, !isLooking(npc));
    self();
  });
  m.btn(isBright(npc) ? "§bNPC Bright" : "NPC Bright", SWITCH(isBright(npc)), () => {
    setBright(npc, !isBright(npc));
    self();
  });
  m.btn("Name Tag", ICON("nametag"), () => openNameTag(player, npc, self));
  m.btn(`Animation: ${anim ? LOOP_ANIMS[anim - 1] : "None"}`, ICON("animate"), () => openLoopAnims(player, npc, self));
  m.btn("Keyframe Animator", ICON("record"), () => openAnimator(player, npc, self));
  m.btn(isMounted(npc) ? "§bRiding" : "Ride A Mob", ICON("ride"), () => openRideMenu(player, npc, self));
  m.btn("Move / Turn", ICON("move"), () => openMoveMenu(player, npc, self));
  m.btn("Cinematic Shot Of This NPC", ICON("film"), () => openShotsMenu(player, self, npc));
  m.btn("Clone", ICON("clone"), () => {
    cloneNpc(player, npc);
    self();
  });
  m.btn("Lock", ICON("lock"), () => {
    npc.setProperty("npcstudio:locked", true);
    msg(player, "§aLocked.");
    self();
  });
  m.btn("§cDelete", ICON("delete"), () => deleteNpc(player, npc, self));
  m.btn("Pick Another NPC", ICON("manage"), () => pickAndSelect(player, self));
  m.btn("Spawn NPC", ICON("spawn"), () => openSpawnMenu(player, self));
}

function deleteNpc(player, npc, back) {
  confirm(player, "Delete?", `Delete ${npcLabel(npc)}? This can't be undone.`, "Delete", () => {
    npc.remove();
    msg(player, "§aDeleted.");
    back();
  }, back);
}

function openCapes(player, npc, back) {
  const cur = getCape(npc);
  const m = menu("Cape").grid();
  m.btn(cur === 0 ? "§bNone" : "None", ICON("clear_x"), () => (setCape(npc, 0), back()));
  CAPE_NAMES.forEach((n, i) => m.btn(cur === i + 1 ? `§b${n}` : n, ICON("cape"), () => (setCape(npc, i + 1), back())));
  m.back(back).show(player);
}

const TAG_COLORS = [["White", "§f"], ["Cyan", "§b"], ["Gold", "§6"], ["Red", "§c"], ["Green", "§a"], ["Purple", "§d"], ["Yellow", "§e"], ["Grey", "§7"], ["Blue", "§9"]];
function plainName(npc) {
  return String(npc.getDynamicProperty("npcstudio:real_name") ?? npc.nameTag ?? "").replace(/§./g, "");
}
function openNameTag(player, npc, back) {
  const hidden = npc.getDynamicProperty("npcstudio:real_name") !== undefined;
  menu("Name Tag", `§7Now: §f${hidden ? "(hidden) " : ""}${npc.getDynamicProperty("npcstudio:real_name") ?? npc.nameTag ?? ""}`)
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
    .btn(hidden ? "§bName Hidden" : "Hide Name", SWITCH(hidden), () => {
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
  m.btn("Pose Mode (Gizmo)", ICON("gizmo"), () => startGizmo(player, npc, () => openStudio(player, 1)));
  m.btn("Exact Sliders", ICON("sliders"), () => {
    const g = menu("Which Body Part?").grid();
    BONES.forEach((b) => g.btn(b.label, ICON("pose_manual"), () => livePose(player, npc, b.key, self)));
    g.back(self).show(player);
  });
  m.btn("Pose Library", ICON("pose_preset"), () => openPoseLibrary(player, npc, self));
  m.btn(`Undo (${h.undo})`, ICON("undo"), () => {
    undo(npc);
    self();
  });
  m.btn(`Redo (${h.redo})`, ICON("redo"), () => {
    redo(npc);
    self();
  });
  m.btn("Mirror Left / Right", ICON("mirror"), () => {
    pushUndo(npc);
    applyPose(npc, mirrorPose(readPose(npc)));
    self();
  });
  m.btn("Reset Pose", ICON("clear_x"), () => {
    pushUndo(npc);
    applyPose(npc, {});
    self();
  });
  m.btn("More Pose Tools", ICON("pose_manual"), () => openPoseEditor(player, npc, self));
}

// =====================================================================================
// Presets (presets, scenes, crowds, props, tools)
// =====================================================================================
function presetsTab(player, m, npc, self) {
  m.btn("Saved NPC Presets", ICON("preset"), () => openPresetsMenu(player, self));
  if (npc) {
    m.btn("Save NPC As Preset", ICON("save"), () =>
      modal("Save Preset").text("n", "Preset name", "knight_guard").show(player, ({ n }) => {
        n = String(n ?? "").trim().slice(0, 40);
        if (n) savePreset(player, npc, n);
        self();
      }, self)
    );
    m.btn("Make A Crowd", ICON("crowd"), () => openCrowdMenu(player, npc, self));
  }
  m.btn("Scene Presets", ICON("scene"), () => openScenesMenu(player, self));
  m.btn("Block & Item Props", ICON("prop"), () => openPropMenu(player, self));
  m.btn("Particle Props", ICON("particle"), () => openParticleMenu(player, self));
  m.btn("Mob & Vehicle Props", "textures/items/npcstudio_mob_tool", () => openMobToolMenu(player, self));
  m.btn("Select All Nearby", ICON("outline"), () => {
    const list = npcsNear(player, 24);
    selectMany(player, list);
    msg(player, `§b${list.length} NPCs selected.`);
    self();
  });
  if (getSelection(player).length) m.btn("Clear Selection", ICON("clear"), () => (clearSelection(player), self()));
  m.btn("Bulk Tools", ICON("bulkequip"), () => openBulkMenu(player, self));
  m.btn("Studio Tools", ICON("tools"), () => openToolsMenu(player, self));
}

// =====================================================================================
// World
// =====================================================================================
function worldTab(player, m, npc, self) {
  const fog = getFog(player);
  const run = (cmd) => () => {
    try {
      player.dimension.runCommand(cmd);
    } catch {
      /* ignore */
    }
    self();
  };
  m.btn("Time & Weather", ICON("day"), () => liveTime(player, self));
  m.btn("Sunrise", ICON("sunset"), run("time set 23000"));
  m.btn("Noon", ICON("day"), run("time set 6000"));
  m.btn("Sunset", ICON("sunset"), run("time set 12000"));
  m.btn("Night", ICON("night"), run("time set 18000"));
  m.btn(fog.on ? "§bDepth Fog" : "Depth Fog", SWITCH(fog.on), () => {
    setFog(player, { on: !fog.on });
    self();
  });
  m.btn(`Fog: ${presetName(fog.preset)}, ${fog.dist} blocks`, ICON("fog"), () => liveFog(player, self));
  m.btn("Studio World Rules", ICON("rules"), () => openStudioRules(player, self));
  m.btn("Play All Animations", ICON("play"), () => {
    playAllTimelines(player);
    self();
  });
  m.btn("Stop All Animations", ICON("clear_x"), () => {
    stopAllTimelines(player);
    self();
  });
}

// =====================================================================================
// Camera
// =====================================================================================
function cameraTab(player, m, npc, self) {
  const sel = getSelectedCamera(player);
  m.btn("Fly Cam", ICON("flycam"), () => flyCam(player, "camera"));
  m.btn("Fly Cam Path", ICON("waypoint"), () => flyCam(player, "path"));
  m.btn("Place Camera At My View", ICON("plus"), () => placeCameraAtView(player));
  m.btn("Peek Through Cameras", ICON("monitor"), () => peek(player));
  m.btn(guidesOn(player) ? "§bThirds Guide" : "Thirds Guide", SWITCH(guidesOn(player)), () => {
    setGuides(player, !guidesOn(player));
    self();
  });
  if (sel) m.btn(`Lens & Framing: ${sel.nameTag || "Camera"}`, ICON("fov"), () => openLiveCamera(player, sel, self));
  m.btn("Cinematic Shots", ICON("film"), () => openShotsMenu(player, self));
  for (const c of allCameras(player).slice(0, 24)) {
    const name = c.getDynamicProperty("npcstudio:shot_name") || c.nameTag || "Camera";
    m.btn(sel?.id === c.id ? `§b${name}` : name, ICON("camera"), () => openCameraPanel(player, c));
  }
  if (isViewing(player)) m.btn("Exit Camera View", ICON("exit"), () => exitView(player));
}

// =====================================================================================
// Layers (green screen, hide/show, Photo Mode)
// =====================================================================================
function layersTab(player, m, npc, self) {
  const flip = (label, on, fn) =>
    m.btn(on ? `§b${label}` : label, SWITCH(on), () => {
      fn(!on);
      self();
    });
  flip("Show NPCs", !npcsHidden(player), (v) => setNpcsHidden(player, !v));
  flip("Show Cameras", !camerasHidden(player), (v) => setCamerasHidden(player, !v));
  flip("Show Outline", !areOutlinesHidden(), (v) => setOutlinesHidden(!v));
  flip("Show Name Tags", !nameTagsHidden(player), (v) => setNameTagsHidden(player, !v));
  const bd = getBackdrop(player);
  const cur = bd ? bd.getProperty("npcstudio:color") : -1;
  BACKDROP_COLORS.forEach((name, i) =>
    m.btn(cur === i ? `§b${name}` : name, ICON("backdrop"), () => {
      if (cur === i) removeBackdrop(player);
      else placeBackdrop(player, i);
      self();
    })
  );
  if (bd) m.btn("Remove Backdrop", ICON("clear_x"), () => (removeBackdrop(player), self()));
  m.btn("Layer Shot (3 photos)", ICON("layers"), () => layerShot(player, 0));
  m.btn("Photo Mode", ICON("photo"), () => photoMode(player));
}

