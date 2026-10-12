"""Give a still winged model (Tripo --no-rig) a wing skeleton and a flap loop.

    blender -b -P tools/blender/rig_wings.py -- in.glb out.glb [options]

Tripo's auto-rig only does two-legged characters, and Blender's automatic
weights fail on Tripo meshes, so the weights are set from where each vertex
is. Axes as Blender imports a Tripo GLB: Z up, the model faces +X, the wings
spread along +Y / -Y.

Skeleton: Body (root), and per side Wing.L / Wing.L.Tip (inner wing and the
tip that trails behind it, so the stroke whips instead of swinging like a
board). A vertex belongs to a wing when it lies outside the shoulder
(|y| > --shoulder), not in front of the wing plane (x < --front: the arms hang
there) and, near the body, not low down (z > --low: legs and tail). Options:

    --shoulder 0.13   |y| where the wing leaves the body (fully wing at +0.07)
    --tip 0.30        |y| where the tip bone takes over
    --front 0.05      in front of this x: arms, not wing
    --low -0.05       below this z (within |y| < 0.3): legs / tail, not wing
    --pivot-z 0.22    height of the shoulder joint
    --fps 30 --seconds 1.2 --lift 32 --drop 38   flap timing and angles (degrees)

--folded: wings folded upright on the back of a lying creature (the
sleeping throne dragon). The body runs along Y, the wings stand either side
of the spine at x = --center-x +/- --gap, from --root-z up; they hinge along
the body and open outward (--open degrees) and beat (+/- --beat) in the loop.
Rest pose = folded, so a game can fade the loop in only when it flies.

    --center-x -0.14 --gap 0.12 --root-z 0.10 --y-min -0.12 --y-max 0.42 --open 55 --beat 28

Then compress it like any model (tools/compress_models.py). Preview:
tools/blender/render_views.py out.glb prefix --colors (red = wing weights).
"""
import math
import sys

import bpy
from mathutils import Vector


def opt(name, default):
    args = sys.argv[sys.argv.index("--") + 1:]
    return float(args[args.index(name) + 1]) if name in args else default


args = sys.argv[sys.argv.index("--") + 1:]
src, out = args[0], args[1]
SHOULDER, TIP = opt("--shoulder", 0.13), opt("--tip", 0.30)
FRONT, LOW, PIVOT_Z = opt("--front", 0.05), opt("--low", -0.05), opt("--pivot-z", 0.22)
FPS, SECONDS = int(opt("--fps", 30)), opt("--seconds", 1.2)
LIFT, DROP = math.radians(opt("--lift", 32)), math.radians(opt("--drop", 38))
FOLDED = "--folded" in args
CX, GAP, ROOT_Z = opt("--center-x", -0.14), opt("--gap", 0.12), opt("--root-z", 0.10)
Y_MIN, Y_MAX = opt("--y-min", -0.12), opt("--y-max", 0.42)
OPEN, BEAT = math.radians(opt("--open", 55)), math.radians(opt("--beat", 28))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if len(meshes) != 1:
    sys.exit(f"expected one mesh, got {len(meshes)}")
