import * as THREE from 'three';
import { toonMaterial } from '../engine/toon';
import type { ThemeLook } from '../data/themeLooks';

// Everything around the sky island: the sky dome (colours sampled from the
// scene's video by tools/analyze_scenes.py), sun / moon / stars / sky clouds
// by time of day, the world far below the island, and the scene lighting.

export type TimeOfDay = 'day' | 'sunset' | 'night';
export type Below = 'clouds' | 'sea' | 'lake' | 'storm' | 'space' | 'snow' | 'city' | 'mountains' | 'forest' | 'fields' | 'desert';

export interface SceneEnv {
  time: TimeOfDay;
  below: Below;
  weather: 'rain' | 'snow' | 'petals' | 'fireflies' | 'sparks' | 'none';
  skyTop: string;
  skyBottom: string;
  /** Colours sampled from the painting: foliage, and (outdoor islands) the ground and cliff. */
  leaf?: string;
  ground?: string;
  groundSide?: string;
  /** Island layout (templates.ts) and, for landmarks, which landmark. */
  island?: import('./templates').IslandKind;
  variant?: string;
  /** Secondary character (creatures.ts kind) and its script (Companion.ts). */
  companion?: string;
  behavior?: import('../character/Companion').Behavior;
  /** Several companions (first is the main one); replaces companion/behavior. */
  companions?: import('../character/Companion').CastEntry[];
  /** The scene's mini-game (engine + variant, see src/games/catalog.ts). */
  game?: import('../games/types').GameRef;
}

const BELOW_Y = -20; // height of the world below the island
const SKY_R = 190;

// Azimuth 0 = straight ahead of the default camera (where the backdrop hangs).
function dirFrom(azimuth: number, elevation: number) {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  );
}

export class Environment {
  readonly group = new THREE.Group();
  private updaters: ((t: number, dt: number) => void)[] = [];
  private t = 0;
  private hemi: THREE.HemisphereLight | null = null;
  private hemiBase = 1;
  private lightDir: THREE.Vector3;
  private top: THREE.Color;
  private bottom: THREE.Color;

  constructor(readonly env: SceneEnv, private look: ThemeLook, private rand: () => number) {
    this.top = new THREE.Color(env.skyTop);
    this.bottom = new THREE.Color(env.skyBottom);
    if (env.below === 'space') {
      // Space is always a star field, whatever the frame looked like.
      this.top.lerp(new THREE.Color('#0b0f2a'), 0.7);
      this.bottom.lerp(new THREE.Color('#1c2350'), 0.6);
    }
    const night = env.time === 'night' || env.below === 'space';

    this.buildSky();
    if (night) {
      this.buildStars(env.below === 'space');
      this.lightDir = dirFrom(0.66, 0.25);
      this.buildGlowDisc(this.lightDir, 14, '#f4f1dc', '#9fb4ff');
    } else {
      this.lightDir = env.time === 'sunset' ? dirFrom(-0.68, 0.1) : dirFrom(-0.7, 0.75);
      const low = env.time === 'sunset';
      this.buildGlowDisc(low ? dirFrom(-0.68, 0.1) : dirFrom(-0.7, 0.38), low ? 22 : 16, low ? '#ffd9a0' : '#fffbe8', low ? '#ff8a50' : '#fff3c0');
    }
    if (env.below !== 'space') this.buildSkyClouds(night ? 6 : 14);
    this.buildBelow();
  }

  /** Fog + sun + hemisphere light for this environment. */
  applyLighting(scene: THREE.Scene, sun: THREE.DirectionalLight, hemi: THREE.HemisphereLight) {
    const { time, below } = this.env;
    const night = time === 'night' || below === 'space';
    scene.fog = below === 'space' ? null : new THREE.Fog(this.bottom, 70, 300);
    sun.position.copy(this.lightDir).multiplyScalar(22);
    if (night) {
      sun.color.set('#a8bcff');
      sun.intensity = 0.9;
    } else if (time === 'sunset') {
      sun.color.set('#ffb27a');
      sun.intensity = 1.7;
    } else {
      sun.color.set('#fff1d6');
      sun.intensity = 2.2;
    }
    hemi.color.copy(this.top).lerp(new THREE.Color('#ffffff'), night ? 0.25 : 0.4);
    hemi.groundColor.set(this.look.ground);
    this.hemiBase = night ? 1.1 : time === 'sunset' ? 1.3 : 1.5;
    if (below === 'storm') {
      sun.intensity *= 0.5;
      this.hemiBase *= 0.8;
    }
    hemi.intensity = this.hemiBase;
    this.hemi = hemi;
  }

