import * as THREE from 'three';
import { geo, type Kit } from '../kit';

// Buildings, lights, furniture and set pieces. Groups with base at y = 0,
// front facing +Z.

const WOOD = '#8a5a3a';
const DARK_WOOD = '#5a3a26';
const STONE = '#a3a3ab';

// ---------------------------------------------------------------- lights & fire

export function stoneLantern(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.28, 0.35, 0.2, 6), STONE, [0, 0.1, 0]);
  k.part(g, geo.cyl(0.1, 0.12, 0.7, 6), STONE, [0, 0.55, 0]);
  k.part(g, geo.box(0.42, 0.34, 0.42), '#ffe2a0', [0, 1.05, 0], { emissive: '#ffcf70', glow: k.night ? 1.2 : 0.4 });
  k.part(g, geo.cone(0.45, 0.35, 4), STONE, [0, 1.4, 0], { rot: [0, Math.PI / 4, 0] });
  if (k.night) k.light(g, '#ffc870', 2.2, 6, [0, 1.05, 0]);
  return g;
}

export function streetLamp(k: Kit, color = '#2d2d35') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.06, 0.1, 2.6, 8), color, [0, 1.3, 0]);
  k.part(g, geo.sph(0.22, 12, 10), '#fff1c4', [0, 2.75, 0], { emissive: '#ffd98a', glow: k.night ? 1.4 : 0.3 });
  k.part(g, geo.cone(0.3, 0.2, 8), color, [0, 3.0, 0]);
  if (k.night) k.light(g, '#ffd48a', 3, 8, [0, 2.75, 0], false);
  return g;
}

export function torch(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.05, 0.07, 1.5, 6), DARK_WOOD, [0, 0.75, 0]);
  k.part(g, geo.cyl(0.12, 0.08, 0.18, 8), '#555', [0, 1.55, 0]);
  const flame = k.part(g, geo.cone(0.12, 0.35, 6), '#ffb347', [0, 1.78, 0], { basic: true });
  k.light(g, '#ff9a40', 2.2, 6, [0, 1.8, 0]);
  k.animate((t) => flame.scale.set(1, 0.85 + Math.sin(t * 12 + g.id) * 0.15, 1));
  return g;
}

export function campfire(k: Kit) {
  const g = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.part(g, geo.dodec(0.16), '#8d8d95', [Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55], { outline: 0.01 });
  }
  for (let i = 0; i < 3; i++) {
    k.part(g, geo.cyl(0.07, 0.07, 0.8, 6), '#6b4a33', [0, 0.12, 0], { rot: [0, (i * Math.PI) / 3, Math.PI / 2] });
  }
  const flames = [0, 1, 2].map((i) =>
    k.part(g, geo.cone(0.18 - i * 0.04, 0.6 - i * 0.1, 6), i ? '#ffd166' : '#ff8a3c', [(i - 1) * 0.08, 0.35, 0], { basic: true }),
  );
  k.light(g, '#ff9a40', 4, 9, [0, 0.7, 0]);
  k.animate((t) => flames.forEach((f, i) => f.scale.set(1, 0.8 + Math.sin(t * 10 + i * 2) * 0.2, 1)));
  return g;
}

/** String of paper lanterns between two points (world-space, relative to the group origin). */
export function lanternString(k: Kit, from: THREE.Vector3, to: THREE.Vector3, n = 7, color = '#e8483f') {
  const g = new THREE.Group();
  const curve = new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, -0.6, 0)), to);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.015, 4), k.mat('#3a2a22')));
  for (let i = 1; i < n; i++) {
    const p = curve.getPoint(i / n);
    k.part(g, geo.sph(0.14, 10, 8), color, [p.x, p.y - 0.18, p.z], {
      scale: [1, 1.25, 1], emissive: color, glow: k.night ? 0.9 : 0.25, outline: 0.01,
    });
  }
  return g;
}

// ---------------------------------------------------------------- buildings

