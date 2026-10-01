import * as THREE from 'three';
import { geo, type Kit } from '../kit';

// Trees, rocks, plants and small water features. Every prop is a Group with
// its base at y = 0, facing +Z.

const TRUNK = '#6b4a33';

/** The same colour a little lighter (+) or darker (-), for two-tone foliage. */
export function shade(color: string, dl: number, ds = 0) {
  return '#' + new THREE.Color(color).offsetHSL(0, ds, dl).getHexString();
}

/** Conifer green: the scene's foliage when it is green, else a forest green (pines don't turn orange or pink). */
export function evergreen(k: Kit) {
  const { h } = new THREE.Color(k.look.leaf).getHSL({ h: 0, s: 0, l: 0 });
  return h > 0.15 && h < 0.5 ? k.look.leaf : '#3f5f3f';
}

/** Gentle wind sway for a canopy (each tree has its own phase). */
function sway(k: Kit, obj: THREE.Object3D, amount = 0.035, speed = 0.9) {
  const ph = k.rand() * Math.PI * 2;
  k.animate((t) => {
    obj.rotation.z = Math.sin(t * speed + ph) * amount;
    obj.rotation.x = Math.sin(t * speed * 0.7 + ph * 1.3) * amount * 0.6;
  });
}

/** Tapered trunk with a little root flare. */
function trunk(k: Kit, g: THREE.Group, h: number, r: number, color = TRUNK) {
  k.part(g, geo.cyl(r * 0.7, r, h, 8), color, [0, h / 2, 0]);
  k.part(g, geo.cyl(r, r * 1.6, 0.18, 8), color, [0, 0.09, 0], { outline: false });
}

export function pine(k: Kit, snowy = false, color = evergreen(k)) {
  const g = new THREE.Group();
  trunk(k, g, 1.1, 0.18);
  const crown = new THREE.Group();
  crown.position.y = 0.8;
  g.add(crown);
  // Four drooping tiers, darker at the bottom, each turned a little.
  const tiers = [[1.15, 1.2, 0.55], [0.95, 1.05, 1.15], [0.72, 0.9, 1.7], [0.45, 0.75, 2.2]];
  tiers.forEach(([r, h, y], i) => {
    const c = snowy && i === tiers.length - 1 ? '#ffffff' : shade(color, -0.06 + i * 0.04);
    const tier = k.part(crown, geo.cone(r, h, 9), c, [0, y, 0], { outline: 0.03, rot: [0, k.rand() * 2, 0] });
    tier.scale.y = 0.9 + k.rand() * 0.15;
    if (snowy && i < tiers.length - 1) k.part(crown, geo.cone(r * 0.82, h * 0.42, 9), '#eef4f8', [0, y + h * 0.3, 0], { outline: false });
  });
  sway(k, crown, 0.02, 0.7);
  return g;
}

export function roundTree(k: Kit, color = k.look.leaf) {
  const g = new THREE.Group();
  trunk(k, g, 1.5, 0.2);
  // A short branch peeking out of the canopy.
  k.part(g, geo.cyl(0.05, 0.08, 0.6, 6), TRUNK, [0.25, 1.35, 0], { rot: [0, 0, -0.8] });
  const crown = new THREE.Group();
  crown.position.y = 1.4;
  g.add(crown);
  // Clustered canopy: dark blobs low and inside, light ones on top (reads as sunlit).
  const blobs: [number, number, number, number, number][] = [
    [0, 0.6, 0, 0.95, -0.05], [0.65, 0.45, 0.15, 0.62, -0.07], [-0.6, 0.5, -0.1, 0.66, -0.06],
    [0.1, 0.45, 0.6, 0.58, -0.04], [-0.15, 0.5, -0.6, 0.6, -0.08],
    [0.25, 1.15, 0.1, 0.62, 0.05], [-0.35, 1.05, 0.2, 0.5, 0.04], [0.05, 1.45, -0.1, 0.4, 0.08],
  ];
  for (const [x, y, z, r, dl] of blobs) {
    const s = 0.9 + k.rand() * 0.2;
    k.part(crown, geo.ico(r * s, 2), shade(color, dl), [x, y, z], { outline: 0.03 });
  }
  sway(k, crown);
  return g;
}