mesh = meshes[0]
# Bake the import transform into the vertices so weights use world positions.
bpy.context.view_layer.objects.active = mesh
mesh.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def smooth(a, b, v):
    t = min(max((v - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# ---------------------------------------------------------------- skeleton
arm_data = bpy.data.armatures.new("Rig")
rig = bpy.data.objects.new("Rig", arm_data)
bpy.context.scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
body = arm_data.edit_bones.new("Body")
body.head, body.tail = Vector((0, 0, -0.2)), Vector((0, 0, PIVOT_Z))
span = max(abs(v.co.y) for v in mesh.data.vertices)
top = max(v.co.z for v in mesh.data.vertices)
mid_z = (ROOT_Z + top) / 2  # folded: where the tip bone takes over
for side, s in (("L", 1), ("R", -1)):
    inner = arm_data.edit_bones.new(f"Wing.{side}")
    tip = arm_data.edit_bones.new(f"Wing.{side}.Tip")
    if FOLDED:
        # Upright bones either side of the spine; they hinge along the body (Y).
        x, y = CX + s * GAP, (Y_MIN + Y_MAX) / 2
        inner.head, inner.tail = Vector((x, y, ROOT_Z)), Vector((x, y, mid_z))
        tip.head, tip.tail = inner.tail.copy(), Vector((x, y, top))
    else:
        inner.head, inner.tail = Vector((0, s * SHOULDER, PIVOT_Z)), Vector((0, s * TIP, PIVOT_Z))
        tip.head, tip.tail = inner.tail.copy(), Vector((0, s * span, PIVOT_Z))
    inner.parent = body
    tip.parent = inner
    tip.use_connect = True
    for b in (inner, tip):
        # The bone's local Z = the hinge: front (+X) for spread wings, along the body (+Y) for folded ones.
        b.align_roll(Vector((0, 1, 0)) if FOLDED else Vector((1, 0, 0)))
bpy.ops.object.mode_set(mode="OBJECT")

# ---------------------------------------------------------------- weights
groups = {n: mesh.vertex_groups.new(name=n) for n in ("Body", "Wing.L", "Wing.L.Tip", "Wing.R", "Wing.R.Tip")}
wing_count = 0
for v in mesh.data.vertices:
    p = v.co
    if FOLDED:
        # High on the back, beside the spine (not the spikes on it), between head and tail.
        w = smooth(ROOT_Z - 0.03, ROOT_Z + 0.04, p.z) * smooth(GAP - 0.05, GAP, abs(p.x - CX))
        w *= smooth(Y_MIN - 0.04, Y_MIN + 0.02, p.y) * (1 - smooth(Y_MAX - 0.02, Y_MAX + 0.04, p.y))
        side = "L" if p.x > CX else "R"
        t = smooth(mid_z - 0.03, mid_z + 0.03, p.z)
    else:
        ay = abs(p.y)
        w = smooth(SHOULDER, SHOULDER + 0.07, ay)
        w *= 1 - smooth(FRONT, FRONT + 0.04, p.x)  # arms hang in front of the wing
        if ay < TIP:
            w *= smooth(LOW - 0.05, LOW + 0.05, p.z)  # legs and tail below
        side = "L" if p.y > 0 else "R"
        t = smooth(TIP - 0.04, TIP + 0.04, ay)
    if w > 0.001:
        wing_count += 1
        groups[f"Wing.{side}"].add([v.index], w * (1 - t), "REPLACE")
        groups[f"Wing.{side}.Tip"].add([v.index], w * t, "REPLACE")
    if w < 0.999:
        groups["Body"].add([v.index], 1 - w, "REPLACE")
print(f"wing vertices: {wing_count} of {len(mesh.data.vertices)}")

# Paint the wing weights as vertex colours (preview only; not exported).
cols = mesh.data.color_attributes.new("WingWeight", "BYTE_COLOR", "POINT")
for v in mesh.data.vertices:
    w = sum(g.weight for g in v.groups if mesh.vertex_groups[g.group].name != "Body")
    cols.data[v.index].color = (0.25 + 0.75 * w, 0.25, 0.25 + 0.6 * (1 - w), 1)

mod = mesh.modifiers.new("Rig", "ARMATURE")
mod.object = rig
mesh.parent = rig

# ---------------------------------------------------------------- flap loop
scene = bpy.context.scene
scene.render.fps = FPS
frames = round(FPS * SECONDS)
scene.frame_start, scene.frame_end = 0, frames
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
rig.animation_data_create()
rig.animation_data.action = bpy.data.actions.new("flap")
for f in range(frames + 1):
    ph = 2 * math.pi * f / frames
    # Downstroke is quicker and stronger than the upstroke (a skewed sine).
    stroke = math.sin(ph + 0.35 * math.sin(ph))
    trail = math.sin(ph - 0.7 + 0.35 * math.sin(ph))  # the tip trails behind
    if FOLDED:
        # Open out from the back and beat around that.
        inner_a = OPEN + BEAT * stroke
        tip_a = 0.5 * BEAT * trail
    else:
        inner_a = LIFT * stroke if stroke > 0 else DROP * stroke
        tip_a = 0.6 * (LIFT if stroke > 0 else DROP) * trail
    for side, s in (("L", 1), ("R", -1)):
        for name, a in ((f"Wing.{side}", inner_a), (f"Wing.{side}.Tip", tip_a)):
            pb = rig.pose.bones[name]
            pb.rotation_mode = "XYZ"
            # Turning about the hinge (local Z) swings the wing; the sides mirror.
            # Folded wings open away from the spine: the opposite turn.
            pb.rotation_euler = (0, 0, -a * s if FOLDED else a * s)
            pb.keyframe_insert("rotation_euler", frame=f)
    body_b = rig.pose.bones["Body"]
    body_b.location = (0, 0, 0 if FOLDED else -0.02 * stroke)  # the body rises as the wings push down
    body_b.keyframe_insert("location", frame=f)
bpy.ops.object.mode_set(mode="OBJECT")
for fc in rig.animation_data.action.fcurves:
    for k in fc.keyframe_points:
        k.interpolation = "LINEAR"

if "--blend" in args:
    bpy.ops.wm.save_as_mainfile(filepath=out.replace(".glb", ".blend"))
bpy.ops.export_scene.gltf(
    filepath=out, export_format="GLB", export_animations=True, export_skins=True,
    export_frame_range=True, export_force_sampling=True, export_attributes=False,
    export_vertex_color="NONE",
)
print("wrote", out)
