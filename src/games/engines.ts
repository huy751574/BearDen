import * as THREE from 'three';
import { Engine, type GameCtx } from './types';
import type { Variant } from './catalog';
import { makeItem } from './items';
import { makeCreature, type Creature } from '../character/creatures';
import { sfx } from './sfx';

// The seven mini-game engines. Each is configured by a catalog Variant
// (items, enemies, wording), so one engine serves many scenes.

const tmp = new THREE.Vector3();

function groundRing(color: string, r = 0.6) {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(r * 0.75, r, 32),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.04;
  return m;
}

function shadow() {
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.35, 20), new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.25, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}

// ---------------------------------------------------------------- shooter

/** Minions walk in from the island edge; click (or Space) fires a beam. */
export class ShooterEngine extends Engine {
  private enemies: { c: Creature; alive: boolean; speed: number }[] = [];
  private spawnT = 1;
  private cooldown = 0;
  private beams: { m: THREE.Mesh; life: number }[] = [];

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, v.duration ?? 60);
  }

  start() {
    this.ctx.hud.toast(this.v.hint, 'info');
  }

  protected tick(dt: number) {
    this.cooldown -= dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = Math.max(0.55, 1.9 - this.time * 0.025);
    }
    const bear = this.bearPos();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const pos = e.c.root.position;
      tmp.subVectors(bear, pos).setY(0);
      const d = tmp.length();
      pos.addScaledVector(tmp.normalize(), Math.min(d, e.speed * dt));
      e.c.root.rotation.y = Math.atan2(tmp.x, tmp.z);
      e.c.update(dt, e.speed);
      if (d < 0.9) {
        this.kill(e, false);
        this.hurt();
        sfx.bad();
      }
    }
    this.beams = this.beams.filter((b) => {
      b.life -= dt;
      (b.m.material as THREE.MeshBasicMaterial).opacity = b.life / 0.25;
      if (b.life <= 0) this.ctx.root.remove(b.m);
      return b.life > 0;
    });
  }

  private spawn() {
    const a = this.ctx.rand() * Math.PI * 2, r = this.ctx.walkRadius;
    const c = makeCreature(this.v.enemy ?? 'slime');
    c.root.scale.multiplyScalar(this.v.enemyScale ?? 0.6);
    c.root.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    this.ctx.root.add(c.root);
    this.enemies.push({ c, alive: true, speed: 1.1 + this.ctx.rand() * 0.6 + this.time * 0.015 });
  }

  private kill(e: { c: Creature; alive: boolean }, scored: boolean) {
    e.alive = false;
    this.fx.burst(e.c.root.position.clone().setY(0.6), scored ? this.v.beamColor ?? '#38e1ff' : '#ff6060', 12);
    this.ctx.root.remove(e.c.root);
    if (scored) this.gain(1, e.c.root.position);
  }

  private fire(dir: THREE.Vector3) {
    if (this.cooldown > 0) return;
    this.cooldown = 0.3;
    dir.setY(0).normalize();
    const from = this.bearPos().clone().setY(0.9);
    this.ctx.bear.root.rotation.y = Math.atan2(dir.x, dir.z);
    const len = 14;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, len, 8),
      new THREE.MeshBasicMaterial({ color: this.v.beamColor ?? '#38e1ff', transparent: true }),
    );
    beam.position.copy(from).addScaledVector(dir, len / 2);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    this.ctx.root.add(beam);
    this.beams.push({ m: beam, life: 0.25 });
    sfx.zap();
    for (const e of this.enemies) {
      if (!e.alive) continue;
      tmp.subVectors(e.c.root.position, from).setY(0);
      const along = tmp.dot(dir);
      if (along < 0 || along > len) continue;
      if (tmp.addScaledVector(dir, -along).length() < 0.9) this.kill(e, true);
    }
  }

  onPointer(p: THREE.Vector3 | null) {
    if (p) this.fire(p.clone().sub(this.bearPos()));
    return true; // clicks shoot instead of walking
  }

  onKey(key: string) {
    if (key !== ' ') return false;
    const bear = this.bearPos();
    const target = this.enemies.filter((e) => e.alive).sort((a, b) => a.c.root.position.distanceTo(bear) - b.c.root.position.distanceTo(bear))[0];
    if (target) this.fire(target.c.root.position.clone().sub(bear));
    return true;
  }
}

// ---------------------------------------------------------------- catcher

