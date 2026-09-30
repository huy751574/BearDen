import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';
import { ChibiBear, BLACK_BEAR, type ChibiSpec, type Pose, type Action } from './ChibiBear';

// Every companion species. Two-legged chibis reuse ChibiBear with a spec;
// four-legged animals, birds, fish and the big villains have small builders
// here. All share the Creature interface so companion scripts can drive any.

export interface Creature {
  readonly root: THREE.Object3D;
  pose: Pose;
  lookYaw: number | null;
  act(action: Action, seconds: number): void;
  update(dt: number, speed: number): void;
  /** How the creature gets around (companion scripts use this). */
  readonly moves: 'walk' | 'fly' | 'swim' | 'float' | 'fixed';
  /** Height above the root where emote bubbles go. */
  readonly top: number;
}

type V3 = [number, number, number];

// ---------------------------------------------------------------- helpers

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3, o: { rot?: V3; scale?: V3; outline?: number | false; glow?: boolean } = {}) {
  const m = new THREE.Mesh(geo, o.glow ? new THREE.MeshBasicMaterial({ color }) : toonMaterial(color));
  m.position.set(...pos);
  if (o.rot) m.rotation.set(...o.rot);
  if (o.scale) m.scale.set(...o.scale);
  m.castShadow = !o.glow;
  if (o.outline !== false && !o.glow) addOutline(m, o.outline ?? 0.02);
  parent.add(m);
  return m;
}
const sph = (r: number) => new THREE.SphereGeometry(r, 20, 14);
const face = (parent: THREE.Object3D, z: number, y: number, spread: number, r = 0.045) => {
  for (const s of [-1, 1]) {
    const e = mesh(parent, sph(r), '#1c1618', [spread * s, y, z], { outline: false, scale: [0.9, 1.2, 0.6] });
    mesh(e, sph(r * 0.35), '#ffffff', [0.3 * r, 0.4 * r, 0.9 * r], { glow: true });
  }
};

/** Wraps a ChibiBear so it satisfies Creature. */
class Chibi extends ChibiBear implements Creature {
  readonly moves = 'walk' as const;
  constructor(spec: ChibiSpec, readonly top = 1.75 * (spec.size ?? 1)) {
    super(spec);
  }
}

// ---------------------------------------------------------------- chibi species

const P = (fur: string, muzzle: string, earInner: string, blush = '#ff8a9a', nose = '#1c1618') => ({ fur, muzzle, earInner, nose, blush });

const hairBun = (color: string, ribbon: string): ChibiSpec['extras'] => ({ head, part }) => {
  part(head, sph(0.46), color, [0, 0.08, -0.08], { scale: [1.06, 0.9, 0.95] });
  part(head, sph(0.2), color, [0, 0.46, -0.2]);
  part(head, new THREE.TorusGeometry(0.13, 0.035, 6, 16), ribbon, [0, 0.42, -0.2], { rot: [Math.PI / 2, 0, 0] });
};

