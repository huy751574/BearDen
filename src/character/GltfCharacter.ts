import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toonMaterial, addOutline, addSkinnedOutline } from '../engine/toon';
import type { Character, Emote } from './Character';
import type { Action, ChibiParts } from './ChibiBear';
import { detachHair } from './hairFix';

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
  /** Lighter copy (~1/4 of the triangles) for crowds, e.g. lounge avatars. */
  lite?: string;
  /** Re-bind long hair that the auto-rig tied to the arms (see hairFix.ts). */
  hairFix?: boolean;
  /**
   * Where the head is (metres, character space, facing +Z) and its radius, so
   * accessories made for the procedural chibi head fit (see attachParts).
   */
  head?: { x?: number; y: number; z?: number; r: number };
  /** Neck (where the head meets the body) and its radius, for scarves. */
  neck?: { x?: number; y: number; z?: number; r: number };
}

/** The procedural chibi's head: radius and height its accessories were made for. */
const CHIBI_HEAD_R = 0.44;
const CHIBI_HEAD_Y = 1.12;
/** The chibi's neck in body space (its scarves: a ring of radius 0.3 at y 0.82). */
const CHIBI_NECK_Y = 0.82;
const CHIBI_NECK_R = 0.3;

type State = 'idle' | 'walk' | 'run' | 'sit' | Emote;
const EMOTES = new Set<string>(['wave', 'dance', 'cheer', 'sing', 'clap', 'victory', 'hurt']);
/** If a model lacks an emote clip, try these instead (in order). */
const FALLBACK: Record<Emote, Emote[]> = {
  wave: [], dance: ['cheer', 'wave'], cheer: ['victory', 'wave'], sing: ['wave'],
  clap: ['cheer', 'wave'], victory: ['cheer', 'wave'], hurt: [],
};
/** Longest time (s) an emote plays; Tripo's clips run 6-23 s, a flinch should be short. */
const MAX_EMOTE: Record<Emote, number> = { wave: 3, dance: 8, cheer: 3, sing: 8, clap: 3, victory: 4, hurt: 1.2 };

const FORWARD_YAW: Record<ModelEntry['forward'], number> = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 };
const RUN_THRESHOLD = 3.4; // m/s
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// Files are shared: several companions of one kind load each GLB once.
const cache = new Map<string, Promise<GLTF>>();
const load = (file: string) => {
  if (!cache.has(file)) cache.set(file, loader.loadAsync(file).catch((e) => { cache.delete(file); throw e; }));
  return cache.get(file)!;
};

/** Load a model + its clips. `height` overrides the entry's (e.g. a cub from the bear model). */
export async function loadGltfCharacter(entry: ModelEntry, height = entry.height): Promise<GltfCharacter> {
  const gltf = await load(entry.file);
  if (entry.hairFix && !gltf.userData.hairFixed) {
    gltf.userData.hairFixed = true; // clones share the geometry: fix it once
    detachHair(gltf.scene);
  }
  const model = { ...gltf, scene: cloneSkinned(gltf.scene) as THREE.Group };
  const clips = new Map<string, THREE.AnimationClip>();
  await Promise.all(
    Object.entries(entry.clips).map(async ([name, file]) => {
      try {
        const gltf = await load(file);
        const src = gltf.animations[0];
        if (src) clips.set(name, removeDrift(src.clone()));
      } catch (e) {
        console.warn(`Character clip "${name}" failed to load from ${file}`, e);
      }
    }),
  );
  return new GltfCharacter(model, clips, { ...entry, height });
}

/**
 * A model without a skeleton (made with tripo_character.py --no-rig), in the
 * game's toon look, standing on y = 0, `height` metres tall, facing +Z.
 * `glow` picks the bright orange pixels of its texture (embers, lava cracks)
 * as an emissive map; returns the materials so the caller can pulse them.
 */
export type GlowKind = 'ember' | 'red' | 'teal';

