import * as THREE from 'three';
import { geo, type Kit } from '../kit';
import { palm } from './nature';
import { lanternString } from './structures';

// Centrepieces: landmark mini-models and theme set pieces. Base at y = 0,
// front facing +Z (rotate toward the island centre when placing).

const WOOD = '#8a5a3a';
const DARK_WOOD = '#5a3a26';

// ---------------------------------------------------------------- landmarks

export function castle(k: Kit) {
  const g = new THREE.Group();
  const wall = '#eeeae2', roof = '#4f6fa8';
  k.part(g, geo.box(3.2, 1.8, 2), wall, [0, 0.9, 0]);
  k.part(g, geo.box(1.4, 3.2, 1.4), wall, [0.2, 1.6, -0.2]);
  k.part(g, geo.cone(1.1, 1.4, 4), roof, [0.2, 3.9, -0.2], { rot: [0, Math.PI / 4, 0] });
  for (const [x, z, h] of [[-1.6, 0.9, 2.6], [1.6, 0.9, 2.2], [-1.5, -0.9, 3.4], [1.4, -1, 2.8]]) {
    k.part(g, geo.cyl(0.42, 0.45, h, 12), wall, [x, h / 2, z]);
    k.part(g, geo.cone(0.55, 1.1, 12), roof, [x, h + 0.55, z]);
  }
  for (let i = 0; i < 5; i++) k.part(g, geo.box(0.25, 0.4, 0.05), k.night ? '#ffd58a' : '#6f8fb8', [-1 + i * 0.5, 1.1, 1.01], {
    emissive: '#ffd58a', glow: k.night ? 1 : 0, outline: false,
  });
  return g;
}

export function pyramid(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cone(3, 3.4, 4), '#d9aa62', [0, 1.7, 0], { rot: [0, Math.PI / 4, 0], outline: 0.04 });
  k.part(g, geo.cone(0.45, 0.5, 4), '#f0d58a', [0, 3.2, 0], { rot: [0, Math.PI / 4, 0], outline: false });
  // Small sphinx-ish block.
  const s = new THREE.Group();
  k.part(s, geo.box(0.6, 0.5, 1.6), '#caa05c', [0, 0.25, 0]);
  k.part(s, geo.box(0.55, 0.6, 0.5), '#caa05c', [0, 0.75, 0.55]);
  s.position.set(2.8, 0, 2);
  g.add(s);
  return g;
}

export function temple(k: Kit) {
  const g = new THREE.Group();
  const stone = '#a79c86';
  for (let i = 0; i < 3; i++) k.part(g, geo.box(3.6 - i * 0.9, 0.5, 3.6 - i * 0.9), stone, [0, 0.25 + i * 0.5, 0]);
  const tower = (x: number, z: number, h: number) => {
    for (let i = 0; i < 4; i++) {
      k.part(g, geo.cyl(0.45 - i * 0.09, 0.5 - i * 0.09, h / 4, 8), stone, [x, 1.5 + h / 8 + (i * h) / 4, z], { outline: 0.02 });
    }
    k.part(g, geo.cone(0.15, 0.5, 8), stone, [x, 1.5 + h + 0.25, z]);
  };
  tower(0, 0, 2.6);
  for (const [x, z] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) tower(x, z, 1.6);
  return g;
}

export function fuji(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cone(3.6, 3.8, 16), '#5a6f9a', [0, 1.9, 0], { outline: 0.04 });
  k.part(g, geo.cone(1.45, 1.55, 16), '#ffffff', [0, 3.03, 0], { outline: false });
  return g;
}

export function moonBase(k: Kit) {
  const g = new THREE.Group();
  // Flag
  k.part(g, geo.cyl(0.03, 0.03, 2, 6), '#dddddd', [0, 1, 0]);
  k.part(g, geo.box(0.9, 0.55, 0.02), '#ffffff', [0.46, 1.7, 0]);
  k.part(g, geo.box(0.3, 0.25, 0.025), '#3f5fa8', [0.2, 1.8, 0], { outline: false });
  // Rover
  const r = new THREE.Group();
  k.part(r, geo.box(1.3, 0.25, 0.8), '#d0d0d8', [0, 0.55, 0]);
  k.part(r, geo.box(0.5, 0.3, 0.5), '#e0b84a', [-0.2, 0.8, 0]);
  k.part(r, geo.cyl(0.02, 0.02, 0.6, 4), '#999', [0.4, 0.95, 0]);
  k.part(r, geo.cone(0.2, 0.1, 10), '#dddddd', [0.4, 1.28, 0], { rot: [Math.PI, 0, 0] });
  for (const x of [-0.5, 0.5]) for (const z of [-0.45, 0.45]) k.part(r, geo.cyl(0.2, 0.2, 0.12, 12), '#555', [x, 0.2, z], { rot: [Math.PI / 2, 0, 0] });
  r.position.set(2, 0, 0.5);
  r.rotation.y = -0.5;
  g.add(r);
  return g;
}

export function crater(k: Kit, r = 1) {
  const g = new THREE.Group();
  k.part(g, geo.torus(r, r * 0.18, Math.PI * 2, 6, 20), '#9a9aa2', [0, 0.02, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.5], outline: false });
  k.part(g, geo.disc(r * 0.9, 20), '#6f6f78', [0, 0.03, 0], { rot: [-Math.PI / 2, 0, 0], outline: false });
  return g;
}