export const CHIBI: Record<string, ChibiSpec> = {
  bear: { palette: BLACK_BEAR },
  cub: { palette: BLACK_BEAR, size: 0.55 },
  cat: { palette: P('#f0a860', '#fff1dc', '#ffc0b0'), ears: 'pointy', tail: 'long', snout: 0.8 },
  cat_grey: { palette: P('#8a93a3', '#eef1f6', '#ffc0c8'), ears: 'pointy', tail: 'long', snout: 0.8,
    extras: ({ head, part }) => part(head, new THREE.TorusGeometry(0.2, 0.03, 6, 16), '#e8483f', [0, -0.3, 0.1], { rot: [Math.PI / 2, 0, 0] }) },
  cat_idol: {
    palette: P('#fff6f0', '#ffffff', '#ffc0d0'), ears: 'pointy', tail: 'long', snout: 0.8,
    extras: ({ head, body, armR, part }) => {
      part(head, sph(0.47), '#bfe3ff', [0, 0.1, -0.06], { scale: [1.05, 0.88, 0.95] });
      for (const s of [-1, 1]) {
        part(head, sph(0.2), s < 0 ? '#ffb3d1' : '#bfe3ff', [0.5 * s, -0.1, -0.1], { scale: [0.8, 1.9, 0.8] });
        part(head, new THREE.TorusGeometry(0.08, 0.03, 6, 12), '#ff7eb6', [0.38 * s, 0.25, -0.05]);
      }
      part(body, new THREE.ConeGeometry(0.46, 0.45, 16), '#ffb3d1', [0, 0.32, 0]);
      part(armR, new THREE.CylinderGeometry(0.025, 0.02, 0.3, 6), '#555555', [0, -0.42, 0.08], { rot: [0.6, 0, 0] });
      part(armR, sph(0.06), '#dddddd', [0, -0.32, 0.18]);
    },
  },
  cat_witch: {
    palette: P('#2e2a36', '#c9b8e8', '#b58cff', '#ff9ec4', '#f4e6ff'), ears: 'pointy', tail: 'long', snout: 0.8,
    extras: ({ head, body, part }) => {
      part(head, new THREE.ConeGeometry(0.35, 0.7, 16), '#5b3a8f', [0, 0.72, -0.05], { rot: [-0.15, 0, 0.1] });
      part(head, new THREE.CylinderGeometry(0.55, 0.55, 0.04, 20), '#5b3a8f', [0, 0.38, 0]);
      part(body, new THREE.CylinderGeometry(0.03, 0.03, 1.8, 6), '#8a5a3a', [0, 0.2, 0.05], { rot: [0, 0, Math.PI / 2] });
      part(body, new THREE.ConeGeometry(0.18, 0.45, 10), '#e0b84a', [-1.0, 0.2, 0.05], { rot: [0, 0, Math.PI / 2] });
    },
  },
  cat_eula: {
    palette: P('#e8eef6', '#ffffff', '#c8d8f0'), ears: 'pointy', tail: 'long', snout: 0.8,
    extras: ({ head, part }) => {
      part(head, sph(0.47), '#8fb8e8', [0, 0.1, -0.08], { scale: [1.06, 0.85, 0.95] });
      part(head, new THREE.BoxGeometry(0.9, 0.08, 0.1), '#2a3a6a', [0, 0.32, 0.25], { rot: [-0.3, 0, 0] });
    },
  },
  weaver: { palette: P('#f7eadd', '#ffffff', '#ffc0c0'), ears: 'small', tail: 'none', snout: 0.7, extras: hairBun('#2a2226', '#e0303a') },
  fox: { palette: P('#e8833a', '#fff4e6', '#3b2a22'), ears: 'pointy', tail: 'bushy', snout: 1.4 },
  capybara: { palette: P('#b0784a', '#8a5a3a', '#6b4a33', '#ff9a9a'), ears: 'small', tail: 'none', snout: 1.25, belly: false, size: 1.05 },
  tanuki: {
    palette: P('#8a6a4a', '#f4e6d4', '#3b2a22'), ears: 'round', tail: 'ringed', snout: 1.15,
    extras: ({ head, part }) => { for (const s of [-1, 1]) part(head, sph(0.1), '#3b2a22', [0.16 * s, 0.05, 0.37], { scale: [1.3, 0.8, 0.4], outline: false }); },
  },
  rabbit: { palette: P('#f4f1ec', '#ffffff', '#ffb6c1'), ears: 'long', tail: 'nub', snout: 0.8, size: 0.9 },
  red_panda: {
    palette: P('#c8552e', '#fff4e6', '#fff4e6'), ears: 'pointy', tail: 'ringed', snout: 1.1, limbs: '#3b2a22',
    extras: ({ head, armR, part }) => {
      part(head, new THREE.ConeGeometry(0.1, 0.25, 8), '#ffffff', [0, -0.3, 0.42], { rot: [0.3, 0, Math.PI] });
      part(armR, new THREE.CylinderGeometry(0.025, 0.025, 1.5, 6), '#8a5a3a', [0, -0.35, 0.1], { rot: [0.2, 0, 0] });
    },
  },
  panda: {
    palette: P('#f7f7f7', '#ffffff', '#2a2a2a'), ears: 'round', tail: 'nub', snout: 1, limbs: '#2a2a2a', earColor: '#2a2a2a',
    extras: ({ head, part }) => { for (const s of [-1, 1]) part(head, sph(0.11), '#2a2a2a', [0.16 * s, 0.06, 0.36], { scale: [1, 1.3, 0.5], outline: false }); },
  },
  husky: {
    palette: P('#7d8696', '#ffffff', '#ffffff'), ears: 'pointy', tail: 'bushy', snout: 1.3,
    extras: ({ body, part }) => part(body, new THREE.TorusGeometry(0.3, 0.07, 6, 16), '#3f6fb5', [0, 0.82, 0], { rot: [Math.PI / 2, 0, 0] }),
  },
  hyena: {
    palette: P('#b89a6a', '#e8d8b0', '#3b2a22'), ears: 'round', tail: 'bushy', snout: 1.35,
    extras: ({ head, armR, part }) => {
      part(head, new THREE.BoxGeometry(0.95, 0.12, 0.9), '#2a2a32', [0, 0.1, 0], { outline: false });
      part(armR, new THREE.BoxGeometry(0.05, 0.6, 0.02), '#c8ccd4', [0, -0.55, 0.1]);
    },
  },
  monkey: { palette: P('#9a6a44', '#f0c8a0', '#f0c8a0'), ears: 'small', tail: 'long', snout: 0.9 },
  dormouse: { palette: P('#b09070', '#f4e6d4', '#ffc0b0'), ears: 'round', tail: 'bushy', snout: 0.9, size: 0.65 },
  lion: {
    palette: P('#e0a84a', '#fff1d0', '#8a5a2a'), ears: 'small', tail: 'long', snout: 1.1,
    extras: ({ head, part }) => part(head, sph(0.58), '#a8622a', [0, 0.02, -0.12], { scale: [1.1, 1.05, 0.7] }),
  },
  goat: {
    palette: P('#f4f1ec', '#ffffff', '#ffc0c0'), ears: 'small', tail: 'nub', snout: 1.15,
    extras: ({ head, part }) => { for (const s of [-1, 1]) part(head, new THREE.TorusGeometry(0.14, 0.04, 6, 12, Math.PI * 1.2), '#8a7a6a', [0.22 * s, 0.36, -0.05], { rot: [0, Math.PI / 2, 0.4 * s] }); },
  },
  doe: {
    palette: P('#c89060', '#fff4e6', '#ffd0b0'), ears: 'pointy', tail: 'nub', snout: 1.15,
    extras: ({ head, body, part }) => {
      part(head, new THREE.CylinderGeometry(0.34, 0.34, 0.1, 20), '#c0392b', [0.08, 0.42, 0], { rot: [0, 0, 0.2] });
      for (let i = 0; i < 5; i++) part(body, sph(0.04), '#fff4e6', [-0.2 + i * 0.1, 0.6 + (i % 2) * 0.12, -0.35], { outline: false });
    },
  },
  frog: {
    palette: P('#6fae5a', '#c8e6a0', '#6fae5a'), ears: 'none', tail: 'none', snout: 0.6,
    extras: ({ head, part }) => {
      part(head, new THREE.ConeGeometry(0.62, 0.3, 20), '#e2c46a', [0, 0.45, 0]);
      for (const s of [-1, 1]) part(head, sph(0.12), '#6fae5a', [0.2 * s, 0.28, 0.2]);
    },
  },
  otter: { palette: P('#7a5436', '#e8d0b0', '#e8d0b0'), ears: 'small', tail: 'long', snout: 1.1 },
  dog: { palette: P('#e0b870', '#fff4e6', '#b07a45'), ears: 'round', tail: 'bushy', snout: 1.25,
    extras: ({ head, part }) => part(head, new THREE.ConeGeometry(0.12, 0.2, 3), '#e8483f', [0, -0.34, 0.25], { rot: [Math.PI, 0, 0] }) },
};

