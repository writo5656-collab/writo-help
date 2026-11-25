// Confetti for the end of a lesson only (canvas-confetti by catdad, ISC licence, github.com/catdad/canvas-confetti).
// Respects the phone's "reduce motion" setting.
import confetti from 'canvas-confetti';

// The study-desk colours: hanko red, forest ink, sage and paper.
const COLORS = ['#b8412c', '#2c6a50', '#a9c2a6', '#efe9da', '#fffdf7'];
const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 80 } as const;

export const celebrate = {
  /** End of a lesson: two cannons from the bottom corners, then sakura petals. */
  done() {
    void confetti({ ...base, particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.95 }, startVelocity: 55 });
    void confetti({ ...base, particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.95 }, startVelocity: 55 });
    setTimeout(() => void confetti({ ...base, particleCount: 40, spread: 160, origin: { y: 0.2 }, gravity: 0.5, scalar: 1.2, shapes: ['circle'], colors: ['#b8412c', '#fffdf7'] }), 450);
  },
};
