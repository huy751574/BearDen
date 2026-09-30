import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';

// Procedural chibi animal built from primitives. Proportions follow the Bear
// Den art: big round head, small round body, tan muzzle, blush cheeks.
// The same builder makes the hero bear and every two-legged companion (cat,
// fox, capybara, red panda...) from a ChibiSpec. A GLB model replaces the hero
// when one is installed (see GltfCharacter / CHARACTERS.md).

export interface ChibiPalette {
  fur: string;
  muzzle: string;
  earInner: string;
  nose: string;
  blush: string;
}

export const BLACK_BEAR: ChibiPalette = {
  fur: '#3b3a40',
  muzzle: '#c9976a',
  earInner: '#b07a55',
  nose: '#1c1618',
  blush: '#ff7c8a',
};

/** Helpers handed to ChibiSpec.extras for hair, hats, manes, instruments... */
export interface ChibiParts {
  head: THREE.Group;
  body: THREE.Group;
  armR: THREE.Group;
  part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: [number, number, number], o?: { rot?: [number, number, number]; scale?: [number, number, number]; outline?: boolean }): THREE.Mesh;
}

export interface ChibiSpec {
  palette: ChibiPalette;
  ears?: 'round' | 'pointy' | 'long' | 'small' | 'none';
  tail?: 'nub' | 'bushy' | 'long' | 'ringed' | 'none';
  /** Muzzle length: 1 = bear, >1 = fox/dog-like, <1 = flat face. */
  snout?: number;
  /** Tan belly patch (default true). */
  belly?: boolean;
  size?: number;
  /** Arm/leg colour and ear colour when they differ from the fur (panda). */
  limbs?: string;
  earColor?: string;
  extras?: (p: ChibiParts) => void;
}

export type Pose = 'stand' | 'sit' | 'sleep';
export type Action = 'none' | 'wave' | 'dance' | 'cheer' | 'roar' | 'sing';

export class ChibiBear {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private tail = new THREE.Group();
  private eyes: THREE.Mesh[] = [];

  private t = 0;
  private walkPhase = 0;
  private blinkTimer = 2;
  private actionTimer = 0;
  private action: Action = 'none';
  private sitBlend = 0;
  private sleepBlend = 0;
  pose: Pose = 'stand';
  /** Head turn toward something (radians, relative to the body); null = look ahead. */
  lookYaw: number | null = null;