export function house(k: Kit, wall = '#f1e3c8', roof = '#c0533f') {
  const g = new THREE.Group();
  k.part(g, geo.box(2.2, 1.6, 1.8), wall, [0, 0.8, 0]);
  const r = k.part(g, geo.cone(1.75, 1.2, 4), roof, [0, 2.2, 0], { rot: [0, Math.PI / 4, 0] });
  r.scale.set(1.05, 1, 0.85);
  k.part(g, geo.box(0.5, 0.9, 0.05), DARK_WOOD, [0, 0.45, 0.91]);
  const lit = k.night ? '#ffd58a' : '#9fc4e8';
  for (const s of [-1, 1]) k.part(g, geo.box(0.4, 0.4, 0.05), lit, [0.65 * s, 1.0, 0.91], { emissive: lit, glow: k.night ? 1 : 0 });
  if (k.night) k.light(g, '#ffc870', 1.4, 5, [0, 1, 1.4], false);
  return g;
}

export function hut(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(1.1, 1.1, 1.3, 10), '#c9a26e', [0, 0.65, 0]);
  k.part(g, geo.cone(1.7, 1.4, 10), '#b99a55', [0, 2.0, 0], { outline: 0.03 });
  k.part(g, geo.box(0.55, 0.9, 0.1), DARK_WOOD, [0, 0.45, 1.08]);
  return g;
}

export function tent(k: Kit, color = '#d9864a') {
  const g = new THREE.Group();
  k.part(g, geo.cone(1.1, 1.5, 4), color, [0, 0.75, 0], { rot: [0, Math.PI / 4, 0] });
  k.part(g, geo.box(0.5, 0.8, 0.02), '#3a2a22', [0, 0.4, 0.58], { outline: false });
  return g;
}

export function well(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.6, 0.65, 0.7, 12), STONE, [0, 0.35, 0]);
  k.part(g, geo.cyl(0.48, 0.48, 0.02, 12), '#2a4a6a', [0, 0.66, 0], { outline: false });
  for (const s of [-1, 1]) k.part(g, geo.box(0.1, 1.3, 0.1), WOOD, [0.55 * s, 1.0, 0]);
  k.part(g, geo.cone(0.95, 0.5, 4), '#b5553f', [0, 1.85, 0], { rot: [0, Math.PI / 4, 0] });
  return g;
}

export function stall(k: Kit, canopy = '#d9473f') {
  const g = new THREE.Group();
  k.part(g, geo.box(1.8, 0.8, 0.8), WOOD, [0, 0.4, 0]);
  for (const x of [-0.85, 0.85]) for (const z of [-0.35, 0.35]) k.part(g, geo.cyl(0.04, 0.04, 1.9, 6), DARK_WOOD, [x, 0.95, z]);
  k.part(g, geo.box(2.0, 0.08, 1.1), canopy, [0, 1.9, 0.05], { rot: [0.18, 0, 0] });
  const goods = ['#ff8a3c', '#9fd36e', '#ffd36e', '#d9473f'];
  for (let i = 0; i < 6; i++) k.part(g, geo.sph(0.1, 8, 6), goods[i % 4], [-0.6 + i * 0.24, 0.88, 0.1], { outline: false });
  return g;
}

export function signpost(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.05, 0.06, 1.6, 6), WOOD, [0, 0.8, 0]);
  k.part(g, geo.box(0.8, 0.2, 0.05), '#c9a26e', [0.25, 1.35, 0], { rot: [0, 0, 0.08] });
  k.part(g, geo.box(0.7, 0.2, 0.05), '#c9a26e', [-0.2, 1.05, 0], { rot: [0, 0, -0.06] });
  return g;
}

export function fence(k: Kit, len = 2) {
  const g = new THREE.Group();
  const posts = Math.max(2, Math.round(len / 0.7) + 1);
  for (let i = 0; i < posts; i++) k.part(g, geo.box(0.08, 0.7, 0.08), WOOD, [-len / 2 + (i * len) / (posts - 1), 0.35, 0]);
  for (const y of [0.25, 0.55]) k.part(g, geo.box(len, 0.06, 0.04), WOOD, [0, y, 0]);
  return g;
}

