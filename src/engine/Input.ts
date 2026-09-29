// Keyboard (WASD / arrows, Shift to run) + click/tap-to-move.
// A pointer press counts as a "click" only if it barely moved, so dragging
// still orbits the camera.

const AXES: Record<string, [number, number]> = {
  w: [0, 1], arrowup: [0, 1],
  s: [0, -1], arrowdown: [0, -1],
  a: [-1, 0], arrowleft: [-1, 0],
  d: [1, 0], arrowright: [1, 0],
};

export class Input {
  private down = new Set<string>();
  running = false;
  onKey: ((key: string) => void) | null = null;

  constructor(el: HTMLElement, onClick: (x: number, y: number) => void) {
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      this.down.add(k);
      this.running = e.shiftKey;
      if (!e.repeat) this.onKey?.(k);
    });
    addEventListener('keyup', (e) => {
      this.down.delete(e.key.toLowerCase());
      this.running = e.shiftKey;
    });
    addEventListener('blur', () => this.down.clear());

    let start: { x: number; y: number; t: number } | null = null;
    el.addEventListener('pointerdown', (e) => (start = { x: e.clientX, y: e.clientY, t: performance.now() }));
    el.addEventListener('pointerup', (e) => {
      if (!start) return;
      const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
      if (moved < 6 && performance.now() - start.t < 400) onClick(e.clientX, e.clientY);
      start = null;
    });
  }

  axis(): { x: number; y: number } {
    let x = 0, y = 0;
    for (const k of this.down) {
      const a = AXES[k];
      if (a) { x += a[0]; y += a[1]; }
    }
    return { x: Math.sign(x), y: Math.sign(y) };
  }
}