export function palm(k: Kit) {
  const g = new THREE.Group();
  // Curved trunk from a few leaning ringed segments.
  let x = 0;
  for (let i = 0; i < 5; i++) {
    const seg = k.part(g, geo.cyl(0.13 - i * 0.012, 0.16 - i * 0.012, 0.6, 8), i % 2 ? '#9a7a50' : '#8a6a44', [x, 0.3 + i * 0.56, 0]);
    seg.rotation.z = -0.05 - i * 0.03;
    x += 0.04 + i * 0.025;
  }
  const crown = new THREE.Group();
  crown.position.set(x, 2.85, 0);
  g.add(crown);
  for (let i = 0; i < 7; i++) {
    const frond = new THREE.Group();
    frond.rotation.y = (i / 7) * Math.PI * 2 + k.rand() * 0.3;
    crown.add(frond);
    // Two pieces per frond: up and out, then drooping.
    k.part(frond, geo.box(0.34, 0.03, 0.9), shade('#4f9a3f', 0.03), [0, 0.12, 0.42], { rot: [-0.35, 0, 0], outline: 0.015 });
    k.part(frond, geo.box(0.26, 0.03, 0.8), shade('#4f9a3f', -0.04), [0, -0.05, 1.12], { rot: [0.45, 0, 0], outline: 0.015 });
  }
  for (let i = 0; i < 3; i++) k.part(crown, geo.sph(0.09, 8, 6), '#6b4a2c', [Math.cos(i * 2.1) * 0.14, -0.12, Math.sin(i * 2.1) * 0.14]);
  sway(k, crown, 0.05, 0.8);
  return g;
}

export function bamboo(k: Kit, stalks = 4) {
  const g = new THREE.Group();
  for (let i = 0; i < stalks; i++) {
    const h = 3 + k.rand() * 2.2;
    const x = (k.rand() - 0.5) * 0.8, z = (k.rand() - 0.5) * 0.8;
    const stalk = new THREE.Group();
    stalk.position.set(x, 0, z);
    g.add(stalk);
    k.part(stalk, geo.cyl(0.07, 0.08, h, 6), '#7cab4f', [0, h / 2, 0]);
    for (let y = 0.8; y < h; y += 0.8) {
      k.part(stalk, geo.cyl(0.09, 0.09, 0.05, 6), '#5d8a3a', [0, y, 0], { outline: false });
      // Thin leaf sprays at the upper joints.
      if (y > h * 0.35) {
        for (let j = 0; j < 5; j++) {
          // A long thin leaf pointing out and drooping a little.
          const a = (j / 5) * Math.PI * 2 + k.rand() * 0.8;
          const spray = new THREE.Group();
          spray.position.set(0, y + 0.05, 0);
          spray.rotation.set(0, a, 0);
          stalk.add(spray);
          const leaf = k.part(spray, geo.cone(0.1, 0.8, 4), shade('#5f9a45', (k.rand() - 0.5) * 0.1), [0, -0.08, 0.38], { rot: [Math.PI / 2 + 0.35, 0, 0], outline: 0.01 });
          leaf.scale.set(1, 1, 0.22);
        }
      }
    }
    sway(k, stalk, 0.025, 0.8 + k.rand() * 0.4);
  }
  return g;
}

export function rock(k: Kit, s = 0.5, color = '#8a8a90') {
  const g = new THREE.Group();
  // Softer boulder (squashed, a little lopsided) with a smaller stone beside it.
  const m = k.part(g, geo.ico(s, 1), color, [0, s * 0.4, 0], { outline: 0.03 });
  m.scale.set(1 + k.rand() * 0.3, 0.65 + k.rand() * 0.2, 0.9 + k.rand() * 0.2);
  m.rotation.y = k.rand() * Math.PI;
  if (k.rand() < 0.6) k.part(g, geo.ico(s * 0.38, 1), shade(color, 0.04), [s * 0.95, s * 0.14, s * 0.3], { scale: [1, 0.7, 1], outline: 0.02 });
  // Moss cap on rocks outside snowy scenes.
  if (k.env.weather !== 'snow' && k.rand() < 0.55) {
    k.part(g, geo.sph(s * 0.8, 12, 6), shade(k.look.leaf, 0.04), [0, s * 0.62, 0], { scale: [m.scale.x, 0.28, m.scale.z], outline: false });
  }
  return g;
}

