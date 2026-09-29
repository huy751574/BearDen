import * as THREE from 'three';
import { geo, type Kit } from '../kit';

// Trees, rocks, plants and small water features. Every prop is a Group with
// its base at y = 0, facing +Z.

const TRUNK = '#6b4a33';

export function pine(k: Kit, snowy = false, color = k.look.leaf) {
  const g = new THREE.Group();
  const leaf = snowy ? '#dfe9ef' : color;
  k.part(g, geo.cyl(0.14, 0.2, 1, 8), TRUNK, [0, 0.5, 0]);
  k.part(g, geo.cone(1.1, 1.6, 8), leaf, [0, 1.5, 0], { outline: 0.03 });
  k.part(g, geo.cone(0.85, 1.3, 8), leaf, [0, 2.3, 0], { outline: 0.03 });
  k.part(g, geo.cone(0.55, 1.0, 8), snowy ? '#ffffff' : leaf, [0, 3.0, 0], { outline: 0.03 });
  return g;
}

export function roundTree(k: Kit, color = k.look.leaf) {
  const g = new THREE.Group();
  k.part(g, geo.cyl(0.14, 0.22, 1.4, 8), TRUNK, [0, 0.7, 0]);
  k.part(g, geo.ico(1.0), color, [0, 2.0, 0], { outline: 0.03 });
  k.part(g, geo.ico(0.7), color, [0.6, 2.3, 0.1], { outline: 0.03 });
  k.part(g, geo.ico(0.6), color, [-0.5, 2.4, -0.2], { outline: 0.03 });
  return g;
}

export function palm(k: Kit) {
  const g = new THREE.Group();
  const trunk = k.part(g, geo.cyl(0.12, 0.2, 2.6, 8), '#8a6a44', [0, 1.3, 0]);
  trunk.rotation.z = 0.12;
  for (let i = 0; i < 6; i++) {
    const frond = k.part(g, geo.cone(0.25, 1.7, 4), '#4f9a3f', [0.2, 2.6, 0], { outline: 0.02 });
    frond.rotation.set(Math.PI / 2.4, (i / 6) * Math.PI * 2, 0, 'YXZ');
  }
  return g;
}

export function bamboo(k: Kit, stalks = 4) {
  const g = new THREE.Group();
  for (let i = 0; i < stalks; i++) {
    const h = 3 + k.rand() * 2.2;
    const x = (k.rand() - 0.5) * 0.8, z = (k.rand() - 0.5) * 0.8;
    k.part(g, geo.cyl(0.07, 0.08, h, 6), '#7cab4f', [x, h / 2, z]);
    for (let y = 0.8; y < h; y += 0.8) k.part(g, geo.cyl(0.09, 0.09, 0.05, 6), '#5d8a3a', [x, y, z], { outline: false });
    k.part(g, geo.cone(0.45, 1, 5), '#5f9a45', [x, h, z], { outline: 0.02 });
  }
  return g;
}

export function rock(k: Kit, s = 0.5, color = '#8a8a90') {
  const g = new THREE.Group();
  const m = k.part(g, geo.dodec(s), color, [0, s * 0.45, 0], { outline: 0.03 });
  m.rotation.set(k.rand(), k.rand(), k.rand());
  return g;
}

export function bush(k: Kit, color = k.look.leaf, s = 0.6) {
  const g = new THREE.Group();
  k.part(g, geo.ico(s), color, [0, s * 0.6, 0], { scale: [1.2, 0.8, 1], outline: 0.025 });
  k.part(g, geo.ico(s * 0.7), color, [s * 0.7, s * 0.45, 0.1], { outline: 0.02 });
  return g;
}

/** Patch of flowers as one instanced mesh (walk-through). */
export function flowers(k: Kit, radius: number, count: number, colors = ['#ff8fb1', '#ffd36e', '#ffffff', '#b58cff']) {
  const g = new THREE.Group();
  const heads = new THREE.InstancedMesh(geo.ico(0.08, 0), k.mat('#ffffff'), count);
  const stems = new THREE.InstancedMesh(geo.cyl(0.012, 0.012, 0.3, 4), k.mat('#4f8f3a'), count);
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const a = k.rand() * Math.PI * 2, d = Math.sqrt(k.rand()) * radius;
    const x = Math.cos(a) * d, z = Math.sin(a) * d, h = 0.2 + k.rand() * 0.15;
    stems.setMatrixAt(i, m.makeTranslation(x, h / 2, z));
    heads.setMatrixAt(i, m.makeTranslation(x, h, z));
    heads.setColorAt(i, c.set(k.pick(colors)));
  }
  g.add(stems, heads);
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
