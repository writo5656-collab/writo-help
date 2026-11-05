/**
 * NPC Studio V3 — studio.js : Peek, Photo Mode, Layer Shot, green screen and hide/show.
 *
 * Peek (Camera Monitor): tap = look through the selected camera, tap again = next camera,
 *   double-tap sneak / /exitcam = back to you. The action bar shows "‹ Camera 2 ›".
 * Photo Mode: 3-2-1, then everything disappears (HUD, hand, outlines, cameras, name tags) and the
 *   screen flashes: take your device screenshot. Tap to come back.
 * Layer Shot: three photos from the same camera so the layers line up in an editor:
 *   ① full shot  ② NPCs on a green screen  ③ background without NPCs.
 * Green screen: a big flat-colour box around the scene (npcstudio:backdrop, drawn from inside).
 * Add-ons can't take screenshots or save files, so the player presses their device's screenshot.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */
import { world, system, msg, sfx, actionbar, NPC_FAMILY, MOB_TAG, CAMERA_ID, CAM_PRESET, getJson, setJson, forward, clamp } from "./core.js";
import { enterCinema, exitCinema, inCinema, hideHud, setCinemaTap } from "./cinema.js";
import { allCameras, getSelectedCamera, lookThrough, camState } from "./camera.js";
import { getSelection, setOutlinesHidden, areOutlinesHidden } from "./selection.js";

const BACKDROP_ID = "npcstudio:backdrop";
export const BACKDROP_COLORS = ["Green Screen", "Black", "White", "Blue Screen"];

// =====================================================================================
// Thirds guide (HUD overlay, RP/ui/hud_screen.json shows titles that start with "npcg:")
// =====================================================================================
export function guidesOn(player) {
  return player.getDynamicProperty("npcstudio:guides") !== false;
}
export function setGuides(player, on) {
  player.setDynamicProperty("npcstudio:guides", on);
}
function showGuides(player, on) {
  try {
    if (on) player.onScreenDisplay.setTitle("npcg:thirds", { fadeInDuration: 0, stayDuration: 2000000, fadeOutDuration: 0 });
    else {
      player.onScreenDisplay.setTitle("npcg:", { fadeInDuration: 0, stayDuration: 1, fadeOutDuration: 0 });
      player.onScreenDisplay.clearTitle();
    }
  } catch {
    /* ignore */
  }
}

// =====================================================================================
// Peek through cameras (Camera Monitor)
// =====================================================================================
const peeking = new Map(); // player.id -> { list, i }

export function isPeeking(player) {
  return peeking.has(player.id);
}

export function peek(player) {
  const list = allCameras(player);
  if (!list.length) return msg(player, "§cNo cameras yet. Open the Cine Camera > Place Camera At My View.");
  const sel = getSelectedCamera(player);
  let i = Math.max(0, list.findIndex((c) => c.id === sel?.id));
  if (!inCinema(player)) {
    enterCinema(player, () => {
      peeking.delete(player.id);
      showGuides(player, false);
      actionbar(player, "");
    }, { keepText: true, quiet: true });
  }
  peeking.set(player.id, { list, i });
  const show = () => {
    const st = peeking.get(player.id);
    if (!st) return;
    st.list = st.list.filter((c) => c.isValid);
    if (!st.list.length) return exitCinema(player);
    st.i %= st.list.length;
    const cam = st.list[st.i];
    lookThrough(player, cam, { keepText: true, quiet: true });
    hideHud(player, true);
    showGuides(player, guidesOn(player));
    const name = cam.getDynamicProperty("npcstudio:shot_name") || cam.nameTag || `Camera ${st.i + 1}`;
    actionbar(player, `§f‹  §b${name}§f  ›   §7tap = next camera · double-tap sneak = back`);
    sfx(player, "click");
  };
  setCinemaTap(player, () => {
    const st = peeking.get(player.id);
    if (!st) return exitCinema(player);
    st.i = (st.i + 1) % st.list.length;
    show();
  });
  show();
  // the action bar fades after a few seconds: keep the camera name up while peeking
  const keep = system.runInterval(() => {
    const st = peeking.get(player.id);
    if (!st || !player.isValid) return system.clearRun(keep);
    const cam = st.list[st.i];
    if (cam?.isValid) actionbar(player, `§f‹  §b${cam.getDynamicProperty("npcstudio:shot_name") || cam.nameTag || "Camera"}§f  ›`);
  }, 40);
}

// =====================================================================================
// Photo Mode
// =====================================================================================
function flash(player) {
  try {
    player.camera.fade({ fadeTime: { fadeInTime: 0.04, holdTime: 0.06, fadeOutTime: 0.35 }, fadeColor: { red: 1, green: 1, blue: 1 } });
  } catch {
    /* ignore */
  }
  sfx(player, "shutter");
}