export function bush(k: Kit, color = k.look.leaf, s = 0.6) {
  const g = new THREE.Group();
  k.part(g, geo.ico(s, 2), shade(color, -0.04), [0, s * 0.6, 0], { scale: [1.2, 0.8, 1], outline: 0.025 });
  k.part(g, geo.ico(s * 0.7, 2), color, [s * 0.7, s * 0.45, 0.1], { outline: 0.02 });
  k.part(g, geo.ico(s * 0.6, 2), shade(color, 0.05), [-s * 0.45, s * 0.75, 0.2], { outline: 0.02 });
  // Some bushes flower or carry berries.
  if (k.rand() < 0.4) {
    const dot = k.pick(['#ffffff', '#ff8fb1', '#d9473f', '#ffd36e']);
    for (let i = 0; i < 6; i++) {
      const a = k.rand() * Math.PI * 2, y = s * (0.5 + k.rand() * 0.5);
      k.part(g, geo.sph(0.05, 6, 4), dot, [Math.cos(a) * s * 0.9, y, Math.sin(a) * s * 0.75], { outline: false });
    }
  }
  return g;
}

/** Patch of flowers as instanced meshes (walk-through): stems, leaves, petals, centres. */
export function flowers(k: Kit, radius: number, count: number, colors = ['#ff8fb1', '#ffd36e', '#ffffff', '#b58cff']) {
  const g = new THREE.Group();
  // Petals: a flattened 5-sided disc reads as a little blossom from above.
  const heads = new THREE.InstancedMesh(geo.cyl(0.085, 0.06, 0.03, 5), k.mat('#ffffff'), count);
  const hearts = new THREE.InstancedMesh(geo.sph(0.03, 6, 4), k.mat('#ffffff'), count);
  const stems = new THREE.InstancedMesh(geo.cyl(0.012, 0.012, 0.3, 4), k.mat('#4f8f3a'), count);
  const leaves = new THREE.InstancedMesh(geo.cone(0.05, 0.16, 3), k.mat(shade(k.look.leaf, 0.06)), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = k.rand() * Math.PI * 2, d = Math.sqrt(k.rand()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.2 + k.rand() * 0.15;
    const col = k.pick(colors);
    stems.setMatrixAt(i, m.makeTranslation(x, h / 2, z));
    e.set(0.25, k.rand() * 6, 0);
    heads.setMatrixAt(i, m.compose(new THREE.Vector3(x, h, z), q.setFromEuler(e), one));
    heads.setColorAt(i, c.set(col));
    hearts.setMatrixAt(i, m.makeTranslation(x, h + 0.02, z));
    hearts.setColorAt(i, c.set(col === '#ffd36e' ? '#e0873a' : '#ffd36e'));
    e.set(0, k.rand() * 6, 0.9);
    leaves.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.08, z), q.setFromEuler(e), one));
  }
  g.add(stems, leaves, heads, hearts);
  return g;
}

/**
 * Grass tufts over the island (walk-through, instanced), swaying in the wind.
 * Three blades per tuft, coloured between the ground and the foliage.
 */
