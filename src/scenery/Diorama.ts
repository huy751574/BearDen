import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';
import type { ThemeLook, Vegetation } from '../data/themeLooks';
import { Particles } from './Particles';
import { Backdrop } from './Backdrop';
import { Environment, type SceneEnv } from './Environment';

// Shared test diorama: a sky island floating in front of the scene's painted
// backdrop. The island's props come from the theme preset (layout seeded by
// scene id); sky, weather and the world below come from the scene's SceneEnv.
// M3 replaces the island body with per-theme templates.

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
  private lights: THREE.PointLight[] = [];
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
    this.buildIsland(rand);
    this.buildFloatingRocks(rand);
    this.buildClouds(rand);
    this.buildVegetation(look.vegetation, rand);
    this.buildRocks(rand);
    if (look.lanterns || env.time === 'night') this.buildLanterns(rand);
    if (env.weather !== 'none') {
      this.particles = new Particles(env.weather, look.accent, ISLAND_RADIUS + 4);
      this.group.add(this.particles.points);
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

  update(dt: number) {
    this.t += dt;
    this.environment.update(dt);
    this.particles?.update(dt);
    for (const f of this.floaters) {
      f.obj.position.y = f.baseY + Math.sin(this.t * f.speed + f.phase) * 0.35;
      f.obj.rotation.y += dt * 0.05 * f.speed;
    }
    this.lights.forEach((l, i) => (l.intensity = 3 + Math.sin(this.t * 3 + i * 1.7) * 0.4));
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
      toonMaterial(this.look.ground),
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
    const grass = toonMaterial(this.look.ground);
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

  private scatter(rand: () => number, count: number, minR: number, fn: (x: number, z: number, i: number) => void) {
    for (let i = 0, tries = 0; i < count && tries < count * 20; tries++) {
      const a = rand() * Math.PI * 2;
      const r = minR + Math.sqrt(rand()) * (WALK_RADIUS - minR);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + 1.2)) continue;
      fn(x, z, i++);
    }
  }

  private buildVegetation(kind: Vegetation, rand: () => number) {
    if (kind === 'none') return;
    const leaf = toonMaterial(this.look.leaf);
    const trunk = toonMaterial('#6b4a33');
    const count = kind === 'bamboo' ? 18 : 12;

    this.scatter(rand, count, 3.5, (x, z) => {
      const tree = new THREE.Group();
      const s = 0.8 + rand() * 0.6;
      const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.y = y;
        m.castShadow = true;
        addOutline(m, 0.03);
        tree.add(m);
        return m;
      };
      switch (kind) {
        case 'pine':
          mesh(new THREE.CylinderGeometry(0.15, 0.2, 1, 8), trunk, 0.5);
          mesh(new THREE.ConeGeometry(1.1, 1.6, 8), leaf, 1.5);
          mesh(new THREE.ConeGeometry(0.85, 1.3, 8), leaf, 2.3);
          mesh(new THREE.ConeGeometry(0.55, 1.0, 8), leaf, 3.0);
          break;
        case 'round':
          mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.4, 8), trunk, 0.7);
          mesh(new THREE.IcosahedronGeometry(1.0, 1), leaf, 2.0);
          mesh(new THREE.IcosahedronGeometry(0.7, 1), leaf, 2.3).position.x = 0.6;
          break;
        case 'bamboo': {
          const green = toonMaterial(this.look.leaf);
          for (let k = 0; k < 3; k++) {
            const h = 3 + rand() * 2;
            const stalk = mesh(new THREE.CylinderGeometry(0.07, 0.08, h, 6), green, h / 2);
            stalk.position.x = (rand() - 0.5) * 0.6;
            stalk.position.z = (rand() - 0.5) * 0.6;
            const tuft = mesh(new THREE.ConeGeometry(0.4, 0.9, 5), leaf, h);
            tuft.position.x = stalk.position.x;
            tuft.position.z = stalk.position.z;
          }
          break;
        }
        case 'palm': {
          const trunkM = mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 8), trunk, 1.3);
          trunkM.rotation.z = 0.15;
          for (let k = 0; k < 6; k++) {
            const frond = mesh(new THREE.ConeGeometry(0.25, 1.6, 4), leaf, 2.6);
            frond.rotation.set(Math.PI / 2.4, (k / 6) * Math.PI * 2, 0, 'YXZ');
            frond.position.x = 0.35;
          }
          break;
        }
        case 'crystal':
          for (let k = 0; k < 3; k++) {
            const c = mesh(
              new THREE.OctahedronGeometry(0.35 + rand() * 0.3),
              toonMaterial(this.look.leaf, { emissive: this.look.leaf, emissiveIntensity: 0.5 }),
              0.5 + rand(),
            );
            c.scale.y = 2;
            c.position.x = (rand() - 0.5) * 0.8;
            c.rotation.z = (rand() - 0.5) * 0.5;
          }
          break;
      }
      tree.position.set(x, 0, z);
      tree.scale.setScalar(s);
      tree.rotation.y = rand() * Math.PI * 2;
      this.group.add(tree);
      this.blockers.push({ x, z, r: kind === 'bamboo' ? 0.5 : 0.45 * s });
    });
  }

  private buildRocks(rand: () => number) {
    const mat = toonMaterial('#8a8a90');
    this.scatter(rand, 6, 2.5, (x, z) => {
      const s = 0.3 + rand() * 0.5;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), mat);
      rock.position.set(x, s * 0.4, z);
      rock.rotation.set(rand(), rand(), rand());
      rock.castShadow = rock.receiveShadow = true;
      addOutline(rock, 0.03);
      this.group.add(rock);
      this.blockers.push({ x, z, r: s });
    });
  }

  private buildLanterns(rand: () => number) {
    const post = toonMaterial('#3a2a22');
    const glow = new THREE.MeshBasicMaterial({ color: this.look.accent });
    this.scatter(rand, 4, 3, (x, z) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.4, 6), post);
      pole.position.y = 0.7;
      addOutline(pole, 0.02);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.3), glow);
      lamp.position.y = 1.55;
      addOutline(lamp, 0.02);
      const light = new THREE.PointLight(this.look.accent, 3, 6, 1.5);
      light.position.y = 1.55;
      this.lights.push(light);
      g.add(pole, lamp, light);
      g.position.set(x, 0, z);
      this.group.add(g);
      this.blockers.push({ x, z, r: 0.2 });
    });
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