export function throne(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(3, 0.4, 2.2), '#6f6a66', [0, 0.2, 0]);
  k.part(g, geo.box(2.2, 0.3, 1.6), '#6f6a66', [0, 0.55, -0.2]);
  k.part(g, geo.box(1.2, 0.6, 1.0), '#4a4a52', [0, 1.0, -0.3]);
  k.part(g, geo.box(1.2, 2.4, 0.3), '#4a4a52', [0, 2.1, -0.75]);
  // Swords bristling from the back.
  for (let i = 0; i < 11; i++) {
    const a = -1.2 + (i / 10) * 2.4;
    const len = 1.2 + Math.cos(a) * 0.8;
    k.part(g, geo.box(0.06, len, 0.02), '#c8ccd4', [Math.sin(a) * 0.7, 2.8 + Math.cos(a) * 0.6, -0.8], { rot: [0, 0, -a * 0.6], outline: 0.01 });
  }
  for (const s of [-1, 1]) k.part(g, geo.box(0.25, 0.5, 1.0), '#4a4a52', [0.6 * s, 1.5, -0.3]);
  return g;
}

export function trainCar(k: Kit) {
  const g = new THREE.Group();
  for (const z of [-0.55, 0.55]) k.part(g, geo.box(0.08, 0.06, 7), '#777', [0, 0.05, 0], { rot: [0, Math.PI / 2, 0], scale: 1 }).position.set(0, 0.05, z);
  for (let x = -3.2; x <= 3.2; x += 0.6) k.part(g, geo.box(0.2, 0.05, 1.5), DARK_WOOD, [x, 0.02, 0], { outline: false });
  k.part(g, geo.box(4.2, 1.6, 1.5), '#e8e4ef', [0, 1.2, 0]);
  k.part(g, geo.box(4.25, 0.25, 1.55), '#e0b84a', [0, 0.55, 0]);
  k.part(g, geo.cyl(0.8, 0.8, 4.2, 16, ), '#9fb0d8', [0, 1.85, 0], { rot: [0, 0, Math.PI / 2], scale: [1, 1, 0.9] });
  for (let i = 0; i < 5; i++) {
    for (const z of [-0.76, 0.76]) {
      k.part(g, geo.box(0.55, 0.45, 0.02), '#ffe6a0', [-1.6 + i * 0.8, 1.35, z], { emissive: '#ffd070', glow: k.night ? 1.2 : 0.4, outline: false });
    }
  }
  for (const x of [-1.6, 1.6]) for (const z of [-0.6, 0.6]) k.part(g, geo.cyl(0.25, 0.25, 0.1, 12), '#333', [x, 0.3, z], { rot: [Math.PI / 2, 0, 0] });
  if (k.night) k.light(g, '#ffd070', 2, 6, [0, 1.4, 1.2], false);
  return g;
}

export function brokenColumn(k: Kit, h = 1.8) {
  const g = new THREE.Group();
  k.part(g, geo.box(0.8, 0.2, 0.8), '#d8d2c0', [0, 0.1, 0]);
  k.part(g, geo.cyl(0.28, 0.3, h, 12), '#e6e0d0', [0, 0.2 + h / 2, 0]);
  k.part(g, geo.cyl(0.3, 0.28, 0.25, 12), '#e6e0d0', [0.02, h + 0.35, 0], { rot: [0.25, 0, 0.2] });
  return g;
}

export function coral(k: Kit) {
  const g = new THREE.Group();
  const colors = ['#ff7e8a', '#ffb05a', '#b58cff', '#5fd3c8'];
  for (let i = 0; i < 5; i++) {
    const h = 0.4 + k.rand() * 0.6;
    k.part(g, geo.cyl(0.05, 0.1, h, 6), k.pick(colors), [(k.rand() - 0.5) * 0.6, h / 2, (k.rand() - 0.5) * 0.6], {
      rot: [(k.rand() - 0.5) * 0.6, 0, (k.rand() - 0.5) * 0.6], outline: 0.01,
    });
  }
  return g;
}

export function mammothBones(k: Kit) {
  const g = new THREE.Group();
  const bone = '#efe6d2';
  for (let i = 0; i < 6; i++) {
    k.part(g, geo.torus(1.1 - Math.abs(i - 2.5) * 0.12, 0.07, Math.PI, 6, 14), bone, [-1.3 + i * 0.5, 0, 0], { rot: [0, Math.PI / 2, 0] });
  }
  k.part(g, geo.cyl(0.08, 0.08, 3.2, 8), bone, [0, 1.05, 0], { rot: [0, 0, Math.PI / 2] });
  k.part(g, geo.sph(0.6, 12, 10), bone, [2.1, 0.8, 0], { scale: [1, 0.9, 0.8] });
  for (const s of [-1, 1]) {
    k.part(g, geo.torus(0.9, 0.08, Math.PI * 0.8, 6, 14), '#f7f0de', [2.7, 0.5, 0.3 * s], { rot: [0, 0, Math.PI * 1.1] });
  }
  // Dig site: shovel + rope stakes.
  k.part(g, geo.cyl(0.03, 0.03, 1.2, 5), WOOD, [-2.2, 0.6, 1.3], { rot: [0.3, 0, 0.3] });
  k.part(g, geo.box(0.25, 0.3, 0.03), '#999', [-2.4, 0.1, 1.2], { rot: [0.3, 0, 0.3] });
  return g;
}

export function mast(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.14, 0.18, 6, 10), DARK_WOOD, [0, 3, 0]);
  k.part(g, geo.cyl(0.07, 0.07, 3, 8), DARK_WOOD, [0, 4.2, 0], { rot: [0, 0, Math.PI / 2] });
  const sail = k.part(g, geo.box(2.8, 2.6, 0.05), '#f4ecd8', [0, 2.8, 0.2]);
  k.animate((t) => (sail.scale.z = 1 + Math.sin(t * 1.5) * 0.8));
  k.part(g, geo.cyl(0.25, 0.25, 0.4, 10), DARK_WOOD, [0, 5.9, 0]);
  return g;
}

