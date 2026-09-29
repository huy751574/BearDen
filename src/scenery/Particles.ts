import * as THREE from 'three';
import type { Particles as Kind } from '../data/themeLooks';

// Ambient weather/FX particles drifting inside a cylinder around the island.

interface Style {
  count: number;
  size: number;
  color: string | null; // null = use theme accent
  fall: number; // m/s downward (negative rises)
  drift: number;
  glow: boolean;
}

const STYLES: Record<Exclude<Kind, 'none'>, Style> = {
  fireflies: { count: 120, size: 0.14, color: '#fff38a', fall: 0, drift: 0.4, glow: true },
  snow: { count: 600, size: 0.1, color: '#ffffff', fall: 0.8, drift: 0.3, glow: false },
  petals: { count: 250, size: 0.13, color: '#ffb7d0', fall: 0.5, drift: 0.8, glow: false },
  sparks: { count: 200, size: 0.1, color: null, fall: -1.2, drift: 0.5, glow: true },
  stars: { count: 300, size: 0.12, color: null, fall: 0, drift: 0.1, glow: true },
  rain: { count: 900, size: 0.06, color: '#9fc4ff', fall: 9, drift: 0, glow: false },
};

export class Particles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private phase: Float32Array;
  private style: Style;
  private t = 0;
  private height = 10;

  constructor(kind: Exclude<Kind, 'none'>, accent: string, private radius: number) {
    this.style = STYLES[kind];
    const n = this.style.count;
    this.pos = new Float32Array(n * 3);
    this.phase = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.respawn(i, Math.random() * this.height);
      this.phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: this.style.color ?? accent,
      size: this.style.size,
      map: dotTexture(),
      transparent: true,
      depthWrite: false,
      blending: this.style.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  private respawn(i: number, y: number) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * this.radius;
    this.pos[i * 3] = Math.cos(a) * r;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = Math.sin(a) * r;
  }

  update(dt: number) {
    this.t += dt;
    const { fall, drift } = this.style;
    for (let i = 0; i < this.style.count; i++) {
      const k = i * 3;
      const ph = this.phase[i];
      this.pos[k] += Math.sin(this.t * 0.7 + ph) * drift * dt;
      this.pos[k + 2] += Math.cos(this.t * 0.5 + ph) * drift * dt;
      this.pos[k + 1] -= fall * dt + (fall === 0 ? Math.sin(this.t + ph) * 0.2 * dt : 0);
      if (this.pos[k + 1] < -0.5) this.respawn(i, this.height);
      else if (this.pos[k + 1] > this.height) this.respawn(i, 0);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

let dot: THREE.Texture | null = null;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dot = new THREE.CanvasTexture(c);
  return dot;
}
