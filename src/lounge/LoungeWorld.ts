import * as THREE from 'three';
import type { World } from '../engine/Game';
import { Environment, type SceneEnv } from '../scenery/Environment';
import { Kit } from '../scenery/kit';
import { toonMaterial, addOutline } from '../engine/toon';
import { lookFor, type ThemeLook } from '../data/themeLooks';
import * as N from '../scenery/props/nature';
import * as S from '../scenery/props/structures';
import { Particles } from '../scenery/Particles';
import { Effects } from '../games/types';
import type { BearInfo } from '../character/Companion';
import { Avatar } from './avatars';
import { ISLAND_RADIUS, MOVE_LEAD, WALK_RADIUS, type Player, type Song } from './protocol';

// The Bear Den Lounge island: a big cosy floating island under a night sky,
// with a stage + "now playing" screen, sofas, pillow piles and lamps.
// It also draws every *other* player's avatar and animates what the server
// reports (walking, jumps, pillow hits, jumping off the island).

const ENV: SceneEnv = { time: 'night', below: 'clouds', weather: 'fireflies', skyTop: '#23204a', skyBottom: '#7a5a9a' };
const LOOK: ThemeLook = { ...lookFor('relax'), ground: '#8fb86a', groundSide: '#6b5344', accent: '#ffc56b', leaf: '#4a7d4f' };
const WALK_SPEED = 2.6;
const RUN_SPEED = 4.5;

interface Remote {
  av: Avatar;
  x: number;
  z: number;
  tx: number | null;
  tz: number | null;
  /** When the last move message arrived (performance.now()). */
  at: number;
  jumpT: number;
  knock: { dx: number; dz: number; t: number } | null;
  leaving: { phase: 'run' | 'leap'; t: number; edge: THREE.Vector3; dir: THREE.Vector3; y: number; speed: number; up?: number; cry?: string } | null;
  pillowT: number;
}

