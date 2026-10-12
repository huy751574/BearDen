"""Print a GLB's mesh bounds and a width profile (run inside Blender).

    blender -b -P tools/blender/inspect_mesh.py -- model.glb
"""
import sys

import bpy

path = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
print("meshes", [(o.name, len(o.data.vertices)) for o in meshes])
for axis, i in (("x", 0), ("y", 1), ("z", 2)):
    print(axis, round(min(p[i] for p in pts), 3), round(max(p[i] for p in pts), 3))
# Width (x) of the shape at each height (z), to find the shoulders and wings.
zmin, zmax = min(p.z for p in pts), max(p.z for p in pts)
for k in range(20):
    z0 = zmin + (zmax - zmin) * k / 20
    z1 = z0 + (zmax - zmin) / 20
    band = [p for p in pts if z0 <= p.z < z1]
    if band:
        xs = sorted(p.x for p in band)
        print(f"z {z0:6.3f}  x {xs[0]:6.3f} .. {xs[-1]:6.3f}  n {len(band)}")