export function shipWheel(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(0.3, 1, 0.3), DARK_WOOD, [0, 0.5, 0]);
  const w = new THREE.Group();
  k.part(w, geo.torus(0.45, 0.04, Math.PI * 2, 6, 20), WOOD, [0, 0, 0]);
  for (let i = 0; i < 4; i++) k.part(w, geo.cyl(0.025, 0.025, 1.2, 5), WOOD, [0, 0, 0], { rot: [0, 0, (i * Math.PI) / 4], outline: false });
  w.position.set(0, 1.2, 0.2);
  g.add(w);
  k.animate((t) => (w.rotation.z = Math.sin(t * 0.7) * 0.6));
  return g;
}

export function karst(k: Kit, h = 3) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.5, 0.8, h, 8), '#8f9a92', [0, h / 2, 0], { outline: 0.03 });
  k.part(g, geo.ico(0.75), '#5f9a55', [0, h + 0.1, 0], { scale: [1, 0.6, 1] });
  return g;
}

export function boat(k: Kit, color = '#8a5a3a') {
  const g = new THREE.Group();
  const hull = k.part(g, geo.cyl(0.45, 0.3, 2.4, 10, ), color, [0, 0.25, 0], { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.55] });
  hull.scale.set(1, 1, 0.5);
  const roof = k.part(g, new THREE.CylinderGeometry(0.5, 0.5, 1.1, 10, 1, true, -Math.PI / 2, Math.PI), '#c9a26e', [0, 0.45, 0], { rot: [Math.PI / 2, 0, 0] });
  (roof.material as THREE.Material).side = THREE.DoubleSide;
  k.animate((t) => (g.rotation.z = Math.sin(t * 1.1 + g.id) * 0.05));
  return g;
}

export function turtle(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.sph(1.3, 16, 10, ), '#4f8f5a', [0, 0.3, 0], { scale: [1, 0.45, 1.2] });
  k.part(g, geo.sph(0.4, 12, 10), '#8fbf7a', [0, 0.35, 1.55]);
  for (const [x, z] of [[-1, 0.9], [1, 0.9], [-1, -0.9], [1, -0.9]]) k.part(g, geo.sph(0.3, 8, 6), '#8fbf7a', [x, 0.15, z], { scale: [1.4, 0.4, 0.8] });
  return g;
}

export function tikiHut(k: Kit) {
  const g = new THREE.Group();
  for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.9]) k.part(g, geo.cyl(0.07, 0.07, 1.9, 6), '#8a6a44', [x, 0.95, z]);
  k.part(g, geo.cone(1.8, 1.2, 4), '#c9a95e', [0, 2.4, 0], { rot: [0, Math.PI / 4, 0], outline: 0.03 });
  k.part(g, geo.box(1.4, 0.8, 0.6), '#8a6a44', [0, 0.4, 0.5]);
  return g;
}

export function airplane(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.35, 0.2, 2.6, 12), '#e8483f', [0, 0, 0], { rot: [Math.PI / 2, 0, 0] });
  k.part(g, geo.box(3.4, 0.08, 0.7), '#f4d35e', [0, 0, 0.2]);
  k.part(g, geo.box(1.2, 0.06, 0.4), '#f4d35e', [0, 0.05, -1.15]);
  k.part(g, geo.box(0.06, 0.5, 0.4), '#e8483f', [0, 0.3, -1.15]);
  const prop = k.part(g, geo.box(0.9, 0.08, 0.04), '#333', [0, 0, 1.33]);
  k.animate((t) => (prop.rotation.z = t * 30));
  return g;
}

// ---------------------------------------------------------------- theme set pieces

/** Giant kneeling mecha bear on a hangar pad. */
export function mecha(k: Kit) {
  const g = new THREE.Group();
  const armor = '#3b3a44', trim = '#e0b84a', glow = k.look.accent;
  k.part(g, geo.box(2.2, 2.2, 1.6), armor, [0, 1.9, 0]);
  k.part(g, geo.box(1.2, 0.8, 0.1), trim, [0, 2.1, 0.81], { outline: false });
  k.part(g, geo.sph(0.3, 12, 10), glow, [0, 2.1, 0.86], { basic: true });
  k.part(g, geo.sph(1.0, 16, 12), armor, [0, 3.7, 0.2]);
  for (const s of [-1, 1]) {
    k.part(g, geo.sph(0.35, 10, 8), armor, [0.75 * s, 4.5, 0.1]);
    k.part(g, geo.box(0.22, 0.1, 0.05), glow, [0.32 * s, 3.8, 1.15], { basic: true });
    k.part(g, geo.cyl(0.35, 0.3, 2, 10), armor, [1.45 * s, 1.6, 0.3], { rot: [0.3, 0, 0.15 * s] });
    k.part(g, geo.box(0.8, 0.6, 1.4), armor, [0.7 * s, 0.3, 0.6]);
  }
  k.part(g, geo.box(0.9, 0.35, 0.3), '#c9976a', [0, 3.35, 1.05], { outline: 0.01 });
  k.light(g, glow, 3, 7, [0, 2.2, 1.5]);
  return g;
}

/** Yellow-black hazard ring floor (walk-through). */
export function hangarPad(k: Kit, r = 4.5) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(r, r, 0.08, 40), '#4a4d58', [0, 0.04, 0], { outline: 0.02 });
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    k.part(g, geo.box(0.5, 0.02, 0.25), i % 2 ? '#1a1a1a' : '#f2c230', [Math.cos(a) * (r - 0.3), 0.09, Math.sin(a) * (r - 0.3)], {
      rot: [0, -a, 0], outline: false,
    });
  }
  return g;
}

export function spotlight(k: Kit, color = '#ffffff') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.08, 0.1, 2.4, 8), '#333', [0, 1.2, 0]);
  k.part(g, geo.cyl(0.25, 0.3, 0.45, 10), '#222', [0, 2.5, 0.1], { rot: [-0.6, 0, 0] });
  const beam = k.part(g, geo.cone(1.4, 7, 20, ), color, [0, 2.6 - 3.3, 3.2], { rot: [Math.PI - 0.6, 0, 0], basic: true, opacity: 0.1, shadow: false });
  beam.renderOrder = 2;
  k.animate((t) => (beam.rotation.z = Math.sin(t * 0.5 + g.id) * 0.2));
  return g;
}

