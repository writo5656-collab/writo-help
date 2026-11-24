// Confetti for big moments (canvas-confetti by catdad, ISC licence, github.com/catdad/canvas-confetti).
// Respects the phone's "reduce motion" setting.
import confetti from 'canvas-confetti';

const COLORS = ['#e9c46a', '#dd8f8f', '#fae6e2', '#2c6a50', '#a9c2a6', '#ffffff'];
const base = { colors: COLORS, disableForReducedMotion: true, zIndex: 80 } as const;

export const celebrate = {
  /** End of a lesson: two cannons from the bottom corners, then sakura petals. */
  done() {
    void confetti({ ...base, particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.95 }, startVelocity: 55 });
    void confetti({ ...base, particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.95 }, startVelocity: 55 });
    setTimeout(() => void confetti({ ...base, particleCount: 40, spread: 160, origin: { y: 0.2 }, gravity: 0.5, scalar: 1.2, shapes: ['circle'], colors: ['#fae6e2', '#dd8f8f', '#ffffff'] }), 450);
  },
  /** A combo of 5 / 10 in a row. */
  combo(n: number) {
    void confetti({ ...base, particleCount: n >= 10 ? 90 : 45, spread: 75, origin: { y: 0.35 }, startVelocity: 35, scalar: 0.9 });
  },
  /** A small pop from a point on screen (e.g. a word read right). */
  pop(x = 0.5, y = 0.6) {
    void confetti({ ...base, particleCount: 24, spread: 50, origin: { x, y }, startVelocity: 25, scalar: 0.7, ticks: 120 });
  },
};