/** Things fall from the sky; walk under the good ones, avoid the bad. */
export class CatcherEngine extends Engine {
  private falling: { g: THREE.Group; sh: THREE.Mesh; good: boolean; speed: number; spin: number }[] = [];
  private spawnT = 0.5;

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, v.duration ?? 45, (v.bad?.length ?? 0) > 0);
  }

  start() {
    this.ctx.hud.toast(this.v.hint, 'info');
  }

  protected tick(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = Math.max(0.35, 0.8 - this.time * 0.008);
    }
    const bear = this.bearPos();
    this.falling = this.falling.filter((f) => {
      f.g.position.y -= f.speed * dt;
      f.g.rotation.y += f.spin * dt;
      f.g.position.x += Math.sin(this.time * 2 + f.spin) * 0.3 * dt * (this.v.drift ?? 0);
      f.sh.position.set(f.g.position.x, 0.03, f.g.position.z);
      (f.sh.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - f.g.position.y / 9);
      const d = Math.hypot(f.g.position.x - bear.x, f.g.position.z - bear.z);
      let gone = false;
      if (f.g.position.y < 1.5 && f.g.position.y > 0.2 && d < 1.0) {
        gone = true;
        if (f.good) { this.gain(1, f.g.position); this.fx.burst(f.g.position, '#ffe27a', 8); sfx.good(); }
        else { this.hurt(); this.fx.burst(f.g.position, '#ff6060', 10); sfx.bad(); }
      } else if (f.g.position.y < 0) {
        gone = true;
        this.fx.burst(f.g.position.clone().setY(0.1), '#ffffff', 4);
      }
      if (gone) this.ctx.root.remove(f.g, f.sh);
      return !gone;
    });
  }

  private spawn() {
    const bad = (this.v.bad?.length ?? 0) > 0 && this.ctx.rand() < 0.25;
    const list = bad ? this.v.bad! : this.v.good ?? ['star'];
    const g = makeItem(list[Math.floor(this.ctx.rand() * list.length)]);
    // Half the drops land near the bear so there's always something to chase.
    const near = this.ctx.rand() < 0.5;
    const p = near ? this.bearPos().clone().add(new THREE.Vector3((this.ctx.rand() - 0.5) * 5, 0, (this.ctx.rand() - 0.5) * 5)) : this.randomSpot(0, this.ctx.walkRadius - 1);
    this.ctx.clamp(p);
    g.position.set(p.x, 9, p.z);
    g.scale.setScalar(1.4);
    const sh = shadow();
    this.ctx.root.add(g, sh);
    this.falling.push({ g, sh, good: !bad, speed: (this.v.fall ?? 3) * (0.8 + this.ctx.rand() * 0.5), spin: 1 + this.ctx.rand() * 2 });
  }
}

// ---------------------------------------------------------------- collector

/** Items are scattered on the island: collect them all before time runs out. */
export class CollectorEngine extends Engine {
  private items: { g: THREE.Group; base: THREE.Vector3; ph: number }[] = [];
  private total = 0;

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, v.duration ?? 45, false);
  }

  start() {
    this.total = this.v.count ?? 12;
    const placed: THREE.Vector3[] = [];
    for (let i = 0; i < this.total; i++) {
      let p = this.randomSpot(1.8);
      for (let k = 0; k < 20 && placed.some((q) => q.distanceTo(p) < 1.6); k++) p = this.randomSpot(1.8);
      placed.push(p);
      const g = makeItem(this.v.item ?? 'gem');
      g.scale.setScalar(1.5);
      g.position.copy(p).setY(this.v.float ?? 0.6);
      this.ctx.root.add(g);
      this.items.push({ g, base: p.clone(), ph: this.ctx.rand() * 6 });
    }
    this.ctx.hud.toast(this.v.hint, 'info');
  }

  protected tick(dt: number) {
    const bear = this.bearPos();
    this.items = this.items.filter((it) => {
      it.g.rotation.y += dt * 1.5;
      const h = this.v.float ?? 0.6;
      if (this.v.moving) {
        // Flutters around its spot, and darts away if the bear rushes in.
        const a = this.time * 1.3 + it.ph;
        it.g.position.set(it.base.x + Math.cos(a) * 0.9, h + 0.4 + Math.sin(this.time * 3 + it.ph) * 0.3, it.base.z + Math.sin(a * 1.2) * 0.9);
      } else {
        it.g.position.y = h + Math.sin(this.time * 2 + it.ph) * 0.12;
      }
      const d = Math.hypot(it.g.position.x - bear.x, it.g.position.z - bear.z);
      if (d < 0.95) {
        this.gain(1, it.g.position);
        this.fx.burst(it.g.position, '#ffe27a', 10);
        sfx.good();
        this.ctx.root.remove(it.g);
        return false;
      }
      return true;
    });
    this.ctx.hud.progress(`${this.score} / ${this.total}`);
    if (!this.items.length) {
      const bonus = Math.ceil((this.duration ?? 0) - this.time);
      this.score += bonus;
      this.ctx.hud.toast(`All found! +${bonus} time bonus`, 'good');
      this.finish(true);
    }
  }
}