export function bench(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.4, 0.08, 0.45), WOOD, [0, 0.45, 0]);
  k.part(g, geo.box(1.4, 0.35, 0.06), WOOD, [0, 0.72, -0.2]);
  for (const s of [-1, 1]) k.part(g, geo.box(0.08, 0.45, 0.4), '#3a3a42', [0.6 * s, 0.22, 0]);
  return g;
}

/** Arched bridge made of deck segments along an arc (spans X). */
export function archBridge(k: Kit, span = 4, color = '#7fc7a8', rail = '#c0392b') {
  const g = new THREE.Group();
  const n = 9, rise = span * 0.22;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = -span / 2 + t * span;
    const y = Math.sin(t * Math.PI) * rise + 0.12;
    const slope = Math.cos(t * Math.PI) * Math.PI * rise / span;
    k.part(g, geo.box(span / (n - 1) + 0.08, 0.14, 1.3), color, [x, y, 0], { rot: [0, 0, Math.atan(slope)], outline: 0.015 });
    if (i % 2 === 0) for (const s of [-1, 1]) k.part(g, geo.cyl(0.04, 0.04, 0.55, 6), rail, [x, y + 0.3, 0.6 * s]);
  }
  for (const s of [-1, 1]) {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const t = i / 11;
      return new THREE.Vector3(-span / 2 + t * span, Math.sin(t * Math.PI) * rise + 0.62, 0.6 * s);
    });
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 5), k.mat(rail)));
  }
  return g;
}

/** Chinese pavilion: platform, red columns, double green roof. */
export function pavilion(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(1.9, 2.0, 0.3, 8), '#d8d2c0', [0, 0.15, 0]);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.part(g, geo.cyl(0.08, 0.08, 2, 8), '#b8322a', [Math.cos(a) * 1.55, 1.3, Math.sin(a) * 1.55]);
  }
  k.part(g, geo.cone(2.5, 0.8, 8), '#3f8f6e', [0, 2.65, 0], { rot: [0, Math.PI / 8, 0], outline: 0.03 });
  k.part(g, geo.cone(1.5, 0.8, 8), '#3f8f6e', [0, 3.2, 0], { rot: [0, Math.PI / 8, 0], outline: 0.03 });
  k.part(g, geo.sph(0.15, 8, 6), '#e0b84a', [0, 3.65, 0]);
  k.part(g, geo.cyl(0.5, 0.5, 0.5, 12), '#7a5436', [0, 0.55, 0]);
  return g;
}

export function torii(k: Kit) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) k.part(g, geo.cyl(0.12, 0.14, 2.6, 10), '#d9473f', [1.1 * s, 1.3, 0]);
  k.part(g, geo.box(3.0, 0.2, 0.3), '#2a2a2a', [0, 2.7, 0]);
  k.part(g, geo.box(2.5, 0.15, 0.2), '#d9473f', [0, 2.2, 0]);
  return g;
}

// ---------------------------------------------------------------- furniture

/** Round plank floor + rug (walk-through). */
export function roomFloor(k: Kit, radius = 3.4, rug = '#b8565e') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(radius, radius, 0.12, 24), '#b98a5e', [0, 0.06, 0], { outline: 0.02 });
  for (let i = -3; i <= 3; i++) {
    k.part(g, geo.box(0.02, 0.01, radius * 1.9), '#8a6240', [i * radius * 0.28, 0.125, 0], { outline: false });
  }
  k.part(g, geo.cyl(radius * 0.55, radius * 0.55, 0.02, 24), rug, [0, 0.14, 0.2], { outline: false, scale: [1.3, 1, 1] });
  return g;
}