// ---------------------------------------------------------------- four-legged

export interface QuadSpec { fur: string; belly: string; size: number; snout: number; ears: 'pointy' | 'round' | 'none'; tail: 'bushy' | 'thin' | 'croc'; low?: boolean; antlers?: boolean; eyes?: string; spots?: string }

export const QUADS: Record<string, QuadSpec> = {
  wolf: { fur: '#4a4d5a', belly: '#9aa0ac', size: 1.6, snout: 1.4, ears: 'pointy', tail: 'bushy', eyes: '#7fe0ff' },
  deer: { fur: '#b07a45', belly: '#f4e6d4', size: 1.1, snout: 1.1, ears: 'pointy', tail: 'thin', antlers: true, spots: '#f4e6d4' },
  alligator: { fur: '#4f7a3a', belly: '#c8d890', size: 1.8, snout: 2.2, ears: 'none', tail: 'croc', low: true, eyes: '#ffd24a' },
};

class Quad implements Creature {
  readonly root = new THREE.Group();
  readonly moves = 'walk' as const;
  readonly top: number;
  pose: Pose = 'stand';
  lookYaw: number | null = null;
  private body = new THREE.Group();
  private head = new THREE.Group();
  private jaw: THREE.Object3D | null = null;
  private legs: THREE.Group[] = [];
  private tail = new THREE.Group();
  private t = 0;
  private phase = 0;
  private action: Action = 'none';
  private actionT = 0;
  private lie = 0;
  private bodyY: number;