/** Freeze the current first-person view as a camera (lens a little in front, so your own invisible head isn't in it). */
function holdCurrentView(player) {
  const eye = player.getHeadLocation();
  const r = player.getRotation();
  const f = forward(r.y);
  const loc = { x: eye.x + f.x * 0.6, y: eye.y, z: eye.z + f.z * 0.6 };
  try {
    player.camera.setCamera(CAM_PRESET, { location: loc, rotation: { x: r.x, y: r.y } });
  } catch {
    /* ignore */
  }
}

function countdown(player, then) {
  let n = 3;
  const tick = () => {
    if (!player.isValid) return;
    if (n > 0) {
      try {
        player.onScreenDisplay.setTitle(`§l§f${n}`, { fadeInDuration: 0, stayDuration: 12, fadeOutDuration: 2 });
      } catch {
        /* ignore */
      }
      sfx(player, "click");
      n--;
      system.runTimeout(tick, 14);
    } else {
      try {
        player.onScreenDisplay.clearTitle();
      } catch {
        /* ignore */
      }
      then();
    }
  };
  tick();
}

export function photoMode(player) {
  const fromPeek = isPeeking(player);
  if (!fromPeek && !inCinema(player)) msg(player, "§b§l» Photo Mode §r§7— after the flash, take your screenshot. §fTap the screen§7 to come back.");
  countdown(player, () => {
    if (!inCinema(player)) {
      enterCinema(player, undefined, { fade: false, quiet: true });
      holdCurrentView(player);
    }
    peeking.delete(player.id);
    showGuides(player, false);
    actionbar(player, "");
    hideHud(player, false);
    flash(player);
    setCinemaTap(player, () => exitCinema(player));
  });
}

// =====================================================================================
// Green screen (backdrop)
// =====================================================================================
const backdrops = new Map(); // player.id -> entity

function viewPoint(player) {
  // where the shot is taken from: the camera you're looking through, else your eyes
  if (inCinema(player) || isPeeking(player)) {
    const cam = getSelectedCamera(player);
    if (cam?.isValid) return camState(cam).location;
  }
  return player.getHeadLocation();
}

/** Centre of the scene: your selected NPCs, else NPCs near where you look. */
function sceneCenter(player, from) {
  let npcs = getSelection(player);
  if (!npcs.length) {
    npcs = [...player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: 24 })];
  }
  if (!npcs.length) {
    const f = forward(player.getRotation().y);
    return { x: from.x + f.x * 4, y: player.location.y, z: from.z + f.z * 4 };
  }
  const c = { x: 0, y: Infinity, z: 0 };
  for (const n of npcs) {
    c.x += n.location.x / npcs.length;
    c.z += n.location.z / npcs.length;
    c.y = Math.min(c.y, n.location.y);
  }
  return c;
}

export function removeBackdrop(player) {
  const b = backdrops.get(player.id);
  backdrops.delete(player.id);
  try {
    if (b?.isValid) b.remove();
  } catch {
    /* ignore */
  }
}
export function getBackdrop(player) {
  const b = backdrops.get(player.id);
  return b?.isValid ? b : undefined;
}

/** color: 0 green, 1 black, 2 white, 3 blue */
export function placeBackdrop(player, color = 0) {
  removeBackdrop(player);
  const from = viewPoint(player);
  const c = sceneCenter(player, from);
  const dist = Math.hypot(from.x - c.x, from.z - c.z);
  const size = clamp(Math.ceil(dist * 2 + 12), 16, 200);
  try {
    const b = player.dimension.spawnEntity(BACKDROP_ID, { x: c.x, y: c.y + 0.02, z: c.z });
    b.setProperty("npcstudio:size", size);
    b.setProperty("npcstudio:color", color);
    b.setDynamicProperty("npcstudio:owner", player.id);
    backdrops.set(player.id, b);
    return b;
  } catch (e) {
    msg(player, `§cCouldn't place the backdrop: ${e}`);
  }
}

// =====================================================================================
// Hide / show
// =====================================================================================
const HIDE_KEY = "npcstudio:hidden_at";

function sceneNpcs(player) {
  return [...player.dimension.getEntities({ families: [NPC_FAMILY], location: player.location, maxDistance: 128 })];
}

export function npcsHidden(player) {
  return !!player.getDynamicProperty("npcstudio:npcs_hidden");
}

/** NPCs are lifted far up out of sight and put back exactly (armor, items and name tags go with them). */
export function setNpcsHidden(player, on) {
  if (on) {
    const list = [];
    for (const n of sceneNpcs(player)) {
      if (n.getDynamicProperty(HIDE_KEY) !== undefined) continue;
      try {
        if (n.getComponent("minecraft:riding")) continue; // in a boat / minecart: leave it
      } catch {
        /* ignore */
      }
      const l = n.location;
      const r = n.getRotation();
      setJson(n, HIDE_KEY, { x: l.x, y: l.y, z: l.z, ry: r.y, dim: n.dimension.id });
      try {
        n.teleport({ x: l.x, y: Math.min(l.y + 220, 318), z: l.z });
        list.push(n.id);
      } catch {
        n.setDynamicProperty(HIDE_KEY, undefined);
      }
    }
    for (const m of player.dimension.getEntities({ tags: [MOB_TAG], location: player.location, maxDistance: 128 })) {
      try {
        m.addEffect("invisibility", 20 * 3600, { amplifier: 0, showParticles: false });
        m.setDynamicProperty("npcstudio:mob_hidden", true);
      } catch {
        /* ignore */
      }
    }
    player.setDynamicProperty("npcstudio:npcs_hidden", true);
  } else {
    showAllHidden(player.dimension);
    player.setDynamicProperty("npcstudio:npcs_hidden", undefined);
  }
}

