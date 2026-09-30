import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ChibiBear } from '../character/ChibiBear';
import type { Character, Emote } from '../character/Character';
import { loadGltfCharacter, type ModelEntry } from '../character/GltfCharacter';
import modelsJson from '../data/models.json';
import { Diorama } from '../scenery/Diorama';
import type { SceneEnv, Environment } from '../scenery/Environment';
import type { BearInfo } from '../character/Companion';
import type { Anchor } from '../scenery/kit';
import type { Creature } from '../character/creatures';
import { lookFor } from '../data/themeLooks';
import { Input } from './Input';
import type { GameCtx } from '../games/types';
import type { GameHud } from '../ui/GameHud';

const WALK_SPEED = 2.6;
const RUN_SPEED = 4.5;
/** What the game needs from a world: a scene diorama or the multiplayer lounge. */
export interface World {
  readonly group: THREE.Group;
  readonly walkable: THREE.Object3D[];
  readonly walkRadius: number;
  readonly environment: Environment;
  readonly anchors: Record<string, Anchor>;
  readonly companionCreatures: Creature[];
  clampToWalkable(p: THREE.Vector3): void;
  update(dt: number, bear: BearInfo): void;
  dispose(): void;
}

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** Number keys play emotes (a mini-game that uses a key gets it first). */
const EMOTE_KEYS: Record<string, Emote> = { '1': 'dance', '2': 'cheer', '3': 'sing', '4': 'clap' };
const CAM_TARGET_Y = 2.4; // aim above the bear: island low in frame, backdrop above it

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 500);
  private controls: OrbitControls;
  private timer = new THREE.Timer();
  private input: Input;
  private raycaster = new THREE.Raycaster();

  private sun = new THREE.DirectionalLight();
  private hemi = new THREE.HemisphereLight();
  private bear: Character = new ChibiBear();
  private diorama: World | null = null;
  /** False while spectating (lounge without an avatar): no walking, no bear. */
  controlsEnabled = true;
  private moveTarget: THREE.Vector3 | null = null;
  private targetMarker: THREE.Mesh;
  private stuckTime = 0;
  private waves = 0;
  private bearSpeed = 0;

  /** Mini-game objects live here (cleared when a game ends). */
  readonly gameRoot = new THREE.Group();
  /** Hooks for the mini-games: return true to swallow the click / key. */
  pointerHook: ((p: THREE.Vector3 | null) => boolean) | null = null;
  keyHook: ((key: string) => boolean) | null = null;
  frameHooks: ((dt: number) => void)[] = [];

  /** 'showcase' = menu background (slow orbit), 'play' = player controls the bear. */
  mode: 'showcase' | 'play' = 'showcase';

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);

    this.camera.position.set(0, 4, 9);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 16;
    this.controls.maxPolarAngle = Math.PI * 0.5; // down to eye level, to look across at the backdrop
    this.controls.target.set(0, CAM_TARGET_Y, 0);

    this.sun.position.set(8, 14, 6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -14;
    sc.right = sc.top = 14;
    this.scene.add(this.sun, this.hemi, this.bear.root);

    this.targetMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.3, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 }),
    );
    this.targetMarker.rotation.x = -Math.PI / 2;
    this.targetMarker.visible = false;
    this.scene.add(this.targetMarker, this.gameRoot);

    this.input = new Input(this.renderer.domElement, (x, y) => this.onClickGround(x, y));
    this.input.onKey = (key) => {
      if (this.mode !== 'play') return;
      if (this.keyHook?.(key)) return;
      if (key === 'e') this.bear.pose = this.bear.pose === 'sit' ? 'stand' : 'sit';
      if (key === 'q') {
        this.bear.wave();
        this.waves++;
      }
      const emote = EMOTE_KEYS[key];
      if (emote) this.bear.emote(emote);
    };

    addEventListener('resize', () => this.resize());
    this.resize();
    this.loadInstalledModel('bear');
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /**
   * Replace the procedural bear with a GLB model if one is installed
   * (public/models, listed in src/data/models.json by tools/check_models.py).
   */
  private async loadInstalledModel(name: string) {
    const entry = (modelsJson as Record<string, ModelEntry>)[name];
    if (!entry) return;
    try {
      const next = await loadGltfCharacter(entry);
      const old = this.bear;
      next.root.position.copy(old.root.position);
      next.root.rotation.copy(old.root.rotation);
      next.pose = old.pose;
      this.scene.remove(old.root);
      old.dispose?.();
      this.scene.add(next.root);
      this.bear = next;
    } catch (e) {
      console.warn(`Model "${name}" failed to load; keeping the procedural bear.`, e);
    }
  }

  /** The character the player controls. */
  get player(): Character {
    return this.bear;
  }

  /** Where the player is walking to after a click, if anywhere. */
  get walkTarget(): THREE.Vector3 | null {
    return this.moveTarget;
  }

  /** Replace the controlled character (e.g. with a lounge avatar); keeps its position. */
  setCharacter(next: Character) {
    const old = this.bear;
    next.root.position.copy(old.root.position);
    next.root.rotation.copy(old.root.rotation);
    this.scene.remove(old.root);
    old.dispose?.();
    this.scene.add(next.root);
    this.bear = next;
  }

  /** Point the camera from `position` at `target`. */
  setView(position: THREE.Vector3, target: THREE.Vector3) {
    this.camera.position.copy(position);
    this.controls.target.copy(target);
    this.controls.update();
  }

  /** Put the camera behind the player at the usual play distance. */
  focusPlayer() {
    const p = this.bear.root.position;
    this.setView(new THREE.Vector3(p.x, CAM_TARGET_Y + 1.2, p.z + 8), new THREE.Vector3(p.x, CAM_TARGET_Y, p.z));
  }

  /** Back to the hero bear (after the lounge), upgrading to the GLB model if installed. */
  resetCharacter() {
    this.setCharacter(new ChibiBear());
    this.loadInstalledModel('bear');
  }

  /** Move the player instantly (server corrections, knockbacks); the camera follows. */
  nudgePlayer(dx: number, dz: number) {
    const root = this.bear.root;
    const before = root.position.clone();
    root.position.x += dx;
    root.position.z += dz;
    this.diorama?.clampToWalkable(root.position);
    const moved = root.position.clone().sub(before);
    this.camera.position.add(moved);
    this.controls.target.add(moved);
    this.moveTarget = null;
    this.targetMarker.visible = false;
  }

  /** Everything a mini-game needs from the world, or null outside a scene. */
  gameContext(hud: GameHud): GameCtx | null {
    const d = this.diorama;
    if (!d) return null;
    this.gameRoot.clear();
    return {
      root: this.gameRoot,
      bear: this.bear,
      walkRadius: d.walkRadius,
      clamp: (p) => d.clampToWalkable(p),
      rand: Math.random, // games should differ each round
      anchors: d.anchors,
      companions: d.companionCreatures,
      hud,
      camera: this.camera,
    };
  }

  /** Swap the diorama. `seed` varies prop layout per scene. */
  loadScene(themeId: string, seed: string, env: SceneEnv, backdropUrl?: string) {
    this.setWorld(new Diorama(lookFor(themeId), seed, env, backdropUrl));
  }

  /** Swap in any world (a scene diorama or the lounge) and reset the player. */
  setWorld(world: World) {
    if (this.diorama) {
      this.scene.remove(this.diorama.group);
      this.diorama.dispose();
    }
    this.diorama = world;
    this.scene.add(world.group);
    world.environment.applyLighting(this.scene, this.sun, this.hemi);

    this.bear.root.position.set(0, 0, 0);
    this.bear.root.rotation.y = 0;
    this.bear.pose = 'stand';
    this.moveTarget = null;
    this.controls.target.set(0, CAM_TARGET_Y, 0);
  }

  setMode(mode: 'showcase' | 'play') {
    this.mode = mode;
    this.controls.autoRotate = mode === 'showcase';
    this.controls.autoRotateSpeed = 0.6;
    this.moveTarget = null;
    this.targetMarker.visible = false;
    const offset = this.camera.position.clone().sub(this.controls.target);
    // Shallow angle so the island sits in the lower part of the frame and the
    // painted backdrop fills the rest.
    offset.y = 0;
    // Menus pull far back so the whole floating island is visible.
    this.controls.maxDistance = mode === 'play' ? 16 : 40;
    offset.setLength(mode === 'play' ? 8 : 28);
    offset.y = mode === 'play' ? 1.2 : 2;
    this.camera.position.copy(this.controls.target).add(offset);
  }

  private resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private onClickGround(clientX: number, clientY: number) {
    if (this.mode !== 'play' || !this.diorama || !this.controlsEnabled) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    if (this.pointerHook) {
      const ground = this.raycaster.ray.intersectPlane(GROUND, new THREE.Vector3());
      if (this.pointerHook(ground)) return;
    }
    const hit = this.raycaster.intersectObjects(this.diorama.walkable, false)[0];
    if (!hit) return;
    const p = hit.point.clone().setY(0);
    this.diorama.clampToWalkable(p);
    this.moveTarget = p;
    this.bear.pose = 'stand';
    this.targetMarker.position.set(p.x, 0.02, p.z);
    this.targetMarker.visible = true;
  }

  private tick() {
    this.timer.update();
    const dt = Math.min(this.timer.getDelta(), 0.05);
    this.bear.root.visible = this.controlsEnabled || this.mode !== 'play';
    const speed = this.mode === 'play' && this.controlsEnabled ? this.movePlayer(dt) : 0;
    this.bear.update(dt, speed);
    this.bearSpeed = speed;
    this.diorama?.update(dt, { pos: this.bear.root.position, speed: this.bearSpeed, waves: this.waves });
    for (const hook of this.frameHooks) hook(dt);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  /** Moves the bear from keyboard or click target; returns current speed. */
  private movePlayer(dt: number): number {
    const root = this.bear.root;
    const dir = new THREE.Vector3();
    const { x, y } = this.input.axis();
    if (x !== 0 || y !== 0) {
      // Camera-relative: forward = away from camera on the ground plane.
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const right = new THREE.Vector3().crossVectors(fwd, THREE.Object3D.DEFAULT_UP);
      dir.addScaledVector(fwd, y).addScaledVector(right, x);
      this.moveTarget = null;
      this.targetMarker.visible = false;
    } else if (this.moveTarget) {
      dir.subVectors(this.moveTarget, root.position).setY(0);
      if (dir.length() < 0.15) {
        this.moveTarget = null;
        this.targetMarker.visible = false;
        dir.set(0, 0, 0);
      }
    }
    if (dir.lengthSq() === 0) return 0;
    if (this.bear.pose === 'sit') this.bear.pose = 'stand';

    dir.normalize();
    const speed = this.input.running ? RUN_SPEED : WALK_SPEED;
    const before = root.position.clone();
    root.position.addScaledVector(dir, speed * dt);
    this.diorama?.clampToWalkable(root.position);

    // Face movement direction smoothly.
    const targetYaw = Math.atan2(dir.x, dir.z);
    let delta = targetYaw - root.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    root.rotation.y += delta * Math.min(1, dt * 12);

    // Camera follows by the same offset the bear moved.
    const moved = root.position.clone().sub(before);
    this.camera.position.add(moved);
    this.controls.target.add(moved);

    // Give up on a click target if something blocks the way.
    const actual = moved.length() / dt;
    this.stuckTime = actual < speed * 0.2 ? this.stuckTime + dt : 0;
    if (this.stuckTime > 0.4 && this.moveTarget) {
      this.moveTarget = null;
      this.targetMarker.visible = false;
    }
    return actual;
  }
}