export async function loadStaticModel(entry: ModelEntry, height = entry.height, glow: GlowKind | false = false, ownGeometry = false) {
  const gltf = await load(entry.file);
  const model = gltf.scene.clone(true);
  // Own copies of the vertices when the caller bends the mesh (Slither).
  if (ownGeometry) {
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry = m.geometry.clone();
      // Compressed files store positions as 16-bit integers; bending needs floats.
      const pos = m.geometry.attributes.position;
      if (!(pos.array instanceof Float32Array)) {
        const f = new Float32Array(pos.count * 3);
        for (let i = 0; i < pos.count; i++) f.set([pos.getX(i), pos.getY(i), pos.getZ(i)], i * 3);
        m.geometry.setAttribute('position', new THREE.BufferAttribute(f, 3));
      }
    });
  }
  model.rotation.y = FORWARD_YAW[entry.forward] ?? 0;
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  const scale = height / Math.max(box.max.y - box.min.y, 1e-3);
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
  const materials: THREE.MeshToonMaterial[] = [];
  // Collect first: addOutline adds child meshes, which traverse would visit.
  const meshes: THREE.Mesh[] = [];
  model.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh)));
  meshes.forEach((mesh) => {
    const old = mesh.material as THREE.MeshStandardMaterial;
    const mat = toonMaterial(old.color ?? '#ffffff', { map: old.map ?? null });
    if (glow && old.map) {
      const mask = glowMask(old.map, glow);
      if (mask) Object.assign(mat, { emissive: new THREE.Color(GLOW_COLOR[glow]), emissiveMap: mask, emissiveIntensity: 1 });
    }
    materials.push(mat);
    mesh.material = mat;
    mesh.castShadow = true;
    addOutline(mesh, 0.018 / scale);
  });
  const root = new THREE.Group();
  root.add(model);
  return { root, materials };
}

const GLOW_COLOR: Record<GlowKind, string> = { ember: '#ff8a2a', red: '#ff2a2a', teal: '#3ff0e0' };
/** Which texture pixels glow (Tripo's textures are muted, so the rules are loose). */
const GLOW_RULE: Record<GlowKind, (r: number, g: number, b: number) => boolean> = {
  // Embers / lava cracks: warm orange (around rgb(195,130,75)).
  ember: (r, g, b) => r > 140 && r > g + 12 && r - b > 80 && g > b,
  // Robot eyes and warning lights.
  red: (r, g, b) => r > 140 && r - g > 70 && r - b > 70,
  // Cyan cores and runes.
  teal: (r, g, b) => g > 130 && b > 120 && g - r > 50,
};

/** White where the texture has the glowing colour, black elsewhere. */
function glowMask(tex: THREE.Texture, kind: GlowKind): THREE.Texture | null {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  if (!img?.width) return null;
  const w = Math.min(img.width, 512), h = Math.min(img.height, 512);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(img, 0, 0, w, h);
  const px = g.getImageData(0, 0, w, h);
  const d = px.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gr = d[i + 1], b = d[i + 2];
    const ember = GLOW_RULE[kind](r, gr, b);
    d[i] = d[i + 1] = d[i + 2] = ember ? 255 : 0;
  }
  g.putImageData(px, 0, 0);
  const mask = new THREE.CanvasTexture(c);
  mask.flipY = tex.flipY;
  mask.colorSpace = THREE.SRGBColorSpace;
  return mask;
}

export class GltfCharacter implements Character {
  readonly root = new THREE.Group();
  pose: 'stand' | 'sit' | 'sleep' = 'stand';
  /** Turn the head toward something (radians, relative to the body), or null. */
  lookYaw: number | null = null;
  /** Holds the model; tipped over to lie down for the 'sleep' pose. */
  private body = new THREE.Group();
  private head: THREE.Bone | null = null;
  private headYaw = 0;
  /** Head rotation before our turn was added (restored each frame, so turns never pile up). */
  private headBase: THREE.Quaternion | null = null;
  private lie = 0;
  private height: number;
  private headInfo: ModelEntry['head'];
  private neckInfo: ModelEntry['neck'];
  private mixer: THREE.AnimationMixer;
  private actions = new Map<State, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private emoteTime = 0;
  private emoteState: State | null = null;
  /** Ground speed (m/s) of the walk / run clips at normal playback. */
  private walkStride = 1;
  private runStride = 2;
  /** Smoothed movement speed, and whether we're in a walking state (with hysteresis). */
  private moveSpeed = 0;
  private moving = false;