function showAllHidden(dimension) {
  for (const n of dimension.getEntities({ families: [NPC_FAMILY] })) {
    const at = getJson(n, HIDE_KEY, undefined);
    if (!at) continue;
    try {
      n.teleport({ x: at.x, y: at.y, z: at.z }, { rotation: { x: 0, y: at.ry } });
    } catch {
      /* ignore */
    }
    n.setDynamicProperty(HIDE_KEY, undefined);
  }
  for (const m of dimension.getEntities({ tags: [MOB_TAG] })) {
    if (!m.getDynamicProperty("npcstudio:mob_hidden")) continue;
    try {
      m.removeEffect("invisibility");
    } catch {
      /* ignore */
    }
    m.setDynamicProperty("npcstudio:mob_hidden", undefined);
  }
}

export function camerasHidden(player) {
  return !!player.getDynamicProperty("npcstudio:cams_hidden");
}
export function setCamerasHidden(player, on) {
  for (const cam of player.dimension.getEntities({ type: CAMERA_ID })) {
    try {
      cam.setProperty("npcstudio:hidden", on);
      if (on) {
        if (cam.getDynamicProperty("npcstudio:shot_name") === undefined) cam.setDynamicProperty("npcstudio:shot_name", cam.nameTag || "");
        cam.nameTag = "";
      } else {
        const prev = cam.getDynamicProperty("npcstudio:shot_name");
        if (prev !== undefined) cam.nameTag = prev;
        cam.setDynamicProperty("npcstudio:shot_name", undefined);
      }
    } catch {
      /* ignore */
    }
  }
  player.setDynamicProperty("npcstudio:cams_hidden", on ? true : undefined);
}

export function nameTagsHidden(player) {
  return !!player.getDynamicProperty("npcstudio:tags_hidden");
}
export function setNameTagsHidden(player, on) {
  for (const n of sceneNpcs(player)) {
    try {
      if (on) {
        if (n.getDynamicProperty("npcstudio:layer_name") === undefined) n.setDynamicProperty("npcstudio:layer_name", n.nameTag || "");
        n.nameTag = "";
      } else {
        const prev = n.getDynamicProperty("npcstudio:layer_name");
        if (prev !== undefined) n.nameTag = prev;
        n.setDynamicProperty("npcstudio:layer_name", undefined);
      }
    } catch {
      /* ignore */
    }
  }
  player.setDynamicProperty("npcstudio:tags_hidden", on ? true : undefined);
}

export { areOutlinesHidden, setOutlinesHidden };

// =====================================================================================
// Layer Shot
// =====================================================================================
export function layerShot(player, color = 0) {
  const cam = getSelectedCamera(player);
  const steps = [
    { name: "① Full shot", run: () => {} },
    { name: "② NPCs on " + BACKDROP_COLORS[color].toLowerCase(), run: () => placeBackdrop(player, color) },
    { name: "③ Background only", run: () => {
      removeBackdrop(player);
      setNpcsHidden(player, true);
    } }
  ];
  let i = 0;
  const cleanup = () => {
    removeBackdrop(player);
    if (npcsHidden(player)) setNpcsHidden(player, false);
  };
  msg(player, `§b§l» Layer Shot §r§7— 3 photos from ${cam ? `§f${cam.nameTag}` : "§fyour view"}§7. After each §fflash§7, take a screenshot, then §ftap the screen§7 for the next one.`);
  const shoot = () => {
    steps[i].run();
    hideHud(player, false);
    system.runTimeout(() => flash(player), 4);
  };
  countdown(player, () => {
    enterCinema(player, cleanup, { quiet: true });
    if (cam?.isValid) lookThrough(player, cam, { quiet: true });
    else holdCurrentView(player);
    peeking.delete(player.id);
    showGuides(player, false);
    setCinemaTap(player, () => {
      i++;
      if (i >= steps.length) {
        exitCinema(player);
        msg(player, "§aLayer Shot done: 3 photos that line up perfectly.");
        return;
      }
      shoot();
    });
    system.runTimeout(shoot, 8);
  });
}

// =====================================================================================
// Safety: after a reload, put back anything left hidden and remove stray backdrops
// =====================================================================================
system.runTimeout(() => {
  for (const d of ["overworld", "nether", "the_end"]) {
    try {
      const dim = world.getDimension(d);
      showAllHidden(dim);
      for (const b of dim.getEntities({ type: BACKDROP_ID })) b.remove();
    } catch {
      /* ignore */
    }
  }
}, 35);