export function sofa(k: Kit, color = '#6d8fb8') {
  const g = new THREE.Group();
  k.part(g, geo.box(1.8, 0.4, 0.8), color, [0, 0.35, 0]);
  k.part(g, geo.box(1.8, 0.6, 0.25), color, [0, 0.75, -0.3]);
  for (const s of [-1, 1]) k.part(g, geo.box(0.25, 0.55, 0.8), color, [0.9 * s, 0.45, 0]);
  k.part(g, geo.box(0.5, 0.3, 0.12), '#f2d4a8', [-0.4, 0.7, -0.12], { rot: [-0.2, 0.2, 0] });
  return g;
}

export function coffeeTable(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.5, 0.5, 0.08, 16), WOOD, [0, 0.45, 0]);
  k.part(g, geo.cyl(0.08, 0.12, 0.42, 8), DARK_WOOD, [0, 0.21, 0]);
  k.part(g, geo.cyl(0.07, 0.06, 0.12, 10), '#ffffff', [0.15, 0.55, 0.05]);
  k.part(g, geo.box(0.3, 0.05, 0.22), '#d9473f', [-0.15, 0.51, -0.05], { rot: [0, 0.4, 0] });
  return g;
}

export function floorLamp(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.2, 0.22, 0.05, 12), '#333', [0, 0.03, 0]);
  k.part(g, geo.cyl(0.025, 0.025, 1.6, 6), '#333', [0, 0.8, 0]);
  k.part(g, geo.cyl(0.18, 0.3, 0.35, 12), '#ffe6b0', [0, 1.7, 0], { emissive: '#ffcf80', glow: k.night ? 1 : 0.3 });
  k.light(g, '#ffd08a', k.night ? 2.5 : 1, 6, [0, 1.6, 0], false);
  return g;
}

export function bookshelf(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.4, 2, 0.4), DARK_WOOD, [0, 1, 0]);
  const colors = ['#c0533f', '#3f7f8f', '#e0b84a', '#6d5fa8', '#4f8f3a', '#d98a6e'];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = -0.6;
    while (x < 0.55) {
      const w = 0.07 + k.rand() * 0.06, h = 0.3 + k.rand() * 0.12;
      k.part(g, geo.box(w, h, 0.28), k.pick(colors), [x + w / 2, 0.2 + shelf * 0.47 + h / 2, 0.08], { outline: false });
      x += w + 0.01;
    }
  }
  return g;
}

export function bed(k: Kit, blanket = '#8fb3e8') {
  const g = new THREE.Group();
  k.part(g, geo.box(1.3, 0.35, 2.1), DARK_WOOD, [0, 0.18, 0]);
  k.part(g, geo.box(1.2, 0.2, 2.0), '#ffffff', [0, 0.45, 0]);
  k.part(g, geo.box(1.25, 0.12, 1.3), blanket, [0, 0.58, 0.3]);
  k.part(g, geo.box(0.7, 0.18, 0.4), '#fff4e0', [0, 0.62, -0.72]);
  k.part(g, geo.box(1.3, 0.8, 0.12), DARK_WOOD, [0, 0.55, -1.05]);
  return g;
}

export function desk(k: Kit, screens = 1) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.6, 0.06, 0.7), '#3a3a42', [0, 0.75, 0]);
  for (const x of [-0.75, 0.75]) k.part(g, geo.box(0.05, 0.75, 0.6), '#2a2a30', [x, 0.37, 0]);
  for (let i = 0; i < screens; i++) {
    const x = (i - (screens - 1) / 2) * 0.75;
    k.part(g, geo.box(0.65, 0.4, 0.04), '#1a1a22', [x, 1.05, -0.2]);
    k.part(g, geo.box(0.6, 0.35, 0.01), '#5fd3ff', [x, 1.05, -0.175], { basic: true });
  }
  k.part(g, geo.box(0.5, 0.02, 0.16), '#222', [0, 0.79, 0.12], { outline: false });
  k.part(g, geo.box(0.02, 0.01, 0.14), '#ff4fd8', [0, 0.8, 0.12], { basic: true });
  k.light(g, '#8fd8ff', 1.2, 3, [0, 1.1, 0.3], false);
  return g;
}

