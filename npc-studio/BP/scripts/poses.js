/**
 * NPC Studio — poses.js : built-in pose library.
 * Format per bone: [rotX, rotY, rotZ, posX, posY, posZ]  (anything left out = 0)
 * "root" is the whole body: rotate it to lie down / fly, move it to sit on the ground.
 * Conventions: arm/leg X negative = forward/up, body X positive = lean forward,
 * right arm Z positive = out to the side (left arm uses negative), right arm Y positive = inward.
 * Copyright (c) 2026 NoxeelMC. All rights reserved. See LICENSE.md.
 */

export const POSE_CATEGORIES = [
  {
    name: "Basic",
    poses: {
      "Idle": {},
      "Relaxed": { head: [5], right_arm: [0, 0, 6], left_arm: [0, 0, -6] },
      "Walking": { right_arm: [-25], left_arm: [25], right_leg: [25], left_leg: [-25] },
      "Running": { head: [-10], body: [15], right_arm: [-60, 0, 5], left_arm: [55, 0, -5], right_leg: [50], left_leg: [-50] },
      "Sneaking": { head: [-20], body: [30], right_arm: [-10, 0, 5], left_arm: [-10, 0, -5], right_leg: [-10], left_leg: [-10], root: [0, 0, 0, 0, -3, 0] },
      "T-Pose": { right_arm: [0, 0, 90], left_arm: [0, 0, -90] },
      "Arms Crossed": { right_arm: [-65, 40, 0], left_arm: [-65, -40, 0] },
      "Hands on Hips": { right_arm: [-20, -30, 30], left_arm: [-20, 30, -30] },
      "Leaning": { root: [0, 0, -7], head: [0, 0, 7], right_leg: [0, 0, 8], right_arm: [0, 0, 10] }
    }
  },
  {
    name: "Action",
    poses: {
      "Fighting": { head: [0, -20], body: [0, 20], right_arm: [-60, -20, 10], left_arm: [-40, 30, -10], right_leg: [-15, 0, 5], left_leg: [15, 0, -5] },
      "Sword Strike": { head: [0, 25], body: [10, -25], right_arm: [-150, -10, 20], left_arm: [-30, 0, -15], right_leg: [-25], left_leg: [20] },
      "Shield Block": { body: [0, -10], left_arm: [-80, 40, 0], right_arm: [-30, 0, 10] },
      "Bow Aim": { head: [0, -20], body: [0, 20], right_arm: [-90, -15, 0], left_arm: [-90, 35, 0] },
      "Throwing": { body: [-5, 20], right_arm: [-160, 0, 20], left_arm: [-60, 0, -10], right_leg: [15], left_leg: [-20] },
      "Mining": { body: [15], right_arm: [-100] },
      "Jumping": { right_arm: [-150, 0, 20], left_arm: [-150, 0, -20], right_leg: [-40], left_leg: [20], root: [0, 0, 0, 0, 8, 0] },
      "Superhero Landing": { head: [-30], body: [35], right_arm: [-20, 0, 40], left_arm: [30, 0, -20], right_leg: [-80, 0, 15], left_leg: [70, 0, -10], root: [0, 0, 0, 0, -8, 0] },
      "Flying (Superhero)": { head: [-60], right_arm: [-180, 0, 5], left_arm: [0, 0, -5], root: [90, 0, 0, 0, 10, 0] },
      "Levitating": { right_arm: [0, 0, 25], left_arm: [0, 0, -25], right_leg: [10], left_leg: [5], root: [0, 0, 0, 0, 8, 0] },
      "Swimming": { head: [-60], right_arm: [-180, 0, 30], left_arm: [-180, 0, -30], root: [90, 0, 0, 0, 6, 0] },
      "Crawling": { head: [-50], right_arm: [-150], left_arm: [-120], right_leg: [10], left_leg: [-10], root: [90, 0, 0, 0, 2, 0] },
      "Riding": { right_arm: [-36], left_arm: [-36], right_leg: [-72, 18, 0], left_leg: [-72, -18, 0] },
      "Riding: Sword Raised": { head: [-10], right_arm: [-165, 0, 15], left_arm: [-36], right_leg: [-72, 18, 0], left_leg: [-72, -18, 0] },
      "Riding: Waving": { head: [0, -15], right_arm: [-160, 0, 25], left_arm: [-36], right_leg: [-72, 18, 0], left_leg: [-72, -18, 0] },
      "Riding: Charge!": { head: [-15], body: [20], right_arm: [-100], left_arm: [-45], right_leg: [-72, 18, 0], left_leg: [-72, -18, 0] }
    }
  },
  {
    name: "Sit & Lie",
    poses: {
      "Sitting": { right_leg: [-90, 10, 0], left_leg: [-90, -10, 0] },
      "Sit on Ground": { right_arm: [-20], left_arm: [-20], right_leg: [-90, 15, 0], left_leg: [-90, -15, 0], root: [0, 0, 0, 0, -12, 0] },
      "Cross-Legged": { right_arm: [-30, 20, 0], left_arm: [-30, -20, 0], right_leg: [-90, 40, 0], left_leg: [-90, -40, 0], root: [0, 0, 0, 0, -12, 0] },
      "Kneeling": { right_leg: [-75], left_leg: [60], root: [0, 0, 0, 0, -6, 0] },
      "Lying (Back)": { right_arm: [0, 0, 10], left_arm: [0, 0, -10], root: [-90, 0, 0, 0, 2, 0] },
      "Lying (Face Down)": { head: [-45], root: [90, 0, 0, 0, 2, 0] },
      "Sleeping (Side)": { right_arm: [-30], left_arm: [-20], right_leg: [-30], left_leg: [-15], root: [0, 0, 90, 0, 4, 0] },
      "Dead": { head: [0, 40], right_arm: [0, 0, 60], left_arm: [0, 0, -30], right_leg: [0, 0, 15], left_leg: [0, 0, -10], root: [-90, 0, 0, 0, 2, 0] },
      "Push-Up": { head: [-60], right_arm: [-90], left_arm: [-90], root: [90, 0, 0, 0, 7, 0] }
    }
  },
  {
    name: "Emotes",
    poses: {
      "Wave": { head: [0, -10], right_arm: [-160, 0, 25] },
      "Pointing": { right_arm: [-90] },
      "Pointing Up": { head: [-30], right_arm: [-170, 0, 5] },
      "Salute": { head: [-5], right_arm: [-150, -40, 55] },
      "Victory": { head: [-10], right_arm: [-150, 0, 20], left_arm: [-150, 0, -20] },
      "Cheer": { head: [-15], right_arm: [-170, 0, 10], left_arm: [-170, 0, -10] },
      "Clap": { right_arm: [-80, 20, 0], left_arm: [-80, -20, 0] },
      "Thinking": { head: [10, 0, 5], right_arm: [-120, 35, 0], left_arm: [-45, -30, 0] },
      "Facepalm": { head: [25], right_arm: [-140, 40, 0] },
      "Shrug": { head: [0, 0, 10], right_arm: [-35, 20, 30], left_arm: [-35, -20, -30] },
      "Scared": { head: [10], body: [-10], right_arm: [-110, 30, 20], left_arm: [-110, -30, -20] },
      "Bowing": { head: [10], body: [45] },
      "Praying": { head: [20], right_arm: [-110, 35, 0], left_arm: [-110, -35, 0] },
      "Hug": { right_arm: [-90, 30, 0], left_arm: [-90, -30, 0] }
    }
  },
  {
    name: "Fun",
    poses: {
      "Zombie": { right_arm: [-90], left_arm: [-90] },
      "Dab": { head: [30, 40, 0], right_arm: [-135, 0, 70], left_arm: [-110, -50, 0] },
      "Floss": { body: [0, 0, 8], right_arm: [10, 40, -20], left_arm: [10, 40, -20] },
      "Disco": { right_arm: [-160, 0, 30], left_arm: [30, 0, -20], body: [0, 0, 10], right_leg: [0, 0, 10] },
      "Ninja Run": { head: [-10], body: [35], right_arm: [60, 0, 10], left_arm: [60, 0, -10], right_leg: [-50], left_leg: [40] },
      "Surfing": { head: [0, -60], body: [0, 60], right_arm: [0, 0, 55], left_arm: [0, 0, -55], right_leg: [-10, 0, 6], left_leg: [10, 0, -6], root: [0, 0, 0, 0, -1, 0] },
      "Big Stretch": { head: [-25], right_arm: [-175, 0, 20], left_arm: [-175, 0, -20], body: [-8] }
    }
  }
];

/** Flat map name -> preset (also used for the left-click quick-cycle). */
export const ALL_POSES = Object.assign({}, ...POSE_CATEGORIES.map((c) => c.poses));
export const QUICK_CYCLE = ["Idle", "Walking", "Running", "Fighting", "Sword Strike", "Sitting", "Wave", "Pointing", "Victory", "Cheer", "Thinking", "Arms Crossed", "Dead"];

/** Looping animations — order MUST match the RP entity "animate" list (anim index = position + 1). */
export const LOOP_ANIMS = [
  "Breathing", "Walk Cycle", "Run Cycle", "Jumping", "Waving", "Talking", "Dancing", "Looking Around",
  "Sword Swing", "Clapping", "Zombie Walk", "Sitting Leg Swing", "Hovering", "Cheering", "Nodding (Yes)",
  "Shaking Head (No)", "Saluting", "Push-Ups", "Guard (scan)"
];
