import * as THREE from 'three';
import { geo, type Kit } from './kit';
import * as N from './props/nature';
import * as S from './props/structures';
import * as P from './props/setpieces';

// Island layouts. Each template decorates the sky island for one kind of
// scene; which one a scene uses is set in src/data/sceneEnv.json ("island",
// plus "variant" for landmarks) by tools/analyze_scenes.py. Templates also
// read the scene's words (k.has('fishing')) for small extras.
//
// Layout rule of thumb: the bear spawns at (0, 0) and the camera looks
// toward -Z, where the painted backdrop hangs. Big set pieces go to the left
// or right (|x| ≈ 5); k.inSightline() keeps scattered tall props out of view.

export type IslandKind =
  | 'meadow' | 'lakeside' | 'snowfield' | 'wheatfield' | 'cave' | 'cozyroom' | 'onsen' | 'stage' | 'camp'
  | 'town' | 'arena' | 'hangar' | 'pavilion' | 'riverside' | 'skygarden' | 'parisbridge' | 'nursery'
  | 'wildforest' | 'landmark';

const L = { x: -5.2, z: -2.6 }; // default spot for a big set piece (left)
const R = { x: 5.2, z: -2.6 };

/** Place a set piece at (x, z) turned toward the island centre. */
function centrepiece(k: Kit, obj: THREE.Object3D, x: number, z: number, block: number) {
  k.put(obj, x, z, { rotY: k.faceCenter(x, z), block, space: block + 0.4 });
}

/**
 * Honkai: Star Rail cover: the Astral Express lounge car. Seats match the
 * passengers' spots in sceneEnv.json (tools/analyze_scenes.py SCENE_CAST).
 */
function starRailLounge(k: Kit) {
  const seat = (obj: THREE.Object3D, x: number, z: number, rotY: number, block: number) => k.put(obj, x, z, { rotY, block, space: 0 });
  // Second bench (Mr. Yang reads here; the raccoon sprawls on the first).
  seat(S.bench(k), 3.4, -1.4, k.faceCenter(3.4, -1.4), 0.8);
  // Himekat's armchair: a narrow sofa.
  const chair = S.sofa(k, '#a8463e');
  chair.scale.set(0.55, 1, 1);
  seat(chair, -2.4, 2.6, k.faceCenter(-2.4, 2.6), 0.7);
  // The bear's table: journal open, tea going cold.
  const desk = S.table(k, '#e8dcc4');
  k.part(desk, geo.box(0.34, 0.02, 0.24), '#f4efe6', [-0.15, 0.8, 0.05], { outline: false });
  k.part(desk, geo.box(0.02, 0.012, 0.18), '#3a2a22', [-0.05, 0.815, 0.05], { rot: [0, 0.6, 0], outline: false });
  seat(desk, -0.9, 1.3, 0.4, 0.5);
  // Dan's corner cushion.
  k.part(k.group, geo.cyl(0.55, 0.6, 0.18, 16), '#4a5a7a', [-3.4, 0.09, -2.4]);
  // Nebula windows at the back, with sills (March Bunny leans on one; Sundove perches on another).
  const nebula = nebulaTexture();
  for (const x of [-1.2, 1.6]) {
    const w = new THREE.Group();
    k.part(w, geo.box(1.5, 1.7, 0.12), '#5a3a2a', [0, 1.35, 0]);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.45), new THREE.MeshBasicMaterial({ map: nebula, toneMapped: false }));
    glass.position.set(0, 1.35, 0.065);
    w.add(glass);
    k.part(w, geo.box(1.6, 0.08, 0.35), '#6b4a33', [0, 0.62, 0.15]);
    seat(w, x, -4.1, 0, 0.7);
  }
}

let nebulaTex: THREE.CanvasTexture | null = null;
function nebulaTexture() {
  if (nebulaTex) return nebulaTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 128, 160);
  grd.addColorStop(0, '#1a1440');
  grd.addColorStop(0.5, '#5a2d8a');
  grd.addColorStop(1, '#1e3a7a');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 160);
  for (let i = 0; i < 4; i++) {
    const r = g.createRadialGradient(20 + i * 30, 30 + (i % 2) * 70, 0, 20 + i * 30, 30 + (i % 2) * 70, 50);
    r.addColorStop(0, i % 2 ? 'rgba(255,140,220,0.55)' : 'rgba(120,200,255,0.5)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 128, 160);
  }
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 60; i++) g.fillRect((i * 53) % 128, (i * 97) % 160, i % 7 ? 1 : 2, i % 7 ? 1 : 2);
  nebulaTex = new THREE.CanvasTexture(c);
  nebulaTex.colorSpace = THREE.SRGBColorSpace;
  return nebulaTex;
}

function trees(k: Kit, n: number, make: () => THREE.Object3D, minR = 3.5) {
  k.scatter(n, 0.8, make, { minR, block: 0.45 });
}

function rocks(k: Kit, n: number, color?: string) {
  k.scatter(n, 0.5, () => N.rock(k, 0.3 + k.rand() * 0.45, color), { minR: 2.5, tall: false, block: 0.4 });
}

