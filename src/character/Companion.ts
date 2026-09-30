import * as THREE from 'three';
import { makeCreature, isBird, type Creature } from './creatures';
import type { Anchor } from '../scenery/kit';

// A scene's secondary character: a creature plus a behaviour script that
// runs on its own (wander, perform on stage, sleep, prowl...), reacts to the
// bear (looks at it, waves back, wakes up, flees) and shows emoji bubbles.
// Which companion and behaviour a scene gets is set in sceneEnv.json.

export type Behavior =
  | 'wander' | 'follow' | 'perform' | 'sit' | 'sleep' | 'prowl' | 'defeated' | 'flee'
  | 'fly' | 'swim' | 'float' | 'orbit' | 'spar' | 'dance' | 'emerge' | 'swarm';

export interface CompanionWorld {
  anchors: Record<string, Anchor>;
  walkRadius: number;
  /** Push a point out of obstacles / back onto the island. */
  clamp(p: THREE.Vector3): void;
  rand: () => number;
}

export interface BearInfo {
  pos: THREE.Vector3;
  speed: number;
  /** Increments each time the bear waves. */
  waves: number;
}

const tmp = new THREE.Vector3();

export class Companion {
  readonly group = new THREE.Group();
  readonly creature: Creature;
  readonly pos = new THREE.Vector3();
  private target: THREE.Vector3 | null = null;
  private state = 'start';
  private timer = 0;
  private t = 0;
  private seenWaves = 0;
  private greetCooldown = 0;
  private bearIdle = 0;
  private emote: Emote;
  private arc: { from: THREE.Vector3; to: THREE.Vector3; t: number } | null = null;
  private riseY = 0;

  /** slot = index among the scene's companions; extras are placed apart from the first. */
  constructor(kind: string, readonly behavior: Behavior, private world: CompanionWorld, readonly slot = 0) {
    this.creature = makeCreature(kind);
    this.emote = new Emote(this.creature.top + 0.35);
    this.group.add(this.creature.root);
    this.creature.root.add(this.emote.sprite);
    this.emote.sprite.scale.divideScalar(this.creature.root.scale.x); // keep bubbles the same size
    this.emote.sprite.position.y /= this.creature.root.scale.x;
    this.place();
  }

  // ---------------------------------------------------------------- setup

  private anchor(...names: string[]) {
    for (const n of names) if (this.world.anchors[n]) return this.world.anchors[n];
    return null;
  }