// ---------------------------------------------------------------- timing

/** Press at the right moment: a sweeping meter, or react to a "!" cue. */
export class TimingEngine extends Engine {
  private round = 0;
  private phase: 'wait' | 'go' | 'meter' | 'pause' = 'pause';
  private t = 0;
  private needle = 0;
  private dir = 1;
  private zone = { c: 0.5, w: 0.3 };

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, null);
  }

  private get rounds() {
    return this.v.rounds ?? 8;
  }

  start() {
    this.ctx.hud.action(this.v.button ?? 'TAP!', () => this.press());
    this.next();
  }

  private next() {
    if (this.round >= this.rounds) return this.finish(true);
    this.round++;
    this.ctx.hud.progress(`Round ${this.round} / ${this.rounds}`);
    if (this.v.mode === 'reaction') {
      this.phase = 'wait';
      this.t = 1.2 + this.ctx.rand() * 2.8;
      this.ctx.hud.big(this.v.waitIcon ?? '…');
    } else {
      this.phase = 'meter';
      this.zone = { c: 0.2 + this.ctx.rand() * 0.6, w: Math.max(0.1, 0.32 - this.round * 0.025) };
      this.needle = 0;
      this.dir = 1;
      this.ctx.hud.big(null);
    }
  }

  protected tick(dt: number) {
    this.t -= dt;
    if (this.phase === 'pause' && this.t <= 0) this.next();
    if (this.phase === 'wait' && this.t <= 0) {
      this.phase = 'go';
      this.t = Math.max(0.35, 0.75 - this.round * 0.04);
      this.ctx.hud.big(this.v.goIcon ?? '❗');
      sfx.cue();
    } else if (this.phase === 'go' && this.t <= 0) {
      this.miss(this.v.slowText ?? 'Too slow!');
    }
    if (this.phase === 'meter') {
      const speed = 0.7 + this.round * 0.12;
      this.needle += this.dir * speed * dt;
      if (this.needle > 1) { this.needle = 1; this.dir = -1; }
      if (this.needle < 0) { this.needle = 0; this.dir = 1; }
      this.ctx.hud.meter(this.needle, this.zone.c - this.zone.w / 2, this.zone.c + this.zone.w / 2);
    } else {
      this.ctx.hud.meter(null);
    }
  }

  private press() {
    if (this.done) return;
    if (this.phase === 'wait') return this.miss(this.v.earlyText ?? 'Too early!');
    if (this.phase === 'go') return this.hit(2);
    if (this.phase === 'meter') {
      const off = Math.abs(this.needle - this.zone.c);
      if (off <= this.zone.w / 2) return this.hit(off < this.zone.w / 6 ? 3 : 1);
      return this.miss(this.v.missText ?? 'Miss!');
    }
  }

  private hit(points: number) {
    this.gain(points, this.bearPos(), points >= 3 ? 'Perfect!' : `+${points}`);
    this.ctx.hud.toast(this.v.hitText ?? 'Nice!', 'good');
    this.ctx.bear.wave();
    this.cheer();
    sfx.good();
    this.pause();
  }

  private miss(text: string) {
    this.hurt(text);
    sfx.bad();
    if (!this.done) this.pause();
  }

  private pause() {
    this.phase = 'pause';
    this.t = 0.8;
    this.ctx.hud.big(null);
  }

  onPointer() {
    this.press();
    return true;
  }

  onKey(key: string) {
    if (key !== ' ' && key !== 'enter') return false;
    this.press();
    return true;
  }

  dispose() {
    this.ctx.hud.action(null);
    this.ctx.hud.meter(null);
    this.ctx.hud.big(null);
    super.dispose();
  }
}

// ---------------------------------------------------------------- simon

/**
 * Watch the sequence, then repeat it on the pads (click or keys 1-4).
 * Two clear phases: "watch" (pads dimmed, each glows in turn) and "your
 * turn" (pads bright, presses get a short tap effect), with a pause between.
 */