  constructor(gltf: GLTF, clips: Map<string, THREE.AnimationClip>, entry: ModelEntry) {
    const model = gltf.scene;
    // Face +Z, stand on y = 0 and scale to the target height.
    model.rotation.y = FORWARD_YAW[entry.forward] ?? 0;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const scale = entry.height / Math.max(box.max.y - box.min.y, 1e-3);
    model.scale.setScalar(scale);
    model.position.y = -box.min.y * scale;
    this.height = entry.height;
    this.headInfo = entry.head;
    this.neckInfo = entry.neck;
    this.body.add(model);
    this.root.add(this.body);
    model.traverse((o) => {
      if (!this.head && (o as THREE.Bone).isBone && /head/i.test(o.name)) this.head = o as THREE.Bone;
    });

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
      // Emotes repeat until their time is up (companions sing / dance for a set time).
      if (EMOTES.has(state)) action.setLoop(THREE.LoopRepeat, Infinity);
      if (state === 'sit') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true; // stay seated
      }
      this.actions.set(state, action);
    }
    // Tripo's chibi steps are small: measure how fast each gait really moves.
    this.walkStride = strideSpeed(model, this.actions.get('walk')) ?? 1;
    this.runStride = strideSpeed(model, this.actions.get('run')) ?? this.walkStride * 2;
    this.play('idle', 0);
  }

  wave() {
    this.emote('wave');
  }

  /** `seconds` overrides the default length (the clip loops if it's shorter). */
  emote(name: Emote, seconds?: number) {
    const state = [name, ...FALLBACK[name]].find((n) => this.actions.has(n));
    if (!state) return;
    this.emoteState = state;
    this.emoteTime = seconds ?? Math.min(this.actions.get(state)!.getClip().duration, MAX_EMOTE[state as Emote] ?? 3);
    this.pose = 'stand';
    this.play(state, 0.2, true);
  }

  /**
   * Parts for accessories written for the procedural chibi (ChibiSpec.extras):
   * `head` is pinned to the head bone, scaled so the chibi's head (radius 0.44)
   * matches this model's head; `body` is pinned to the upper spine, scaled
   * and placed so the chibi's neck (scarves) matches this model's neck. Call
   * once, right after loading.
   */
  attachParts(): ChibiParts {
    const h = this.headInfo ?? { y: this.height * 0.72, r: this.height * 0.2 };
    // Pin in the idle pose (the head's measured position), not the file's rest pose.
    this.mixer.update(0);
    this.root.updateMatrixWorld(true);
    const head = new THREE.Group();
    head.position.set(h.x ?? 0, h.y, h.z ?? 0);
    head.scale.setScalar(h.r / CHIBI_HEAD_R);
    this.root.add(head);
    head.updateMatrixWorld(true);
    (this.head ?? this.root).attach(head); // keeps where it is, then follows the head
    // Body parts follow the chest: the chibi's neck ring lands on this neck.
    const n = this.neckInfo ?? { x: h.x, y: h.y - h.r * 1.05, z: h.z, r: h.r * 0.9 };
    const k = n.r / CHIBI_NECK_R;
    const body = new THREE.Group();
    body.position.set(n.x ?? 0, n.y - CHIBI_NECK_Y * k, n.z ?? 0);
    body.scale.setScalar(k);
    this.root.add(body);
    body.updateMatrixWorld(true);
    let chest: THREE.Object3D | null = null;
    this.root.traverse((o) => {
      if (!chest && (o as THREE.Bone).isBone && /^(Spine02|Chest|Spine2|UpperChest)$/i.test(o.name)) chest = o;
    });
    (chest ?? this.head ?? this.root).attach(body);
    return {
      head,
      body,
      armR: this.handAnchor(),
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
    };
  }

  /** Put something in the right hand (e.g. a pillow); it follows the hand. */
  holdInHand(obj: THREE.Object3D) {
    obj.position.set(0, -0.05, 0.12);
    this.handAnchor().add(obj);
  }

  private hand: THREE.Group | null = null;
  /** A metre-scaled, character-aligned group on the right hand bone. */
  private handAnchor() {
    if (this.hand) return this.hand;
    let bone: THREE.Object3D | null = null;
    this.root.traverse((o) => {
      if (!bone && (o as THREE.Bone).isBone && /^R_Hand$|RightHand$/i.test(o.name)) bone = o;
    });
    this.root.updateMatrixWorld(true);
    const anchor = new THREE.Group();
    const at = new THREE.Vector3();
    (bone ?? this.root).getWorldPosition(at);
    anchor.position.copy(this.root.worldToLocal(at));
    this.root.add(anchor);
    anchor.updateMatrixWorld(true);
    (bone ?? this.root).attach(anchor);
    this.hand = anchor;
    return anchor;
  }

  /** Companion actions (same names as the procedural creatures). */
  act(action: Action, seconds: number) {
    if (action === 'none') return void (this.emoteTime = 0);
    const map: Record<Exclude<Action, 'none'>, Emote> = { wave: 'wave', dance: 'dance', cheer: 'cheer', sing: 'sing', roar: 'cheer', swing: 'wave' };
    this.emote(map[action], seconds || undefined);
  }

  update(dt: number, speed: number) {
    if (this.emoteTime > 0) {
      this.emoteTime -= dt;
      if (speed > 0.05) this.emoteTime = 0; // walking cancels the emote
    }
    // Smooth the speed and use hysteresis, so stop-and-go (a companion keeping
    // its distance) doesn't restart the walk every few frames.
    this.moveSpeed = THREE.MathUtils.damp(this.moveSpeed, speed, 10, dt);
    this.moving = this.moving ? this.moveSpeed > 0.08 : this.moveSpeed > 0.3;
    let state: State;
    if (this.emoteTime > 0 && this.emoteState) state = this.emoteState;
    else if (this.pose !== 'stand' && this.actions.has('sit')) state = 'sit';
    else if (this.moving && this.moveSpeed > RUN_THRESHOLD && this.actions.has('run')) state = 'run';
    else if (this.moving) state = 'walk';
    else state = 'idle';
    this.play(state, 0.25);

    // Step as fast as we travel (within reason), so feet don't slide.
    const v = Math.max(this.moveSpeed, 0.3);
    const walk = this.actions.get('walk');
    if (walk) walk.timeScale = THREE.MathUtils.clamp(v / this.walkStride, 0.6, 2.5);
    const run = this.actions.get('run');
    if (run) run.timeScale = THREE.MathUtils.clamp(v / this.runStride, 0.6, 2.2);
    // Undo last frame's head turn first: a clip without a head track wouldn't overwrite it.
    if (this.head && this.headBase) this.head.quaternion.copy(this.headBase);
    this.mixer.update(dt);

    // Sleep: the sitting pose tipped onto its side, curled up.
    const lie = this.pose === 'sleep' && state === 'sit' ? 1 : 0;
    this.lie += (lie - this.lie) * Math.min(1, dt * 4);
    this.body.rotation.z = this.lie * 1.35;
    this.body.position.y = this.lie * this.height * 0.2;

    // Head turn on top of the animation, about the character's up axis.
    const want = this.lookYaw === null || this.lie > 0.5 ? 0 : THREE.MathUtils.clamp(this.lookYaw, -1, 1);
    this.headYaw += (want - this.headYaw) * Math.min(1, dt * 6);
    this.headBase = null;
    if (this.head?.parent && Math.abs(this.headYaw) > 1e-3) {
      this.headBase = this.head.quaternion.clone();
      const parentQ = this.head.parent.getWorldQuaternion(new THREE.Quaternion());
      const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rootQ);
      const turn = new THREE.Quaternion().setFromAxisAngle(up, this.headYaw);
      // local' = parent^-1 * turn * parent * local
      this.head.quaternion.premultiply(parentQ.clone().invert().multiply(turn).multiply(parentQ));
    }
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