/** Idol stage: round deck, truss arch, speakers, light-up floor edge. */
export function idolStage(k: Kit) {
  const g = new THREE.Group();
  const accent = k.look.accent;
  k.part(g, geo.cyl(2.6, 2.8, 0.6, 24), '#2e2a3a', [0, 0.3, 0]);
  k.part(g, geo.torus(2.62, 0.05, Math.PI * 2, 6, 48), accent, [0, 0.6, 0], { rot: [Math.PI / 2, 0, 0], basic: true });
  for (const s of [-1, 1]) {
    k.part(g, geo.box(0.25, 3.6, 0.25), '#b8bcc8', [2.3 * s, 2.2, -1.2]);
    k.part(g, geo.box(0.8, 1.1, 0.6), '#1a1a22', [1.9 * s, 1.15, 0.7]);
    k.part(g, geo.cyl(0.25, 0.25, 0.05, 12), '#555', [1.9 * s, 1.25, 1.01], { rot: [Math.PI / 2, 0, 0], outline: false });
  }
  k.part(g, geo.box(4.85, 0.25, 0.25), '#b8bcc8', [0, 4, -1.2]);
  const bulbs: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) bulbs.push(k.part(g, geo.sph(0.12, 8, 6), i % 2 ? accent : '#ffffff', [-2 + i * 0.8, 3.8, -1.05], { basic: true }));
  // Mic stand at the front, mouth-high for a chibi singer standing just behind it
  // (the performer's spot is the deck centre; a taller stand poked through her).
  k.part(g, geo.cyl(0.15, 0.18, 0.04, 12), '#333', [0, 0.62, 1.15]);
  k.part(g, geo.cyl(0.02, 0.02, 0.95, 5), '#333', [0, 1.08, 1.15]);
  k.part(g, geo.sph(0.07, 8, 6), '#666', [0, 1.6, 1.1], { outline: false });
  k.light(g, accent, 3, 9, [0, 3, 1.5]);
  k.animate((t) => bulbs.forEach((b, i) => (b.visible = Math.sin(t * 4 + i) > -0.3)));
  return g;
}

/** Rows of glowing light sticks, as if a crowd is waving them. */
export function glowSticks(k: Kit, n = 40, radius = 2.5) {
  const g = new THREE.Group();
  const colors = [k.look.accent, '#8fd3ff', '#ffffff', '#ff9ec4'];
  const sticks: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const a = k.rand() * Math.PI, d = 0.5 + k.rand() * radius;
    sticks.push(k.part(g, geo.cyl(0.03, 0.03, 0.45, 5), k.pick(colors), [Math.cos(a) * d, 1.1 + k.rand() * 0.3, Math.sin(a) * d * 0.6], { basic: true }));
  }
  k.animate((t) => sticks.forEach((s, i) => (s.rotation.z = Math.sin(t * 3 + i * 0.7) * 0.5)));
  return g;
}

/**
 * Concert hall stage for the orchestra scenes (front = +Z, toward the
 * audience): warm wooden floor with a gold rim, glowing footlights, two
 * golden candelabras, a string of warm bulbs behind, and real warm lights
 * so the musicians are lit like in the painting.
 */
export function concertStage(k: Kit, radius = 2.9) {
  const g = new THREE.Group();
  const warm = '#ffe2a0';
  const glow = k.night ? 1.6 : 0.6;
  // Floor: wooden boards (two tones) and a gold edge.
  k.part(g, geo.cyl(radius, radius + 0.08, 0.08, 40), '#a8703f', [0, 0.04, 0], { outline: false });
  for (let i = -3; i <= 3; i++) k.part(g, geo.box(0.02, 0.005, radius * 1.8), '#8a5a32', [i * 0.75, 0.085, 0], { outline: false, shadow: false });
  k.part(g, geo.torus(radius + 0.02, 0.05, Math.PI * 2, 6, 64), '#e8c25a', [0, 0.08, 0], { rot: [Math.PI / 2, 0, 0], emissive: '#e8a83a', glow: 0.3, outline: false });
  // Footlights: a row of little bulbs along the front edge.
  for (let i = 0; i < 11; i++) {
    const a = -1.0 + (i / 10) * 2.0;
    const x = Math.sin(a) * (radius - 0.15), z = Math.cos(a) * (radius - 0.15);
    k.part(g, geo.box(0.16, 0.08, 0.1), '#3a2a22', [x, 0.12, z], { rot: [0, a, 0], outline: false });
    k.part(g, geo.sph(0.06, 8, 6), warm, [x, 0.18, z], { emissive: '#ffd070', glow: glow + 0.6, outline: false });
  }
  k.light(g, '#ffd9a0', 3, 6, [0, 0.5, radius - 0.4], false);
  // Two candelabras either side of the stage.
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(Math.sin(1.35 * s) * (radius + 0.4), 0, Math.cos(1.35) * (radius + 0.4));
    g.add(c);
    k.part(c, geo.cyl(0.22, 0.3, 0.12, 12), '#c99a3a', [0, 0.06, 0]);
    k.part(c, geo.cyl(0.04, 0.06, 2.0, 8), '#d9ac48', [0, 1.06, 0]);
    k.part(c, geo.torus(0.32, 0.03, Math.PI * 2, 6, 24), '#d9ac48', [0, 2.05, 0], { rot: [Math.PI / 2, 0, 0], outline: false });
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2;
      const cx = Math.cos(a) * 0.32, cz = Math.sin(a) * 0.32;
      k.part(c, geo.cyl(0.035, 0.035, 0.22, 6), '#fff6e0', [cx, 2.17, cz], { outline: false });
      k.part(c, geo.cone(0.035, 0.1, 6), '#ffcf5a', [cx, 2.33, cz], { emissive: '#ffb030', glow: 2, outline: false });
    }
    k.part(c, geo.sph(0.12, 10, 8), warm, [0, 2.3, 0], { emissive: '#ffd070', glow: glow + 0.4, outline: false });
    k.light(c, '#ffc878', 3, 7, [0, 2.4, 0]);
  }
  // Warm stage light from above the musicians.
  k.light(g, '#ffe6b8', 4, 9, [0, 3.4, 0.4], false);
  // A string of warm bulbs on two golden poles behind the orchestra.
  const back = radius + 0.3;
  const a = new THREE.Vector3(-2.6, 2.6, -back * 0.75), b = new THREE.Vector3(2.6, 2.6, -back * 0.75);
  for (const p of [a, b]) k.part(g, geo.cyl(0.04, 0.05, 2.6, 6), '#d9ac48', [p.x, 1.3, p.z]);
  g.add(lanternString(k, a, b, 9, '#ffe08a'));
  return g;
}