function flowerPatches(k: Kit, n: number, colors?: string[]) {
  for (let i = 0; i < n; i++) {
    const s = k.spot(1.1, { minR: 2, tall: false });
    if (s) k.put(N.flowers(k, 1.0, 26, colors), s.x, s.z, { space: 1.1 });
  }
}

function nightLanterns(k: Kit, n = 2) {
  if (k.night) k.scatter(n, 0.4, () => S.stoneLantern(k), { minR: 2.5, block: 0.35 });
}

function teddy(k: Kit) {
  const g = new THREE.Group();
  const fur = '#b07a4a';
  k.part(g, geo.sph(0.22, 12, 10), fur, [0, 0.22, 0]);
  k.part(g, geo.sph(0.17, 12, 10), fur, [0, 0.55, 0]);
  for (const s of [-1, 1]) k.part(g, geo.sph(0.06, 8, 6), fur, [0.12 * s, 0.7, 0]);
  k.part(g, geo.sph(0.07, 8, 6), '#e8c9a0', [0, 0.51, 0.14], { outline: false });
  return g;
}

// ---------------------------------------------------------------- templates

const TEMPLATES: Record<Exclude<IslandKind, 'landmark'>, (k: Kit) => void> = {
  meadow(k) {
    trees(k, 6, () => N.roundTree(k, k.has('bloom', 'sakura') ? '#f5a0b8' : k.look.leaf));
    k.scatter(5, 0.7, () => N.bush(k), { minR: 3, block: 0.5 });
    flowerPatches(k, 4);
    rocks(k, 3);
    centrepiece(k, S.bench(k), 3.4, 2.4, 0.8);
    k.anchor('seat', 3.4, 2.4);
    if (k.has('butterflies')) k.put(N.butterflies(k, 7), 1.5, 0.5);
    if (k.has('drawing', 'paints', 'cliff')) centrepiece(k, S.easel(k), -2.4, 1.2, 0.5);
    if (k.has('honey', 'beehive')) {
      const t = N.roundTree(k);
      k.part(t, geo.sph(0.3, 10, 8), '#e0b84a', [0.7, 1.4, 0.3], { scale: [1, 1.3, 1] });
      k.put(N.butterflies(k, 4), -4, -1);
      centrepiece(k, t, -4, -1, 0.6);
      k.anchor('tree', -4, -1);
    }
    if (k.has('graveyard')) {
      for (let i = 0; i < 6; i++) centrepiece(k, S.tombstone(k), 4 + (i % 3) * 1.3, -3.5 + Math.floor(i / 3) * 1.6, 0.4);
      centrepiece(k, S.streetLamp(k), 2.6, -1.6, 0.2);
    }
    if (k.has('stargazing')) centrepiece(k, S.telescope(k), 2.2, 0.6, 0.4);
    if (k.has('pigeons', 'lyre')) {
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Group();
        k.part(b, geo.sph(0.12, 8, 6), '#dfe3ea', [0, 0.12, 0], { scale: [1, 0.9, 1.3] });
        k.part(b, geo.sph(0.07, 8, 6), '#9aa3b0', [0, 0.24, 0.12]);
        k.put(b, -1.5 + (i % 3) * 0.6, 2 + Math.floor(i / 3) * 0.6, { rotY: k.rand() * 6 });
      }
    }
    nightLanterns(k);
  },

  lakeside(k) {
    const px = -3.2, pz = -4.4, pr = 3.1;
    k.put(N.pond(k, pr), px, pz, { block: pr - 0.2, space: pr + 0.3 });
    k.anchor('pond', px, pz, pr);
    k.put(N.lotus(k, k.has('lotus') ? 8 : 4, pr - 0.6), px, pz);
    // Dock from the shore into the pond.
    const dock = new THREE.Group();
    k.part(dock, geo.box(0.9, 0.08, 2.4), '#9a6a44', [0, 0.25, 0]);
    for (const x of [-0.4, 0.4]) for (const z of [-1, 1]) k.part(dock, geo.cyl(0.05, 0.05, 0.5, 6), '#5a3a26', [x, 0.15, z]);
    k.put(dock, px + 2.2, pz + 1.2, { rotY: 0.9 });
    for (let i = 0; i < 4; i++) {
      const a = 0.6 + i * 0.9;
      k.put(N.reeds(k), px + Math.cos(a) * (pr + 0.3), pz + Math.sin(a) * (pr + 0.3));
    }
    if (k.has('fishing', 'salmon', 'fish')) {
      const rod = new THREE.Group();
      k.part(rod, geo.cyl(0.02, 0.03, 2.4, 5), '#5a3a26', [0, 0.9, 0.6], { rot: [0.9, 0, 0] });
      k.part(rod, geo.box(0.5, 0.3, 0.35), '#6d8fb8', [0.4, 0.15, 0]);
      k.put(rod, px + 2.6, pz + 2.8, { rotY: -2.3 });
    }
    if (k.has('lantern', 'lattern', 'river')) {
      for (let i = 0; i < 4; i++) {
        const lb = new THREE.Group();
        k.part(lb, geo.box(0.35, 0.08, 0.5), '#8a5a3a', [0, 0.1, 0]);
        k.part(lb, geo.sph(0.12, 8, 6), '#ffb347', [0, 0.28, 0], { emissive: '#ffb347', glow: 1.2, outline: false });
        const a0 = i * 1.6;
        k.put(lb, px, pz);
        k.animate((t) => lb.position.set(px + Math.cos(a0 + t * 0.1) * (pr - 1), 0, pz + Math.sin(a0 + t * 0.1) * (pr - 1)));
      }
      k.light(k.group, '#ffb070', 2, 7, [px, 1, pz]);
    }
    trees(k, 7, () => (k.has('bamboo') ? N.bamboo(k) : N.pine(k)));
    rocks(k, 3);
    centrepiece(k, S.bench(k), 3.2, 2.6, 0.8);
    nightLanterns(k);
  },

  snowfield(k) {
    k.ground = '#eef3fb';
    k.put(N.pond(k, 2.2, '#bfe3f2', false), -3.4, -3.8, { space: 2.4 });
    trees(k, 9, () => N.pine(k, true));
    centrepiece(k, N.snowman(k), 3.2, 1.8, 0.55);
    rocks(k, 3, '#c8d0dc');
    const sled = new THREE.Group();
    k.part(sled, geo.box(0.5, 0.06, 1.1), '#c0533f', [0, 0.25, 0]);
    for (const x of [-0.22, 0.22]) k.part(sled, geo.box(0.04, 0.2, 1.2), '#555', [x, 0.12, 0]);
    k.put(sled, 2.4, -0.6, { rotY: 0.6, block: 0.4 });
    nightLanterns(k, 3);
  },

  wheatfield(k) {
    k.ground = k.env.time === 'sunset' ? '#c7a85a' : '#a9b85a';
    centrepiece(k, P.windmill(k), -5.6, -3.2, 1.2);
    for (let i = 0; i < 4; i++) {
      const s = k.spot(2.1, { minR: 2.6, tall: false });
      if (s) k.put(N.wheat(k, 2, 160), s.x, s.z, { space: 2.1 });
    }
    k.scatter(3, 0.6, () => P.haybale(k), { minR: 3, tall: false, block: 0.6 });
    centrepiece(k, S.bench(k), 2.8, 1.8, 0.8);
    centrepiece(k, S.fence(k, 3), 4.6, -1, 0.3);
    trees(k, 3, () => N.roundTree(k), 5);
  },

  cave(k) {
    centrepiece(k, P.cave(k), -4.6, -2.8, 2.6);
    k.put(S.campfire(k), -2.2, -0.2, { block: 0.7 });
    k.anchor('fire', -2.2, -0.2, 0.7);
    k.put(N.log(k), -2.2, 1.1, { rotY: 0.2, block: 0.4 });
    if (k.has('fish', 'grill')) {
      for (let i = 0; i < 2; i++) k.part(k.group, geo.cyl(0.015, 0.015, 1, 4), '#6b4a33', [-2.3 + i * 0.3, 0.55, -0.2], { rot: [0, 0, 0.6], outline: false });
    }
    if (k.has('cafe', 'story', 'books', 'coffee')) centrepiece(k, S.coffeeTable(k), -1.4, -2.4, 0.5);
    trees(k, 6, () => N.pine(k), 4);
    rocks(k, 5);
    k.scatter(4, 0.3, () => N.mushroom(k), { minR: 3, tall: false, block: 0 });
  },

  cozyroom(k) {
    k.put(S.roomFloor(k, 3.6, k.pick(['#b8565e', '#5e7fb8', '#6fa86a', '#c9a24a'])), 0, 0, { space: 3.7 });
    const at = (deg: number, r = 2.8) => {
      const a = (deg * Math.PI) / 180;
      return { x: Math.sin(a) * r, z: Math.cos(a) * r };
    };
    const place = (obj: THREE.Object3D, deg: number, r = 2.8, block = 0.7) => {
      const p = at(deg, r);
      k.put(obj, p.x, p.z, { rotY: k.faceCenter(p.x, p.z), block, space: 0 });
    };
    let used = 0;
    if (k.has('ramen')) { place(P.ramenStall(k), -120, 3.0, 1.2); used++; }
    if (k.has('train')) {
      const t = P.trainCar(k);
      k.put(t, -5.2, -0.5, { rotY: Math.PI / 2, space: 2.5 });
      for (const z of [-2.2, -0.5, 1.2]) k.blockers.push({ x: -5.2, z, r: 1 });
      used++;
    }
    if (k.has('bar', 'jazz', 'lounge')) { place(S.counter(k), 120, 3.0, 1.2); place(S.piano(k), -115, 2.8, 1); used++; }
    if (k.has('library', 'reading', 'books', 'writing', 'book')) {
      place(S.bookshelf(k), -100, 3.1, 0.8);
      place(S.bookshelf(k), -135, 3.1, 0.8);
      used++;
    }
    if (k.has('bed', 'lazy', 'waking')) { place(S.bed(k), 110, 2.6, 1.1); used++; }
    if (k.has('gaming', 'working', 'cafe', 'neon')) { place(S.desk(k, 2), 125, 2.9, 0.9); place(S.chair(k), 100, 2.0, 0.35); used++; }
    if (k.has('radio')) { place(S.table(k), 145, 2.6, 0.6); place(S.radio(k), 90, 2.9, 0.5); used++; }
    if (!used || used < 2) { place(S.sofa(k), -150, 2.7, 1); place(S.coffeeTable(k), -175, 1.6, 0.5); }
    place(S.floorLamp(k), -75, 3.1, 0.3);
    place(N.bush(k, '#5f9a45', 0.4), 70, 3.2, 0.4);
    // Garden around the open-air room.
    for (const deg of [-50, 55, 160, -160]) {
      const a = (deg * Math.PI) / 180;
      centrepiece(k, S.streetLamp(k), Math.sin(a) * 5.2, Math.cos(a) * 5.2, 0.2);
    }
    trees(k, 6, () => N.roundTree(k), 5);
    k.scatter(4, 0.6, () => N.bush(k), { minR: 4.5, block: 0.5 });
    flowerPatches(k, 3);
  },

  onsen(k) {
    const snowy = k.env.below === 'snow' || k.has('snow');
    if (snowy) k.ground = '#eef3fb';
    k.put(P.onsenPool(k, 2.4), -2.8, -3.6, { space: 2.7 }); // walk in and soak
    k.anchor('pond', -2.8, -3.6, 2.4);
    centrepiece(k, P.bambooFence(k, 3.2), -6.2, -2.2, 0.4);
    centrepiece(k, S.stoneLantern(k), 0.4, -2.6, 0.35);
    centrepiece(k, S.stoneLantern(k), -5.6, -5.8, 0.35);
    const bucket = new THREE.Group();
    k.part(bucket, geo.cyl(0.22, 0.18, 0.3, 12), '#b98a5e', [0, 0.15, 0]);
    k.part(bucket, geo.box(0.4, 0.04, 0.3), '#ffffff', [0.35, 0.02, 0], { outline: false });
    k.put(bucket, 1.2, -1.6, { block: 0.3 });
    trees(k, 8, () => N.pine(k, snowy));
    rocks(k, 4, snowy ? '#c8d0dc' : undefined);
  },

  stage(k) {
    const x = -5.0, z = -1.8;
    if (k.has('conduct', 'conducts', 'orchestra', 'podium', 'philharmonic')) {
      centrepiece(k, P.podium(k), x + 1, z, 0.8);
      k.anchor('stage', x + 1, z, 0.5, 0.4);
    } else if (k.has('waltz', 'ballroom', 'tango')) {
      const floor = new THREE.Group();
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
        k.part(floor, geo.box(0.7, 0.04, 0.7), (i + j) % 2 ? '#2a2a2a' : '#f4f4f4', [i * 0.7, 0.03, j * 0.7], { outline: false });
      }
      k.put(floor, 0.5, -1.5, { space: 0 });
      k.anchor('stage', 0.5, -2.2, 1.5);
      centrepiece(k, S.piano(k), x, z, 1);
      centrepiece(k, P.spotlight(k, '#fff1c4'), 5, 1.5, 0.3);
    } else {
      centrepiece(k, P.idolStage(k), x, z, 2.7);
      k.anchor('stage', x + 0.3, z, 1.2, 0.6);
      const sticks = P.glowSticks(k, 36, 2.2);
      k.put(sticks, x + 3.6, z + 0.4, { rotY: -Math.PI / 2, space: 0 });
      centrepiece(k, P.spotlight(k, k.look.accent), 5.2, 1.6, 0.3);
      centrepiece(k, P.spotlight(k, '#ffffff'), 5.6, -3.4, 0.3);
    }
    if (k.has('rooftop', 'radio', 'broadcast')) centrepiece(k, S.radio(k), 2.6, 1.4, 0.4);
    trees(k, 5, () => N.roundTree(k, k.has('autumn') ? '#e0873a' : '#f5a0b8'), 4.5);
    flowerPatches(k, 3, ['#ff9ec4', '#ffffff', '#ffd36e']);
    if (k.night || k.has('firework', 'festival')) {
      const a = new THREE.Vector3(2.5, 2.4, -4), b = new THREE.Vector3(6, 2.4, 0.5);
      k.group.add(S.lanternString(k, a, b, 8));
      for (const p of [a, b]) centrepiece(k, (() => { const g = new THREE.Group(); k.part(g, geo.cyl(0.05, 0.05, 2.5, 6), '#5a3a26', [0, 1.25, 0]); return g; })(), p.x, p.z, 0.15);
    }
  },

  camp(k) {
    k.put(S.campfire(k), 2.4, -1.4, { block: 0.7, space: 1 });
    k.anchor('fire', 2.4, -1.4, 0.7);
    for (const [x, z, r] of [[3.9, -0.8, 1.3], [1.1, -0.2, 0.5], [2.8, 0.2, -0.2]]) k.put(N.log(k, 1.3), x, z, { rotY: r, block: 0.35 });
    centrepiece(k, S.tent(k, '#d9864a'), -4.2, -2.6, 1.1);
    centrepiece(k, S.tent(k, '#5e8f6f'), -4.6, 1.4, 1.1);
    const a = new THREE.Vector3(-3, 1.8, -4.5), b = new THREE.Vector3(1, 1.8, -5.5);
    trees(k, 11, () => N.pine(k), 4.5);
    k.group.add(S.lanternString(k, a, b, 6, '#ffcf70'));
    rocks(k, 3);
  },

  town(k) {
    k.put((() => { const g = new THREE.Group(); k.part(g, geo.cyl(4.2, 4.2, 0.05, 40), '#b8b0a2', [0, 0.03, 0], { outline: false }); return g; })(), 0, 0, { space: 0 });
    const colors = [['#f1e3c8', '#c0533f'], ['#e3ecf1', '#4f6fa8'], ['#f1dcc8', '#6f8f3f'], ['#efe0f0', '#8f5fa8']];
    [[-6.2, -2.5], [-5.5, 2.4], [6.2, -2.8], [5.4, 2.6]].forEach(([x, z], i) => centrepiece(k, S.house(k, ...(colors[i] as [string, string])), x, z, 1.4));
    centrepiece(k, S.well(k), 3.0, -3.6, 0.7);
    centrepiece(k, S.stall(k, '#d9473f'), -3.0, 3.2, 0.9);
    centrepiece(k, S.signpost(k), 2.2, 2.6, 0.2);
    k.scatter(3, 0.4, () => (k.rand() < 0.5 ? S.barrel(k) : S.crate(k, 0.6)), { minR: 3, block: 0.4 });
    if (k.has('traveling', 'caravan')) centrepiece(k, S.wagon(k), 3.6, 0.4, 1.2);
    if (k.has('summoning', 'portal')) k.put(S.portal(k), 0, -3.2, { space: 1.6 });
    if (k.has('mourning')) {
      centrepiece(k, S.tombstone(k), -2.6, -3.4, 0.4);
      k.put(N.flowers(k, 0.6, 14, ['#ffffff', '#ffe27a']), -2.6, -2.6);
      centrepiece(k, S.banner(k, '#3a3a52'), -3.8, -4.2, 0.2);
    }
    if (k.has('guild', 'guildhall', 'signing')) centrepiece(k, S.counter(k, 2), -2.8, -3.2, 1);
    if (k.has('tavern', 'feast')) {
      for (const [x, z] of [[-2.6, -2.8], [2.4, 1.8]]) centrepiece(k, S.table(k, '#c9a26e'), x, z, 0.7);
      centrepiece(k, S.campfire(k), 3.2, -1.6, 0.7);
    }
    nightLanterns(k, 3);
  },

  arena(k) {
    k.ground = '#c9b48a';
    const bamboo = k.has('bamboo', 'panda');
    k.put((() => { const g = new THREE.Group(); k.part(g, geo.cyl(4.4, 4.5, 0.15, 40), '#b0a898', [0, 0.07, 0], { outline: 0.02 }); return g; })(), 0, 0, { space: 0 });
    for (let i = 0; i < 6; i++) {
      const a = Math.PI * 0.35 + (i / 5) * Math.PI * 1.3;
      centrepiece(k, S.torch(k), Math.cos(a) * 4.9, Math.sin(a) * 4.9 - 0.4, 0.2);
    }
    centrepiece(k, S.trainingDummy(k), 3.2, -2.4, 0.35);
    centrepiece(k, S.trainingDummy(k), -3.0, -2.6, 0.35);
    centrepiece(k, S.weaponRack(k), -5.6, 1.2, 0.6);
    centrepiece(k, S.banner(k, k.look.accent), 5.8, -0.6, 0.2);
    centrepiece(k, S.banner(k, '#2d2d35'), 5.4, 2.4, 0.2);
    if (k.has('defending', 'siege')) {
      centrepiece(k, S.wallSegment(k, 4), -5.8, -4.6, 0.9);
      centrepiece(k, S.wallSegment(k, 4), 6.0, -4.2, 0.9);
    }
    if (bamboo) trees(k, 8, () => N.bamboo(k), 5);
    else trees(k, 5, () => N.pine(k), 5.5);
  },

  hangar(k) {
    const snowy = k.env.below === 'snow' || k.has('snow');
    k.ground = snowy ? '#e8eef5' : '#6a6d78';
    k.put(P.hangarPad(k, 5), 0, 0, { space: 0 });
    // No mecha statue here any more: the mecha bear is a companion that walks
    // with the bear in every Power Bearer scene (tools/analyze_scenes.py).
    centrepiece(k, P.spotlight(k, k.look.accent), 5.2, -3.2, 0.3);
    centrepiece(k, P.spotlight(k, '#ffffff'), 5.4, 2.6, 0.3);
    k.scatter(5, 0.5, () => (k.rand() < 0.6 ? S.crate(k, 0.5 + k.rand() * 0.4) : S.barrel(k)), { minR: 3, block: 0.45 });
    if (snowy) trees(k, 5, () => N.pine(k, true), 6);
    else k.scatter(3, 0.5, () => P.crystal(k, k.look.accent), { minR: 6, block: 0.4 });
  },

  pavilion(k) {
    const px = 0.8, pz = -4.6;
    k.put(N.pond(k, 2.5), px, pz, { block: 2.4, space: 2.7 });
    k.anchor('pond', px, pz, 2.5);
    k.put(N.lotus(k, 7, 1.9), px, pz);
    k.put(S.archBridge(k, 4.2), px, pz, { rotY: 0, space: 0 });
    centrepiece(k, S.pavilion(k), -5.2, -1.6, 2.1);
    centrepiece(k, S.stoneLantern(k), 3.6, -2.2, 0.35);
    centrepiece(k, S.stoneLantern(k), -2.2, -3.4, 0.35);
    trees(k, 6, () => N.bamboo(k), 4.5);
    trees(k, 2, () => N.roundTree(k, '#f5a0b8'), 5);
    if (k.has('tea', 'liyue')) centrepiece(k, S.table(k, '#3f8f6e'), 2.4, 1.4, 0.7);
    rocks(k, 2);
  },

  riverside(k) {
    k.ground = '#8fbf5a';
    const px = 3.4, pz = -4.2;
    k.put(N.pond(k, 2.8, '#5aa8a0'), px, pz, { block: 2.7, space: 3 });
    k.anchor('pond', px, pz, 2.8);
    k.put(N.lotus(k, 10, 2.2), px, pz);
    const b = P.boat(k);
    k.put(b, px - 0.4, pz + 0.4, { rotY: 0.6 });
    centrepiece(k, S.hut(k), -5.2, -2.4, 1.3);
    trees(k, 5, () => N.bamboo(k), 4.5);
    trees(k, 2, () => N.palm(k), 5);
    // Rice paddy strips (walk-through).
    const paddy = new THREE.Group();
    for (let i = 0; i < 4; i++) k.part(paddy, geo.box(2.6, 0.05, 0.5), i % 2 ? '#7fcf5a' : '#5aa845', [0, 0.03, i * 0.6], { outline: false });
    k.put(paddy, -3.2, 2.6, { rotY: 0.3, space: 1.6 });
    if (k.words.has('to') && k.words.has('hong') || k.has('duyen', 'det', 'mong', 'chuc', 'nguu')) {
      centrepiece(k, P.loom(k), 4.4, 1.6, 1);
      k.anchor('loom', 3.4, 1.2);
      const t1 = N.roundTree(k, '#f5a0b8'), t2 = N.roundTree(k, '#f5a0b8');
      centrepiece(k, t1, -2.6, -4.6, 0.5);
      centrepiece(k, t2, -5.6, 1.4, 0.5);
      k.group.add(P.redThread(k, new THREE.Vector3(-2.6, 2, -4.6), new THREE.Vector3(-5.6, 2, 1.4)));
      k.group.add(S.lanternString(k, new THREE.Vector3(-2.6, 2.4, -4.6), new THREE.Vector3(px - 2, 2.2, pz + 3), 6));
    }
    nightLanterns(k, 2);
  },

  skygarden(k) {
    centrepiece(k, P.sundial(k), 2.6, -2.2, 0.6);
    centrepiece(k, P.gardenArch(k, '#ffd36e'), -3.2, -2.4, 0.3);
    centrepiece(k, P.gardenArch(k, '#b58cff'), 3.8, 1.8, 0.3);
    k.scatter(6, 0.5, () => P.crystal(k, k.pick(['#cfe8ff', '#ffe6a0', '#e0c8ff'])), { minR: 3, block: 0.4 });
    flowerPatches(k, 4, ['#ffe27a', '#cfe8ff', '#ffffff']);
    trees(k, 3, () => N.roundTree(k, '#cfe0f5'), 5);
    const sun = P.orb(k, '#ffd36e', 0.55), moon = P.orb(k, '#dfe8ff', 0.45);
    k.group.add(sun, moon);
    k.animate((t) => {
      const a = t * 0.15;
      sun.position.set(Math.cos(a) * 6, 4.2 + Math.sin(t * 0.8) * 0.3, Math.sin(a) * 6);
      moon.position.set(Math.cos(a + Math.PI) * 6, 3.8 + Math.sin(t * 0.8 + 1) * 0.3, Math.sin(a + Math.PI) * 6);
    });
  },

  parisbridge(k) {
    const cz = -3.4;
    k.put(P.canal(k, 22, 1.8), 0, cz, { space: 0 });
    for (let x = -9; x <= 9; x += 1.3) if (Math.abs(x) > 1.4) k.blockers.push({ x, z: cz, r: 0.9 });
    k.put(S.archBridge(k, 3.4, '#d8d0c0', '#2d2d35'), 0, cz, { rotY: Math.PI / 2, space: 1.8 });
    for (const x of [-3.5, 3.5]) for (const s of [-1, 1]) centrepiece(k, S.streetLamp(k), x, cz + 1.5 * s, 0.2);
    centrepiece(k, P.eiffel(k), -6.2, -6.0, 1.4);
    centrepiece(k, P.cafeSet(k), 3.6, 1.8, 0.8);
    k.scatter(3, 0.6, () => P.flowerBox(k), { minR: 2.5, tall: false, block: 0.5 });
    trees(k, 4, () => N.roundTree(k, k.has('bloom', 'fleurit') ? '#f5a0b8' : k.look.leaf), 4.5);
  },

  nursery(k) {
    k.put(S.roomFloor(k, 3.5, '#e8c9a0'), 0, 0, { space: 3.6 });
    const ring = (deg: number, r: number, obj: THREE.Object3D, block: number) => {
      const a = (deg * Math.PI) / 180, x = Math.sin(a) * r, z = Math.cos(a) * r;
      k.put(obj, x, z, { rotY: k.faceCenter(x, z), block, space: 0 });
    };
    ring(-130, 2.6, S.rockingChair(k), 0.5);
    ring(135, 2.6, S.crib(k), 0.7);
    k.anchor('bed', 1.6, -1.6);
    ring(-90, 3.0, S.fireplace(k), 1);
    ring(95, 3.0, S.bookshelf(k), 0.8);
    ring(160, 2.0, teddy(k), 0.2);
    ring(-165, 1.9, S.coffeeTable(k), 0.5);
    trees(k, 5, () => (k.has('snowy') ? N.pine(k, true) : N.roundTree(k)), 5);
    flowerPatches(k, 2);
  },

  wildforest(k) {
    k.ground = '#5d6b3f';
    if (k.has('roar', 'mountain', 'peak')) {
      const crag = new THREE.Group();
      for (let i = 0; i < 5; i++) k.part(crag, geo.dodec(0.8 + k.rand() * 0.6), '#7d7468', [(k.rand() - 0.5) * 1.6, 0.6 + i * 0.35, (k.rand() - 0.5) * 1.6], { outline: 0.03 });
      centrepiece(k, crag, -4.6, -2.8, 1.6);
    }
    trees(k, 16, () => N.pine(k, false, k.pick(['#2f4d33', '#3a5a3a', '#2a4430'])), 3.2);
    k.scatter(3, 0.9, () => N.log(k), { minR: 2.5, tall: false, block: 0.5 });
    k.scatter(6, 0.3, () => N.mushroom(k), { minR: 2, tall: false, block: 0 });
    k.scatter(4, 0.7, () => N.bush(k, '#3f5f3a'), { minR: 3, block: 0.5 });
    rocks(k, 5);
  },
};

