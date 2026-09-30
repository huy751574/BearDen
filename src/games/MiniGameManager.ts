import type * as THREE from 'three';
import type { GameCtx, GameRef, Engine } from './types';
import { variantFor, type Variant } from './catalog';
import { ShooterEngine, CatcherEngine, CollectorEngine, TimingEngine, SimonEngine, DodgeEngine, StealthEngine } from './engines';
import type { GameHud } from '../ui/GameHud';

// Runs one mini-game at a time: ready card -> playing -> result card.
// Best scores are kept per scene in the browser (localStorage).

const BEST_KEY = (sceneId: string) => `bearden.best.${sceneId}`;

export class MiniGameManager {
  private engine: Engine | null = null;
  private ref: GameRef | null = null;
  private v: Variant | null = null;
  private sceneId = '';

  constructor(private hud: GameHud, private makeCtx: () => GameCtx | null) {
    hud.onClose = () => this.close();
  }

  get active() {
    return !!this.engine && !this.engine.done;
  }

  get isOpen() {
    return !this.hud.el.hidden;
  }

  /** Title of a scene's game (for the HUD button). */
  static titleFor(ref: GameRef | undefined) {
    return variantFor(ref).v.title;
  }

  open(sceneId: string, ref: GameRef | undefined) {
    this.close();
    const { ref: r, v } = variantFor(ref);
    this.ref = r;
    this.v = v;
    this.sceneId = sceneId;
    this.hud.ready(v, this.best(), () => this.start());
  }

  start() {
    if (!this.ref || !this.v) return;
    this.engine?.dispose();
    const ctx = this.makeCtx();
    if (!ctx) return;
    this.engine = createEngine(this.ref, this.v, ctx);
    this.hud.playing(this.v);
    this.engine.start();
  }

  update(dt: number) {
    const e = this.engine;
    if (!e || e.done) return;
    e.update(dt);
    if (e.done) this.finish(e);
  }

  private finish(e: Engine) {
    const best = this.best();
    const isBest = e.score > best;
    if (isBest) {
      try {
        localStorage.setItem(BEST_KEY(this.sceneId), String(e.score));
      } catch {
        /* storage unavailable: keep playing without saving */
      }
    }
    this.hud.over(e.score, Math.max(best, e.score), isBest && e.score > 0, e.won, () => this.start());
    e.dispose();
  }

  close() {
    this.engine?.dispose();
    this.engine = null;
    this.hud.hide();
  }

  onPointer(p: THREE.Vector3 | null) {
    return this.active ? this.engine!.onPointer(p) : false;
  }

  onKey(key: string) {
    if (!this.active) return false;
    return this.engine!.onKey(key);
  }

  private best() {
    try {
      return Number(localStorage.getItem(BEST_KEY(this.sceneId))) || 0;
    } catch {
      return 0;
    }
  }
}

function createEngine(ref: GameRef, v: Variant, ctx: GameCtx): Engine {
  switch (ref.type) {
    case 'shooter': return new ShooterEngine(ctx, v);
    case 'catcher': return new CatcherEngine(ctx, v);
    case 'timing': return new TimingEngine(ctx, v);
    case 'simon': return new SimonEngine(ctx, v);
    case 'dodge': return new DodgeEngine(ctx, v);
    case 'stealth': return new StealthEngine(ctx, v);
    default: return new CollectorEngine(ctx, v);
  }
}