export function podium(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.6, 0.7, 0.4, 12), '#b8322a', [0, 0.2, 0]);
  k.part(g, geo.cyl(0.03, 0.03, 1.1, 5), '#333', [0, 0.95, 0.35]);
  k.part(g, geo.box(0.5, 0.35, 0.03), '#222', [0, 1.5, 0.4], { rot: [-0.5, 0, 0] });
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    const stand = new THREE.Group();
    k.part(stand, geo.cyl(0.02, 0.02, 1.1, 5), '#333', [0, 0.55, 0]);
    k.part(stand, geo.box(0.4, 0.3, 0.02), '#222', [0, 1.1, 0], { rot: [-0.4, 0, 0] });
    stand.position.set(Math.sin(a) * 2.2, 0, Math.cos(a) * 2.2);
    stand.rotation.y = a + Math.PI;
    g.add(stand);
  }
  return g;
}

/** Stone-ringed hot spring with rising steam. */
export function onsenPool(k: Kit, r = 2.4) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(r, r, 0.1, 32), '#7fc9d9', [0, 0.05, 0], { emissive: '#7fc9d9', glow: 0.25, outline: false });
  const n = Math.round(r * 7);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, s = 0.3 + k.rand() * 0.25;
    k.part(g, geo.dodec(s), '#8d8d95', [Math.cos(a) * r, s * 0.4, Math.sin(a) * r], { outline: 0.02 });
  }
  const steam: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const m = k.part(g, geo.sph(0.35, 8, 6), '#ffffff', [0, 0, 0], { basic: true, opacity: 0.18 });
    m.userData = { x: (k.rand() - 0.5) * r * 1.4, z: (k.rand() - 0.5) * r * 1.4, ph: k.rand() };
    steam.push(m);
  }
  k.animate((t) => steam.forEach((m) => {
    const p = (t * 0.15 + m.userData.ph) % 1;
    m.position.set(m.userData.x + Math.sin(t + m.userData.ph * 6) * 0.2, 0.2 + p * 2.5, m.userData.z);
    m.scale.setScalar(0.6 + p * 1.2);
  }));
  return g;
}

export function bambooFence(k: Kit, len = 3) {
  const g = new THREE.Group();
  for (let x = -len / 2; x <= len / 2; x += 0.16) k.part(g, geo.cyl(0.07, 0.07, 1.6, 6), '#a8b86a', [x, 0.8, 0], { outline: false });
  for (const y of [0.4, 1.2]) k.part(g, geo.box(len + 0.2, 0.05, 0.08), '#5a3a26', [0, y, 0.08]);
  return g;
}

/** Rocky cave arch with an opening toward +Z. */
export function cave(k: Kit) {
  const g = new THREE.Group();
  const c = k.env.below === 'snow' ? '#9aa3b0' : '#7d7468';
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7; // arc behind, open at the front
    const s = 1 + k.rand() * 0.5;
    k.part(g, geo.dodec(s), c, [Math.cos(a) * 2.2, s * 0.7, -Math.sin(a) * 2.2 + 0.4], { outline: 0.03 });
  }
  k.part(g, geo.sph(2.6, 12, 8, ), c, [0, 1.2, -0.6], { scale: [1.1, 0.8, 0.9], outline: 0.03 });
  k.part(g, geo.cyl(1.2, 1.2, 0.03, 16), '#b8565e', [0, 0.02, 1.2], { outline: false, scale: [1, 1, 0.7] });
  return g;
}

export function windmill(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.7, 1.1, 4, 8), '#efe6d2', [0, 2, 0]);
  k.part(g, geo.cone(1.0, 1.2, 8), '#b5553f', [0, 4.6, 0]);
  const blades = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Group();
    k.part(b, geo.box(0.08, 2.4, 0.04), WOOD, [0, 1.3, 0]);
    k.part(b, geo.box(0.6, 1.9, 0.02), '#f4ecd8', [0.34, 1.5, 0], { outline: 0.01 });
    b.rotation.z = (i * Math.PI) / 2;
    blades.add(b);
  }
  blades.position.set(0, 3.8, 1.05);
  g.add(blades);
  k.animate((t) => (blades.rotation.z = t * 0.6));
  return g;
}

export function haybale(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.5, 0.5, 0.9, 14), '#e2c46a', [0, 0.5, 0], { rot: [0, 0, Math.PI / 2] });
  return g;
}