export class SimonEngine extends Engine {
  private seq: number[] = [];
  private input = 0;
  private showing = false;
  private showT = 0;
  private showI = 0;

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, null);
  }

  start() {
    const pads = this.v.pads ?? ['🔴', '🔵', '🟡', '🟢'];
    this.ctx.hud.pads(pads, (i: number) => this.press(i));
    this.seq = [];
    this.addStep();
    this.addStep();
    this.extend(0.8);
  }

  /** Next pad, never the same as the previous one (a repeat looks like a glitch). */
  private addStep() {
    const last = this.seq[this.seq.length - 1];
    let pad = Math.floor(this.ctx.rand() * 4);
    if (pad === last) pad = (pad + 1 + Math.floor(this.ctx.rand() * 3)) % 4;
    this.seq.push(pad);
  }

  private extend(delay = 1.3) {
    this.addStep();
    this.replay(delay);
  }

  /** Start the "watch" phase after a pause. */
  private replay(delay: number) {
    this.showing = true;
    this.showI = 0;
    this.showT = delay;
    this.input = 0;
    this.ctx.hud.padsState('watch');
    this.ctx.hud.progress(`Watch 0 / ${this.seq.length}`);
    this.ctx.hud.big('👀');
  }

  protected tick(dt: number) {
    if (!this.showing) return;
    this.showT -= dt;
    if (this.showT > 0) return;
    if (this.showI < this.seq.length) {
      const pad = this.seq[this.showI++];
      this.ctx.hud.flashPad(pad, 'demo');
      this.ctx.hud.progress(`Watch ${this.showI} / ${this.seq.length}`);
      sfx.pad(pad);
      this.showT = Math.max(0.55, 0.85 - this.seq.length * 0.03); // glow 0.45 s + a visible gap
    } else {
      this.showing = false;
      this.ctx.hud.big(null);
      this.ctx.hud.padsState('input');
      this.ctx.hud.progress(`Your turn 0 / ${this.seq.length}`);
    }
  }

  private press(i: number) {
    if (this.showing || this.done) return;
    this.ctx.hud.flashPad(i, 'tap');
    sfx.pad(i);
    if (i !== this.seq[this.input]) {
      this.hurt(`${this.v.missText ?? 'Wrong!'} Watch again…`);
      sfx.bad();
      if (!this.done) this.replay(1.4);
      return;
    }
    this.input++;
    this.ctx.hud.progress(`Your turn ${this.input} / ${this.seq.length}`);
    if (this.input === this.seq.length) {
      this.gain(this.seq.length, this.bearPos());
      this.ctx.hud.toast(`${this.v.hitText ?? 'Perfect!'} Next: ${this.seq.length + 1}`, 'good');
      this.cheer();
      this.ctx.bear.wave();
      if (this.seq.length >= (this.v.rounds ?? 10)) return this.finish(true);
      this.extend();
    }
  }

  onKey(key: string) {
    const n = Number(key);
    if (n >= 1 && n <= 4) {
      this.press(n - 1);
      return true;
    }
    return false;
  }

  dispose() {
    this.ctx.hud.pads(null);
    this.ctx.hud.big(null);
    super.dispose();
  }
}

// ---------------------------------------------------------------- dodge

/** Warning rings appear, then something strikes there: keep moving! */
export class DodgeEngine extends Engine {
  private strikes: { ring: THREE.Mesh; obj: THREE.Group; at: THREE.Vector3; t: number; hit: boolean }[] = [];
  private spawnT = 1;

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, v.duration ?? 40);
  }

  start() {
    this.ctx.hud.toast(this.v.hint, 'info');
  }

  protected tick(dt: number) {
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawn();
      this.spawnT = Math.max(0.35, 1.2 - this.time * 0.02);
    }
    const bear = this.bearPos();
    const warn = 1.0;
    this.strikes = this.strikes.filter((s) => {
      s.t += dt;
      const k = Math.min(s.t / warn, 1);
      s.ring.scale.setScalar(0.4 + k * 0.8);
      (s.ring.material as THREE.MeshBasicMaterial).opacity = 0.4 + k * 0.5;
      // Falls from above during the last 0.3 s of the warning.
      const fall = THREE.MathUtils.clamp((s.t - (warn - 0.3)) / 0.3, 0, 1);
      s.obj.position.set(s.at.x, 7 * (1 - fall) + 0.3, s.at.z);
      s.obj.visible = s.t > warn - 0.35;
      if (!s.hit && s.t >= warn) {
        s.hit = true;
        this.fx.burst(s.at.clone().setY(0.3), this.v.burst ?? '#c8b89a', 12);
        if (Math.hypot(bear.x - s.at.x, bear.z - s.at.z) < 1.0) {
          this.hurt();
          sfx.bad();
        } else {
          this.score++;
        }
      }
      if (s.t > warn + 0.5) {
        this.ctx.root.remove(s.ring, s.obj);
        return false;
      }
      return true;
    });
  }

  private spawn() {
    const bear = this.bearPos();
    const aimed = this.ctx.rand() < 0.55;
    const at = aimed ? bear.clone().add(new THREE.Vector3((this.ctx.rand() - 0.5) * 2.4, 0, (this.ctx.rand() - 0.5) * 2.4)) : this.randomSpot(0);
    this.ctx.clamp(at);
    const ring = groundRing('#ff5050', 1.0);
    ring.position.set(at.x, 0.05, at.z);
    const obj = makeItem(this.v.hazard ?? 'boulder');
    obj.visible = false;
    this.ctx.root.add(ring, obj);
    this.strikes.push({ ring, obj, at, t: 0, hit: false });
  }
}