  constructor(spec: ChibiSpec | ChibiPalette = BLACK_BEAR) {
    const s: ChibiSpec = 'palette' in spec ? spec : { palette: spec };
    const p = s.palette;
    const fur = toonMaterial(p.fur);
    const tan = toonMaterial(p.muzzle);
    const inner = toonMaterial(p.earInner);
    const dark = new THREE.MeshBasicMaterial({ color: p.nose });
    const snout = s.snout ?? 1;
    const limbMat = s.limbs ? toonMaterial(s.limbs) : fur;
    const earMat = s.earColor ? toonMaterial(s.earColor) : fur;

    const sphere = (r: number, mat: THREE.Material, outline = true) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 24), mat);
      m.castShadow = true;
      if (outline) addOutline(m);
      return m;
    };

    // Body
    const torso = sphere(0.4, fur);
    torso.scale.set(1, 1.02, 0.9);
    torso.position.y = 0.48;
    this.body.add(torso);
    if (s.belly !== false) {
      const belly = sphere(0.26, tan, false);
      belly.scale.set(1, 1.1, 0.5);
      belly.position.set(0, 0.46, 0.25);
      this.body.add(belly);
    }
    this.buildTail(s.tail ?? 'nub', fur, p.muzzle, sphere);
    this.tail.position.set(0, 0.3, -0.34);
    this.body.add(this.tail);

    // Head
    const skull = sphere(0.44, fur);
    skull.scale.set(1.05, 0.95, 0.95);
    for (const side of [-1, 1]) {
      this.buildEar(s.ears ?? 'round', side, earMat, inner, sphere);

      const eye = sphere(0.05, dark, false);
      eye.scale.set(0.9, 1.25, 0.6);
      eye.position.set(0.16 * side, 0.07, 0.4);
      this.eyes.push(eye);
      const shine = sphere(0.016, new THREE.MeshBasicMaterial({ color: '#ffffff' }), false);
      shine.position.set(0.012, 0.02, 0.045);
      eye.add(shine);
      this.head.add(eye);

      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 20),
        new THREE.MeshBasicMaterial({ color: p.blush, transparent: true, opacity: 0.75 }),
      );
      blush.position.set(0.27 * side, -0.06, 0.345);
      blush.lookAt(blush.position.clone().multiplyScalar(2));
      blush.scale.y = 0.7;
      this.head.add(blush);
    }
    const muzzle = sphere(0.17, tan);
    muzzle.scale.set(1.2 / Math.sqrt(snout), 0.85, 0.75 * snout);
    muzzle.position.set(0, -0.1, 0.36 + (snout - 1) * 0.08);
    const nose = sphere(0.055, dark, false);
    nose.scale.set(1.3, 0.9, 0.8);
    nose.position.set(0, -0.04, 0.49 + (snout - 1) * 0.2);
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 16, Math.PI), dark);
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.13, 0.485 + (snout - 1) * 0.18);
    this.head.add(skull, muzzle, nose, mouth);
    this.head.position.y = 1.12;

    // Limbs: pivot groups so rotations swing from shoulder / hip.
    const limb = (r: number, len: number, mat: THREE.Material) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat);
      m.castShadow = true;
      addOutline(m);
      m.position.y = -len / 2 - r * 0.3;
      return m;
    };
    for (const [grp, side] of [[this.armL, 1], [this.armR, -1]] as const) {
      grp.add(limb(0.1, 0.22, limbMat));
      grp.position.set(0.37 * side, 0.72, 0.05);
      grp.rotation.z = 0.35 * side;
    }
    for (const [grp, side] of [[this.legL, 1], [this.legR, -1]] as const) {
      const leg = limb(0.12, 0.1, limbMat);
      const pad = sphere(0.07, tan, false);
      pad.scale.z = 0.4;
      pad.position.set(0, -0.2, 0.1);
      pad.rotation.x = -0.4;
      grp.add(leg, pad);
      grp.position.set(0.18 * side, 0.25, 0);
    }

    this.body.add(this.head, this.armL, this.armR, this.legL, this.legR);
    this.root.add(this.body);

    s.extras?.({
      head: this.head,
      body: this.body,
      armR: this.armR,
      part: (parent, geo, color, pos, o = {}) => {
        const m = new THREE.Mesh(geo, toonMaterial(color));
        m.position.set(...pos);
        if (o.rot) m.rotation.set(...o.rot);
        if (o.scale) m.scale.set(...o.scale);
        m.castShadow = true;
        if (o.outline !== false) addOutline(m, 0.015);
        parent.add(m);
        return m;
      },
    });
    if (s.size) this.root.scale.setScalar(s.size);
  }

  private buildEar(kind: NonNullable<ChibiSpec['ears']>, side: number, fur: THREE.Material, inner: THREE.Material, sphere: (r: number, m: THREE.Material, o?: boolean) => THREE.Mesh) {
    if (kind === 'none') return;
    if (kind === 'round' || kind === 'small') {
      const r = kind === 'small' ? 0.09 : 0.14;
      const ear = sphere(r, fur);
      ear.position.set(0.31 * side, 0.33, -0.02);
      const earIn = sphere(r * 0.6, inner, false);
      earIn.position.set(0.31 * side, 0.33, 0.07);
      earIn.scale.z = 0.5;
      this.head.add(ear, earIn);
      return;
    }
    const long = kind === 'long';
    const h = long ? 0.55 : 0.3;
    const ear = new THREE.Mesh(new THREE.ConeGeometry(long ? 0.1 : 0.14, h, 12), fur);
    ear.castShadow = true;
    addOutline(ear);
    ear.position.set(0.24 * side, 0.36 + h / 2, -0.02);
    ear.rotation.z = -0.25 * side;
    if (long) ear.scale.z = 0.6;
    const earIn = new THREE.Mesh(new THREE.ConeGeometry(long ? 0.06 : 0.08, h * 0.7, 10), inner);
    earIn.position.set(0.24 * side, 0.34 + h / 2, 0.05);
    earIn.rotation.z = -0.25 * side;
    earIn.scale.z = 0.4;
    this.head.add(ear, earIn);
  }

  private buildTail(kind: NonNullable<ChibiSpec['tail']>, fur: THREE.Material, tipColor: string, sphere: (r: number, m: THREE.Material, o?: boolean) => THREE.Mesh) {
    if (kind === 'none') return;
    if (kind === 'nub') {
      this.tail.add(sphere(0.09, fur));
      return;
    }
    if (kind === 'bushy' || kind === 'ringed') {
      const t = sphere(0.18, fur);
      t.scale.set(0.8, 0.8, 1.8);
      t.position.set(0, 0.1, -0.25);
      t.rotation.x = -0.6;
      this.tail.add(t);
      const tip = sphere(0.12, toonMaterial(kind === 'ringed' ? '#3b2a22' : tipColor), false);
      tip.position.set(0, 0.28, -0.52);
      this.tail.add(tip);
      if (kind === 'ringed') {
        const ring = sphere(0.15, toonMaterial('#f4e6d4'), false);
        ring.scale.set(0.95, 0.95, 0.35);
        ring.position.set(0, 0.16, -0.36);
        this.tail.add(ring);
      }
      return;
    }
    // long thin tail (cat, monkey)
    const pts = [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(0, i * 0.1 + Math.sin(i) * 0.05, -i * 0.12));
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.045, 6), fur);
    addOutline(m, 0.012);
    this.tail.add(m);
  }

  wave() {
    this.act('wave', 1.6);
  }

  /** Play an action for `seconds` (0 = until another action). */
  act(action: Action, seconds: number) {
    this.action = action;
    this.actionTimer = seconds || Infinity;
  }

  /** speed: current horizontal speed in m/s. */
  update(dt: number, speed: number) {
    this.t += dt;
    const resting = this.pose !== 'stand';
    const moving = speed > 0.05 && !resting;
    this.sitBlend = THREE.MathUtils.damp(this.sitBlend, resting ? 1 : 0, 8, dt);
    this.sleepBlend = THREE.MathUtils.damp(this.sleepBlend, this.pose === 'sleep' ? 1 : 0, 4, dt);
    const sit = this.sitBlend;

    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      if (this.actionTimer <= 0) this.action = 'none';
    }
    const act = moving ? 'none' : this.action;

    // Walk cycle
    if (moving) this.walkPhase += dt * (6 + speed * 2);
    const w = moving ? Math.sin(this.walkPhase) : 0;
    const walkAmt = moving ? Math.min(speed / 2.5, 1) : 0;

    const breathe = Math.sin(this.t * (this.pose === 'sleep' ? 1.2 : 2)) * 0.015;
    let bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
    if (act === 'dance') bob = Math.abs(Math.sin(this.t * 7)) * 0.12;
    if (act === 'cheer') bob = Math.abs(Math.sin(this.t * 9)) * 0.1;
    this.body.position.y = bob - sit * 0.2;
    this.body.scale.y = 1 + breathe + (act === 'roar' ? Math.sin(this.t * 20) * 0.03 : 0);
    this.body.rotation.z = w * 0.06 * walkAmt + (act === 'dance' ? Math.sin(this.t * 3.5) * 0.15 : 0);
    this.body.rotation.y = act === 'dance' ? Math.sin(this.t * 1.7) * 0.6 : 0;

    this.legL.rotation.x = w * 0.7 * walkAmt - sit * 1.4;
    this.legR.rotation.x = -w * 0.7 * walkAmt - sit * 1.4;
    this.armL.rotation.x = -w * 0.8 * walkAmt;
    this.armR.rotation.x = w * 0.8 * walkAmt;

    // Arms by action
    let armLz = 0.35 + sit * 0.3;
    let armRz = -0.35 - sit * 0.3;
    if (act === 'wave') armRz = -2.5 + Math.sin(this.t * 14) * 0.35;
    if (act === 'cheer') { armLz = 2.6 + Math.sin(this.t * 9) * 0.2; armRz = -2.6 - Math.sin(this.t * 9) * 0.2; }
    if (act === 'dance') { armLz = 1.6 + Math.sin(this.t * 7) * 0.8; armRz = -1.6 + Math.sin(this.t * 7) * 0.8; }
    if (act === 'roar') { armLz = 1.9; armRz = -1.9; }
    if (act === 'sing') { armRz = -1.2; this.armR.rotation.x = -1.3 + Math.sin(this.t * 2) * 0.1; armLz = 0.9 + Math.sin(this.t * 1.5) * 0.4; }
    this.armL.rotation.z = THREE.MathUtils.damp(this.armL.rotation.z, armLz, 12, dt);
    this.armR.rotation.z = act === 'wave' ? armRz : THREE.MathUtils.damp(this.armR.rotation.z, armRz, 12, dt);

    // Head: idle sway, looks at things, droops when sleeping, tilts back to roar/sing.
    const yaw = this.lookYaw === null ? 0 : THREE.MathUtils.clamp(this.lookYaw, -1.1, 1.1);
    this.head.rotation.y = THREE.MathUtils.damp(this.head.rotation.y, yaw, 6, dt);
    this.head.rotation.z = Math.sin(this.t * 0.9) * 0.05 * (1 - walkAmt) + (act === 'sing' ? Math.sin(this.t * 1.5) * 0.12 : 0);
    const tilt = act === 'roar' ? -0.35 : act === 'sing' ? -0.15 : 0;
    this.head.rotation.x = THREE.MathUtils.damp(this.head.rotation.x, sit * 0.12 + this.sleepBlend * 0.3 + tilt + Math.sin(this.t * 1.3) * 0.02, 8, dt);

    // Tail wag
    this.tail.rotation.y = Math.sin(this.t * (moving ? 8 : 2)) * (moving ? 0.35 : 0.15);

    // Blink (eyes stay shut while sleeping)
    this.blinkTimer -= dt;
    const closing = this.blinkTimer < 0.12 || this.sleepBlend > 0.5;
    for (const e of this.eyes) e.scale.y = closing ? 0.15 : 1.25;
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 3;
  }
}