/** Weaving loom (Tơ Hồng) with red threads. */
export function loom(k: Kit) {
  const g = new THREE.Group();
  for (const x of [-0.8, 0.8]) for (const z of [-0.5, 0.5]) k.part(g, geo.box(0.1, 1.6, 0.1), WOOD, [x, 0.8, z]);
  for (const z of [-0.5, 0.5]) k.part(g, geo.cyl(0.06, 0.06, 1.7, 8), DARK_WOOD, [0, 1.4, z], { rot: [0, 0, Math.PI / 2] });
  for (let i = 0; i < 14; i++) k.part(g, geo.box(0.015, 0.015, 1.0), '#e0303a', [-0.65 + i * 0.1, 1.2, 0], { outline: false, emissive: '#e0303a', glow: 0.4 });
  k.part(g, geo.box(1.3, 0.02, 0.5), '#e0303a', [0, 1.19, 0.2], { outline: false });
  k.part(g, geo.box(1.2, 0.08, 0.4), WOOD, [0, 0.6, 0.9]);
  return g;
}

/** Red thread strung between two points (world-space, relative to group). */
export function redThread(k: Kit, a: THREE.Vector3, b: THREE.Vector3) {
  const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.5, 0));
  const tube = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, mid, b), 24, 0.025, 5);
  return new THREE.Mesh(tube, k.mat('#e0303a', { emissive: '#ff3040', glow: k.night ? 1 : 0.5 }));
}

/** Floating glowing orb (sun or moon) that bobs and slowly orbits. */
export function orb(k: Kit, color: string, r = 0.6) {
  const g = new THREE.Group();
  k.part(g, geo.sph(r, 20, 14), color, [0, 0, 0], { basic: true });
  k.part(g, geo.sph(r * 1.5, 16, 12), color, [0, 0, 0], { basic: true, opacity: 0.2 });
  k.light(g, color, 2.5, 8, [0, 0, 0], false);
  return g;
}

export function crystal(k: Kit, color = '#cfe8ff') {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const h = 0.5 + k.rand() * 0.9;
    k.part(g, geo.cone(0.18, h, 5), color, [(k.rand() - 0.5) * 0.5, h / 2, (k.rand() - 0.5) * 0.5], {
      rot: [(k.rand() - 0.5) * 0.5, 0, (k.rand() - 0.5) * 0.5], emissive: color, glow: 0.5, outline: 0.015,
    });
  }
  return g;
}

export function sundial(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.5, 0.6, 0.9, 12), '#e6e0d0', [0, 0.45, 0]);
  k.part(g, geo.cyl(0.6, 0.6, 0.06, 20), '#e0b84a', [0, 0.93, 0]);
  k.part(g, geo.box(0.04, 0.35, 0.4), '#8a6a3a', [0, 1.1, 0], { rot: [0.5, 0, 0] });
  return g;
}

export function gardenArch(k: Kit, flower = '#ff9ec4') {
  const g = new THREE.Group();
  k.part(g, geo.torus(1.1, 0.06, Math.PI, 6, 20), '#f4f4f4', [0, 1.3, 0]);
  for (const s of [-1, 1]) k.part(g, geo.cyl(0.06, 0.06, 1.3, 6), '#f4f4f4', [1.1 * s, 0.65, 0]);
  for (let i = 0; i < 9; i++) {
    const a = (i / 8) * Math.PI;
    k.part(g, geo.sph(0.13, 8, 6), flower, [Math.cos(a) * 1.1, 1.3 + Math.sin(a) * 1.1, 0.05], { outline: false });
  }
  return g;
}

/** Mini Eiffel tower. */
export function eiffel(k: Kit) {
  const g = new THREE.Group();
  const iron = '#6b5a4a';
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.part(g, geo.box(0.18, 2.6, 0.18), iron, [x * 0.65, 1.2, z * 0.65], { rot: [-z * 0.28, 0, x * 0.28] });
  }
  k.part(g, geo.box(1.4, 0.15, 1.4), iron, [0, 2.4, 0]);
  k.part(g, geo.cyl(0.12, 0.45, 3, 4), iron, [0, 3.9, 0], { rot: [0, Math.PI / 4, 0] });
  k.part(g, geo.cyl(0.03, 0.08, 1, 4), iron, [0, 5.9, 0]);
  if (k.night) k.part(g, geo.sph(0.12, 8, 6), '#ffd58a', [0, 6.4, 0], { basic: true });
  return g;
}

export function cafeSet(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.4, 0.4, 0.05, 14), '#f4f4f4', [0, 0.75, 0]);
  k.part(g, geo.cyl(0.04, 0.06, 0.75, 8), '#2d2d35', [0, 0.37, 0]);
  for (const s of [-1, 1]) {
    k.part(g, geo.cyl(0.22, 0.22, 0.05, 12), '#c0392b', [0.65 * s, 0.45, 0]);
    k.part(g, geo.cyl(0.03, 0.03, 0.45, 6), '#2d2d35', [0.65 * s, 0.22, 0], { outline: false });
  }
  k.part(g, geo.cyl(0.05, 0.04, 0.08, 8), '#ffffff', [0.1, 0.82, 0], { outline: false });
  // Parasol
  k.part(g, geo.cyl(0.02, 0.02, 1.5, 5), '#2d2d35', [0, 1.5, 0], { outline: false });
  k.part(g, geo.cone(1.1, 0.4, 8), '#e8b0b8', [0, 2.3, 0], { outline: 0.015 });
  return g;
}

export function flowerBox(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.2, 0.35, 0.4), '#8a5a3a', [0, 0.18, 0]);
  const colors = ['#e05a7a', '#ffb3c6', '#ffffff', '#ffd36e'];
  for (let i = 0; i < 8; i++) k.part(g, geo.sph(0.1, 6, 4), k.pick(colors), [-0.5 + i * 0.14, 0.42, (k.rand() - 0.5) * 0.2], { outline: false });
  return g;
}