  constructor(q: QuadSpec) {
    const low = q.low ?? false;
    const bodyY = low ? 0.28 : 0.62;
    this.top = (low ? 0.9 : 1.6) * q.size;
    mesh(this.body, sph(0.42), q.fur, [0, 0, 0], { scale: [0.85, low ? 0.55 : 0.8, low ? 2.2 : 1.35] });
    mesh(this.body, sph(0.3), q.belly, [0, -0.12, 0.05], { scale: [0.9, 0.5, low ? 2.6 : 1.4], outline: false });
    if (q.spots) for (let i = 0; i < 6; i++) mesh(this.body, sph(0.05), q.spots, [(i % 2 ? 0.2 : -0.2), 0.25, -0.3 + i * 0.12], { outline: false });
    // Head
    mesh(this.head, sph(0.32), q.fur, [0, 0, 0], { scale: [1, low ? 0.6 : 0.95, 1] });
    const snout = mesh(this.head, sph(0.18), q.belly, [0, low ? -0.05 : -0.08, 0.25 + q.snout * 0.1], { scale: [0.9, low ? 0.45 : 0.7, q.snout] });
    if (low) {
      this.jaw = mesh(this.head, sph(0.18), q.belly, [0, -0.14, 0.3 + q.snout * 0.1], { scale: [0.85, 0.3, q.snout * 0.95] });
      for (let i = 0; i < 6; i++) mesh(snout, new THREE.ConeGeometry(0.02, 0.06, 4), '#ffffff', [((i % 2) - 0.5) * 0.28, -0.12, -0.1 + i * 0.06], { rot: [Math.PI, 0, 0], outline: false });
    }
    mesh(this.head, sph(0.05), '#1c1618', [0, low ? 0.02 : 0, 0.28 + q.snout * 0.28], { outline: false });
    for (const s of [-1, 1]) {
      const eye = mesh(this.head, sph(0.05), q.eyes ?? '#1c1618', [0.15 * s, low ? 0.14 : 0.08, 0.22], { outline: false, glow: !!q.eyes });
      eye.scale.set(0.9, 1.2, 0.6);
      if (q.ears === 'pointy') mesh(this.head, new THREE.ConeGeometry(0.09, 0.24, 8), q.fur, [0.17 * s, 0.3, -0.05], { rot: [0, 0, -0.3 * s] });
      if (q.ears === 'round') mesh(this.head, sph(0.09), q.fur, [0.2 * s, 0.26, -0.05]);
      if (q.antlers) {
        mesh(this.head, new THREE.CylinderGeometry(0.02, 0.03, 0.35, 5), '#e8d8b0', [0.12 * s, 0.4, -0.05], { rot: [0, 0, -0.35 * s] });
        mesh(this.head, new THREE.CylinderGeometry(0.015, 0.02, 0.15, 5), '#e8d8b0', [0.2 * s, 0.5, 0.02], { rot: [0.5, 0, -0.9 * s] });
      }
    }
    this.head.position.set(0, low ? 0.05 : 0.45, low ? 0.95 : 0.55);
    // Legs
    const legLen = low ? 0.18 : 0.45;
    for (const [x, z] of [[-0.25, 0.4], [0.25, 0.4], [-0.25, -0.4], [0.25, -0.4]]) {
      const leg = new THREE.Group();
      mesh(leg, new THREE.CapsuleGeometry(0.09, legLen, 6, 10), q.fur, [0, -legLen / 2 - 0.05, 0]);
      leg.position.set(x * (low ? 1.4 : 1), -0.1, z * (low ? 1.6 : 1));
      this.legs.push(leg);
      this.body.add(leg);
    }
    // Tail
    if (q.tail === 'bushy') mesh(this.tail, sph(0.15), q.fur, [0, 0.1, -0.25], { scale: [0.8, 0.8, 2.2], rot: [-0.5, 0, 0] });
    if (q.tail === 'thin') mesh(this.tail, sph(0.08), q.belly, [0, 0.1, -0.08]);
    if (q.tail === 'croc') for (let i = 0; i < 5; i++) mesh(this.tail, sph(0.22 - i * 0.035), q.fur, [0, 0, -0.25 - i * 0.28], { scale: [1, 0.6, 1.4] });
    this.tail.position.set(0, low ? 0 : 0.1, low ? -0.9 : -0.5);
    this.body.add(this.head, this.tail);
    this.body.position.y = this.bodyY = bodyY;
    this.root.add(this.body);
    this.root.scale.setScalar(q.size);
  }

