import * as THREE from 'three';

// Shared anime-style look: 3-step toon shading + inverted-hull outlines.

let gradient: THREE.DataTexture | null = null;

function toonGradient(): THREE.DataTexture {
  if (gradient) return gradient;
  const steps = new Uint8Array([90, 170, 255]);
  const data = new Uint8Array(steps.length * 4);
  steps.forEach((v, i) => data.set([v, v, v, 255], i * 4));
  gradient = new THREE.DataTexture(data, steps.length, 1, THREE.RGBAFormat);
  gradient.minFilter = THREE.NearestFilter;
  gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

export function toonMaterial(color: THREE.ColorRepresentation, extra: THREE.MeshToonMaterialParameters = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient(), ...extra });
}

const outlineMaterials = new Map<number, THREE.ShaderMaterial>();

function outlineMaterial(thickness: number): THREE.ShaderMaterial {
  const key = Math.round(thickness * 1000);
  let mat = outlineMaterials.get(key);
  if (!mat) {
    mat = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#1d1517') }, thickness: { value: thickness } },
      vertexShader: /* glsl */ `
        uniform float thickness;
        void main() {
          vec3 p = position + normal * thickness;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 color;
        void main() { gl_FragColor = vec4(color, 1.0); }`,
      side: THREE.BackSide,
    });
    outlineMaterials.set(key, mat);
  }
  return mat;
}

/**
 * Outline for an animated (skinned) mesh: a back-face copy bound to the same
 * skeleton, pushed out along the skinned normal so it follows the animation.
 * `thickness` is in the mesh's local units.
 */
export function addSkinnedOutline(mesh: THREE.SkinnedMesh, thickness: number) {
  const mat = new THREE.MeshBasicMaterial({ color: '#1d1517', side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <skinning_vertex>',
      `#include <skinning_vertex>\n  transformed += normalize(objectNormal) * ${thickness.toFixed(5)};`,
    );
  };
  const hull = new THREE.SkinnedMesh(mesh.geometry, mat);
  hull.bind(mesh.skeleton, mesh.bindMatrix);
  hull.position.copy(mesh.position);
  hull.quaternion.copy(mesh.quaternion);
  hull.scale.copy(mesh.scale);
  hull.frustumCulled = false;
  hull.raycast = () => {};
  mesh.parent?.add(hull);
  return hull;
}

/** Adds a slightly inflated back-face copy of the mesh, drawn as a dark outline. */
export function addOutline(mesh: THREE.Mesh, thickness = 0.022) {
  const hull = new THREE.Mesh(mesh.geometry, outlineMaterial(thickness));
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}
