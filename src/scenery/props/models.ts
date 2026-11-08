import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { addOutline } from '../../engine/toon';
import type { Kit } from '../kit';

// Props modelled in Blender (tools/blender/build_props.py -> public/props/<name>.glb).
// Each file is a few dozen KB; it loads once and is cloned for every copy.
// Seats are nodes named Seat_<n>: the player can click the prop and sit there
// (Game.walkToSeat). If a file can't load, the old code-built prop is used.

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF>>();

function load(name: string) {
  const url = `props/${name}.glb`;
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).catch((e) => { cache.delete(url); throw e; }));
  return cache.get(url)!;
}

export interface PropOpts {
  /** Recolour materials by name, e.g. { Fabric: '#a8463e' } for a red sofa. */
  tint?: Record<string, string>;
  /** The code-built version, used if the model can't load. */
  fallback: () => THREE.Object3D;
  /** The player can click it and sit on its seats. */
  sittable?: boolean;
  /** No backrest (a log, a hay bale): sit facing away from the side you came from. */
  twoSided?: boolean;
}

/** A prop from public/props, in the game's toon look; empty until the file arrives. */
export function propModel(k: Kit, name: string, o: PropOpts): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.userData.twoSided = !!o.twoSided;
  if (o.sittable) k.sittable(g);
  load(name).then(
    (gltf) => {
      const model = gltf.scene.clone(true);
      // Collect first: addOutline adds child meshes, which traverse would visit.
      const meshes: THREE.Mesh[] = [];
      model.traverse((x) => void ((x as THREE.Mesh).isMesh && meshes.push(x as THREE.Mesh)));
      for (const m of meshes) {
        const src = m.material as THREE.MeshStandardMaterial;
        m.material = k.mat(o.tint?.[src.name] ?? '#' + src.color.getHexString());
        m.castShadow = m.receiveShadow = true;
        addOutline(m, 0.015);
      }
      g.add(model);
    },
    (e) => {
      console.warn(`Prop "${name}" failed to load; using the code-built one.`, e);
      g.add(o.fallback());
    },
  );
  return g;
}

/** Add Seat_<n> markers to a code-built prop: [x, y (seat surface), z] facing +Z, or a yaw. */
export function withSeats<T extends THREE.Object3D>(obj: T, seats: ([number, number, number] | [number, number, number, number])[]): T {
  seats.forEach(([x, y, z, yaw = 0], i) => {
    const s = new THREE.Object3D();
    s.name = `Seat_${i}`;
    s.position.set(x, y, z);
    s.rotation.y = yaw;
    obj.add(s);
  });
  return obj;
}

/** A lighter shade of a colour (the cushions of a tinted sofa). */
export function lighter(color: string, amount = 0.05) {
  return '#' + new THREE.Color(color).offsetHSL(0, 0, amount).getHexString();
}