// ---------------------------------------------------------------- stealth

/** Sneak up on a watcher: freeze whenever it looks your way. */
export class StealthEngine extends Engine {
  private watcher!: Creature;
  private state: 'away' | 'turning' | 'watching' = 'away';
  private t = 3;
  private last = new THREE.Vector3();
  private startPos = new THREE.Vector3();
  private target = new THREE.Vector3();

  constructor(ctx: GameCtx, private v: Variant) {
    super(ctx, v.duration ?? 60);
  }

  start() {
    const a = this.ctx.anchors[this.v.anchor ?? ''];
    const bear = this.bearPos();
    if (a) this.target.set(a.x, 0, a.z);
    else this.target.copy(bear).setY(0).negate().setLength(this.ctx.walkRadius - 1.5);
    if (this.target.distanceTo(bear) < 5) this.target.copy(bear).setY(0).negate().setLength(this.ctx.walkRadius - 1.5);
    this.watcher = makeCreature(this.v.watcher ?? 'deer');
    this.watcher.root.position.copy(this.target);
    this.ctx.root.add(this.watcher.root);
    this.startPos.copy(bear);
    this.last.copy(bear);
    this.setState('away');
    this.ctx.hud.toast(this.v.hint, 'info');
  }

  private setState(s: StealthEngine['state']) {
    this.state = s;
    this.t = s === 'away' ? 2 + this.ctx.rand() * 2.5 : s === 'turning' ? 0.7 : 1.5 + this.ctx.rand() * 1.5;
    this.ctx.hud.big(s === 'away' ? '🙈' : s === 'turning' ? '⚠️' : '👀');
    if (this.v.watcher === 'cub') this.watcher.pose = s === 'watching' ? 'sit' : 'sleep';
    if (s === 'turning') sfx.cue();
  }

  protected tick(dt: number) {
    const bear = this.bearPos();
    const moved = bear.distanceTo(this.last) / Math.max(dt, 1e-3);
    this.last.copy(bear);
    this.t -= dt;
    if (this.t <= 0) this.setState(this.state === 'away' ? 'turning' : this.state === 'turning' ? 'watching' : 'away');
    // Face away from the bear, or right at it while watching.
    const toBear = Math.atan2(bear.x - this.target.x, bear.z - this.target.z);
    const goal = this.state === 'away' ? toBear + Math.PI : toBear;
    const r = this.watcher.root;
    r.rotation.y += Math.atan2(Math.sin(goal - r.rotation.y), Math.cos(goal - r.rotation.y)) * Math.min(1, dt * 6);
    this.watcher.update(dt, 0);

    if (this.state === 'watching' && moved > 0.3) {
      this.hurt(this.v.missText ?? 'Spotted!');
      sfx.bad();
      bear.copy(this.startPos);
      this.last.copy(bear);
      this.setState('away');
    }
    const d = Math.hypot(bear.x - this.target.x, bear.z - this.target.z);
    this.ctx.hud.progress(`${Math.max(0, d - 1.4).toFixed(1)} m to go`);
    if (d < 1.4) {
      this.score = Math.max(10, Math.round((this.duration ?? 60) - this.time)) + this.lives * 10;
      this.ctx.hud.toast(this.v.hitText ?? 'Made it!', 'good');
      this.finish(true);
    }
  }

  dispose() {
    this.ctx.hud.big(null);
    super.dispose();
  }
}
