import * as THREE from 'three';
import { toonMaterial, addOutline } from '../engine/toon';

// Small procedural pickups and hazards for the mini-games. Each is a Group
// about 0.3-0.5 m across, centred on its origin.

type V3 = [number, number, number];

function p(g: THREE.Object3D, geo: THREE.BufferGeometry, color: string, pos: V3 = [0, 0, 0], o: { rot?: V3; scale?: V3; glow?: boolean; outline?: boolean } = {}) {
  const mesh = new THREE.Mesh(geo, o.glow ? new THREE.MeshBasicMaterial({ color }) : toonMaterial(color));
  mesh.position.set(...pos);
  if (o.rot) mesh.rotation.set(...o.rot);
  if (o.scale) mesh.scale.set(...o.scale);
  if (o.outline !== false && !o.glow) addOutline(mesh, 0.012);
  g.add(mesh);
  return mesh;
}
const sph = (r: number, w = 14, h = 10) => new THREE.SphereGeometry(r, w, h);
const cyl = (a: number, b: number, h: number, s = 10) => new THREE.CylinderGeometry(a, b, h, s);
const cone = (r: number, h: number, s = 10) => new THREE.ConeGeometry(r, h, s);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

function starShape(r: number, depth: number) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, rr = i % 2 ? r * 0.45 : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false });
  geo.center();
  return geo;
}

