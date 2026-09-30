import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { toonMaterial, addSkinnedOutline } from '../engine/toon';
import type { Character } from './Character';

// A rigged GLB character (e.g. from tools/tripo_character.py) driven by an
// AnimationMixer. Clips can live in the model file or in separate
// "<name>@<clip>.glb" files that share the same skeleton.
// Entries come from src/data/models.json (written by tools/check_models.py).

export interface ModelEntry {
  /** Model file (skinned mesh), relative to the site root, e.g. "models/bear.glb". */
  file: string;
  /** clip name -> file holding it (the model file itself for clips inside it). */
  clips: Record<string, string>;
  /** Which way the model faces in its file; the game expects +Z. */
  forward: '+x' | '-x' | '+z' | '-z';
  /** Target height in metres (the procedural bear is ~1.5). */
  height: number;
}

type State = 'idle' | 'walk' | 'run' | 'sit' | 'wave';

const FORWARD_YAW: Record<ModelEntry['forward'], number> = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
const RUN_THRESHOLD = 3.4; // m/s
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

export async function loadGltfCharacter(entry: ModelEntry): Promise<GltfCharacter> {
  const cache = new Map<string, Promise<GLTF>>();
  const load = (file: string) => {
    if (!cache.has(file)) cache.set(file, loader.loadAsync(file));
    return cache.get(file)!;
  };
  const model = await load(entry.file);
  const clips = new Map<string, THREE.AnimationClip>();
  await Promise.all(
    Object.entries(entry.clips).map(async ([name, file]) => {
      try {
        const gltf = await load(file);
        const src = gltf.animations[0];
        if (src) clips.set(name, src.clone());
      } catch (e) {
        console.warn(`Character clip "${name}" failed to load from ${file}`, e);
      }
    }),
  );
  return new GltfCharacter(model, clips, entry);
}

export class GltfCharacter implements Character {
  readonly root = new THREE.Group();
  pose: 'stand' | 'sit' | 'sleep' = 'stand';
  private mixer: THREE.AnimationMixer;
  private actions = new Map<State, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private waveTime = 0;
  private walkSpeed = 1;

  constructor(gltf: GLTF, clips: Map<string, THREE.AnimationClip>, entry: ModelEntry) {
    const model = gltf.scene;
    // Face +Z, stand on y = 0 and scale to the target height.
    model.rotation.y = FORWARD_YAW[entry.forward] ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = entry.height / Math.max(box.max.y - box.min.y, 1e-3);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    this.root.add(model);

    // Swap PBR materials for the game's toon look (keeps the texture).
    model.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const old = mesh.material as THREE.MeshStandardMaterial;
      mesh.material = toonMaterial(old.color ?? '#ffffff', { map: old.map ?? null });
      mesh.castShadow = true;
      mesh.frustumCulled = false; // skinned bounds don't follow the animation
      if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) addSkinnedOutline(mesh as THREE.SkinnedMesh, 0.018 / scale);
    });

    this.mixer = new THREE.AnimationMixer(model);
    const rootBone = findRootBone(model);
    for (const [name, clip] of clips) {
      const state = name as State;
      if (rootBone && (state === 'walk' || state === 'run' || state === 'idle')) lockRootMotion(clip, rootBone.name);
      const action = this.mixer.clipAction(clip);
      if (state === 'wave') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = false;
      }
      if (state === 'sit') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true; // stay seated
      }
      this.actions.set(state, action);
    }
    this.walkSpeed = 2.6;
    this.play('idle', 0);
  }

  wave() {
    const a = this.actions.get('wave');
    if (!a) return;
    this.waveTime = a.getClip().duration;
    this.play('wave', 0.2, true);
  }

  update(dt: number, speed: number) {
    if (this.waveTime > 0) {
      this.waveTime -= dt;
      if (speed > 0.05) this.waveTime = 0; // walking cancels the wave
    }
    let state: State;
    if (this.waveTime > 0) state = 'wave';
    else if (this.pose !== 'stand' && this.actions.has('sit')) state = 'sit';
    else if (speed > RUN_THRESHOLD && this.actions.has('run')) state = 'run';
    else if (speed > 0.05) state = 'walk';
    else state = 'idle';
    this.play(state, 0.25);

    const walk = this.actions.get('walk');
    if (walk) walk.timeScale = THREE.MathUtils.clamp(speed / this.walkSpeed, 0.6, 1.8);
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
  }

  private play(state: State, fade: number, restart = false) {
    const next = this.actions.get(state) ?? this.actions.get('idle');
    if (!next || (next === this.current && !restart)) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current && this.current !== next) this.current.fadeOut(fade);
    this.current = next;
  }
}

function findRootBone(model: THREE.Object3D): THREE.Bone | null {
  let root: THREE.Bone | null = null;
  model.traverse((o) => {
    if (!root && (o as THREE.Bone).isBone) root = o as THREE.Bone;
  });
  return root;
}

/**
 * Remove travel from the hips track (the game moves the character itself).
 * The rig's axes vary (many are Z-up inside), so instead of assuming X/Z we
 * freeze whichever axis drifts steadily from the first to the last frame;
 * the up-down bob returns to where it started and is kept.
 */
function lockRootMotion(clip: THREE.AnimationClip, boneName: string) {
  const safe = THREE.PropertyBinding.sanitizeNodeName(boneName);
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const node = track.name.slice(0, -'.position'.length);
    if (node !== boneName && node !== safe) continue;
    const v = track.values;
    const last = v.length - 3;
    for (let axis = 0; axis < 3; axis++) {
      let min = Infinity, max = -Infinity;
      for (let i = axis; i < v.length; i += 3) {
        min = Math.min(min, v[i]);
        max = Math.max(max, v[i]);
      }
      const drift = Math.abs(v[last + axis] - v[axis]);
      if (max - min > 1e-4 && drift > 0.6 * (max - min)) {
        for (let i = axis; i < v.length; i += 3) v[i] = v[axis];
      }
    }
  }
}