export function chair(k: Kit, color = '#c0533f') {
  const g = new THREE.Group();
  k.part(g, geo.box(0.5, 0.08, 0.5), color, [0, 0.45, 0]);
  k.part(g, geo.box(0.5, 0.6, 0.08), color, [0, 0.8, -0.22]);
  for (const x of [-0.2, 0.2]) for (const z of [-0.2, 0.2]) k.part(g, geo.cyl(0.03, 0.03, 0.45, 6), '#333', [x, 0.22, z], { outline: false });
  return g;
}

export function radio(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(0.7, 0.2, 0.4), DARK_WOOD, [0, 0.35, 0]);
  for (const x of [-0.28, 0.28]) k.part(g, geo.cyl(0.03, 0.03, 0.35, 6), DARK_WOOD, [x, 0.17, 0], { outline: false });
  k.part(g, geo.box(0.6, 0.45, 0.3), '#a0673e', [0, 0.68, 0]);
  k.part(g, geo.cyl(0.13, 0.13, 0.02, 16), '#e8d9b5', [-0.12, 0.7, 0.16], { rot: [Math.PI / 2, 0, 0], outline: false });
  k.part(g, geo.box(0.18, 0.08, 0.02), '#ffcf70', [0.17, 0.75, 0.16], { emissive: '#ffcf70', glow: 0.8, outline: false });
  k.part(g, geo.cyl(0.005, 0.005, 0.5, 4), '#888', [0.2, 1.1, -0.05], { rot: [0, 0, -0.4], outline: false });
  return g;
}

export function counter(k: Kit, len = 2.4, top = '#6b4a33') {
  const g = new THREE.Group();
  k.part(g, geo.box(len, 1, 0.6), DARK_WOOD, [0, 0.5, 0]);
  k.part(g, geo.box(len + 0.1, 0.08, 0.75), top, [0, 1.04, 0]);
  const bottles = ['#4f8f3a', '#c0533f', '#e0b84a', '#6d5fa8'];
  for (let i = 0; i < 5; i++) k.part(g, geo.cyl(0.05, 0.06, 0.3, 8), k.pick(bottles), [-len / 2 + 0.3 + i * (len - 0.6) / 4, 1.23, -0.1], { outline: false });
  return g;
}

export function piano(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.5, 0.35, 1.1), '#15151a', [0, 0.85, 0]);
  k.part(g, geo.box(1.4, 0.04, 0.9), '#15151a', [0.1, 1.35, -0.2], { rot: [0.5, 0, 0] });
  k.part(g, geo.box(1.4, 0.04, 0.22), '#ffffff', [0, 0.95, 0.6], { outline: false });
  for (const [x, z] of [[-0.6, -0.4], [0.6, -0.4], [0, 0.4]]) k.part(g, geo.cyl(0.05, 0.05, 0.7, 6), '#15151a', [x, 0.35, z]);
  return g;
}

export function fireplace(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.8, 1.5, 0.6), '#b07a5a', [0, 0.75, 0]);
  k.part(g, geo.box(0.9, 0.7, 0.2), '#2a1a14', [0, 0.45, 0.25], { outline: false });
  k.part(g, geo.box(2.0, 0.12, 0.75), '#6b4a33', [0, 1.55, 0.05]);
  const f = k.part(g, geo.cone(0.2, 0.45, 6), '#ffb347', [0, 0.35, 0.3], { basic: true });
  k.light(g, '#ff9a40', 2.5, 6, [0, 0.5, 0.6]);
  k.animate((t) => f.scale.set(1, 0.85 + Math.sin(t * 11) * 0.15, 1));
  return g;
}