const BUILDERS: Record<string, (g: THREE.Group) => void> = {
  honey: (g) => { p(g, cyl(0.18, 0.2, 0.3), '#e0b84a'); p(g, cyl(0.2, 0.2, 0.06), '#c9a26e', [0, 0.18, 0]); p(g, cyl(0.12, 0.12, 0.04), '#8a5a3a', [0, 0.22, 0]); },
  bee: (g) => { p(g, sph(0.16), '#f2c230', [0, 0, 0], { scale: [1, 1, 1.3] }); p(g, new THREE.TorusGeometry(0.15, 0.04, 6, 12), '#222', [0, 0, 0], { outline: false }); for (const s of [-1, 1]) p(g, sph(0.12), '#ffffff', [0.14 * s, 0.14, 0], { scale: [1, 0.3, 0.6], outline: false }); },
  egg: (g) => { p(g, cyl(0.2, 0.2, 0.08, 16), '#ffffff'); p(g, sph(0.1), '#ffb43a', [0, 0.05, 0], { scale: [1, 0.5, 1] }); },
  naruto: (g) => { p(g, cyl(0.2, 0.2, 0.08, 16), '#ffffff', [0, 0, 0], { rot: [Math.PI / 2, 0, 0] }); p(g, new THREE.TorusGeometry(0.1, 0.025, 6, 16), '#ff7e9a', [0, 0, 0.045], { outline: false }); },
  chili: (g) => { p(g, cone(0.1, 0.45), '#e0303a', [0, 0, 0], { rot: [0, 0, 2.6] }); p(g, cyl(0.03, 0.03, 0.1), '#4f8f3a', [0.18, 0.15, 0]); },
  petal: (g) => { p(g, sph(0.2), '#ffb3d1', [0, 0, 0], { scale: [1, 0.2, 0.7] }); },
  thorn: (g) => { p(g, cone(0.15, 0.4, 5), '#5a3a26'); },
  star: (g) => { p(g, starShape(0.25, 0.08), '#ffe27a', [0, 0, 0], { glow: true }); },
  meteor: (g) => { p(g, new THREE.DodecahedronGeometry(0.25), '#6f5a4a'); p(g, cone(0.22, 0.6), '#ff8a3c', [0, 0.35, 0], { glow: true, outline: false }); },
  snowflake: (g) => { for (let i = 0; i < 3; i++) p(g, box(0.45, 0.05, 0.05), '#e8f4ff', [0, 0, 0], { rot: [0, 0, (i * Math.PI) / 3], glow: true }); },
  icicle: (g) => { p(g, cone(0.12, 0.6, 6), '#bfe3f2', [0, 0, 0], { rot: [Math.PI, 0, 0] }); },
  light: (g) => { p(g, sph(0.22), '#fff1a8', [0, 0, 0], { glow: true }); p(g, sph(0.34), '#ffe27a', [0, 0, 0], { glow: true, scale: [1, 1, 1] }).material = new THREE.MeshBasicMaterial({ color: '#ffe27a', transparent: true, opacity: 0.3 }); },
  dark: (g) => { p(g, sph(0.24), '#2a1f3a'); p(g, sph(0.05), '#ff4060', [0.08, 0.06, 0.2], { glow: true }); p(g, sph(0.05), '#ff4060', [-0.08, 0.06, 0.2], { glow: true }); },
  lantern: (g) => { p(g, sph(0.2), '#ffb347', [0, 0, 0], { scale: [1, 1.25, 1], glow: true }); p(g, cyl(0.1, 0.1, 0.05), '#6b4a33', [0, 0.26, 0]); },
  note: (g) => { p(g, sph(0.12), '#2a2a3a', [0, -0.15, 0], { scale: [1.3, 1, 1] }); p(g, box(0.04, 0.45, 0.04), '#2a2a3a', [0.13, 0.06, 0]); p(g, box(0.18, 0.05, 0.04), '#2a2a3a', [0.2, 0.27, 0], { rot: [0, 0, -0.4] }); },
  offnote: (g) => { p(g, sph(0.2), '#6b5a7a'); p(g, box(0.3, 0.05, 0.05), '#ffffff', [0, 0, 0.19], { rot: [0, 0, 0.6], outline: false }); p(g, box(0.3, 0.05, 0.05), '#ffffff', [0, 0, 0.19], { rot: [0, 0, -0.6], outline: false }); },
  leaf: (g) => { p(g, sph(0.22), '#e0873a', [0, 0, 0], { scale: [1, 0.15, 0.6] }); },
  gem: (g) => { p(g, new THREE.OctahedronGeometry(0.22), '#5fd3ff', [0, 0, 0], { scale: [0.8, 1.2, 0.8], glow: false }); },
  relic: (g) => { p(g, cyl(0.12, 0.16, 0.35, 8), '#e0b84a'); p(g, sph(0.13), '#e0b84a', [0, 0.26, 0]); p(g, sph(0.03), '#e0303a', [0, 0.28, 0.12], { glow: true }); },
  pearl: (g) => { p(g, sph(0.2), '#b8c8e8', [0, -0.05, 0], { scale: [1, 0.4, 1] }); p(g, sph(0.1), '#fbf7ff', [0, 0.05, 0.05]); },
  lotus: (g) => { p(g, cyl(0.28, 0.28, 0.02, 12), '#4f8f3a'); for (let i = 0; i < 6; i++) p(g, cone(0.07, 0.22, 5), '#ff9ec4', [Math.cos(i) * 0.08, 0.1, Math.sin(i) * 0.08], { rot: [Math.sin(i) * 0.5, 0, -Math.cos(i) * 0.5], outline: false }); },
  shell: (g) => { p(g, sph(0.2, 12, 6), '#ffc8b0', [0, 0, 0], { scale: [1, 0.35, 0.8] }); for (let i = -2; i <= 2; i++) p(g, box(0.02, 0.02, 0.3), '#e89a80', [i * 0.06, 0.07, 0], { rot: [0, i * 0.25, 0], outline: false }); },
  mushroom: (g) => { p(g, cyl(0.05, 0.07, 0.2), '#f3e6d0', [0, -0.05, 0]); p(g, sph(0.16), '#d9473f', [0, 0.08, 0], { scale: [1, 0.6, 1] }); },
  butterfly: (g) => { for (const s of [-1, 1]) p(g, sph(0.14), '#ffd36e', [0.12 * s, 0, 0], { scale: [1, 0.15, 0.8], outline: false }); p(g, cyl(0.02, 0.02, 0.2), '#333', [0, 0, 0], { rot: [Math.PI / 2, 0, 0], outline: false }); },
  stardust: (g) => { p(g, new THREE.OctahedronGeometry(0.15), '#e0d0ff', [0, 0, 0], { glow: true }); p(g, new THREE.OctahedronGeometry(0.08), '#ffffff', [0.18, 0.12, 0], { glow: true }); },
  feather: (g) => { p(g, sph(0.2), '#ffffff', [0, 0, 0], { scale: [0.3, 1.2, 0.08] }); p(g, cyl(0.01, 0.01, 0.5), '#bbbbbb', [0, 0, 0], { outline: false }); },
  book: (g) => { p(g, box(0.35, 0.08, 0.26), '#c0533f'); p(g, box(0.33, 0.06, 0.24), '#f4ecd8', [0.01, 0, 0], { outline: false }); },
  bone: (g) => { p(g, cyl(0.04, 0.04, 0.45), '#efe6d2', [0, 0, 0], { rot: [0, 0, Math.PI / 2] }); for (const s of [-1, 1]) for (const t of [-1, 1]) p(g, sph(0.06), '#efe6d2', [0.24 * s, 0.04 * t, 0]); },
  spool: (g) => { p(g, cyl(0.12, 0.12, 0.2), '#e0303a'); for (const y of [-0.11, 0.11]) p(g, cyl(0.16, 0.16, 0.03), '#8a5a3a', [0, y, 0]); },
  flower: (g) => { p(g, cyl(0.015, 0.015, 0.35, 5), '#4f8f3a', [0, -0.1, 0], { outline: false }); for (let i = 0; i < 5; i++) p(g, sph(0.07), '#e05a7a', [Math.cos(i * 1.26) * 0.09, 0.1, Math.sin(i * 1.26) * 0.09], { outline: false }); p(g, sph(0.05), '#ffe27a', [0, 0.11, 0], { outline: false }); },
  duck: (g) => { p(g, sph(0.18), '#ffd33a', [0, 0, 0], { scale: [1, 0.8, 1.2] }); p(g, sph(0.12), '#ffd33a', [0, 0.18, 0.12]); p(g, cone(0.05, 0.1, 6), '#ff8a2a', [0, 0.17, 0.26], { rot: [Math.PI / 2, 0, 0], outline: false }); },
  pumpkin: (g) => { p(g, sph(0.22), '#ff8a2a', [0, 0, 0], { scale: [1.2, 0.85, 1.2] }); p(g, cyl(0.03, 0.04, 0.12), '#4f8f3a', [0, 0.22, 0]); p(g, sph(0.05), '#2a1a10', [0.08, 0.04, 0.24], { outline: false }); p(g, sph(0.05), '#2a1a10', [-0.08, 0.04, 0.24], { outline: false }); },
  raindrop: (g) => { p(g, sph(0.12), '#7fc9ff', [0, -0.05, 0], { glow: true }); p(g, cone(0.1, 0.2, 10), '#7fc9ff', [0, 0.1, 0], { glow: true }); },
  bolt: (g) => { p(g, box(0.1, 0.35, 0.05), '#fff176', [0.05, 0.12, 0], { rot: [0, 0, 0.4], glow: true }); p(g, box(0.1, 0.35, 0.05), '#fff176', [-0.03, -0.12, 0], { rot: [0, 0, 0.4], glow: true }); },
  coin: (g) => { p(g, cyl(0.18, 0.18, 0.05, 16), '#f2c230', [0, 0, 0], { rot: [Math.PI / 2, 0, 0] }); },
  apple: (g) => { p(g, sph(0.18), '#e0303a'); p(g, cyl(0.015, 0.015, 0.1, 5), '#5a3a26', [0, 0.2, 0], { outline: false }); p(g, sph(0.06), '#4f8f3a', [0.06, 0.2, 0], { scale: [1, 0.3, 0.6], outline: false }); },
  rock: (g) => { p(g, new THREE.DodecahedronGeometry(0.22), '#8a8a92'); },
  rune: (g) => { p(g, new THREE.OctahedronGeometry(0.22), '#9f7bff', [0, 0, 0], { glow: true, scale: [0.7, 1.3, 0.7] }); },
  firewood: (g) => { for (const z of [-0.08, 0.08]) p(g, cyl(0.06, 0.06, 0.45), '#7a5436', [0, 0, z], { rot: [0, 0, Math.PI / 2] }); },
  balloon: (g) => { p(g, sph(0.24), '#ff7eb6', [0, 0.15, 0], { scale: [1, 1.2, 1] }); p(g, cyl(0.005, 0.005, 0.5, 4), '#dddddd', [0, -0.3, 0], { outline: false }); },
  sheep: (g) => { p(g, sph(0.24), '#ffffff', [0, 0, 0], { scale: [1.2, 0.9, 1] }); p(g, sph(0.12), '#3a3a42', [0, 0.05, 0.27]); for (const x of [-0.12, 0.12]) p(g, cyl(0.03, 0.03, 0.15), '#3a3a42', [x, -0.25, 0], { outline: false }); },
  page: (g) => { p(g, box(0.3, 0.02, 0.38), '#fbf7ec'); for (let i = 0; i < 4; i++) p(g, box(0.22, 0.005, 0.02), '#8a8a92', [0, 0.012, -0.12 + i * 0.08], { outline: false }); },
  wheat: (g) => { for (let i = -1; i <= 1; i++) p(g, cone(0.05, 0.5, 5), '#e2c46a', [i * 0.06, 0, 0], { rot: [0, 0, i * 0.15], outline: false }); p(g, cyl(0.07, 0.07, 0.05), '#8a5a3a', [0, -0.1, 0]); },
  paint: (g) => { const colors = ['#e0303a', '#3f6fb5', '#f2c230', '#4f8f3a']; colors.forEach((c, i) => p(g, sph(0.09), c, [Math.cos(i * 1.57) * 0.12, 0, Math.sin(i * 1.57) * 0.12])); },
  firefly: (g) => { p(g, sph(0.08), '#fff38a', [0, 0, 0], { glow: true }); p(g, sph(0.2), '#fff38a', [0, 0, 0], { glow: true }).material = new THREE.MeshBasicMaterial({ color: '#fff38a', transparent: true, opacity: 0.3 }); },
  ring: (g) => { p(g, new THREE.TorusGeometry(0.28, 0.05, 8, 24), '#ffd36e', [0, 0, 0], { glow: true }); },
  candle: (g) => { p(g, cyl(0.07, 0.07, 0.3), '#f4ecd8'); p(g, cone(0.05, 0.12, 6), '#ffb347', [0, 0.22, 0], { glow: true, outline: false }); },
  boulder: (g) => { p(g, new THREE.DodecahedronGeometry(0.5), '#8a8580'); },
  sword: (g) => { p(g, box(0.08, 0.9, 0.02), '#c8ccd4', [0, 0.1, 0]); p(g, box(0.3, 0.06, 0.06), '#5a4a3a', [0, -0.35, 0]); },
};

export function makeItem(kind: string): THREE.Group {
  const g = new THREE.Group();
  (BUILDERS[kind] ?? BUILDERS.coin)(g);
  return g;
}