  private spot(minR = 2.5, maxR = this.world.walkRadius - 0.5) {
    const r = this.world.rand;
    const a = r() * Math.PI * 2, d = minR + Math.sqrt(r()) * (maxR - minR);
    const p = new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d);
    this.world.clamp(p);
    return p;
  }

  /** Starting position for each behaviour. */
  private place() {
    const b = this.behavior;
    const root = this.creature.root;
    const a = this.anchor(b === 'perform' || b === 'dance' ? 'stage' : b === 'float' || b === 'swim' ? 'pond' : b === 'sleep' ? 'bed' : 'seat', 'fire', 'loom');
    if (b === 'emerge') {
      // Big villain rising from beyond the island edge, beside the painting (a second one mirrors it).
      this.pos.set(this.slot % 2 ? -10.5 : 10.5, 0.3, -8);
      root.rotation.y = Math.atan2(-this.pos.x, -this.pos.z);
    } else if (b === 'swim' && !a) {
      this.pos.set(0, -9, 16); // whale circling below
    } else if (a) {
      const toCenter = Math.atan2(-a.x, -a.z);
      const off = b === 'perform' || b === 'float' || b === 'swim' || b === 'sleep' ? 0 : a.r + 0.9;
      // Extras stand beside the first: alternate left/right, 1.3 m apart.
      const side = this.slot ? (this.slot % 2 ? 1 : -1) * Math.ceil(this.slot / 2) * 1.3 : 0;
      this.pos.set(
        a.x + Math.sin(toCenter) * off + Math.cos(toCenter) * side,
        a.y,
        a.z + Math.cos(toCenter) * off - Math.sin(toCenter) * side,
      );
      root.rotation.y = toCenter;
    } else {
      this.pos.copy(this.spot(2.6, 4.5));
      root.rotation.y = Math.atan2(-this.pos.x, -this.pos.z);
    }
    if (b === 'sleep') this.creature.pose = 'sleep';
    if (b === 'sit') this.creature.pose = 'sit';
    if (b === 'defeated') {
      this.pos.copy(this.spot(5, 7));
      this.creature.pose = 'sleep';
    }
    root.position.copy(this.pos);
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number, bear: BearInfo) {
    this.t += dt;
    this.timer -= dt;
    this.greetCooldown -= dt;
    this.bearIdle = bear.speed < 0.05 ? this.bearIdle + dt : 0;
    const dist = Math.hypot(bear.pos.x - this.pos.x, bear.pos.z - this.pos.z);
    let speed = 0;

    switch (this.behavior) {
      case 'wander': speed = this.wander(dt, bear, dist); break;
      case 'follow': speed = this.follow(dt, bear, dist); break;
      case 'perform': this.perform(bear, dist); break;
      case 'dance': this.dance(bear, dist); break;
      case 'sit': this.sit(bear); break;
      case 'sleep': this.sleep(bear, dist); break;
      case 'prowl': speed = this.prowl(dt, bear); break;
      case 'defeated': this.defeated(); break;
      case 'flee': speed = this.flee(dt, bear, dist); break;
      case 'fly': this.fly(dt, bear); break;
      case 'swim': this.swim(dt); break;
      case 'float': this.float(); break;
      case 'orbit': this.orbit(bear); break;
      case 'spar': speed = this.spar(dt, bear, dist); break;
      case 'emerge': this.emergeTick(dt, bear); break;
      case 'swarm': this.swarm(dt, bear); break;
    }

    // Reactions shared by everyone who isn't asleep or knocked out.
    const awake = this.behavior !== 'sleep' && this.behavior !== 'defeated';
    if (bear.waves !== this.seenWaves) {
      this.seenWaves = bear.waves;
      if (awake && dist < 9) {
        this.creature.act('wave', 1.6);
        this.emote.show('❤️', 1.8);
      }
    }
    if (awake && dist < 2.2 && this.greetCooldown <= 0 && !['swim', 'emerge', 'swarm'].includes(this.behavior)) {
      this.greetCooldown = 14;
      this.emote.show(pick(['✨', '😊', '♪', '👋']), 1.6);
    }

    this.creature.root.position.copy(this.pos);
    this.creature.update(dt, speed);
    this.emote.update(dt);
  }

  // ---------------------------------------------------------------- helpers

  /** Walk toward `target`; returns true when arrived. */
  private walk(dt: number, target: THREE.Vector3, speed: number) {
    tmp.subVectors(target, this.pos).setY(0);
    const d = tmp.length();
    if (d < 0.15) return true;
    this.pos.addScaledVector(tmp.normalize(), Math.min(d, speed * dt));
    this.world.clamp(this.pos);
    this.turnTo(Math.atan2(tmp.x, tmp.z), dt, 8);
    return false;
  }

  private turnTo(yaw: number, dt: number, rate = 6) {
    const r = this.creature.root;
    const delta = Math.atan2(Math.sin(yaw - r.rotation.y), Math.cos(yaw - r.rotation.y));
    r.rotation.y += delta * Math.min(1, dt * rate);
  }

  private yawTo(p: THREE.Vector3) {
    return Math.atan2(p.x - this.pos.x, p.z - this.pos.z);
  }

  /** Turn the head toward the bear when it's close enough. */
  private watch(bear: BearInfo, range = 5) {
    const d = Math.hypot(bear.pos.x - this.pos.x, bear.pos.z - this.pos.z);
    if (d > range) return void (this.creature.lookYaw = null);
    const yaw = this.yawTo(bear.pos) - this.creature.root.rotation.y;
    this.creature.lookYaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
  }

  // ---------------------------------------------------------------- behaviours

  private wander(dt: number, bear: BearInfo, dist: number) {
    if (this.state === 'walk' && this.target) {
      this.watch(bear, 3);
      if (this.walk(dt, this.target, 1.2)) { this.state = 'idle'; this.timer = 2 + this.world.rand() * 4; }
      return 1.2;
    }
    this.watch(bear, 5);
    if (dist < 4) this.turnTo(this.yawTo(bear.pos), dt, 2);
    if (this.state !== 'idle') { this.state = 'idle'; this.timer = 1; }
    if (this.timer <= 0) {
      if (this.world.rand() < 0.25) this.creature.act(pick(['dance', 'cheer', 'wave']), 2);
      this.target = this.spot(2, this.world.walkRadius - 1);
      this.state = 'walk';
    }
    return 0;
  }

  private follow(dt: number, bear: BearInfo, dist: number) {
    this.watch(bear, 6);
    if (this.bearIdle > 8 && dist < 3) {
      this.creature.pose = 'sit';
      if (this.timer <= 0) { this.emote.show(pick(['💭', '♪', '😌']), 2); this.timer = 7; }
      return 0;
    }
    this.creature.pose = 'stand';
    if (dist > 2.3) {
      tmp.subVectors(this.pos, bear.pos).setY(0).setLength(1.8).add(bear.pos);
      this.walk(dt, tmp.clone(), Math.min(Math.max(bear.speed, 1.5) + 0.6, 5));
      return Math.max(bear.speed, 1.5);
    }
    this.turnTo(this.yawTo(bear.pos), dt, 3);
    return 0;
  }

  private perform(bear: BearInfo, dist: number) {
    // Face the audience (island centre), cycle sing -> dance -> cheer.
    this.creature.root.rotation.y = Math.atan2(-this.pos.x, -this.pos.z);
    this.watch(bear, 8);
    if (this.timer <= 0) {
      const phase = Math.floor(this.t / 6) % 3;
      if (phase === 0) { this.creature.act('sing', 6); this.emote.show('🎵', 1.5); }
      if (phase === 1) this.creature.act('dance', 6);
      if (phase === 2) { this.creature.act('cheer', 2); this.emote.show(dist < 5 ? '💖' : '🎶', 1.5); }
      this.timer = phase === 0 ? 2 : 6;
    }
  }

  private dance(bear: BearInfo, dist: number) {
    this.watch(bear, 6);
    if (this.timer <= 0) {
      this.creature.act('dance', 5);
      if (dist < 4) this.emote.show(pick(['💃', '🎶', '✨']), 1.5);
      this.timer = 5;
    }
  }

  private sit(bear: BearInfo) {
    this.creature.pose = 'sit';
    this.watch(bear, 6);
    if (this.timer <= 0) { this.emote.show(pick(['☕', '💭', '♪', '😌']), 2); this.timer = 8 + this.world.rand() * 6; }
  }

  private sleep(bear: BearInfo, dist: number) {
    if (this.state === 'awake') {
      this.watch(bear, 6);
      if (this.timer <= 0) { this.state = 'asleep'; this.creature.pose = 'sleep'; }
      return;
    }
    this.creature.lookYaw = null;
    if (dist < 1.6) {
      this.state = 'awake';
      this.creature.pose = 'sit';
      this.emote.show('❗', 1.2);
      this.timer = 6;
      return;
    }
    if (this.timer <= 0) { this.emote.show('💤', 2.2); this.timer = 3; }
  }

  private prowl(dt: number, bear: BearInfo) {
    if (this.state === 'roar') {
      this.turnTo(this.yawTo(bear.pos), dt, 4);
      if (this.timer <= 0) { this.state = 'walk'; this.timer = 7 + this.world.rand() * 4; }
      return 0;
    }
    if (this.timer <= 0) {
      this.state = 'roar';
      this.timer = 2.2;
      this.creature.act('roar', 1.6);
      this.emote.show('💢', 1.6);
      return 0;
    }
    const r = this.world.walkRadius - 0.6;
    const a = Math.atan2(this.pos.z, this.pos.x) + 0.25;
    this.walk(dt, new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), 1.1);
    return 1.1;
  }

  private defeated() {
    this.creature.pose = 'sleep';
    if (this.timer <= 0) { this.emote.show('💫', 2.5); this.timer = 3.5; }
  }

  private flee(dt: number, bear: BearInfo, dist: number) {
    if (this.state === 'run' && this.target) {
      if (this.walk(dt, this.target, 4)) this.state = 'graze';
      return 4;
    }
    this.watch(bear, 6);
    if (dist < 3.5) {
      // Run to the far side of the island from the bear.
      tmp.subVectors(this.pos, bear.pos).setY(0).normalize().multiplyScalar(this.world.walkRadius - 1);
      this.target = tmp.clone();
      this.world.clamp(this.target);
      this.state = 'run';
      this.emote.show('❗', 1.2);
    }
    return 0;
  }

  private fly(dt: number, bear: BearInfo) {
    const bird = isBird(this.creature) ? this.creature : null;
    if (this.state === 'landed') {
      if (bird) bird.flying = false;
      this.watch(bear, 5);
      if (this.timer <= 0 || Math.hypot(bear.pos.x - this.pos.x, bear.pos.z - this.pos.z) < 1.5) {
        this.state = 'air';
        this.timer = 12 + this.world.rand() * 8;
      }
      return;
    }
    if (this.state === 'landing' && this.target) {
      if (bird) bird.flying = true;
      tmp.subVectors(this.target, this.pos);
      this.pos.addScaledVector(tmp, Math.min(1, dt * 1.2));
      this.turnTo(Math.atan2(tmp.x, tmp.z), dt, 4);
      if (tmp.length() < 0.1) { this.state = 'landed'; this.timer = 6 + this.world.rand() * 4; this.pos.copy(this.target); }
      return;
    }
    // Circle above the island, then pick a spot to land.
    if (bird) bird.flying = true;
    if (this.state !== 'air') { this.state = 'air'; this.timer = 10; }
    const a = this.t * 0.35 + this.slot * 2.1;
    const r = this.creature.top > 3 ? 12 : 5.5 + this.slot * 0.8;
    const h = this.creature.top > 3 ? 9 : 4.5;
    const goal = new THREE.Vector3(Math.cos(a) * r, h + Math.sin(this.t) * 0.5, Math.sin(a) * r);
    tmp.subVectors(goal, this.pos);
    this.pos.addScaledVector(tmp, Math.min(1, dt * 1.5));
    this.turnTo(Math.atan2(tmp.x, tmp.z), dt, 3);
    if (this.timer <= 0 && this.creature.top < 3) {
      this.target = this.spot(2.5, this.world.walkRadius - 1);
      this.state = 'landing';
    }
  }

  private swim(dt: number) {
    const pond = this.anchor('pond');
    if (!pond) {
      // Big swimmer circling far below the island.
      const a = this.t * 0.12;
      this.pos.set(Math.cos(a) * 16, -9 + Math.sin(this.t * 0.5), Math.sin(a) * 16);
      this.creature.root.rotation.y = -a + Math.PI; // tangent to the circle
      return;
    }
    // Fish leaping in arcs across the pond.
    if (!this.arc) {
      if (this.timer > 0) { this.pos.set(pond.x, -1, pond.z); return; }
      const r = this.world.rand, rr = pond.r * 0.6;
      const a1 = r() * Math.PI * 2, a2 = a1 + Math.PI * (0.6 + r() * 0.8);
      this.arc = {
        from: new THREE.Vector3(pond.x + Math.cos(a1) * rr, 0, pond.z + Math.sin(a1) * rr),
        to: new THREE.Vector3(pond.x + Math.cos(a2) * rr, 0, pond.z + Math.sin(a2) * rr),
        t: 0,
      };
    }
    this.arc.t += dt;
    const k = Math.min(this.arc.t / 1.1, 1);
    this.pos.lerpVectors(this.arc.from, this.arc.to, k);
    this.pos.y = Math.sin(k * Math.PI) * 1.4 - 0.1;
    const root = this.creature.root;
    root.rotation.y = this.yawTo(this.arc.to);
    root.rotation.x = -Math.cos(k * Math.PI) * 0.8;
    if (k >= 1) {
      this.arc = null;
      this.timer = 1.5 + this.world.rand() * 2.5;
      if (this.world.rand() < 0.4) this.emote.show('💦', 1);
    }
  }

  private float() {
    const pond = this.anchor('pond');
    const a = this.t * 0.15 + this.slot * Math.PI;
    const r = pond ? pond.r * 0.45 : 0;
    this.pos.set((pond?.x ?? this.pos.x) + Math.cos(a) * r, 0.1 + Math.sin(this.t * 1.5) * 0.04, (pond?.z ?? this.pos.z) + Math.sin(a) * r);
    this.creature.root.rotation.y = -a;
    this.creature.pose = 'sit';
    if (this.timer <= 0) { this.emote.show(pick(['😌', '♪', '🐟']), 2); this.timer = 9; }
  }

  private orbit(bear: BearInfo) {
    const a = this.t * 0.6 + this.slot * Math.PI;
    this.pos.set(bear.pos.x + Math.cos(a) * 1.7, 1.6 + Math.sin(this.t * 1.7) * 0.25, bear.pos.z + Math.sin(a) * 1.7);
    this.creature.root.rotation.y = this.yawTo(bear.pos);
    if (this.timer <= 0) { this.emote.show(pick(['✨', '🌟', '💛']), 1.5); this.timer = 10; }
  }

  private spar(dt: number, bear: BearInfo, dist: number) {
    this.turnTo(this.yawTo(bear.pos), dt, 6);
    if (this.state === 'lunge') {
      if (this.walk(dt, bear.pos.clone().lerp(this.pos, 0.5), 5) || this.timer <= 0) { this.state = 'back'; this.timer = 1; }
      return 5;
    }
    if (this.timer <= 0) {
      this.state = 'lunge';
      this.timer = 0.6;
      this.creature.act('roar', 0.6);
      this.emote.show('⚔️', 1.2);
      return 0;
    }
    // Circle the bear at duelling distance.
    const a = Math.atan2(this.pos.z - bear.pos.z, this.pos.x - bear.pos.x) + dt * 0.5;
    const goal = new THREE.Vector3(bear.pos.x + Math.cos(a) * 3, 0, bear.pos.z + Math.sin(a) * 3);
    this.walk(dt, goal, dist < 2.5 ? 2.5 : 1.4);
    if (this.state !== 'circle') { this.state = 'circle'; this.timer = 5 + this.world.rand() * 3; }
    return 1.4;
  }

  private emergeTick(dt: number, bear: BearInfo) {
    const root = this.creature.root;
    root.rotation.y = Math.atan2(-this.pos.x, -this.pos.z) + Math.sin(this.t * 0.4) * 0.15;
    this.riseY = THREE.MathUtils.damp(this.riseY, this.state === 'rise' ? 1.6 : 0, 2, dt);
    this.pos.y = 0.3 + Math.sin(this.t * 0.6) * 0.4 + this.riseY;
    if (this.timer <= 0) {
      const rising = this.state !== 'rise';
      this.state = rising ? 'rise' : 'sink';
      this.timer = rising ? 2.5 : 7 + this.world.rand() * 4;
      if (rising) {
        this.creature.act('roar', 2);
        this.emote.show('💢', 2);
      }
    }
    void bear;
  }

  private swarm(dt: number, bear: BearInfo) {
    const home = this.anchor('tree') ?? { x: -4, z: -1, r: 0, y: 0 };
    const d = Math.hypot(bear.pos.x - home.x, bear.pos.z - home.z);
    if (d < 2.6 && this.state !== 'chase') {
      this.state = 'chase';
      this.timer = 3;
      this.emote.show('💢', 1.5);
    }
    const goal = this.state === 'chase' && this.timer > 0 ? bear.pos : new THREE.Vector3(home.x, 0, home.z);
    if (this.state === 'chase' && this.timer <= 0) this.state = 'home';
    this.pos.lerp(tmp.set(goal.x, 0, goal.z), Math.min(1, dt * 2));
  }
}

function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}

// ---------------------------------------------------------------- emote bubble

const emoteTextures = new Map<string, THREE.Texture>();

function emoteTexture(text: string) {
  let tex = emoteTextures.get(text);
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    g.arc(64, 58, 50, 0, Math.PI * 2);
    g.moveTo(52, 100);
    g.lineTo(64, 124);
    g.lineTo(76, 100);
    g.fill();
    g.font = '60px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 62);
    tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    emoteTextures.set(text, tex);
  }
  return tex;
}

class Emote {
  readonly sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  private life = 0;
  private total = 1;

  constructor(height: number) {
    this.sprite.position.y = height;
    this.sprite.scale.setScalar(0.7);
    this.sprite.visible = false;
    this.sprite.renderOrder = 5;
  }

  show(text: string, seconds: number) {
    this.sprite.material.map = emoteTexture(text);
    this.sprite.material.needsUpdate = true;
    this.life = this.total = seconds;
    this.sprite.visible = true;
  }

  update(dt: number) {
    if (this.life <= 0) return;
    this.life -= dt;
    const k = this.life / this.total;
    this.sprite.material.opacity = Math.min(1, k * 4, (1 - k) * 8);
    if (this.life <= 0) this.sprite.visible = false;
  }
}