export function grass(k: Kit, radius: number, tufts: number) {
  const g = new THREE.Group();
  const base = new THREE.Color(k.ground).lerp(new THREE.Color(k.look.leaf), 0.55);
  const mesh = new THREE.InstancedMesh(geo.cone(0.04, 0.4, 3), k.mat('#ffffff'), tufts * 3);
  const blades: { p: THREE.Vector3; tilt: number; yaw: number; s: number }[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < tufts; i++) {
    const a = k.rand() * Math.PI * 2, d = 1.2 + Math.sqrt(k.rand()) * (radius - 1.2);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const s = 0.7 + k.rand() * 0.6;
    for (let j = 0; j < 3; j++) {
      blades.push({ p: new THREE.Vector3(x + (j - 1) * 0.04, 0.18 * s, z + (j % 2) * 0.03), tilt: (j - 1) * 0.35, yaw: k.rand() * 6, s });
      mesh.setColorAt(i * 3 + j, c.copy(base).offsetHSL(0, 0, (k.rand() - 0.4) * 0.1));
    }
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  const wind = (t: number) => {
    blades.forEach((b, i) => {
      const w = Math.sin(t * 1.4 + b.p.x * 0.7 + b.p.z * 0.4) * 0.15;
      e.set(w * 0.6, b.yaw, b.tilt + w, 'YXZ');
      mesh.setMatrixAt(i, m.compose(b.p, q.setFromEuler(e), v.setScalar(b.s)));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  wind(0);
  k.animate(wind);
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

/** Fallen leaves on the ground (walk-through, instanced), for autumn scenes. */
export function fallenLeaves(k: Kit, radius: number, count: number, colors = ['#e0873a', '#d9603a', '#e8b84e', '#b8552e']) {
  const g = new THREE.Group();
  const mesh = new THREE.InstancedMesh(geo.cyl(0.07, 0.07, 0.01, 5), k.mat('#ffffff'), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  const flat = new THREE.Vector3(1, 1, 0.6);
  for (let i = 0; i < count; i++) {
    const a = k.rand() * Math.PI * 2, d = Math.sqrt(k.rand()) * radius;
    e.set((k.rand() - 0.5) * 0.3, k.rand() * 6, (k.rand() - 0.5) * 0.3);
    mesh.setMatrixAt(i, m.compose(new THREE.Vector3(Math.cos(a) * d, 0.012, Math.sin(a) * d), q.setFromEuler(e), flat));
    mesh.setColorAt(i, c.set(k.pick(colors)));
  }
  mesh.receiveShadow = true;
  g.add(mesh);
  return g;
}

export function reeds(k: Kit, n = 7) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const h = 0.6 + k.rand() * 0.6;
    const r = k.part(g, geo.cone(0.03, h, 4), '#6f8f3f', [(k.rand() - 0.5) * 0.6, h / 2, (k.rand() - 0.5) * 0.6], { outline: false });
    r.rotation.z = (k.rand() - 0.5) * 0.3;
    k.part(g, geo.cyl(0.04, 0.04, 0.15, 5), '#6b4a2c', [r.position.x, h * 0.85, r.position.z], { outline: false });
  }
  return g;
}

export function log(k: Kit, len = 1.6) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.18, 0.18, len, 10), '#7a5436', [0, 0.18, 0], { rot: [0, 0, Math.PI / 2] });
  k.part(g, geo.cyl(0.13, 0.13, 0.01, 10), '#c9a26e', [len / 2 + 0.005, 0.18, 0], { rot: [0, 0, Math.PI / 2], outline: false });
  return g;
}

export function mushroom(k: Kit, color = '#d9473f') {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.05, 0.07, 0.25, 6), '#f3e6d0', [0, 0.12, 0], { outline: false });
  k.part(g, geo.sph(0.14, 10, 6), color, [0, 0.26, 0], { scale: [1, 0.6, 1], outline: 0.015 });
  return g;
}

/** Flat pond (water disc + stone rim). Radius in metres. */
export function pond(k: Kit, radius: number, water = k.look.water, stones = true) {
  const g = new THREE.Group();
  const c = new THREE.Color(water);
  if (k.night) c.multiplyScalar(0.6);
  const surf = k.part(g, geo.disc(radius, 40), '#' + c.getHexString(), [0, 0.03, 0], {
    rot: [-Math.PI / 2, 0, 0], outline: false, shadow: false, emissive: '#' + c.getHexString(), glow: 0.25,
  });
  surf.receiveShadow = true;
  if (stones) {
    const n = Math.round(radius * 6);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = 0.18 + k.rand() * 0.15;
      k.part(g, geo.dodec(s), '#9a9aa2', [Math.cos(a) * radius, s * 0.3, Math.sin(a) * radius], { outline: 0.015 });
    }
  }
  // Slow shimmer: rotate a faint ring pattern.
  const ring = k.part(g, geo.torus(radius * 0.5, 0.015, Math.PI * 2, 4, 48), '#ffffff', [0, 0.05, 0], {
    rot: [Math.PI / 2, 0, 0], basic: true, opacity: 0.35,
  });
  k.animate((t) => {
    const s = 0.4 + ((t * 0.15) % 1) * 0.6;
    ring.scale.setScalar(s * 1.6);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - (s - 0.4) / 0.6);
  });
  return g;
}

