import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';

// Procedural chibi animal built from primitives. Placeholder until a GLB model
// exists in public/models/ (M4). Proportions follow the Bear Den art: big round
// head, small round body, tan muzzle, blush cheeks.

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

type Pose = 'stand' | 'sit';

export class ChibiBear {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private head = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private eyes: THREE.Mesh[] = [];

  private t = 0;
  private walkPhase = 0;
  private blinkTimer = 2;
  private waveTimer = 0;
  private sitBlend = 0;
  pose: Pose = 'stand';

  constructor(p: ChibiPalette = BLACK_BEAR) {
    const fur = toonMaterial(p.fur);
    const tan = toonMaterial(p.muzzle);
    const inner = toonMaterial(p.earInner);
    const dark = new THREE.MeshBasicMaterial({ color: p.nose });

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
    const belly = sphere(0.26, tan, false);
    belly.scale.set(1, 1.1, 0.5);
    belly.position.set(0, 0.46, 0.25);
    const tail = sphere(0.09, fur);
    tail.position.set(0, 0.3, -0.36);
    this.body.add(torso, belly, tail);

    // Head
    const skull = sphere(0.44, fur);
    skull.scale.set(1.05, 0.95, 0.95);
    for (const s of [-1, 1]) {
      const ear = sphere(0.14, fur);
      ear.position.set(0.31 * s, 0.33, -0.02);
      const earIn = sphere(0.085, inner, false);
      earIn.position.set(0.31 * s, 0.33, 0.07);
      earIn.scale.z = 0.5;
      this.head.add(ear, earIn);

      const eye = sphere(0.05, dark, false);
      eye.scale.set(0.9, 1.25, 0.6);
      eye.position.set(0.16 * s, 0.07, 0.4);
      this.eyes.push(eye);
      const shine = sphere(0.016, new THREE.MeshBasicMaterial({ color: '#ffffff' }), false);
      shine.position.set(0.012, 0.02, 0.045);
      eye.add(shine);
      this.head.add(eye);

      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(0.07, 20),
        new THREE.MeshBasicMaterial({ color: p.blush, transparent: true, opacity: 0.75 }),
      );
      blush.position.set(0.27 * s, -0.06, 0.345);
      blush.lookAt(blush.position.clone().multiplyScalar(2));
      blush.scale.y = 0.7;
      this.head.add(blush);
    }
    const muzzle = sphere(0.17, tan);
    muzzle.scale.set(1.2, 0.85, 0.75);
    muzzle.position.set(0, -0.1, 0.36);
    const nose = sphere(0.055, dark, false);
    nose.scale.set(1.3, 0.9, 0.8);
    nose.position.set(0, -0.04, 0.49);
    const mouth = new THREE.Mesh(
      new THREE.TorusGeometry(0.035, 0.01, 6, 16, Math.PI),
      dark,
    );
    mouth.rotation.z = Math.PI;
    mouth.position.set(0, -0.13, 0.485);
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
    for (const [grp, s] of [[this.armL, 1], [this.armR, -1]] as const) {
      grp.add(limb(0.1, 0.22, fur));
      grp.position.set(0.37 * s, 0.72, 0.05);
      grp.rotation.z = 0.35 * s;
    }
    for (const [grp, s] of [[this.legL, 1], [this.legR, -1]] as const) {
      const leg = limb(0.12, 0.1, fur);
      const pad = sphere(0.07, tan, false);
      pad.scale.z = 0.4;
      pad.position.set(0, -0.2, 0.1);
      pad.rotation.x = -0.4;
      grp.add(leg, pad);
      grp.position.set(0.18 * s, 0.25, 0);
    }

    this.body.add(this.head, this.armL, this.armR, this.legL, this.legR);
    this.root.add(this.body);
  }

  wave() {
    this.waveTimer = 1.6;
  }

  /** speed: current horizontal speed in m/s. */
  update(dt: number, speed: number) {
    this.t += dt;
    const moving = speed > 0.05 && this.pose === 'stand';
    this.sitBlend = THREE.MathUtils.damp(this.sitBlend, this.pose === 'sit' ? 1 : 0, 8, dt);
    const sit = this.sitBlend;

    // Walk cycle
    if (moving) this.walkPhase += dt * (6 + speed * 2);
    const w = moving ? Math.sin(this.walkPhase) : 0;
    const walkAmt = moving ? Math.min(speed / 2.5, 1) : 0;

    const breathe = Math.sin(this.t * 2) * 0.015;
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.06 : 0;
    this.body.position.y = bob - sit * 0.2;
    this.body.scale.y = 1 + breathe;
    this.body.rotation.z = w * 0.06 * walkAmt;

    this.legL.rotation.x = w * 0.7 * walkAmt - sit * 1.4;
    this.legR.rotation.x = -w * 0.7 * walkAmt - sit * 1.4;
    this.armL.rotation.x = -w * 0.8 * walkAmt;
    this.armR.rotation.x = w * 0.8 * walkAmt;

    // Wave with the right arm
    if (this.waveTimer > 0) {
      this.waveTimer -= dt;
      this.armR.rotation.z = -2.5 + Math.sin(this.t * 14) * 0.35;
    } else {
      this.armR.rotation.z = THREE.MathUtils.damp(this.armR.rotation.z, -0.35 - sit * 0.3, 10, dt);
    }
    this.armL.rotation.z = 0.35 + sit * 0.3;

    // Head: gentle idle sway, looks down a little while sitting
    this.head.rotation.z = Math.sin(this.t * 0.9) * 0.05 * (1 - walkAmt);
    this.head.rotation.x = sit * 0.12 + Math.sin(this.t * 1.3) * 0.02;

    // Blink
    this.blinkTimer -= dt;
    const closing = this.blinkTimer < 0.12;
    for (const e of this.eyes) e.scale.y = closing ? 0.15 : 1.25;
    if (this.blinkTimer < 0) this.blinkTimer = 2 + Math.random() * 3;
  }
}
