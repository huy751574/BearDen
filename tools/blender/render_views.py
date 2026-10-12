"""Render a GLB from the front, back and side (Workbench, texture or vertex colours).

    blender -b -P tools/blender/render_views.py -- model.glb|.blend out_prefix [--colors] [--frame N]

Writes <out_prefix>_front.png, _back.png and _side.png (512 px). The model's
front is +X (Tripo), Z is up. With --colors it shows the vertex colours (e.g.
weights painted by rig_wings.py) instead of the texture.
"""
import math
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
path, prefix = args[0], args[1]
colors = "--colors" in args
frame = int(args[args.index("--frame") + 1]) if "--frame" in args else None

if path.endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=path)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
scene = bpy.context.scene
if frame is not None:
    scene.frame_set(frame)  # an animation pose (e.g. a wing stroke)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "FLAT" if colors else "STUDIO"
scene.display.shading.color_type = "VERTEX" if colors else "TEXTURE"
scene.render.resolution_x = scene.render.resolution_y = 512
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w") if not scene.world else scene.world
scene.world.color = (0.85, 0.87, 0.9)

meshes = [o for o in scene.objects if o.type == "MESH"]
pts = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
center = sum(pts, Vector()) / len(pts)
size = max((p - center).length for p in pts)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = size * 2.2
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
for name, direction in (("front", Vector((1, 0, 0))), ("back", Vector((-1, 0, 0))), ("side", Vector((0, 1, 0)))):
    cam.location = center + direction * size * 3
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = f"{prefix}_{name}.png"
    bpy.ops.render.render(write_still=True)
print("rendered", prefix)