export function lotus(k: Kit, n: number, radius: number) {
  const g = new THREE.Group();
  for (let i = 0; i < n; i++) {
    const a = k.rand() * Math.PI * 2, d = Math.sqrt(k.rand()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    k.part(g, geo.cyl(0.28, 0.28, 0.02, 12), '#4f8f3a', [x, 0.05, z], { outline: false });
    if (k.rand() < 0.6) {
      k.part(g, geo.cone(0.12, 0.18, 6), '#ff9ec4', [x, 0.14, z], { outline: 0.01 });
      k.part(g, geo.sph(0.05, 6, 4), '#ffe27a', [x, 0.2, z], { outline: false });
    }
  }
  return g;
}

/** Snowman with coal eyes and a carrot nose. */
export function snowman(k: Kit) {
  const g = new THREE.Group();
  k.part(g, geo.sph(0.5), '#ffffff', [0, 0.45, 0]);
  k.part(g, geo.sph(0.36), '#ffffff', [0, 1.1, 0]);
  k.part(g, geo.sph(0.26), '#ffffff', [0, 1.6, 0]);
  for (const s of [-1, 1]) k.part(g, geo.sph(0.04, 6, 4), '#222', [0.09 * s, 1.66, 0.23], { outline: false });
  k.part(g, geo.cone(0.05, 0.3, 6), '#ff8a2a', [0, 1.6, 0.36], { rot: [Math.PI / 2, 0, 0], outline: false });
  k.part(g, geo.torus(0.3, 0.07, Math.PI * 2, 6, 16), '#d9473f', [0, 1.38, 0], { rot: [Math.PI / 2, 0, 0], outline: false });
  return g;
}

/** Instanced wheat patch (walk-through), golden stalks swaying in the wind. */
export function wheat(k: Kit, radius: number, count: number) {
  const g = new THREE.Group();
  const mesh = new THREE.InstancedMesh(geo.cone(0.05, 0.9, 4), k.mat(k.env.time === 'sunset' ? '#e8b84e' : '#d9bf5c'), count);
  const base: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = k.rand() * Math.PI * 2, d = Math.sqrt(k.rand()) * radius;
    base.push(new THREE.Vector3(Math.cos(a) * d, 0.45, Math.sin(a) * d));
  }
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
  const sway = (t: number) => {
    base.forEach((p, i) => {
      e.set(Math.sin(t * 1.3 + p.x * 0.6) * 0.12, 0, Math.sin(t * 1.1 + p.z * 0.5) * 0.12);
      mesh.setMatrixAt(i, m.compose(p, q.setFromEuler(e), one));
    });
    mesh.instanceMatrix.needsUpdate = true;
  };
  sway(0);
  k.animate(sway);
  g.add(mesh);
  return g;
}

/** A few fluttering butterflies circling a point. */
export function butterflies(k: Kit, n = 5) {
  const g = new THREE.Group();
  const colors = ['#ffd36e', '#ff9ec4', '#9fd3ff', '#ffffff'];
  const flies: { obj: THREE.Group; wings: THREE.Mesh[]; r: number; ph: number; h: number }[] = [];
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group();
    const wings = [-1, 1].map((s) =>
      k.part(b, new THREE.PlaneGeometry(0.16, 0.12), k.pick(colors), [0.08 * s, 0, 0], { outline: false }),
    );
    wings.forEach((w) => ((w.material as THREE.Material).side = THREE.DoubleSide));
    g.add(b);
    flies.push({ obj: b, wings, r: 1 + k.rand() * 2.5, ph: k.rand() * 6, h: 0.8 + k.rand() * 1.2 });
  }
  k.animate((t) => {
    for (const f of flies) {
      const a = t * 0.6 + f.ph;
      f.obj.position.set(Math.cos(a) * f.r, f.h + Math.sin(t * 2 + f.ph) * 0.3, Math.sin(a * 1.3) * f.r);
      f.obj.rotation.y = -a;
      const flap = Math.sin(t * 18 + f.ph) * 0.9;
      f.wings[0].rotation.y = flap;
      f.wings[1].rotation.y = -flap;
    }
  });
  return g;
}