/** Straight canal (water strip across X) with stone kerbs; walk-through surface. */
export function canal(k: Kit, len = 22, width = 1.8) {
  const g = new THREE.Group();
  k.part(g, geo.box(len, 0.04, width), k.night ? '#2f4f6f' : '#5f9ec8', [0, 0.03, 0], { emissive: '#5f9ec8', glow: 0.2, outline: false });
  for (const s of [-1, 1]) k.part(g, geo.box(len, 0.2, 0.25), '#c8c0b0', [0, 0.1, (width / 2 + 0.12) * s]);
  return g;
}

export function ramenStall(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(2.4, 1, 0.9), '#6b4a33', [0, 0.5, 0]);
  k.part(g, geo.box(2.5, 0.08, 1.0), '#c9a26e', [0, 1.04, 0]);
  for (const x of [-1.15, 1.15]) k.part(g, geo.cyl(0.05, 0.05, 2.2, 6), DARK_WOOD, [x, 1.1, -0.4]);
  k.part(g, geo.box(2.6, 0.1, 1.2), DARK_WOOD, [0, 2.25, -0.1]);
  for (let i = 0; i < 4; i++) k.part(g, geo.box(0.55, 0.5, 0.02), '#2a2f55', [-0.9 + i * 0.6, 1.95, 0.45], { outline: false });
  for (let i = 0; i < 3; i++) {
    k.part(g, geo.cyl(0.14, 0.09, 0.1, 12), '#ffffff', [-0.6 + i * 0.6, 1.13, 0.2], { outline: false });
    k.part(g, geo.cyl(0.13, 0.13, 0.01, 12), '#e8b060', [-0.6 + i * 0.6, 1.18, 0.2], { outline: false });
  }
  for (const x of [-1.3, 1.3]) k.part(g, geo.sph(0.18, 10, 8), '#e8483f', [x, 1.9, 0.55], { scale: [1, 1.3, 1], emissive: '#e8483f', glow: k.night ? 1 : 0.3 });
  k.light(g, '#ffb070', 2.2, 6, [0, 1.8, 1], false);
  return g;
}

/** Beach umbrella + towel. */
export function beachSet(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.03, 0.03, 2, 5), '#f4f4f4', [0, 1, 0]);
  k.part(g, geo.cone(1.2, 0.45, 8), '#ff7e5a', [0, 2, 0], { outline: 0.015 });
  k.part(g, geo.box(0.8, 0.02, 1.6), '#5fb3e8', [0.9, 0.02, 0.3], { outline: false });
  k.part(g, geo.box(0.25, 1.4, 0.05), '#ffd36e', [-0.9, 0.7, 0.2], { rot: [0.15, 0, 0.1] });
  return g;
}

// ---------------------------------------------------------------- championship arena (League of Legends cover)

/**
 * Championship stage: three round marble steps with gold rims and, on a
 * pedestal in the middle, the trophy (silver cup, gold handles and crown, a
 * blue gem) under a warm light. Front = +Z.
 */
export function trophyStage(k: Kit) {
  const g = new THREE.Group();
  const steps: [number, number][] = [[3.2, 0.12], [2.4, 0.24], [1.6, 0.36]];
  for (const [r, h] of steps) {
    k.part(g, geo.cyl(r, r + 0.05, h, 48), '#2c2c38', [0, h / 2, 0], { outline: false });
    k.part(g, geo.torus(r + 0.01, 0.025, Math.PI * 2, 6, 64), '#e8c25a', [0, h, 0], { rot: [Math.PI / 2, 0, 0], emissive: '#e8a83a', glow: 0.8, outline: false });
  }
  // Pedestal
  k.part(g, geo.cyl(0.45, 0.55, 0.7, 24), '#1f1f29', [0, 0.36 + 0.35, 0]);
  k.part(g, geo.torus(0.46, 0.03, Math.PI * 2, 6, 32), '#e8c25a', [0, 1.06, 0], { rot: [Math.PI / 2, 0, 0], emissive: '#e8a83a', glow: 0.6, outline: false });
  const cup = trophy(k);
  cup.position.y = 1.06;
  g.add(cup);
  k.light(g, '#fff0d0', 4, 7, [0, 3.2, 1.2], false);
  k.light(g, '#9a7bff', 3, 8, [0, 1.6, -1.2], false);
  return g;
}

/** The championship cup (about 1.3 m): a lathed silver body, gold trim and handles, a blue gem. */
export function trophy(k: Kit) {
  const g = new THREE.Group();
  // Profile (radius, height) from the foot up to the lip.
  const profile = [[0.0, 0], [0.32, 0], [0.32, 0.08], [0.16, 0.14], [0.08, 0.3], [0.07, 0.55], [0.12, 0.62],
    [0.3, 0.78], [0.38, 1.0], [0.4, 1.18], [0.36, 1.2], [0.0, 1.2]].map(([r, y]) => new THREE.Vector2(r, y));
  // Silver in the toon look (a metal material has nothing to reflect here and goes black).
  k.part(g, new THREE.LatheGeometry(profile, 40), '#e4e8f0', [0, 0, 0], { emissive: '#8a94b8', glow: 0.45, outline: 0.012 });
  const gold = { emissive: '#c8902a', glow: 0.5, outline: false as const };
  k.part(g, geo.torus(0.395, 0.025, Math.PI * 2, 6, 40), '#f0c860', [0, 1.19, 0], { rot: [Math.PI / 2, 0, 0], ...gold });
  k.part(g, geo.torus(0.32, 0.03, Math.PI * 2, 6, 40), '#f0c860', [0, 0.04, 0], { rot: [Math.PI / 2, 0, 0], ...gold });
  k.part(g, geo.torus(0.1, 0.025, Math.PI * 2, 6, 24), '#f0c860', [0, 0.58, 0], { rot: [Math.PI / 2, 0, 0], ...gold });
  for (const s of [-1, 1]) {
    // Swept handles: a half ring on each side.
    k.part(g, geo.torus(0.2, 0.03, Math.PI, 6, 20), '#f0c860', [0.42 * s, 0.92, 0], { rot: [0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2], ...gold });
  }
  // Crown of little gold points on the lip.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.part(g, geo.cone(0.035, 0.14, 4), '#f0c860', [Math.cos(a) * 0.38, 1.27, Math.sin(a) * 0.38], gold);
  }
  k.part(g, geo.ico(0.09, 0), '#4fa8ff', [0, 0.88, 0.37], { emissive: '#2f7fff', glow: 1.5, outline: false });
  // Glints that sparkle across the cup.
  const glint = k.part(g, geo.sph(0.035, 6, 4), '#ffffff', [0.2, 1.0, 0.33], { basic: true });
  k.animate((t) => {
    const p = (t * 0.35) % 1;
    glint.position.set(Math.cos(p * Math.PI * 2) * 0.39, 0.8 + p * 0.3, Math.sin(p * Math.PI * 2) * 0.39);
    glint.scale.setScalar(Math.max(0, Math.sin(p * Math.PI * 6)) * 1.5);
  });
  return g;
}

