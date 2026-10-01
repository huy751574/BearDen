import * as THREE from 'three';

// Tripo's auto-rig binds long hair that hangs beside the arms (the cat idol's
// twin tails) to the arm and calf bones, so waving or dancing drags the hair
// along like a sleeve. This re-binds it at load time, for models with
// "hairFix": true in models.json (not by default: a fox's tail would match).
//
// Hair = a vertex that follows an arm (or lower leg) but sits far from that
// limb's bones; real skin hugs its bones. Hair is re-bound to the head near
// the top and to the upper spine lower down, so the tails hang naturally.
// Works in bind space with Tripo's bone names (L_Hand, R_Calf, Spine02, ...).

/** Distances as a fraction of the head-to-foot span (cat idol: arm skin < 0.09, hair > 0.2). */
const ARM_REACH = 0.1;
const LEG_REACH = 0.14;

export function detachHair(root: THREE.Object3D): number {
  let changed = 0;
  root.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) changed += fixMesh(mesh);
  });
  return changed;
}

function fixMesh(mesh: THREE.SkinnedMesh): number {
  const { bones, boneInverses } = mesh.skeleton;
  const find = (name: string) => bones.findIndex((b) => b.name === name);
  const P = boneInverses.map((m) => new THREE.Vector3().setFromMatrixPosition(m.clone().invert()));
  const at = (name: string) => P[find(name)];
  const head = find('Head'), spine = find('Spine02');
  const need = ['L_Upperarm', 'L_Forearm', 'L_Hand', 'R_Upperarm', 'R_Forearm', 'R_Hand', 'L_Calf', 'R_Calf', 'L_Foot', 'R_Foot', 'L_Thigh', 'R_Thigh', 'L_ToeBase', 'R_ToeBase'];
  if (head < 0 || spine < 0 || need.some((n) => find(n) < 0)) return 0; // not a Tripo rig

  const span = P[head].distanceTo(at('L_Foot'));
  const armReach = ARM_REACH * span, legReach = LEG_REACH * span;
  const seg = (p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) => {
    const ab = b.clone().sub(a);
    const t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / Math.max(ab.lengthSq(), 1e-9), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  };
  const chain = (p: THREE.Vector3, names: string[]) => {
    let d = Infinity;
    for (let i = 0; i + 1 < names.length; i++) d = Math.min(d, seg(p, at(names[i]), at(names[i + 1])));
    return d;
  };
  const handTip = (s: string) => at(`${s}_Hand`).clone().add(at(`${s}_Hand`).clone().sub(at(`${s}_Forearm`)).multiplyScalar(0.6));
  const armBones = new Set(bones.map((b, i) => (/^[LR]_(Upperarm|Forearm|Hand)/.test(b.name) ? i : -1)).filter((i) => i >= 0));
  const calfBones = new Set(bones.map((b, i) => (/^[LR]_(Calf|Foot|Toe)/.test(b.name) ? i : -1)).filter((i) => i >= 0));

  const geo = mesh.geometry;
  const pos = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const yHead = P[head].y, ySpine = P[spine].y;
  const v = new THREE.Vector3();
  let changed = 0;
  for (let k = 0; k < pos.count; k++) {
    v.fromBufferAttribute(pos, k).applyMatrix4(mesh.bindMatrix);
    let armW = 0, calfW = 0, armMax = 0, calfMax = 0, armSide = 'L', calfSide = 'L';
    for (let j = 0; j < 4; j++) {
      const b = si.getComponent(k, j), w = sw.getComponent(k, j);
      if (armBones.has(b)) {
        armW += w;
        if (w > armMax) [armMax, armSide] = [w, bones[b].name[0]];
      }
      if (calfBones.has(b)) {
        calfW += w;
        if (w > calfMax) [calfMax, calfSide] = [w, bones[b].name[0]];
      }
    }
    let hair = false;
    if (armW > 0.2) {
      const s = armSide;
      hair = Math.min(chain(v, [`${s}_Upperarm`, `${s}_Forearm`, `${s}_Hand`]), seg(v, at(`${s}_Hand`), handTip(s))) > armReach;
    }
    if (!hair && calfW > 0.2) {
      const s = calfSide;
      // Include the toe (and a bit past it), or the shoe tips would count as hair.
      const toe = at(`${s}_ToeBase`) ?? at(`${s}_Foot`);
      const toeTip = toe.clone().add(toe.clone().sub(at(`${s}_Foot`)).multiplyScalar(1.5));
      hair = Math.min(chain(v, [`${s}_Thigh`, `${s}_Calf`, `${s}_Foot`]), seg(v, at(`${s}_Foot`), toeTip)) > legReach;
    }
    if (!hair) continue;
    const wHead = THREE.MathUtils.clamp((v.y - ySpine) / (yHead - ySpine), 0, 1);
    si.setXYZW(k, head, spine, 0, 0);
    sw.setXYZW(k, wHead, 1 - wHead, 0, 0);
    changed++;
  }
  si.needsUpdate = sw.needsUpdate = true;
  return changed;
}
