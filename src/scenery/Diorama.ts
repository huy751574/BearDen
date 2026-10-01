import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';
import type { ThemeLook } from '../data/themeLooks';
import { Particles } from './Particles';
import { Backdrop } from './Backdrop';
import { Environment, type SceneEnv } from './Environment';
import { Kit } from './kit';
import { buildIsland } from './templates';
import { Companion, type BearInfo } from '../character/Companion';

// A sky island floating in front of the scene's painted backdrop. The props
// on it come from an island template (templates.ts, picked per scene in
// sceneEnv.json); sky, weather and the world below come from Environment.
// Random choices are seeded by scene id, so a scene always looks the same.

export const ISLAND_RADIUS = 11;
const WALK_RADIUS = ISLAND_RADIUS - 1.2;

export class Diorama {
  readonly group = new THREE.Group();
  /** Meshes the player can click to walk to. */
  readonly walkable: THREE.Object3D[] = [];
  /** Horizontal circles the bear can't enter (trees, rocks). */
  readonly blockers: { x: number; z: number; r: number }[] = [];
  private particles: Particles | null = null;
  private backdrop: Backdrop | null = null;
  private kit: Kit;
  private companions: Companion[] = [];
  readonly walkRadius = WALK_RADIUS;

  get anchors() {
    return this.kit.anchors;
  }

  get companionCreatures() {
    return this.companions.map((c) => c.creature);
  }
  private floaters: { obj: THREE.Object3D; baseY: number; phase: number; speed: number }[] = [];
  private t = 0;
  readonly environment: Environment;

  constructor(readonly look: ThemeLook, seed: string, readonly env: SceneEnv, backdropUrl?: string) {
    const rand = mulberry32(hash(seed));
    this.environment = new Environment(env, look, mulberry32(hash(seed + '/env')));
    this.group.add(this.environment.group);
    if (backdropUrl) {
      this.backdrop = new Backdrop(backdropUrl);
      this.group.add(this.backdrop.mesh);
    }
    // Props first: a template may change the island's ground colour.
    this.kit = new Kit(rand, look, env, new Set(seed.split('-')), WALK_RADIUS);
    buildIsland(this.kit, env.island ?? 'meadow', env.variant);
    this.group.add(this.kit.group);
    this.blockers.push(...this.kit.blockers);
    this.buildIsland(rand);
    this.buildFloatingRocks(rand);
    this.buildClouds(rand);
    const cast = env.companions ?? (env.companion ? [{ kind: env.companion, behavior: env.behavior ?? 'wander' }] : []);
    const world = {
      anchors: this.kit.anchors,
      walkRadius: WALK_RADIUS,
      clamp: (p: THREE.Vector3) => this.clampToWalkable(p),
      rand: mulberry32(hash(seed + '/companion')),
    };
    cast.forEach((c, i) => {
      const comp = new Companion(c.kind, c.behavior, world, i, c);
      this.companions.push(comp);
      this.group.add(comp.group);
    });
    if (env.weather !== 'none') {
      this.particles = new Particles(env.weather, look.accent, ISLAND_RADIUS + 4);
      this.group.add(this.particles.points);
    }
  }

