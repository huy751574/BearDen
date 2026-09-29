import * as THREE from 'three';

// The scene's own loop video on a large curved screen behind the sky island,
// so the original artwork is always the "painted background" of the diorama.
// It hangs in a fixed direction (ahead of the default camera, -Z), like a landmark.

const RADIUS = 55;
const HEIGHT = 34;
const ARC = (HEIGHT * 16) / 9 / RADIUS; // radians, keeps the video 16:9
const CENTER_Y = 8; // bottom edge tucks just behind the island's far rim from the default camera

export class Backdrop {
  readonly mesh: THREE.Mesh;
  private video = document.createElement('video');
  private texture: THREE.VideoTexture;

  constructor(url: string) {
    const v = this.video;
    v.src = url;
    v.muted = true; // music comes from the radio card
    v.loop = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.play().catch(() => {});

    this.texture = new THREE.VideoTexture(v);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    // Viewed from inside the cylinder, so mirror U to keep the art readable.
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.repeat.x = -1;

    const geo = new THREE.CylinderGeometry(RADIUS, RADIUS, HEIGHT, 48, 1, true, Math.PI - ARC / 2, ARC);
    const mat = new THREE.MeshBasicMaterial({
      map: this.texture,
      alphaMap: featherTexture(),
      transparent: true,
      side: THREE.BackSide,
      fog: false,
      toneMapped: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = CENTER_Y;
    this.mesh.renderOrder = -1;
    this.mesh.visible = false;
    v.addEventListener('loadeddata', () => (this.mesh.visible = true), { once: true });
  }

  dispose() {
    this.video.pause();
    this.video.removeAttribute('src');
    this.video.load();
    this.texture.dispose();
    (this.mesh.material as THREE.Material).dispose();
    this.mesh.geometry.dispose();
  }
}

let feather: THREE.Texture | null = null;
/** Soft edges on all sides so the screen melts into the sky. */
function featherTexture() {
  if (feather) return feather;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 256, 256);
  g.globalCompositeOperation = 'destination-in';
  const h = g.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(0,0,0,0)');
  h.addColorStop(0.12, 'rgba(0,0,0,1)');
  h.addColorStop(0.88, 'rgba(0,0,0,1)');
  h.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = h;
  g.fillRect(0, 0, 256, 256);
  const v = g.createLinearGradient(0, 0, 0, 256);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.1, 'rgba(0,0,0,1)');
  v.addColorStop(0.9, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 256, 256);
  // alphaMap reads the green channel; convert alpha to grayscale.
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3];
    img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
    img.data[i + 3] = 255;
  }
  g.globalCompositeOperation = 'copy';
  g.putImageData(img, 0, 0);
  feather = new THREE.CanvasTexture(c);
  return feather;
}