let mistTex: THREE.CanvasTexture | null = null;
function mistTexture() {
  if (mistTex) return mistTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  mistTex = new THREE.CanvasTexture(c);
  return mistTex;
}

/** Low drifting mist around a point: soft sprites that circle slowly and breathe. */
export function mist(k: Kit, radius: number, n = 26, color = '#d8d0ff') {
  const g = new THREE.Group();
  const mat = new THREE.SpriteMaterial({ map: mistTexture(), color, transparent: true, opacity: 0.32, depthWrite: false });
  const puffs: { s: THREE.Sprite; a: number; r: number; y: number; size: number; ph: number }[] = [];
  for (let i = 0; i < n; i++) {
    const s = new THREE.Sprite(mat);
    const p = { s, a: (i / n) * Math.PI * 2 + k.rand() * 0.4, r: radius * (0.75 + k.rand() * 0.45), y: 0.2 + k.rand() * 0.5, size: 1.6 + k.rand() * 1.4, ph: k.rand() * 6 };
    s.renderOrder = 3;
    g.add(s);
    puffs.push(p);
  }
  k.animate((t) => {
    for (const p of puffs) {
      const a = p.a + t * 0.05;
      p.s.position.set(Math.cos(a) * p.r, p.y + Math.sin(t * 0.4 + p.ph) * 0.1, Math.sin(a) * p.r);
      p.s.scale.setScalar(p.size * (1 + Math.sin(t * 0.3 + p.ph) * 0.15));
    }
  });
  return g;
}

/** Spotlight beams from high above, converging on a point and sweeping slowly. */
export function stageBeams(k: Kit, target: THREE.Vector3, n = 4, color = '#e8f0ff') {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const top = new THREE.Vector3(target.x + Math.cos(a) * 5, 10, target.z + Math.sin(a) * 5);
    const len = top.distanceTo(target);
    const pivot = new THREE.Group();
    pivot.position.copy(top);
    pivot.lookAt(target);
    g.add(pivot);
    // A cone from its tip at the lamp, opening toward the target (+Z of the pivot).
    const beam = k.part(pivot, geo.cone(1.1, len, 24), color, [0, 0, len / 2], { rot: [-Math.PI / 2, 0, 0], basic: true, opacity: 0.08, shadow: false });
    beam.renderOrder = 2;
    (beam.material as THREE.Material).depthWrite = false;
    const base = pivot.rotation.clone();
    k.animate((t) => {
      pivot.rotation.set(base.x + Math.sin(t * 0.3 + i) * 0.06, base.y + Math.cos(t * 0.25 + i * 2) * 0.06, base.z);
    });
  }
  return g;
}

/**
 * A cheering crowd in the dark: only their light sticks show, in rows of
 * stands rising around the arena, waving in a wave that runs around the
 * stands. `gap`: an opening (radians either side of -Z) left for the painting.
 */
export function lightStickCrowd(k: Kit, inner: number, rows = 6, perRow = 110, gap = 0.75) {
  const g = new THREE.Group();
  const colors = ['#b48cff', '#7aa8ff', '#ffffff', '#ffd36e', '#9a6bff'];
  const count = rows * perRow;
  const mesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.035, 0.3, 2, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), count);
  const sticks: { p: THREE.Vector3; a: number; ph: number }[] = [];
  const c = new THREE.Color();
  let i = 0;
  for (let row = 0; row < rows; row++) {
    for (let j = 0; j < perRow; j++) {
      // Azimuth measured from -Z (the painting); skip the opening in front.
      const span = Math.PI * 2 - gap * 2;
      const az = gap + (j + k.rand() * 0.6) / perRow * span;
      const r = inner + row * 0.9 + k.rand() * 0.3;
      sticks.push({ p: new THREE.Vector3(Math.sin(az) * r, -1.2 + row * 0.75 + k.rand() * 0.15, -Math.cos(az) * r), a: az, ph: k.rand() * 0.6 });
      mesh.setColorAt(i++, c.set(k.pick(colors)));
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const wave = (t: number) => {
    sticks.forEach((s, idx) => {
      // Side-to-side waving, stronger where the wave is passing.
      const pass = Math.max(0, Math.sin(s.a - t * 0.8));
      const sway = Math.sin(t * 3.2 + s.ph * 6) * (0.25 + pass * 0.5);
      e.set(0, -s.a, sway);
      mesh.setMatrixAt(idx, m.compose(new THREE.Vector3(s.p.x, s.p.y + pass * 0.25, s.p.z), q.setFromEuler(e), one));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  wave(0);
  k.animate(wave);
  mesh.frustumCulled = false;
  g.add(mesh);
  return g;
}

export { palm };