export function rockingChair(k: Kit) {
  const g = new THREE.Group();
  const c = chair(k, WOOD);
  g.add(c);
  for (const x of [-0.22, 0.22]) {
    k.part(g, geo.torus(0.9, 0.03, 0.9, 4, 12), DARK_WOOD, [x, 0.9, 0], { rot: [0, Math.PI / 2, Math.PI * 1.5 - 0.45], outline: false });
  }
  k.animate((t) => (g.rotation.x = Math.sin(t * 1.2) * 0.08));
  return g;
}

export function crib(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.1, 0.12, 0.7), '#f4e6d4', [0, 0.45, 0]);
  k.part(g, geo.box(1.0, 0.1, 0.6), '#bfe0f5', [0, 0.55, 0], { outline: false });
  for (const z of [-0.33, 0.33]) for (let i = 0; i < 8; i++) {
    k.part(g, geo.cyl(0.02, 0.02, 0.5, 4), '#f4e6d4', [-0.5 + i * (1 / 7), 0.75, z], { outline: false });
  }
  for (const x of [-0.53, 0.53]) k.part(g, geo.box(0.06, 1.0, 0.72), '#f4e6d4', [x, 0.5, 0]);
  return g;
}

export function easel(k: Kit) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) k.part(g, geo.cyl(0.03, 0.03, 1.7, 5), WOOD, [0.35 * s, 0.85, 0], { rot: [0.1, 0, -0.15 * s] });
  k.part(g, geo.cyl(0.03, 0.03, 1.6, 5), WOOD, [0, 0.8, -0.3], { rot: [-0.35, 0, 0] });
  k.part(g, geo.box(0.9, 0.7, 0.04), '#ffffff', [0, 1.25, 0.08], { rot: [0.1, 0, 0] });
  k.part(g, geo.box(0.8, 0.3, 0.01), '#f2a65a', [0, 1.35, 0.11], { rot: [0.1, 0, 0], outline: false });
  k.part(g, geo.box(0.8, 0.28, 0.01), '#6fae5a', [0, 1.08, 0.13], { rot: [0.1, 0, 0], outline: false });
  return g;
}

export function tombstone(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(0.6, 0.8, 0.18), '#8a8a92', [0, 0.4, 0]);
  k.part(g, geo.cyl(0.3, 0.3, 0.18, 12, ), '#8a8a92', [0, 0.8, 0], { rot: [Math.PI / 2, 0, 0] });
  return g;
}

export function telescope(k: Kit) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.part(g, geo.cyl(0.02, 0.02, 1.2, 5), '#555', [Math.cos(a) * 0.25, 0.55, Math.sin(a) * 0.25], { rot: [Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3] });
  }
  k.part(g, geo.cyl(0.08, 0.12, 1.1, 10), '#e0b84a', [0, 1.3, 0.1], { rot: [-0.8, 0, 0] });
  return g;
}

export function crate(k: Kit, s = 0.7) {
  const g = new THREE.Group();
  k.part(g, geo.box(s, s, s), '#a67c52', [0, s / 2, 0]);
  k.part(g, geo.box(s * 1.02, 0.08, s * 1.02), '#7a5436', [0, s * 0.8, 0], { outline: false });
  k.part(g, geo.box(s * 1.02, 0.08, s * 1.02), '#7a5436', [0, s * 0.2, 0], { outline: false });
  return g;
}

export function barrel(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.32, 0.32, 0.8, 12), '#8a5a3a', [0, 0.4, 0], { scale: [1, 1, 1] });
  for (const y of [0.15, 0.65]) k.part(g, geo.cyl(0.33, 0.33, 0.05, 12), '#444', [0, y, 0], { outline: false });
  return g;
}

export function table(k: Kit, cloth = '#f4efe6') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.6, 0.6, 0.06, 16), cloth, [0, 0.75, 0]);
  k.part(g, geo.cyl(0.05, 0.08, 0.72, 8), '#333', [0, 0.36, 0]);
  k.part(g, geo.cyl(0.06, 0.05, 0.1, 8), '#ffffff', [0.2, 0.83, 0.1], { outline: false });
  return g;
}

