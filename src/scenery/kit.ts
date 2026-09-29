import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';
import type { ThemeLook } from '../data/themeLooks';
import type { SceneEnv } from './Environment';

// Toolbox shared by all props and island templates: cached toon materials,
// a one-line "part" builder, placement with collision + a clear line of
// sight to the painted backdrop, flickering lights and per-frame animators.

export type V3 = [number, number, number];

export interface PartOpts {
  rot?: V3;
  scale?: V3 | number;
  outline?: number | false;
  emissive?: string;
  glow?: number; // emissive intensity
  opacity?: number;
  shadow?: boolean;
  basic?: boolean; // unlit (for glowing things)
}

export interface Circle { x: number; z: number; r: number }

export const geo = {
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  cyl: (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg),
  cone: (r: number, h: number, seg = 12) => new THREE.ConeGeometry(r, h, seg),
  sph: (r: number, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h),
  ico: (r: number, d = 1) => new THREE.IcosahedronGeometry(r, d),
  dodec: (r: number) => new THREE.DodecahedronGeometry(r, 0),
  torus: (r: number, tube: number, arc = Math.PI * 2, rs = 8, ts = 24) => new THREE.TorusGeometry(r, tube, rs, ts, arc),
  disc: (r: number, seg = 32) => new THREE.CircleGeometry(r, seg),
};

export class Kit {
  readonly group = new THREE.Group();
  /** Circles the bear cannot walk into. */
  readonly blockers: Circle[] = [];
  /** Everything placed so far (for scatter spacing), including walk-through things like rugs. */
  private occupied: Circle[] = [];
  private flicker: THREE.PointLight[] = [];
  private animators: ((t: number, dt: number) => void)[] = [];
  private mats = new Map<string, THREE.Material>();
  /** Island top colour; a template may override it. */
  ground: string;
  readonly night: boolean;
  private t = 0;

  constructor(
    readonly rand: () => number,
    readonly look: ThemeLook,
    readonly env: SceneEnv,
    readonly words: Set<string>,
    readonly walkRadius: number,
  ) {
    this.ground = look.ground;
    this.night = env.time === 'night' || env.below === 'space';
    this.occupied.push({ x: 0, z: 0, r: 1.6 }); // bear spawn point stays clear
  }

  has(...w: string[]) {
    return w.some((x) => this.words.has(x));
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rand() * arr.length)];
  }

  // ---------------------------------------------------------------- building

  mat(color: string, o: Pick<PartOpts, 'emissive' | 'glow' | 'opacity' | 'basic'> = {}) {
    const key = `${color}|${o.emissive ?? ''}|${o.glow ?? ''}|${o.opacity ?? ''}|${o.basic ? 1 : 0}`;
    let m = this.mats.get(key);
    if (!m) {
      const transparent = o.opacity !== undefined && o.opacity < 1;
      m = o.basic
        ? new THREE.MeshBasicMaterial({ color, transparent, opacity: o.opacity ?? 1 })
        : toonMaterial(color, {
            emissive: o.emissive ?? '#000000',
            emissiveIntensity: o.glow ?? (o.emissive ? 1 : 0),
            transparent,
            opacity: o.opacity ?? 1,
          });
      this.mats.set(key, m);
    }
    return m;
  }

  /** Add a mesh to `parent`; outline on by default. */
  part(parent: THREE.Object3D, g: THREE.BufferGeometry, color: string, pos: V3, o: PartOpts = {}) {
    const mesh = new THREE.Mesh(g, this.mat(color, o));
    mesh.position.set(...pos);
    if (o.rot) mesh.rotation.set(...o.rot);
    if (o.scale !== undefined) typeof o.scale === 'number' ? mesh.scale.setScalar(o.scale) : mesh.scale.set(...o.scale);
    mesh.castShadow = o.shadow ?? !o.basic;
    mesh.receiveShadow = !o.basic;
    if (o.outline !== false && !o.basic && (o.opacity ?? 1) >= 1) addOutline(mesh, o.outline ?? 0.02);
    parent.add(mesh);
    return mesh;
  }

  /** Point light; flickers gently when `flicker` (fires, lanterns). */
  light(parent: THREE.Object3D, color: string, intensity: number, distance: number, pos: V3, flicker = true) {
    const l = new THREE.PointLight(color, intensity, distance, 1.6);
    l.position.set(...pos);
    l.userData.base = intensity;
    parent.add(l);
    if (flicker) this.flicker.push(l);
    return l;
  }

  animate(fn: (t: number, dt: number) => void) {
    this.animators.push(fn);
  }

  update(dt: number) {
    this.t += dt;
    this.flicker.forEach((l, i) => {
      l.intensity = l.userData.base * (0.88 + Math.sin(this.t * 7 + i * 2.3) * 0.06 + Math.sin(this.t * 13 + i) * 0.06);
    });
    for (const a of this.animators) a(this.t, dt);
  }

  // ---------------------------------------------------------------- placement

  /** Tall things here would hide the painting (ahead, -Z) or the bear (camera side, +Z). */
  inSightline(x: number, z: number) {
    return z < 0.5 ? Math.abs(x) < 2.2 + -z * 0.45 : Math.abs(x) < 2;
  }

  isFree(x: number, z: number, r: number, tall = true) {
    if (Math.hypot(x, z) + r > this.walkRadius + 0.6) return false;
    if (tall && this.inSightline(x, z)) return false;
    return !this.occupied.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r + 0.3);
  }

  /** Place an object. `block` = collision radius (0 = walk-through). */
  put(obj: THREE.Object3D, x: number, z: number, o: { rotY?: number; scale?: number; block?: number; space?: number } = {}) {
    obj.position.set(x, obj.position.y, z);
    if (o.rotY !== undefined) obj.rotation.y = o.rotY;
    if (o.scale !== undefined) obj.scale.setScalar(o.scale);
    this.group.add(obj);
    const block = o.block ?? 0;
    if (block > 0) this.blockers.push({ x, z, r: block });
    this.occupied.push({ x, z, r: o.space ?? Math.max(block, 0.3) });
    return obj;
  }

  /** Reserve an area so scatter keeps out (e.g. a floor or a path). */
  reserve(x: number, z: number, r: number) {
    this.occupied.push({ x, z, r });
  }

  /** Random free spot on the island, or null. */
  spot(r: number, o: { minR?: number; maxR?: number; tall?: boolean } = {}) {
    const minR = o.minR ?? 2.5, maxR = o.maxR ?? this.walkRadius;
    for (let i = 0; i < 60; i++) {
      const a = this.rand() * Math.PI * 2;
      const d = minR + Math.sqrt(this.rand()) * (maxR - minR);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (this.isFree(x, z, r, o.tall ?? true)) return { x, z };
    }
    return null;
  }

  /** Place up to `n` objects from `make` at free random spots. */
  scatter(n: number, r: number, make: (i: number) => THREE.Object3D, o: { minR?: number; maxR?: number; tall?: boolean; block?: number } = {}) {
    for (let i = 0; i < n; i++) {
      const s = this.spot(r, o);
      if (!s) return;
      this.put(make(i), s.x, s.z, { rotY: this.rand() * Math.PI * 2, block: o.block ?? r, space: r });
    }
  }

  /** Angle that makes an object at (x, z) face the island centre. */
  faceCenter(x: number, z: number) {
    return Math.atan2(-x, -z);
  }
}