  /** Keep walking companions from standing inside each other. */
  private separateCompanions() {
    const walkers = this.companions.filter((c) => c.creature.moves === 'walk' && c.pos.y < 0.5);
    for (let i = 0; i < walkers.length; i++) {
      for (let j = i + 1; j < walkers.length; j++) {
        const a = walkers[i].pos, b = walkers[j].pos;
        const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), min = 0.95;
        if (d < min) {
          const push = (min - d) / 2 / (d || 1);
          a.x -= dx * push; a.z -= dz * push;
          b.x += dx * push; b.z += dz * push;
        }
      }
    }
  }

  clampToWalkable(p: THREE.Vector3) {
    const d = Math.hypot(p.x, p.z);
    if (d > WALK_RADIUS) p.multiplyScalar(WALK_RADIUS / d);
    for (const b of this.blockers) {
      const dx = p.x - b.x, dz = p.z - b.z;
      const dist = Math.hypot(dx, dz);
      const min = b.r + 0.35;
      if (dist < min && dist > 1e-4) {
        p.x = b.x + (dx / dist) * min;
        p.z = b.z + (dz / dist) * min;
      }
    }
  }

  update(dt: number, bear: BearInfo) {
    this.t += dt;
    for (const c of this.companions) c.update(dt, bear);
    this.separateCompanions();
    this.environment.update(dt);
    this.particles?.update(dt);
    for (const f of this.floaters) {
      f.obj.position.y = f.baseY + Math.sin(this.t * f.speed + f.phase) * 0.35;
      f.obj.rotation.y += dt * 0.05 * f.speed;
    }
    this.kit.update(dt);
  }

  dispose() {
    this.backdrop?.dispose();
    this.environment.dispose();
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }

  // ---------------------------------------------------------------------------

  private buildIsland(rand: () => number) {
    const top = new THREE.Mesh(
      new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.3, 0.6, 64),
      toonMaterial(this.kit.ground),
    );
    top.position.y = -0.3;
    top.receiveShadow = true;
    addOutline(top, 0.05);

    // Jagged rock underside hanging below the grass, like a floating island.
    const under = rockGeometry(ISLAND_RADIUS - 0.2, 9, rand);
    const cliff = new THREE.Mesh(under, toonMaterial(this.look.groundSide));
    cliff.position.y = -0.6;
    cliff.castShadow = true;
    this.group.add(top, cliff);
    this.walkable.push(top);
  }

  private buildFloatingRocks(rand: () => number) {
    const mat = toonMaterial(this.look.groundSide);
    const grass = toonMaterial(this.kit.ground);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + rand() * 0.6;
      const r = ISLAND_RADIUS + 3 + rand() * 6;
      const size = 0.6 + rand() * 1.4;
      const g = new THREE.Group();
      const rock = new THREE.Mesh(rockGeometry(size, size * 2.2, rand), mat);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 0.95, size * 0.25, 12), grass);
      cap.position.y = size * 0.12;
      addOutline(cap, 0.03);
      g.add(rock, cap);
      const baseY = -3 + rand() * 5;
      g.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r);
      this.group.add(g);
      this.floaters.push({ obj: g, baseY, phase: rand() * 6, speed: 0.4 + rand() * 0.5 });
    }
  }

  private buildClouds(rand: () => number) {
    const night = this.env.time === 'night' || this.env.below === 'space';
    const tint = this.env.below === 'storm' ? '#7a808c' : night ? '#5d6788' : '#ffffff';
    const mat = toonMaterial(tint, { transparent: true, opacity: 0.92 });
    for (let i = 0; i < 9; i++) {
      const cloud = new THREE.Group();
      const puffs = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < puffs; k++) {
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + rand() * 0.8, 1), mat);
        puff.position.set(k * 1.1 - puffs * 0.5, rand() * 0.5, (rand() - 0.5) * 0.8);
        puff.scale.y = 0.6;
        cloud.add(puff);
      }
      const a = rand() * Math.PI * 2;
      const r = ISLAND_RADIUS + 1 + rand() * 12;
      const baseY = -5 - rand() * 6;
      cloud.position.set(Math.cos(a) * r, baseY, Math.sin(a) * r);
      cloud.rotation.y = rand() * Math.PI;
      this.group.add(cloud);
      this.floaters.push({ obj: cloud, baseY, phase: rand() * 6, speed: 0.2 + rand() * 0.2 });
    }
  }
}

/** Downward-pointing cone with noisy vertices: the underside of a floating rock. */
function rockGeometry(radius: number, depth: number, rand: () => number) {
  const geo = new THREE.ConeGeometry(radius, depth, 20, 5);
  geo.rotateX(Math.PI);
  geo.translate(0, -depth / 2, 0);
  // Noise is a function of angle (periodic), so duplicated seam vertices move together.
  const [s1, s2, s3] = [rand() * 6.28, rand() * 6.28, rand() * 6.28];
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    if (v.y > -0.01) continue; // keep the top rim flat so it meets the grass
    const a = Math.atan2(v.z, v.x);
    const k = v.y / depth; // 0 at rim .. -1 at tip
    const jitter = 1 + 0.14 * Math.sin(3 * a + s1) + 0.1 * Math.sin(7 * a + s2 + k * 5);
    v.x *= jitter;
    v.z *= jitter;
    v.y *= 1 + 0.12 * Math.sin(5 * a + s3);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  const flat = geo.toNonIndexed();
  flat.computeVertexNormals();
  return flat;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