  act(action: Action, seconds: number) {
    this.action = action;
    this.actionT = seconds || Infinity;
  }

  update(dt: number, speed: number) {
    this.t += dt;
    if (this.actionT > 0 && (this.actionT -= dt) <= 0) this.action = 'none';
    const moving = speed > 0.05 && this.pose === 'stand';
    if (moving) this.phase += dt * (5 + speed * 2.5);
    const w = moving ? Math.sin(this.phase) : 0;
    this.legs.forEach((l, i) => (l.rotation.x = (i === 0 || i === 3 ? w : -w) * 0.6));
    this.tail.rotation.y = Math.sin(this.t * (moving ? 6 : 1.5)) * 0.35;
    // Lying down (sleep / defeated) rolls onto the side.
    this.lie = THREE.MathUtils.damp(this.lie, this.pose === 'stand' ? 0 : 1, 4, dt);
    this.root.rotation.z = this.lie * (this.pose === 'sleep' ? 1.3 : 0.25);
    const roar = this.action === 'roar';
    const graze = this.action === 'none' && !moving && this.pose === 'stand' && Math.sin(this.t * 0.4) > 0.6;
    const yaw = this.lookYaw === null ? 0 : THREE.MathUtils.clamp(this.lookYaw, -1, 1);
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, yaw, 5, dt);
    this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, roar ? -0.5 : graze ? 0.7 : 0, 6, dt);
    if (this.jaw) this.jaw.rotation.x = roar ? 0.35 + Math.sin(this.t * 25) * 0.05 : Math.max(0, Math.sin(this.t * 0.7)) * 0.1;
    this.body.position.y = this.bodyY + (moving ? Math.abs(Math.sin(this.phase)) * 0.04 : 0);
  }
}

// ---------------------------------------------------------------- birds

export interface BirdSpec { body: string; belly: string; wing: string; beak: string; size: number; legs?: number; neck?: number; crest?: string; tufts?: boolean }

export const BIRDS: Record<string, BirdSpec> = {
  crane: { body: '#ffffff', belly: '#ffffff', wing: '#2a2a2a', beak: '#6b6b52', size: 1.1, legs: 0.7, neck: 0.5, crest: '#e0303a' },
  egret: { body: '#ffffff', belly: '#ffffff', wing: '#f4f4f4', beak: '#f2c230', size: 0.9, legs: 0.6, neck: 0.4 },
  dove: { body: '#ffffff', belly: '#f4f4f4', wing: '#eeeeee', beak: '#ff9a7a', size: 0.45 },
  pigeon: { body: '#9aa3b0', belly: '#c0c8d4', wing: '#7d8696', beak: '#555', size: 0.45 },
  parrot: { body: '#e8483f', belly: '#f2c230', wing: '#3f6fb5', beak: '#f4f1ec', size: 0.55, crest: '#e8483f' },
  owl: { body: '#8a6a4a', belly: '#e8d8b0', wing: '#6b4a33', beak: '#e0b84a', size: 0.6, tufts: true },
  robin: { body: '#8a6a4a', belly: '#e8703a', wing: '#6b4a33', beak: '#333', size: 0.4 },
  seagull: { body: '#ffffff', belly: '#ffffff', wing: '#b8c0cc', beak: '#f2c230', size: 0.55 },
  magpie: { body: '#1c1c28', belly: '#ffffff', wing: '#2a3f7a', beak: '#222', size: 0.5 },
  dragon: { body: '#2e3440', belly: '#8a6a4a', wing: '#4a2a2a', beak: '#c8b89a', size: 3.2, neck: 0.5, tufts: true },
};

class Bird implements Creature {
  readonly root = new THREE.Group();
  readonly moves = 'fly' as const;
  readonly top: number;
  pose: Pose = 'stand';
  lookYaw: number | null = null;
  /** Set by the companion script while airborne. */
  flying = false;
  private wings: THREE.Group[] = [];
  private head = new THREE.Group();
  private t = Math.random() * 10;
  private action: Action = 'none';
  private actionT = 0;