/**
 * Tripo's "in place" walk and run still carry the hips forward (0.6 m per
 * walk cycle, 1.35 m per run cycle), so on every loop the body jumped back
 * to the start. Remove any steady drift from position tracks (the hips' bob
 * and sway stay); the game moves the character itself.
 */
function removeDrift(clip: THREE.AnimationClip): THREE.AnimationClip {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('.position')) continue;
    const { times, values } = track;
    const n = times.length, span = times[n - 1] - times[0];
    if (n < 2 || span <= 0) continue;
    for (let axis = 0; axis < 3; axis++) {
      const drift = values[(n - 1) * 3 + axis] - values[axis];
      if (Math.abs(drift) < 0.02) continue;
      for (let i = 0; i < n; i++) values[i * 3 + axis] -= drift * ((times[i] - times[0]) / span);
    }
  }
  return clip;
}

/**
 * Ground speed of an in-place walk/run clip: how fast a foot slides back
 * relative to the hips, averaged over the clip (forward = the axis the feet
 * travel along most). Null if the rig has no Hip / L_Foot.
 */
function strideSpeed(model: THREE.Object3D, action: THREE.AnimationAction | undefined): number | null {
  const hip = model.getObjectByName('Hip'), foot = model.getObjectByName('L_Foot');
  if (!action || !hip || !foot) return null;
  const clip = action.getClip();
  const mixer = new THREE.AnimationMixer(model);
  const probe = mixer.clipAction(clip);
  probe.play();
  const steps = 60, dt = clip.duration / steps;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), rel: THREE.Vector3[] = [];
  for (let i = 0; i <= steps; i++) {
    mixer.setTime(i * dt);
    model.updateMatrixWorld(true);
    rel.push(foot.getWorldPosition(a).clone().sub(hip.getWorldPosition(b)));
  }
  probe.stop();
  mixer.uncacheRoot(model);
  const span = (k: 'x' | 'z') => Math.max(...rel.map((v) => v[k])) - Math.min(...rel.map((v) => v[k]));
  const axis = span('x') > span('z') ? 'x' : 'z';
  let travel = 0;
  for (let i = 1; i < rel.length; i++) travel += Math.abs(rel[i][axis] - rel[i - 1][axis]);
  const speed = travel / clip.duration;
  return speed > 0.05 ? speed : null;
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
