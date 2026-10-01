import * as THREE from 'three';
import { ChibiBear, type ChibiSpec, type ChibiParts, type Action, type Pose } from '../character/ChibiBear';
import { CHIBI } from '../character/creatures';
import type { Character, Emote } from '../character/Character';
import { loadGltfCharacter, type GltfCharacter, type ModelEntry } from '../character/GltfCharacter';
import modelsJson from '../data/models.json';

// The lounge's 50 avatars: the game's 5 characters (3D models from
// public/models) x 10 accessories, one per slot, so every player on the island
// looks different. Slot n -> species n % 5, accessory floor(n / 5). The
// accessories are code-built and pinned to the model's head bone, so no new
// models are needed. Until a model loads (or if it can't), the procedural
// chibi of the same species stands in, wearing the same accessory.

const SPECIES = ['bear', 'fox', 'capybara', 'cat_idol', 'moon_bunny'];
const MODELS = modelsJson as Record<string, ModelEntry>;

type Accessory = (p: ChibiParts) => void;
const torus = (r: number, t: number) => new THREE.TorusGeometry(r, t, 8, 20);

const ACCESSORIES: { name: string; add: Accessory }[] = [
  { name: 'red scarf', add: ({ body, part }) => part(body, torus(0.3, 0.08), '#d9473f', [0, 0.82, 0], { rot: [Math.PI / 2, 0, 0] }) },
  { name: 'blue beanie', add: ({ head, part }) => { part(head, new THREE.SphereGeometry(0.46, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#3f6fb5', [0, 0.12, -0.02]); part(head, new THREE.SphereGeometry(0.09, 10, 8), '#ffffff', [0, 0.6, -0.02]); } },
  { name: 'pink bow', add: ({ head, part }) => { for (const s of [-1, 1]) part(head, new THREE.ConeGeometry(0.12, 0.22, 4), '#ff7eb6', [0.12 * s, 0.4, 0.05], { rot: [0, 0, (Math.PI / 2) * s] }); part(head, new THREE.SphereGeometry(0.06, 8, 6), '#ff7eb6', [0, 0.4, 0.05]); } },
  { name: 'headphones', add: ({ head, part }) => { part(head, new THREE.TorusGeometry(0.46, 0.04, 6, 20, Math.PI), '#2a2a32', [0, 0.05, 0], { rot: [0, 0, 0] }); for (const s of [-1, 1]) part(head, new THREE.CylinderGeometry(0.13, 0.13, 0.1, 14), '#ff4fd8', [0.46 * s, 0.02, 0], { rot: [0, 0, Math.PI / 2] }); } },
  { name: 'golden crown', add: ({ head, part }) => { part(head, new THREE.CylinderGeometry(0.2, 0.22, 0.14, 8, 1, true), '#f2c230', [0, 0.47, 0]); for (let i = 0; i < 5; i++) part(head, new THREE.ConeGeometry(0.05, 0.12, 4), '#f2c230', [Math.cos(i * 1.26) * 0.2, 0.58, Math.sin(i * 1.26) * 0.2], { outline: false }); } },
  { name: 'flower', add: ({ head, part }) => { for (let i = 0; i < 5; i++) part(head, new THREE.SphereGeometry(0.06, 8, 6), '#ffd36e', [0.28 + Math.cos(i * 1.26) * 0.07, 0.36 + Math.sin(i * 1.26) * 0.07, 0.2], { outline: false }); part(head, new THREE.SphereGeometry(0.045, 8, 6), '#e0873a', [0.28, 0.36, 0.22], { outline: false }); } },
  { name: 'green cap', add: ({ head, part }) => { part(head, new THREE.SphereGeometry(0.45, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.4), '#4f8f3a', [0, 0.1, 0]); part(head, new THREE.CylinderGeometry(0.28, 0.28, 0.03, 16, 1, false, -Math.PI / 2, Math.PI), '#3a6a2a', [0, 0.26, 0.28]); } },
  { name: 'purple bandana', add: ({ head, part }) => part(head, new THREE.TorusGeometry(0.44, 0.05, 6, 24), '#8f5fa8', [0, 0.18, 0], { rot: [Math.PI / 2 - 0.25, 0, 0] }) },
  { name: 'round glasses', add: ({ head, part }) => { for (const s of [-1, 1]) part(head, torus(0.08, 0.015), '#2a2a2a', [0.16 * s, 0.07, 0.43], { outline: false }); part(head, new THREE.BoxGeometry(0.1, 0.015, 0.015), '#2a2a2a', [0, 0.08, 0.44], { outline: false }); } },
  { name: 'party hat', add: ({ head, part }) => { part(head, new THREE.ConeGeometry(0.18, 0.45, 12), '#38c1e0', [0.05, 0.62, 0], { rot: [0, 0, -0.15] }); part(head, new THREE.SphereGeometry(0.06, 8, 6), '#ffd36e', [0.09, 0.86, 0], { outline: false }); } },
];

const speciesOf = (slot: number) => SPECIES[slot % SPECIES.length];
const accessoryOf = (slot: number) => ACCESSORIES[Math.floor(slot / SPECIES.length) % ACCESSORIES.length];

export function avatarLabel(slot: number) {
  return `${accessoryOf(slot).name} ${speciesOf(slot).replace('_', ' ')}`;
}

/** Procedural stand-in: the species' chibi wearing the slot's accessory. */
export function avatarSpec(slot: number): ChibiSpec {
  const base = CHIBI[speciesOf(slot)] ?? CHIBI.bear;
  const acc = accessoryOf(slot);
  return {
    ...base,
    size: 1,
    extras: (p) => {
      base.extras?.(p);
      acc.add(p);
    },
  };
}

/**
 * An avatar's body: starts as the procedural chibi and swaps to the 3D model
 * (same accessory, pillow moved to the new hand) once it has loaded. The game
 * and the lounge only ever hold this wrapper, so the swap is invisible to them.
 */
class AvatarBody implements Character {
  readonly root = new THREE.Group();
  private body: ChibiBear | GltfCharacter;
  private held: THREE.Object3D | null = null;

  constructor(slot: number) {
    const chibi = new ChibiBear(avatarSpec(slot));
    this.body = chibi;
    this.root.add(chibi.root);
    const entry = MODELS[speciesOf(slot)];
    if (!entry) return;
    // Up to 50 at once: use the light copy (its file also holds the idle clip).
    const lite = entry.lite ? { ...entry, file: entry.lite, clips: { ...entry.clips, idle: entry.lite } } : entry;
    loadGltfCharacter(lite).then(
      (model) => {
        accessoryOf(slot).add(model.attachParts());
        model.pose = this.body.pose;
        if (this.held) model.holdInHand(this.held);
        this.root.remove(this.body.root);
        this.root.add(model.root);
        this.body = model;
      },
      (e) => console.warn(`Avatar model "${entry.file}" failed to load; keeping the chibi.`, e),
    );
  }

  get pose() { return this.body.pose; }
  set pose(p: Pose) { this.body.pose = p; }
  wave() { this.body.wave(); }
  emote(name: Emote) { this.body.emote(name); }
  act(action: Action, seconds: number) { this.body.act(action, seconds); }
  update(dt: number, speed: number) { this.body.update(dt, speed); }

  holdInHand(obj: THREE.Object3D) {
    this.held = obj;
    this.body.holdInHand(obj);
  }
}

/** A lounge avatar: body + name tag + pillow for pillow fights. */
export class Avatar {
  readonly char: AvatarBody;
  readonly pillow: THREE.Mesh;
  private tag: THREE.Sprite;

  constructor(readonly slot: number, name: string, mine = false) {
    this.char = new AvatarBody(slot);
    this.tag = nameTag(name, mine);
    this.tag.position.y = 2.05;
    this.char.root.add(this.tag);
    this.pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.38), new THREE.MeshToonMaterial({ color: '#f7f2ff' }));
    this.pillow.visible = false;
    this.char.holdInHand(this.pillow);
  }

  setName(name: string, mine = false) {
    this.char.root.remove(this.tag);
    this.tag = nameTag(name, mine);
    this.tag.position.y = 2.05;
    this.char.root.add(this.tag);
  }
}

function nameTag(name: string, mine: boolean) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 30px "Baloo 2", sans-serif';
  const text = name.slice(0, 18);
  const w = Math.min(248, g.measureText(text).width + 28);
  g.fillStyle = mine ? 'rgba(255,197,107,0.95)' : 'rgba(28,20,26,0.75)';
  g.beginPath();
  g.roundRect((256 - w) / 2, 8, w, 46, 23);
  g.fill();
  g.fillStyle = mine ? '#2a1a10' : '#fff8ee';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1);
  s.renderOrder = 4;
  return s;
}
