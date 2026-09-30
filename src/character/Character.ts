import type * as THREE from 'three';

/** What the game needs from any playable character (procedural or GLB). */
export interface Character {
  readonly root: THREE.Object3D;
  pose: 'stand' | 'sit' | 'sleep';
  wave(): void;
  /** speed: current horizontal speed in m/s. */
  update(dt: number, speed: number): void;
  dispose?(): void;
}