  constructor(b: BirdSpec) {
    const legs = b.legs ?? 0.18, neck = b.neck ?? 0;
    const body = new THREE.Group();
    mesh(body, sph(0.35), b.body, [0, 0, 0], { scale: [0.8, 0.8, 1.15] });
    mesh(body, sph(0.26), b.belly, [0, -0.08, 0.1], { scale: [0.85, 0.8, 1], outline: false });
    mesh(body, new THREE.ConeGeometry(0.18, 0.4, 6), b.wing, [0, 0.05, -0.45], { rot: [-Math.PI / 2 - 0.3, 0, 0] });
    for (const s of [-1, 1]) {
      const wing = new THREE.Group();
      mesh(wing, sph(0.3), b.wing, [0.25 * s, 0, 0], { scale: [1.2, 0.2, 0.9] });
      wing.position.set(0.18 * s, 0.1, 0);
      this.wings.push(wing);
      body.add(wing);
      mesh(this.root, new THREE.CylinderGeometry(0.02, 0.02, legs, 5), '#e0a050', [0.1 * s, legs / 2, 0], { outline: false });
    }
    body.position.y = legs + 0.25;
    // Head on an optional neck
    if (neck) mesh(body, new THREE.CylinderGeometry(0.07, 0.09, neck, 8), b.body, [0, 0.2 + neck / 2, 0.25], { rot: [0.3, 0, 0] });
    mesh(this.head, sph(0.2), b.body, [0, 0, 0]);
    face(this.head, 0.17, 0.04, 0.09, 0.035);
    mesh(this.head, new THREE.ConeGeometry(0.06, neck ? 0.35 : 0.14, 8), b.beak, [0, -0.02, neck ? 0.3 : 0.24], { rot: [Math.PI / 2, 0, 0], outline: 0.01 });
    if (b.crest) mesh(this.head, sph(0.07), b.crest, [0, 0.18, 0], { outline: false });
    if (b.tufts) for (const s of [-1, 1]) mesh(this.head, new THREE.ConeGeometry(0.05, 0.16, 5), b.wing, [0.12 * s, 0.2, 0], { rot: [0, 0, -0.4 * s] });
    this.head.position.set(0, 0.28 + neck, 0.28 + neck * 0.3);
    body.add(this.head);
    this.root.add(body);
    this.root.scale.setScalar(b.size);
    this.top = (legs + 0.9 + neck) * b.size;
  }

  act(action: Action, seconds: number) {
    this.action = action;
    this.actionT = seconds || Infinity;
  }

  update(dt: number, _speed: number) {
    this.t += dt;
    if (this.actionT > 0 && (this.actionT -= dt) <= 0) this.action = 'none';
    const flap = this.flying ? Math.sin(this.t * 14) * 0.9 : this.action !== 'none' ? Math.sin(this.t * 18) * 0.7 : 0;
    this.wings.forEach((w, i) => (w.rotation.z = (i ? -1 : 1) * (flap + (this.flying ? 0.2 : 0))));
    const yaw = this.lookYaw === null ? 0 : THREE.MathUtils.clamp(this.lookYaw, -1.2, 1.2);
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, yaw, 6, dt);
    this.head.rotation.x = !this.flying && Math.sin(this.t * 0.8) > 0.85 ? 0.6 : 0; // peck
  }
}

// ---------------------------------------------------------------- special

/** Simple animated set piece that isn't a walker (fish, whale, kraken, spirits...). */
class Special implements Creature {
  readonly root = new THREE.Group();
  pose: Pose = 'stand';
  lookYaw: number | null = null;
  private t = Math.random() * 10;
  private action: Action = 'none';
  private actionT = 0;
  constructor(readonly moves: Creature['moves'], readonly top: number, private anim: (t: number, action: Action, dt: number) => void) {}
  act(action: Action, seconds: number) {
    this.action = action;
    this.actionT = seconds || Infinity;
  }
  update(dt: number) {
    this.t += dt;
    if (this.actionT > 0 && (this.actionT -= dt) <= 0) this.action = 'none';
    this.anim(this.t, this.action, dt);
  }
}

function salmon() {
  let tail: THREE.Object3D;
  const s = new Special('swim', 0.6, (t) => (tail.rotation.y = Math.sin(t * 16) * 0.5));
  mesh(s.root, sph(0.25), '#e8836a', [0, 0, 0], { scale: [0.5, 0.6, 1.6] });
  mesh(s.root, sph(0.18), '#d8dde6', [0, -0.06, 0], { scale: [0.55, 0.45, 1.7], outline: false });
  tail = mesh(s.root, new THREE.ConeGeometry(0.16, 0.3, 4), '#c8604a', [0, 0, -0.5], { rot: [-Math.PI / 2, 0, 0], scale: [0.3, 1, 1] });
  face(s.root, 0.3, 0.06, 0.08, 0.03);
  return s;
}

