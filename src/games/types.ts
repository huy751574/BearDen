import * as THREE from 'three';
import type { Character } from '../character/Character';
import type { Anchor } from '../scenery/kit';
import type { Creature } from '../character/creatures';
import type { GameHud } from '../ui/GameHud';

// Shared types for the mini-games. Each scene gets one game: an engine
// (shooter, catcher, collector, timing, simon, dodge, stealth) plus a variant
// that picks the items/enemies and wording (see catalog.ts).

export type EngineKind = 'shooter' | 'catcher' | 'collector' | 'timing' | 'simon' | 'dodge' | 'stealth';

/** What sceneEnv.json stores per scene. */
export interface GameRef {
  type: EngineKind;
  variant: string;
}

export interface GameCtx {
  /** Game objects go here; cleared when the game ends. */
  root: THREE.Group;
  bear: Character;
  walkRadius: number;
  clamp(p: THREE.Vector3): void;
  rand: () => number;
  anchors: Record<string, Anchor>;
  /** The scene's companions, to cheer / react. */
  companions: Creature[];
  hud: GameHud;
  camera: THREE.Camera;
}

export abstract class Engine {
  score = 0;
  lives = 3;
  time = 0;
  done = false;
  won = false;
  protected fx: Effects;

  constructor(protected ctx: GameCtx, readonly duration: number | null, protected usesLives = true) {
    this.fx = new Effects(ctx.root);
  }

  abstract start(): void;
  protected abstract tick(dt: number): void;

  /** Ground point under a click, or null. Return true to swallow the click (no walking). */
  onPointer(_p: THREE.Vector3 | null): boolean {
    return false;
  }

  /** Space / Enter / number keys. Return true if used. */
  onKey(_key: string): boolean {
    return false;
  }

  update(dt: number) {
    if (this.done) return;
    this.time += dt;
    this.tick(dt);
    this.fx.update(dt);
    this.ctx.hud.stats({
      score: this.score,
      time: this.duration === null ? null : Math.max(0, this.duration - this.time),
      lives: this.usesLives ? this.lives : null,
    });
    if (this.duration !== null && this.time >= this.duration) this.finish(true);
  }

  protected hurt(text = 'Ouch!') {
    this.lives--;
    this.ctx.bear.emote('hurt');
    this.ctx.hud.toast(text, 'bad');
    if (this.lives <= 0) this.finish(false);
  }

  protected gain(points = 1, at?: THREE.Vector3, text = `+${points}`) {
    this.score += points;
    if (at) this.fx.text(text, at);
  }

  protected cheer() {
    for (const c of this.ctx.companions) c.act('cheer', 1.2);
  }

  finish(won: boolean) {
    if (this.done) return;
    this.done = true;
    this.won = won;
    if (won) this.cheer();
    this.ctx.bear.emote(won ? 'victory' : 'hurt');
  }

  protected bearPos() {
    return this.ctx.bear.root.position;
  }

  /** Random point on the island at least `minR` from the centre. */
  protected randomSpot(minR = 2, maxR = this.ctx.walkRadius - 0.5) {
    const r = this.ctx.rand;
    const a = r() * Math.PI * 2, d = minR + Math.sqrt(r()) * (maxR - minR);
    const p = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    this.ctx.clamp(p);
    return p;
  }

  dispose() {
    this.ctx.root.clear();
  }
}

// ---------------------------------------------------------------- effects

/** Little bursts and floating "+1" texts. */
export class Effects {
  private items: { obj: THREE.Object3D; life: number; total: number; vel: THREE.Vector3; kind: 'burst' | 'text' }[] = [];
  constructor(private root: THREE.Group) {}

  burst(at: THREE.Vector3, color: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
      m.position.copy(at);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4);
      this.root.add(m);
      this.items.push({ obj: m, life: 0.6, total: 0.6, vel, kind: 'burst' });
    }
  }

  text(text: string, at: THREE.Vector3, color = '#ffe27a') {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.font = 'bold 40px "Baloo 2", sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 6;
    g.strokeStyle = '#2a1a10';
    g.strokeText(text, 64, 44);
    g.fillStyle = color;
    g.fillText(text, 64, 44);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    s.scale.set(1.2, 0.6, 1);
    s.position.copy(at).add(new THREE.Vector3(0, 1.6, 0));
    s.renderOrder = 6;
    this.root.add(s);
    this.items.push({ obj: s, life: 0.9, total: 0.9, vel: new THREE.Vector3(0, 1.2, 0), kind: 'text' });
  }

  update(dt: number) {
    this.items = this.items.filter((it) => {
      it.life -= dt;
      it.obj.position.addScaledVector(it.vel, dt);
      if (it.kind === 'burst') it.vel.y -= 9 * dt;
      const mat = (it.obj as THREE.Mesh).material as THREE.Material;
      mat.opacity = Math.max(0, it.life / it.total);
      if (it.life <= 0) {
        this.root.remove(it.obj);
        return false;
      }
      return true;
    });
  }
}