export class LoungeWorld implements World {
  readonly group = new THREE.Group();
  readonly walkable: THREE.Object3D[] = [];
  readonly walkRadius = WALK_RADIUS;
  readonly environment: Environment;
  readonly companionCreatures = [];
  private kit: Kit;
  private remotes = new Map<number, Remote>();
  /** Avatars on their way off the island; their slot may already be reused. */
  private leavers: Remote[] = [];
  private fx: Effects;
  private fxRoot = new THREE.Group();
  private particles: Particles;
  private screenTex: THREE.CanvasTexture;
  /** The stage screen (ScreenVideo lines the YouTube player up with it). */
  screen!: THREE.Mesh;
  static readonly SCREEN_WIDTH = 7;
  private cardMaterial!: THREE.MeshBasicMaterial;
  /** Writes see-through pixels, so the player behind the canvas shows. */
  private holeMaterial = new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0, blending: THREE.NoBlending, toneMapped: false, fog: false });
  private screenCanvas = document.createElement('canvas');
  private t = 0;
  /** Slot of the local player (drawn by the game as the controlled character). */
  mySlot: number | null = null;

  constructor() {
    const rand = mulberry(20260930);
    this.environment = new Environment(ENV, LOOK, rand);
    this.group.add(this.environment.group);
    this.kit = new Kit(rand, LOOK, ENV, new Set(['lounge']), WALK_RADIUS);
    this.screenCanvas.width = 1024;
    this.screenCanvas.height = 576;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas);
    this.screenTex.colorSpace = THREE.SRGBColorSpace;
    this.buildIsland();
    this.buildProps();
    this.group.add(this.kit.group, this.fxRoot);
    this.fx = new Effects(this.fxRoot);
    this.particles = new Particles('fireflies', LOOK.accent, ISLAND_RADIUS);
    this.group.add(this.particles.points);
    this.setScreen(null);
  }

  get anchors() {
    return this.kit.anchors;
  }

  // ---------------------------------------------------------------- building

  private buildIsland() {
    const top = new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS - 0.4, 0.6, 80), toonMaterial(LOOK.ground));
    top.position.y = -0.3;
    top.receiveShadow = true;
    addOutline(top, 0.05);
    const under = new THREE.Mesh(new THREE.ConeGeometry(ISLAND_RADIUS - 0.3, 12, 28, 4), toonMaterial(LOOK.groundSide));
    under.rotation.x = Math.PI;
    under.position.y = -6.6;
    // Warm wooden deck in the middle, big rug on top.
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.1, 48), toonMaterial('#b98a5e'));
    deck.position.y = 0.05;
    deck.receiveShadow = true;
    const rug = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.03, 48), toonMaterial('#8f5fa8'));
    rug.position.y = 0.11;
    rug.receiveShadow = true;
    const rug2 = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.12, 6, 48), toonMaterial('#ffc56b'));
    rug2.rotation.x = Math.PI / 2;
    rug2.position.y = 0.13;
    this.group.add(top, under, deck, rug, rug2);
    this.walkable.push(top);
  }

  private buildProps() {
    const k = this.kit;
    // Stage with the "now playing" screen, at the back.
    const stage = new THREE.Group();
    k.part(stage, new THREE.CylinderGeometry(4, 4.2, 0.6, 32, 1, false, Math.PI / 2, Math.PI), '#3a2e44', [0, 0.3, 0]);
    k.part(stage, new THREE.BoxGeometry(7.4, 4.3, 0.3), '#1a1520', [0, 3.4, -1.6]);
    this.cardMaterial = new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false });
    const W = LoungeWorld.SCREEN_WIDTH;
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(W, (W * 9) / 16), this.cardMaterial);
    this.screen.position.set(0, 3.4, -1.44);
    stage.add(this.screen);
    for (const s of [-1, 1]) {
      k.part(stage, new THREE.BoxGeometry(0.9, 1.3, 0.7), '#1a1a22', [3.2 * s, 0.95, -0.6]);
      k.light(stage, '#ff7eb6', 2.5, 9, [3.2 * s, 2.5, 0.5]);
    }
    k.put(stage, 0, -12.2, { rotY: 0, block: 0, space: 4.5 });
    for (let x = -3.6; x <= 3.6; x += 1.2) this.kit.blockers.push({ x, z: -12.6, r: 1 });

    // Ring of sofas facing the middle (leaving the stage side open).
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.3 + (i / 6) * Math.PI * 1.4;
      const x = Math.sin(a) * 9.5, z = Math.cos(a) * 9.5;
      k.put(S.sofa(k, ['#6d8fb8', '#b8565e', '#6fa86a', '#c9a24a', '#8f5fa8'][i % 5]), x, z, { rotY: k.faceCenter(x, z), block: 1, space: 1.4 });
    }
    // Pillow piles, lamps, plants.
    const pillowColors = ['#ffb3d1', '#bfe3ff', '#ffe27a', '#c8f0c0', '#e8d0ff', '#ffffff'];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.3, r = 6.3;
      const pile = new THREE.Group();
      for (let j = 0; j < 4; j++) {
        k.part(pile, new THREE.BoxGeometry(0.7, 0.22, 0.5), pillowColors[(i + j) % 6], [(j % 2) * 0.3 - 0.15, 0.12 + j * 0.2, (j % 3) * 0.15 - 0.15], { rot: [0, j * 0.7, 0.08 * (j % 2 ? 1 : -1)] });
      }
      k.put(pile, Math.cos(a) * r, Math.sin(a) * r, { rotY: a, block: 0.5 });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.put(S.floorLamp(k), Math.cos(a) * 11.8, Math.sin(a) * 11.8, { block: 0.3 });
    }
    // String lights between the lamps.
    for (let i = 0; i < 8; i++) {
      const a1 = (i / 8) * Math.PI * 2, a2 = ((i + 1) / 8) * Math.PI * 2;
      const p1 = new THREE.Vector3(Math.cos(a1) * 11.8, 1.9, Math.sin(a1) * 11.8);
      const p2 = new THREE.Vector3(Math.cos(a2) * 11.8, 1.9, Math.sin(a2) * 11.8);
      this.kit.group.add(S.lanternString(k, p1, p2, 7, i % 2 ? '#ffc56b' : '#ff7eb6'));
    }
    k.scatter(12, 0.8, () => N.roundTree(k, k.pick(['#4a7d4f', '#f5a0b8', '#5f9a45'])), { minR: 13, maxR: WALK_RADIUS + 0.6, block: 0.5 });
    k.scatter(10, 0.6, () => N.bush(k), { minR: 12.5, block: 0.4 });
    for (let i = 0; i < 6; i++) {
      const s = k.spot(1, { minR: 12, tall: false });
      if (s) k.put(N.flowers(k, 0.9, 24), s.x, s.z);
    }
  }

  /** true: the screen shows the video (see ScreenVideo); false: the song card. */
  showVideo(on: boolean) {
    this.screen.material = on ? this.holeMaterial : this.cardMaterial;
  }

  /** Draw the current song on the stage screen. */
  setScreen(song: Song | null) {
    const g = this.screenCanvas.getContext('2d')!;
    const grd = g.createLinearGradient(0, 0, 1024, 576);
    grd.addColorStop(0, '#2a1f4a');
    grd.addColorStop(1, '#6a3d8f');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 576);
    g.fillStyle = '#ffc56b';
    g.font = 'bold 44px "Baloo 2", sans-serif';
    g.textAlign = 'center';
    g.fillText(song ? '♪ NOW PLAYING ♪' : 'BEAR DEN LOUNGE', 512, 120);
    g.fillStyle = '#fff8ee';
    g.font = 'bold 56px "Baloo 2", sans-serif';
    const title = song?.title ?? 'Paste a YouTube link to play a song';
    wrap(g, title, 512, 250, 940, 66, 3);
    if (song) {
      g.fillStyle = '#e9dccb';
      g.font = '38px "Baloo 2", sans-serif';
      g.fillText(`requested by ${song.by}`, 512, 500);
    }
    this.screenTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- players

  sync(players: Player[]) {
    for (const slot of [...this.remotes.keys()]) this.removeRemote(slot);
    this.clearLeavers();
    for (const p of players) this.addPlayer(p);
  }

  addPlayer(p: Player) {
    if (p.slot === this.mySlot) return;
    this.removeRemote(p.slot);
    const av = new Avatar(p.slot, p.name);
    av.char.root.position.set(p.x, 0, p.z);
    this.group.add(av.char.root);
    this.remotes.set(p.slot, { av, x: p.x, z: p.z, tx: p.tx, tz: p.tz, at: performance.now(), jumpT: 0, knock: null, leaving: null, pillowT: 0 });
    this.fx.burst(new THREE.Vector3(p.x, 1, p.z), '#ffe27a', 14);
  }

  move(slot: number, x: number, z: number, tx: number | null, tz: number | null) {
    const r = this.remotes.get(slot);
    if (!r || r.leaving) return;
    Object.assign(r, { x, z, tx, tz, at: performance.now() });
    // Far off (lag, teleport)? Snap instead of sliding across the island.
    const pos = r.av.char.root.position;
    if (Math.hypot(pos.x - x, pos.z - z) > 3) pos.set(x, pos.y, z);
  }

  /** Someone left: jump off the island (idle or not), then disappear. */
  leave(slot: number) {
    const r = this.remotes.get(slot);
    if (!r) return;
    const pos = r.av.char.root.position;
    const dir = new THREE.Vector3(pos.x, 0, pos.z);
    if (dir.lengthSq() < 0.01) dir.set(0, 0, 1);
    dir.normalize();
    r.leaving = { phase: 'run', t: 0, edge: dir.clone().multiplyScalar(ISLAND_RADIUS - 0.4), dir, y: 0, speed: 3 };
    r.av.char.act('cheer', 3);
    this.remotes.delete(slot);
    this.leavers.push(r);
  }

  /** Pillowed off the edge: fly out along the hit, then fall into the clouds. */
  knockOff(slot: number, dx: number, dz: number) {
    const r = this.remotes.get(slot);
    if (!r) return;
    const pos = r.av.char.root.position;
    const dir = new THREE.Vector3(dx, 0, dz);
    if (dir.lengthSq() < 0.01) dir.set(pos.x, 0, pos.z);
    dir.normalize();
    r.leaving = { phase: 'leap', t: 0, edge: pos.clone(), dir, y: 0, speed: 7, up: 5, cry: 'Waaah!' };
    r.av.pillow.visible = false;
    r.av.char.pose = 'stand';
    r.av.char.root.rotation.y = Math.atan2(-dir.x, -dir.z); // facing the hitter
    this.fx.burst(pos.clone().setY(1.2), '#ffffff', 22);
    this.fx.text('BONK!', pos.clone().setY(2.4), '#ffd36e');
    this.remotes.delete(slot);
    this.leavers.push(r);
  }

  act(slot: number, a: string) {
    const r = this.remotes.get(slot);
    if (!r) return;
    if (a === 'jump') r.jumpT = 0.001;
    if (a === 'wave') r.av.char.wave();
    if (a === 'sit') r.av.char.pose = r.av.char.pose === 'sit' ? 'stand' : 'sit';
    if (a === 'pillow') this.pillowSwing(r.av);
    if (a === 'dance' || a === 'cheer' || a === 'sing' || a === 'clap') r.av.char.emote(a);
  }

  /** Pillow swing for any avatar (remote or the local player's). */
  pillowSwing(av: Avatar) {
    av.pillow.visible = true;
    av.char.act('swing', 0.55);
    const r = this.remotes.get(av.slot);
    if (r) r.pillowT = 0.7;
    else setTimeout(() => (av.pillow.visible = false), 700);
    const root = av.char.root;
    const front = new THREE.Vector3(Math.sin(root.rotation.y), 0, Math.cos(root.rotation.y)).multiplyScalar(0.9).add(root.position);
    setTimeout(() => this.fx.burst(front.setY(1.2), '#ffffff', 16), 300);
  }

  /** A pillow hit pushed this remote avatar. */
  knock(slot: number, dx: number, dz: number) {
    const r = this.remotes.get(slot);
    if (!r) return;
    r.knock = { dx, dz, t: 0 };
    r.x += dx;
    r.z += dz;
    r.tx = r.tz = null;
    r.jumpT = 0.001;
  }

  /** Jump arc for the local player too (y offset over 0.6 s). */
  static jumpHeight(t: number) {
    return t > 0 && t < 0.6 ? Math.sin((t / 0.6) * Math.PI) * 1.1 : 0;
  }

  private removeRemote(slot: number) {
    const r = this.remotes.get(slot);
    if (!r) return;
    this.group.remove(r.av.char.root);
    this.remotes.delete(slot);
  }

  private clearLeavers() {
    for (const r of this.leavers) this.group.remove(r.av.char.root);
    this.leavers = [];
  }

  // ---------------------------------------------------------------- frame

  update(dt: number, _bear: BearInfo) {
    this.t += dt;
    this.environment.update(dt);
    this.kit.update(dt);
    this.particles.update(dt);
    this.fx.update(dt);
    this.leavers = this.leavers.filter((r) => {
      if (!this.animateLeave(r, dt)) return true;
      this.group.remove(r.av.char.root);
      return false;
    });
    for (const r of this.remotes.values()) {
      const root = r.av.char.root;
      let speed = 0;
      if (r.knock) {
        r.knock.t += dt;
        const k = Math.min(1, dt / 0.25);
        root.position.x += (r.x - root.position.x) * k * 3;
        root.position.z += (r.z - root.position.z) * k * 3;
        if (r.knock.t > 0.3) r.knock = null;
      } else {
        // Walk toward where they are now: the reported spot moved along their
        // heading for the time since the message (at most MOVE_LEAD ahead, so
        // there's nothing to walk back when the stop message arrives).
        const k = r.tx === null || r.tz === null ? 0 : Math.min(1, (performance.now() - r.at) / 1000 / MOVE_LEAD);
        const gx = r.x + ((r.tx ?? r.x) - r.x) * k, gz = r.z + ((r.tz ?? r.z) - r.z) * k;
        const dx = gx - root.position.x, dz = gz - root.position.z, d = Math.hypot(dx, dz);
        if (d > 0.05) {
          // Their own speed (walking or running, from the heading), plus a catch-up when behind.
          const theirs = r.tx === null || r.tz === null ? 0 : Math.hypot(r.tx - r.x, r.tz - r.z) / MOVE_LEAD;
          const v = THREE.MathUtils.clamp(Math.max(theirs, WALK_SPEED) + d * 1.5, WALK_SPEED, RUN_SPEED * 1.3);
          const step = Math.min(d, v * dt);
          root.position.x += (dx / d) * step;
          root.position.z += (dz / d) * step;
          speed = v;
          const yaw = Math.atan2(dx, dz);
          root.rotation.y += Math.atan2(Math.sin(yaw - root.rotation.y), Math.cos(yaw - root.rotation.y)) * Math.min(1, dt * 10);
          if (r.av.char.pose !== 'stand') r.av.char.pose = 'stand';
        }
      }
      if (r.jumpT > 0) {
        r.jumpT += dt;
        root.position.y = LoungeWorld.jumpHeight(r.jumpT);
        if (r.jumpT > 0.6) r.jumpT = 0;
      }
      if (r.pillowT > 0 && (r.pillowT -= dt) <= 0) r.av.pillow.visible = false;
      r.av.char.update(dt, speed);
    }
  }

  /** Run to the edge, leap outward, fall into the clouds. Returns true when done. */
  private animateLeave(r: Remote, dt: number) {
    const L = r.leaving!;
    const root = r.av.char.root;
    L.t += dt;
    if (L.phase === 'run') {
      const dx = L.edge.x - root.position.x, dz = L.edge.z - root.position.z, d = Math.hypot(dx, dz);
      root.rotation.y = Math.atan2(dx, dz);
      if (d < 0.2 || L.t > 5) {
        L.phase = 'leap';
        L.t = 0;
        return false;
      }
      const step = Math.min(d, 5.5 * dt);
      root.position.x += (dx / d) * step;
      root.position.z += (dz / d) * step;
      r.av.char.update(dt, 5);
      return false;
    }
    // Leap: up and outward, then fall far below while spinning.
    root.position.x += L.dir.x * L.speed * dt;
    root.position.z += L.dir.z * L.speed * dt;
    root.position.y = L.edge.y + (L.up ?? 2.2) * L.t - 9 * L.t * L.t;
    root.rotation.x += dt * 4;
    r.av.char.update(dt, 0);
    if (L.t > 0.25 && L.t < 0.3) this.fx.text(L.cry ?? 'Wheee!', root.position.clone(), '#bfe3ff');
    return root.position.y < -18;
  }

  clampToWalkable(p: THREE.Vector3) {
    const d = Math.hypot(p.x, p.z);
    if (d > WALK_RADIUS) p.multiplyScalar(WALK_RADIUS / d);
    for (const b of this.kit.blockers) {
      const dx = p.x - b.x, dz = p.z - b.z, dist = Math.hypot(dx, dz), min = b.r + 0.35;
      if (dist < min && dist > 1e-4) {
        p.x = b.x + (dx / dist) * min;
        p.z = b.z + (dz / dist) * min;
      }
    }
  }

  dispose() {
    this.environment.dispose();
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.screenTex.dispose();
  }
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '…');
  }
  const start = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((l, i) => g.fillText(l, x, start + i * lineH));
}

function mulberry(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