function whale() {
  let tail: THREE.Object3D;
  const s = new Special('swim', 3, (t) => (tail.rotation.x = Math.sin(t * 1.2) * 0.3));
  mesh(s.root, sph(1.6), '#4f6f9a', [0, 0, 0], { scale: [0.9, 0.75, 2.2], outline: 0.05 });
  mesh(s.root, sph(1.3), '#dfe8f0', [0, -0.5, 0.4], { scale: [0.85, 0.5, 2.0], outline: false });
  tail = new THREE.Group();
  mesh(tail, new THREE.BoxGeometry(2.4, 0.15, 0.9), '#4f6f9a', [0, 0, -0.4]);
  tail.position.z = -3.4;
  s.root.add(tail);
  face(s.root, 2.9, 0.3, 0.9, 0.12);
  return s;
}

function kraken() {
  const arms: THREE.Mesh[] = [];
  const s = new Special('fixed', 6, (t, action) => {
    arms.forEach((a, i) => {
      a.rotation.z = Math.sin(t * 1.3 + i) * 0.35 + (action === 'roar' ? Math.sin(t * 9 + i) * 0.3 : 0);
      a.rotation.x = -0.2 + Math.cos(t * 0.9 + i * 2) * 0.2;
    });
  });
  mesh(s.root, sph(2.2), '#7a3f8f', [0, 1, 0], { scale: [1, 1.2, 1], outline: 0.06 });
  face(s.root, 1.9, 1.5, 0.8, 0.25);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI - Math.PI / 2;
    const pts = [0, 1, 2, 3, 4].map((k) => new THREE.Vector3(0, k * 1.1, Math.sin(k) * 0.4));
    const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.28, 8), toonMaterial('#8f4fa8'));
    addOutline(arm, 0.04);
    arm.position.set(Math.sin(a) * 2.6, -1, Math.cos(a) * 1.2);
    arms.push(arm);
    s.root.add(arm);
  }
  return s;
}

function hydra() {
  const necks: THREE.Group[] = [];
  const s = new Special('fixed', 6, (t, action) => {
    necks.forEach((n, i) => {
      n.rotation.z = Math.sin(t * 0.8 + i * 1.3) * 0.25;
      n.rotation.x = Math.sin(t * 0.6 + i) * 0.15 + (action === 'roar' ? -0.3 : 0);
    });
  });
  for (let i = 0; i < 5; i++) {
    const n = new THREE.Group();
    const h = 4 + (i % 2) * 1.2;
    mesh(n, new THREE.CylinderGeometry(0.35, 0.55, h, 10), '#3f6f5a', [0, h / 2, 0], { outline: 0.04 });
    for (let k = 0; k < 4; k++) mesh(n, new THREE.BoxGeometry(0.7, 0.12, 0.6), '#9aa3b0', [0, 0.8 + k * (h / 4), 0.1], { outline: false });
    const head = new THREE.Group();
    mesh(head, sph(0.6), '#3f6f5a', [0, 0, 0.2], { scale: [0.9, 0.7, 1.4] });
    for (const sd of [-1, 1]) mesh(head, sph(0.1), '#ff4040', [0.3 * sd, 0.2, 0.7], { glow: true });
    head.position.y = h;
    n.add(head);
    n.position.set(-3 + i * 1.5, -2, Math.abs(i - 2) * -0.8);
    n.rotation.z = (i - 2) * 0.15;
    necks.push(n);
    s.root.add(n);
  }
  return s;
}

function bees() {
  const bs: THREE.Group[] = [];
  const s = new Special('fly', 1.5, (t) => {
    bs.forEach((b, i) => {
      const a = t * (2 + i * 0.3) + i * 1.3;
      b.position.set(Math.cos(a) * (0.6 + i * 0.1), 1.4 + Math.sin(t * 3 + i) * 0.3, Math.sin(a) * (0.6 + i * 0.1));
      b.rotation.y = -a;
    });
  });
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Group();
    mesh(b, sph(0.08), '#f2c230', [0, 0, 0], { scale: [0.9, 0.9, 1.3], outline: 0.01 });
    mesh(b, new THREE.TorusGeometry(0.07, 0.02, 4, 10), '#222', [0, 0, 0], { outline: false });
    for (const sd of [-1, 1]) mesh(b, sph(0.06), '#ffffff', [0.07 * sd, 0.07, 0], { scale: [1, 0.3, 0.7], outline: false });
    bs.push(b);
    s.root.add(b);
  }
  return s;
}