export function trainingDummy(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.06, 0.06, 1.4, 6), WOOD, [0, 0.7, 0]);
  k.part(g, geo.cyl(0.25, 0.28, 0.8, 10), '#d9bf8c', [0, 1.1, 0]);
  k.part(g, geo.sph(0.2, 10, 8), '#d9bf8c', [0, 1.7, 0]);
  k.part(g, geo.cyl(0.04, 0.04, 1.1, 6), WOOD, [0, 1.3, 0], { rot: [0, 0, Math.PI / 2] });
  return g;
}

export function weaponRack(k: Kit) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) k.part(g, geo.box(0.08, 1.2, 0.08), WOOD, [0.7 * s, 0.6, 0]);
  k.part(g, geo.box(1.5, 0.08, 0.1), WOOD, [0, 1.1, 0]);
  for (let i = 0; i < 4; i++) {
    const x = -0.5 + i * 0.33;
    k.part(g, geo.cyl(0.02, 0.02, 1.4, 5), '#6b4a33', [x, 0.75, 0.08], { rot: [0, 0, 0.12] });
    k.part(g, geo.cone(0.05, 0.25, 4), '#c8ccd4', [x - 0.08, 1.52, 0.08], { rot: [0, 0, 0.12] });
  }
  return g;
}

export function banner(k: Kit, color = '#b8322a') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.04, 0.04, 3, 6), '#3a2a22', [0, 1.5, 0]);
  const cloth = k.part(g, geo.box(0.7, 1.1, 0.03), color, [0.38, 2.4, 0]);
  k.animate((t) => (cloth.rotation.y = Math.sin(t * 2 + g.id) * 0.15));
  return g;
}

export function wagon(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.box(1.4, 0.5, 2.2), WOOD, [0, 0.75, 0]);
  const cover = k.part(g, new THREE.CylinderGeometry(0.75, 0.75, 2.1, 12, 1, true, -Math.PI / 2, Math.PI), '#f1e3c8', [0, 1.0, 0], {
    rot: [Math.PI / 2, 0, 0],
  });
  (cover.material as THREE.Material).side = THREE.DoubleSide;
  for (const x of [-0.75, 0.75]) for (const z of [-0.7, 0.7]) {
    k.part(g, geo.torus(0.35, 0.05, Math.PI * 2, 5, 14), DARK_WOOD, [x, 0.35, z], { rot: [0, Math.PI / 2, 0] });
  }
  return g;
}

export function portal(k: Kit, color = '#9f7bff') {
  const g = new THREE.Group();
  k.part(g, geo.torus(1.5, 0.06, Math.PI * 2, 6, 48), color, [0, 0.05, 0], { rot: [Math.PI / 2, 0, 0], basic: true });
  const inner = k.part(g, geo.torus(1.1, 0.04, Math.PI * 2, 6, 6), color, [0, 0.06, 0], { rot: [Math.PI / 2, 0, 0], basic: true });
  k.part(g, geo.disc(1.5, 48), color, [0, 0.03, 0], { rot: [-Math.PI / 2, 0, 0], basic: true, opacity: 0.25 });
  const beam = k.part(g, geo.cyl(1.2, 1.4, 4, 24), color, [0, 2, 0], { basic: true, opacity: 0.12 });
  k.light(g, color, 3, 8, [0, 1, 0]);
  k.animate((t) => {
    inner.rotation.z = t * 0.6;
    beam.scale.set(1 + Math.sin(t * 2) * 0.05, 1, 1 + Math.sin(t * 2) * 0.05);
  });
  return g;
}

export function wallSegment(k: Kit, len = 4) {
  const g = new THREE.Group();
  k.part(g, geo.box(len, 1.8, 0.6), '#9a948a', [0, 0.9, 0]);
  for (let x = -len / 2 + 0.3; x <= len / 2; x += 0.8) k.part(g, geo.box(0.45, 0.4, 0.62), '#9a948a', [x, 2.0, 0]);
  return g;
}