  update(dt: number) {
    this.t += dt;
    for (const u of this.updaters) u(this.t, dt);
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
  }

  // ---------------------------------------------------------------- sky

  private buildSky() {
    const below = this.env.below === 'space'
      ? this.top.clone()
      : this.bottom.clone().multiplyScalar(0.8);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: this.top },
        horizon: { value: this.bottom },
        below: { value: below },
      },
      vertexShader: /* glsl */ `
        varying vec3 vPos;
        void main() { vPos = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 below; varying vec3 vPos;
        void main() {
          float y = normalize(vPos).y;
          vec3 c = y > 0.0 ? mix(horizon, top, smoothstep(0.0, 0.55, y))
                           : mix(horizon, below, smoothstep(0.0, 0.25, -y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.group.add(new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), mat));
  }

  private buildStars(fullSphere: boolean) {
    const n = fullSphere ? 2600 : 1600;
    const pos = new Float32Array(n * 3);
    const phase = new Float32Array(n);
    const size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection();
      if (!fullSphere) v.y = Math.abs(v.y) * 0.95 + 0.02;
      v.normalize().multiplyScalar(SKY_R - 10);
      pos.set([v.x, v.y, v.z], i * 3);
      phase[i] = this.rand() * Math.PI * 2;
      size[i] = 1.5 + Math.pow(this.rand(), 3) * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 } },
      vertexShader: /* glsl */ `
        attribute float phase; attribute float size; uniform float time; varying float vTw;
        void main() {
          vTw = 0.55 + 0.45 * sin(time * (1.0 + phase * 0.3) + phase);
          gl_PointSize = size * (0.7 + 0.3 * vTw);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vTw;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d) * vTw;
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9), a);
        }`,
    });
    const stars = new THREE.Points(geo, mat);
    stars.renderOrder = -2;
    stars.frustumCulled = false;
    this.group.add(stars);
    this.updaters.push((t) => (mat.uniforms.time.value = t));
  }

  /** Sun or moon: a bright disc with a soft halo, as a sprite. */
  private buildGlowDisc(dir: THREE.Vector3, size: number, core: string, halo: string) {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, core);
    grd.addColorStop(0.28, core);
    grd.addColorStop(0.34, halo + 'aa');
    grd.addColorStop(1, halo + '00');
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c), fog: false, depthWrite: false, transparent: true,
    }));
    sprite.position.copy(dir).multiplyScalar(SKY_R - 15);
    sprite.scale.setScalar(size * 2.4);
    sprite.renderOrder = -2;
    this.group.add(sprite);
  }

  private buildSkyClouds(count: number) {
    const { time, below } = this.env;
    const tint = below === 'storm' ? '#6b7280' : time === 'night' ? '#5a6388' : time === 'sunset' ? '#ffd2b8' : '#ffffff';
    const opacity = below === 'storm' ? 0.9 : time === 'night' ? 0.5 : 0.95;
    const tex = cloudTexture();
    const clouds: { s: THREE.Sprite; az: number; el: number; speed: number }[] = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: tint, opacity, fog: false, depthWrite: false, transparent: true,
      }));
      const w = 30 + this.rand() * 40;
      s.scale.set(w, w * 0.45, 1);
      s.renderOrder = -2;
      const c = { s, az: this.rand() * Math.PI * 2, el: 0.03 + this.rand() * 0.28, speed: 0.004 + this.rand() * 0.006 };
      clouds.push(c);
      this.group.add(s);
    }
    this.updaters.push((_, dt) => {
      for (const c of clouds) {
        c.az += c.speed * dt;
        c.s.position.copy(dirFrom(c.az, c.el)).multiplyScalar(SKY_R - 25);
      }
    });
    this.updaters[this.updaters.length - 1](0, 0);
  }

  // ---------------------------------------------------------------- below

  private buildBelow() {
    const { below, time } = this.env;
    const night = time === 'night';
    switch (below) {
      case 'clouds': return this.cloudSea(night ? '#3a4466' : time === 'sunset' ? '#ffd7c2' : '#ffffff', 260);
      case 'sea': return this.water(this.look.water, 0.7, 1);
      case 'lake': return this.water(this.look.water, 0.18, 0.4);
      case 'storm': return this.storm();
      case 'space': return this.space();
      case 'snow': return this.landscape('#eef3fb', 5, '#e9f0f7', 260, 'pine');
      case 'forest': return this.landscape('#4f7a3a', 4, '#2f5d34', 700, 'pine');
      case 'fields': return this.landscape(time === 'sunset' ? '#d8b25a' : '#a9c46a', 3, '#4f7d3c', 320, 'round');
      case 'desert': return this.desert();
      case 'mountains': return this.mountains();
      case 'city': return this.city(night);
    }
  }

  private cloudSea(color: string, count: number, y = BELOW_Y + 3) {
    const puff = new THREE.IcosahedronGeometry(1, 1);
    const mesh = new THREE.InstancedMesh(puff, toonMaterial(color), count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 16 + Math.sqrt(this.rand()) * 170;
      const s = 3 + this.rand() * 6;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, y + (this.rand() - 0.5) * 3, Math.sin(a) * r),
        q.setFromEuler(new THREE.Euler(0, this.rand() * 6, 0)),
        new THREE.Vector3(s * (1.2 + this.rand()), s * 0.5, s),
      );
      mesh.setMatrixAt(i, m);
    }
    this.group.add(mesh);
    let drift = 0;
    this.updaters.push((_, dt) => {
      drift += dt * 0.004;
      mesh.rotation.y = drift;
    });
  }

  /** Animated toon water; amplitude/choppiness pick lake, sea or storm. */
  private water(color: string, amp: number, chop: number, dark = false) {
    const base = new THREE.Color(color);
    if (this.env.time === 'night' || dark) base.multiplyScalar(0.45);
    const deep = base.clone().multiplyScalar(0.55).lerp(this.bottom, 0.15);
    const shallow = base.clone().lerp(this.bottom, 0.3);
    const fog = this.env.below === 'space' ? this.top : this.bottom;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 }, amp: { value: amp }, chop: { value: chop },
        deep: { value: deep }, shallow: { value: shallow }, foam: { value: new THREE.Color(dark ? '#aab4c0' : '#ffffff') },
        fogColor: { value: fog },
      },
      vertexShader: /* glsl */ `
        uniform float time; uniform float amp; uniform float chop; varying float vH; varying float vDist;
        void main() {
          vec3 p = position;
          float h = sin(p.x * 0.05 * chop + time * 0.8) * 0.6
                  + sin(p.y * 0.07 * chop - time * 1.1) * 0.5
                  + sin((p.x + p.y) * 0.13 * chop + time * 1.7) * 0.3;
          p.z += h * amp;
          vH = h;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDist = -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 deep; uniform vec3 shallow; uniform vec3 foam; uniform vec3 fogColor;
        varying float vH; varying float vDist;
        void main() {
          float band = floor((vH * 0.5 + 0.5) * 3.0) / 2.0;       // 3 toon steps
          vec3 c = mix(deep, shallow, clamp(band, 0.0, 1.0));
          c = mix(c, foam, smoothstep(1.05, 1.25, vH) * 0.8);        // crest foam
          c = mix(c, fogColor, smoothstep(60.0, 280.0, vDist));
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(640, 640, 180, 180), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = BELOW_Y;
    this.group.add(plane);
    this.updaters.push((t) => (mat.uniforms.time.value = t));
  }

  private storm() {
    this.water('#2f4a5c', 1.8, 1.3, true);
    this.cloudSea('#59606e', 90, BELOW_Y + 10);
    // Lightning: rare double flashes of the ambient light.
    let next = 3 + this.rand() * 5;
    this.updaters.push((t) => {
      if (!this.hemi) return;
      const since = t - next;
      if (since > 0.45) next = t + 4 + Math.random() * 8;
      const flash = since > 0 && (since < 0.08 || (since > 0.18 && since < 0.3));
      this.hemi.intensity = this.hemiBase * (flash ? 3.2 : 1);
    });
  }

  private space() {
    // A ringed planet drifting below, plus the island's own floating rocks.
    const planet = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(38, 48, 32), toonMaterial(this.look.accent));
    const bands = new THREE.Mesh(
      new THREE.SphereGeometry(38.3, 48, 32, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.12),
      toonMaterial(new THREE.Color(this.look.accent).multiplyScalar(0.7)),
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(48, 66, 96),
      new THREE.MeshBasicMaterial({ color: '#e8d9b5', side: THREE.DoubleSide, transparent: true, opacity: 0.55, fog: false }),
    );
    ring.rotation.x = Math.PI / 2.3;
    planet.add(body, bands, ring);
    planet.position.set(-70, -75, -60);
    planet.rotation.z = 0.35;
    this.group.add(planet);
    this.updaters.push((_, dt) => (body.rotation.y += dt * 0.02));
  }

  /** Rolling terrain far below, dotted with instanced trees. */
  private landscape(ground: string, hills: number, tree: string, trees: number, kind: 'pine' | 'round') {
    const geo = new THREE.PlaneGeometry(640, 640, 120, 120);
    const p = geo.attributes.position;
    const s1 = this.rand() * 10, s2 = this.rand() * 10;
    const height = (x: number, y: number) =>
      (Math.sin(x * 0.03 + s1) + Math.sin(y * 0.025 + s2) + Math.sin((x - y) * 0.05) * 0.5) * hills;
    // Patchwork colours (fields / meadows / snowdrifts seen from above).
    const colors = new Float32Array(p.count * 3);
    const base = new THREE.Color(ground);
    const alt = base.clone().offsetHSL(0.04, 0.05, -0.1);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, height(x, y));
      const patch = Math.sin(x * 0.09 + s2) * Math.sin(y * 0.11 + s1);
      c.copy(base).lerp(alt, patch > 0.25 ? 0.8 : patch < -0.4 ? 0.35 : 0);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const land = new THREE.Mesh(geo, toonMaterial('#ffffff', { vertexColors: true }));
    land.rotation.x = -Math.PI / 2;
    land.position.y = BELOW_Y - 4;
    this.group.add(land);

    const treeGeo = kind === 'pine' ? new THREE.ConeGeometry(1.4, 4.5, 7) : new THREE.IcosahedronGeometry(1.8, 0);
    const mesh = new THREE.InstancedMesh(treeGeo, toonMaterial('#ffffff'), trees);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const baseCol = new THREE.Color(tree);
    for (let i = 0; i < trees; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 20 + Math.sqrt(this.rand()) * 220;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const sc = 0.7 + this.rand() * 0.9;
      // Plane was rotated -90° about X, so its local y maps to world -z.
      const y = BELOW_Y - 4 + height(x, -z) + (kind === 'pine' ? 2 : 1.5) * sc;
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sc, sc, sc));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.copy(baseCol).offsetHSL(0, 0, (this.rand() - 0.5) * 0.12));
    }
    this.group.add(mesh);
  }

  private desert() {
    this.landscape('#e2bb78', 3.5, '#6c8f3f', 25, 'round');
    const mat = toonMaterial('#d9aa62');
    for (const [az, r, s] of [[1.9, 150, 1], [2.3, 175, 0.7], [-2.2, 160, 0.85]]) {
      const pyr = new THREE.Mesh(new THREE.ConeGeometry(22 * s, 26 * s, 4), mat);
      pyr.position.set(Math.sin(az) * r, BELOW_Y + 6 * s, -Math.cos(az) * r);
      pyr.rotation.y = Math.PI / 4;
      this.group.add(pyr);
    }
  }

  private mountains() {
    this.cloudSea(this.env.time === 'night' ? '#3a4466' : '#ffffff', 160, BELOW_Y + 6);
    const rock = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), toonMaterial('#6d7280'), 34);
    const caps = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), toonMaterial('#f4f7fb'), 34);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 34; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 85 + this.rand() * 110;
      const h = 25 + this.rand() * 35;
      const w = h * (0.45 + this.rand() * 0.2);
      const base = BELOW_Y - 12;
      const pos = new THREE.Vector3(Math.cos(a) * r, base + h / 2, Math.sin(a) * r);
      m.compose(pos, q, new THREE.Vector3(w, h, w));
      rock.setMatrixAt(i, m);
      // Snow cap: top 30% of the cone.
      m.compose(pos.clone().setY(base + h * 0.85 + 0.2), q, new THREE.Vector3(w * 0.31, h * 0.3, w * 0.31));
      caps.setMatrixAt(i, m);
    }
    this.group.add(rock, caps);
  }

  private city(night: boolean) {
    const ground = new THREE.Mesh(new THREE.CircleGeometry(320, 48), toonMaterial(night ? '#1d1f2b' : '#6f7482'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = BELOW_Y - 6;
    this.group.add(ground);

    const [map, glow] = windowTextures(this.rand);
    const mat = toonMaterial(night ? '#3a3f55' : '#b8bfcc', {
      map,
      emissive: night ? '#ffc86a' : '#000000',
      emissiveMap: glow,
      emissiveIntensity: night ? 1.1 : 0,
    });
    const n = 420;
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const r = 22 + Math.sqrt(this.rand()) * 230;
      const w = 4 + this.rand() * 6;
      const h = 6 + Math.pow(this.rand(), 2) * 34;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, BELOW_Y - 6 + h / 2, Math.sin(a) * r),
        q.setFromEuler(new THREE.Euler(0, this.rand() * Math.PI, 0)),
        new THREE.Vector3(w, h, w * (0.7 + this.rand() * 0.6)),
      );
      mesh.setMatrixAt(i, m);
    }
    this.group.add(mesh);
  }
}