function ghost() {
  const body = new THREE.Group();
  const s = new Special('fly', 1.6, (t) => {
    body.position.y = 0.9 + Math.sin(t * 1.5) * 0.15;
    body.rotation.z = Math.sin(t) * 0.1;
  });
  mesh(body, sph(0.45), '#f4f4ff', [0, 0.3, 0]);
  mesh(body, new THREE.ConeGeometry(0.45, 0.8, 16, 1, true), '#f4f4ff', [0, -0.2, 0], { rot: [Math.PI, 0, 0] });
  face(body, 0.4, 0.35, 0.14, 0.06);
  mesh(body, sph(0.05), '#ff9ec4', [0.25, 0.25, 0.35], { outline: false });
  s.root.add(body);
  return s;
}

function slime() {
  const body = new THREE.Group();
  const s = new Special('walk', 1.1, (t) => {
    const b = Math.abs(Math.sin(t * 3));
    body.position.y = b * 0.4;
    body.scale.set(1 + (1 - b) * 0.2, 0.8 + b * 0.3, 1 + (1 - b) * 0.2);
  });
  mesh(body, sph(0.5), '#7fcf6a', [0, 0.4, 0], { scale: [1, 0.8, 1] });
  face(body, 0.44, 0.5, 0.15, 0.06);
  s.root.add(body);
  return s;
}

function spirit(color: string, glowFace = '#1c1618') {
  const body = new THREE.Group();
  const s = new Special('fly', 1.2, (t) => {
    body.position.y = 0.2 + Math.sin(t * 2) * 0.12;
    body.rotation.y = Math.sin(t * 0.7) * 0.4;
  });
  mesh(body, sph(0.35), color, [0, 0, 0], { glow: true });
  mesh(body, sph(0.5), color, [0, 0, 0], { glow: true }).material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 });
  for (const sd of [-1, 1]) mesh(body, sph(0.04), glowFace, [0.11 * sd, 0.05, 0.33], { outline: false });
  const light = new THREE.PointLight(color, 1.5, 5, 1.6);
  body.add(light);
  s.root.add(body);
  return s;
}

function drone() {
  const body = new THREE.Group();
  let rotor: THREE.Object3D;
  const s = new Special('fly', 1.2, (t) => {
    body.position.y = Math.sin(t * 2.5) * 0.08;
    rotor.rotation.y = t * 30;
  });
  mesh(body, new THREE.BoxGeometry(0.5, 0.35, 0.45), '#d0d4dc', [0, 0, 0]);
  mesh(body, new THREE.BoxGeometry(0.36, 0.12, 0.02), '#38e1ff', [0, 0.03, 0.23], { glow: true });
  rotor = mesh(body, new THREE.BoxGeometry(0.8, 0.03, 0.08), '#555', [0, 0.3, 0], { outline: false });
  s.root.add(body);
  return s;
}

// ---------------------------------------------------------------- factory

export function makeCreature(kind: string): Creature {
  if (CHIBI[kind]) return new Chibi(CHIBI[kind]);
  if (QUADS[kind]) return new Quad(QUADS[kind]);
  if (BIRDS[kind]) return new Bird(BIRDS[kind]);
  switch (kind) {
    case 'salmon': return salmon();
    case 'whale': return whale();
    case 'kraken': return giant(kraken());
    case 'hydra': return giant(hydra());
    case 'bees': return bees();
    case 'ghost': return ghost();
    case 'slime': return slime();
    case 'sun': return spirit('#ffd36e');
    case 'moon': return spirit('#cfe0ff', '#3a4a7a');
    case 'star': return spirit('#fff1a8');
    case 'drone': return drone();
  }
  console.warn(`Unknown companion "${kind}", using a fox`);
  return new Chibi(CHIBI.fox);
}

/** Villains that loom from beyond the island edge are scaled up. */
function giant(c: Creature) {
  c.root.scale.setScalar(1.5);
  return c;
}

export function isBird(c: Creature): c is Creature & { flying: boolean } {
  return c instanceof Bird;
}
