import * as THREE from 'three';
import { CSS3DObject, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer.js';

// Shows the YouTube player ON the lounge's stage screen. A YouTube iframe
// can't be drawn into WebGL, so it lives in a CSS 3D layer *behind* the game
// canvas, transformed to match the screen mesh every frame; the screen mesh
// then draws fully transparent pixels (LoungeWorld.showVideo) so the video
// shows through, and avatars in front of the screen still cover it. Because
// the canvas sits on top, nobody can click the video (no pausing it for
// everyone's view; the page keeps it playing anyway).

/** CSS pixel size of the player; scaled down to the screen's size in 3D. */
const PX_W = 640;
const PX_H = 360;

export class ScreenVideo {
  /** Put the player in here. */
  readonly host = document.createElement('div');
  private renderer = new CSS3DRenderer();
  private scene = new THREE.Scene();
  private obj: CSS3DObject;
  private onResize = () => this.resize();

  constructor(
    private container: HTMLElement,
    private camera: THREE.Camera,
    private screen: THREE.Mesh,
    private screenWidth: number,
  ) {
    Object.assign(this.host.style, { width: `${PX_W}px`, height: `${PX_H}px`, background: '#000', pointerEvents: 'none' });
    this.obj = new CSS3DObject(this.host);
    this.host.style.pointerEvents = 'none'; // CSS3DObject turns it back on
    this.scene.add(this.obj);
    Object.assign(this.renderer.domElement.style, { position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none' });
  }

  attach() {
    this.container.prepend(this.renderer.domElement);
    addEventListener('resize', this.onResize);
    this.resize();
  }

  detach() {
    this.renderer.domElement.remove();
    removeEventListener('resize', this.onResize);
  }

  /** Call after the WebGL frame is drawn, with the same camera. */
  render() {
    this.screen.updateWorldMatrix(true, false);
    this.screen.matrixWorld.decompose(this.obj.position, this.obj.quaternion, this.obj.scale);
    this.obj.scale.multiplyScalar(this.screenWidth / PX_W);
    this.renderer.render(this.scene, this.camera);
  }

  private resize() {
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}