// ---------------------------------------------------------------- textures

let cloudTex: THREE.Texture | null = null;
function cloudTexture() {
  if (cloudTex) return cloudTex;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d')!;
  const puffs = [[70, 80, 42], [120, 62, 52], [175, 78, 40], [100, 90, 36], [150, 92, 38], [205, 92, 28], [45, 96, 26]];
  for (const [x, y, r] of puffs) {
    const grd = g.createRadialGradient(x, y, r * 0.2, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  cloudTex = new THREE.CanvasTexture(c);
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  return cloudTex;
}

/** Building facade: [colour map, emissive map with only the lit windows]. */
function windowTextures(rand: () => number): [THREE.Texture, THREE.Texture] {
  const make = () => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    return c;
  };
  const a = make(), b = make();
  const ga = a.getContext('2d')!, gb = b.getContext('2d')!;
  ga.fillStyle = '#9aa0aa';
  ga.fillRect(0, 0, 64, 128);
  gb.fillStyle = '#000';
  gb.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 124; y += 12) {
    for (let x = 5; x < 60; x += 11) {
      const lit = rand() < 0.45;
      ga.fillStyle = lit ? '#ffe2a0' : '#39435a';
      ga.fillRect(x, y, 7, 7);
      if (lit) {
        gb.fillStyle = '#fff';
        gb.fillRect(x, y, 7, 7);
      }
    }
  }
  const ta = new THREE.CanvasTexture(a), tb = new THREE.CanvasTexture(b);
  ta.colorSpace = THREE.SRGBColorSpace;
  return [ta, tb];
}
