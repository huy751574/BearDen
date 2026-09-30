import type * as THREE from 'three';

/** One-shot animations the player (and friends) can play. */
export type Emote = 'wave' | 'dance' | 'cheer' | 'sing' | 'clap' | 'victory' | 'hurt';

/** What the game needs from any playable character (procedural or GLB). */
export interface Character {
  readonly root: THREE.Object3D;
  pose: 'stand' | 'sit' | 'sleep';
  wave(): void;
  /** Play an emote; walking cancels it. */
  emote(name: Emote): void;
  /** speed: current horizontal speed in m/s. */
  update(dt: number, speed: number): void;
  dispose?(): void;
}