// ---------------------------------------------------------------- landmarks

const LANDMARKS: Record<string, (k: Kit) => void> = {
  castle(k) {
    centrepiece(k, P.castle(k), L.x - 0.4, L.z - 1, 2.4);
    trees(k, 5, () => N.pine(k), 4);
    flowerPatches(k, 3);
    centrepiece(k, S.signpost(k), 2.6, -1.6, 0.2);
    centrepiece(k, S.bench(k), 3.2, 2.2, 0.8);
  },
  pyramid(k) {
    k.ground = '#e2c07a';
    centrepiece(k, P.pyramid(k), L.x - 0.5, L.z - 1.4, 3);
    trees(k, 5, () => N.palm(k), 4);
    rocks(k, 4, '#caa05c');
  },
  temple(k) {
    centrepiece(k, P.temple(k), L.x, L.z - 0.8, 2.4);
    k.put(N.pond(k, 1.6), 2.4, -3.8, { block: 1.5, space: 1.8 });
    k.anchor('pond', 2.4, -3.8, 1.6);
    k.put(N.lotus(k, 5, 1.2), 2.4, -3.8);
    trees(k, 4, () => N.palm(k), 4);
    trees(k, 3, () => N.roundTree(k), 5);
  },
  fuji(k) {
    centrepiece(k, P.fuji(k), L.x - 0.6, L.z - 2.4, 3.4);
    centrepiece(k, S.torii(k), 3.4, -2.6, 0.3);
    centrepiece(k, S.stoneLantern(k), 1.6, -3.4, 0.35);
    trees(k, 5, () => N.roundTree(k, '#f5a0b8'), 4);
    flowerPatches(k, 2, ['#ff9ec4', '#ffffff']);
  },
  moon(k) {
    k.ground = '#b8b8c0';
    centrepiece(k, P.moonBase(k), 3.2, -2.4, 1);
    for (let i = 0; i < 6; i++) {
      const s = k.spot(1.2, { minR: 2.4, tall: false });
      if (s) k.put(P.crater(k, 0.6 + k.rand() * 0.8), s.x, s.z, { space: 1.2 });
    }
    rocks(k, 5, '#9a9aa2');
  },
  throne(k) {
    k.ground = '#8a8580';
    centrepiece(k, P.throne(k), L.x, L.z, 1.8);
    for (const [x, z] of [[-2.6, -4.2], [-2.8, 0.8], [2.8, -3.6], [3.4, 1.2]]) centrepiece(k, S.torch(k), x, z, 0.2);
    centrepiece(k, S.banner(k, '#7a1f1f'), 5.4, -1.8, 0.2);
    centrepiece(k, S.banner(k, '#2d2d35'), 5.2, 1.6, 0.2);
    k.scatter(4, 0.6, () => P.brokenColumn(k, 2.4), { minR: 5, block: 0.45 });
  },
  train(k) {
    const t = P.trainCar(k);
    k.put(t, -5.2, -0.8, { rotY: Math.PI / 2, space: 2.6 });
    for (const z of [-2.6, -0.8, 1]) k.blockers.push({ x: -5.2, z, r: 1 });
    centrepiece(k, S.streetLamp(k, '#6d5fa8'), -3, -3.6, 0.2);
    centrepiece(k, S.bench(k), 3.0, 1.8, 0.8);
    if (k.has('honkai', 'trailblazing')) return starRailLounge(k);
    k.scatter(4, 0.5, () => P.crystal(k, '#b8a0ff'), { minR: 3.5, block: 0.4 });
  },
  ruins(k) {
    k.ground = '#d9c9a0';
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.6 + (i / 6) * Math.PI * 1.1;
      centrepiece(k, P.brokenColumn(k, 1 + k.rand() * 1.6), Math.cos(a) * 6.2, Math.sin(a) * 6.2 - 0.5, 0.45);
    }
    k.scatter(7, 0.4, () => P.coral(k), { minR: 2.4, block: 0.3 });
    k.scatter(4, 0.4, () => N.reeds(k, 6), { minR: 3, block: 0 });
    const chest = S.crate(k, 0.6);
    k.part(chest, geo.box(0.62, 0.08, 0.62), '#e0b84a', [0, 0.62, 0], { outline: false });
    centrepiece(k, chest, 2.6, -1.6, 0.4);
  },
  bones(k) {
    centrepiece(k, P.mammothBones(k), L.x + 0.4, L.z - 0.6, 2.6);
    centrepiece(k, S.tent(k, '#c9a26e'), 4.6, -2.2, 1.1);
    k.scatter(3, 0.4, () => S.crate(k, 0.55), { minR: 3, block: 0.4 });
    trees(k, 4, () => N.pine(k, k.env.below === 'snow'), 5);
    rocks(k, 3);
  },
  ship(k) {
    k.ground = '#a0764e';
    centrepiece(k, P.mast(k), -4.6, -1.8, 0.4);
    centrepiece(k, P.shipWheel(k), 2.4, 1.6, 0.4);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.cos(a), Math.sin(a))) < 0.4) continue; // keep the camera side open
      const x = Math.cos(a) * 9.9, z = Math.sin(a) * 9.9;
      k.put(S.fence(k, 4.3), x, z, { rotY: -a + Math.PI / 2 });
    }
    k.scatter(4, 0.4, () => S.barrel(k), { minR: 3, block: 0.4 });
    k.scatter(3, 0.4, () => S.crate(k, 0.6), { minR: 3, block: 0.4 });
  },
  bay(k) {
    k.put(N.pond(k, 3.2, '#4fa8a0'), 0.6, -5.2, { block: 3.1, space: 3.4 });
    k.anchor('pond', 0.6, -5.2, 3.2);
    const b1 = P.boat(k), b2 = P.boat(k, '#6b4a33');
    k.put(b1, -0.6, -5.2, { rotY: 0.4 });
    k.put(b2, 1.8, -4.4, { rotY: -0.8 });
    for (const [x, z, h] of [[-5.6, -3.4, 3.6], [-6.2, -0.6, 2.6], [5.8, -3.8, 3.2], [6.4, -0.8, 2.4]]) centrepiece(k, P.karst(k, h), x, z, 0.8);
    centrepiece(k, P.turtle(k), 3.2, 1.2, 1.4);
    trees(k, 3, () => N.palm(k), 4);
  },
  beach(k) {
    k.ground = '#ecd49a';
    centrepiece(k, P.tikiHut(k), L.x, L.z, 1.4);
    centrepiece(k, P.beachSet(k), 3.2, -1.8, 0.8);
    trees(k, 7, () => N.palm(k), 3.5);
    if (k.night) k.put(S.campfire(k), 2.6, 1.8, { block: 0.7 });
    rocks(k, 2, '#c9b48a');
  },
  jungle(k) {
    k.ground = '#4f7a3a';
    trees(k, 7, () => N.palm(k), 3.5);
    trees(k, 5, () => N.roundTree(k, '#2f6b35'), 4);
    k.scatter(5, 0.8, () => N.bush(k, '#3f8a3a', 0.8), { minR: 2.6, block: 0.6 });
    if (k.has('aircraft', 'pilot', 'plane')) {
      const plane = P.airplane(k);
      plane.position.y = 0.6;
      centrepiece(k, plane, 4.6, -1.6, 1.6);
    } else {
      // Tarzan swing: a tall tree with a hanging vine.
      const t = N.roundTree(k, '#2f6b35');
      t.scale.setScalar(1.6);
      k.part(t, geo.cyl(0.02, 0.02, 2.2, 4), '#4f7a2a', [0.9, 2.0, 0.4], { outline: false });
      centrepiece(k, t, -4.6, -1.6, 0.6);
    }
  },
};

export function buildIsland(k: Kit, island: IslandKind, variant?: string) {
  if (island === 'landmark') (LANDMARKS[variant ?? 'castle'] ?? LANDMARKS.castle)(k);
  else (TEMPLATES[island] ?? TEMPLATES.meadow)(k);
}
