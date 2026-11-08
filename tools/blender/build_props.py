"""Model the sittable props in Blender and export them as GLB (public/props/).

    blender -b -P tools/blender/build_props.py -- [--preview DIR] [name ...]

Every prop is built from code (bevelled planks, soft cushions, curved iron,
bark and tree rings), so it is reproducible and easy to tweak. Conventions
match the game's props: metres, standing on the ground (z = 0), centred,
front facing Blender -Y (the game's +Z after export). Seats are empties named
Seat_<n> on the seat surface, where the character's bottom goes; the game
lets the player click the prop and sit there (src/scenery/props/models.ts).
Materials are plain colours named by role; the game recolours "Fabric" and
"FabricSoft" per scene (sofa colours, chair cushions).

Names: bench, log, sofa, chair, rocking_chair, haybale (all when none given).
--preview DIR also renders a three-quarter view of each prop to DIR.
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
PREVIEW = None
if "--preview" in args:
    i = args.index("--preview")
    PREVIEW = Path(args[i + 1])
    del args[i:i + 2]
ONLY = set(args)
OUT = Path(__file__).resolve().parents[2] / "public" / "props"


# ---------------------------------------------------------------- helpers

def srgb(hex_color: str):
    h = hex_color.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c) + (1.0,)


def material(name, color, rough=0.85, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = srgb(color)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    m.diffuse_color = srgb(color)  # viewport / preview colour
    return m


def link(ob):
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_object(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    return link(bpy.data.objects.new(name, me))


def select_only(ob):
    for o in bpy.context.scene.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def finish(ob, bevel=0.0, segments=2, smooth=35, subsurf=0):
    """Bevel the edges, optionally subdivide, and shade smooth with sharp creases."""
    select_only(ob)
    if bevel:
        mod = ob.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = math.radians(30)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if subsurf:
        mod = ob.modifiers.new("Subsurf", "SUBSURF")
        mod.levels = mod.render_levels = subsurf
        bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.data.shade_smooth()
    ob.data.set_sharp_from_angle(angle=math.radians(smooth))
    return ob


def box(name, size, loc, mat, bevel=0.01, segments=2, rot=(0, 0, 0), smooth=35):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    ob = mesh_object(name, bm, [mat])
    ob.location, ob.rotation_euler = loc, rot
    return finish(ob, bevel, segments, smooth)


def cyl(name, r1, r2, depth, loc, mat, segs=12, rot=(0, 0, 0), bevel=0.0, smooth=40):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r1, radius2=r2, depth=depth)
    ob = mesh_object(name, bm, [mat])
    ob.location, ob.rotation_euler = loc, rot
    return finish(ob, bevel, 2, smooth)


def blob(name, size, loc, mat, rot=(0, 0, 0), subdiv=2):
    """A soft rounded lump (moss, cushions' piping): a squashed icosphere."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    ob = mesh_object(name, bm, [mat])
    ob.location, ob.rotation_euler = loc, rot
    return finish(ob, smooth=70)


def tube(name, points, radius, mat, res=5):
    """A round bar along a smooth curve through `points` (iron frames, rockers)."""
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = 2
    cu.resolution_u = res
    cu.use_fill_caps = True
    sp = cu.splines.new("BEZIER")
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = "AUTO"
    ob = link(bpy.data.objects.new(name, cu))
    cu.materials.append(mat)
    select_only(ob)
    bpy.ops.object.convert(target="MESH")
    ob = bpy.context.view_layer.objects.active
    ob.data.shade_smooth()
    ob.data.set_sharp_from_angle(angle=math.radians(60))
    return ob


def seat(i, x, y, z):
    """Where the character sits: on the seat surface, facing the front (-Y)."""
    e = link(bpy.data.objects.new(f"Seat_{i}", None))
    e.empty_display_size = 0.12
    e.location = (x, y, z)
    return e


def join_meshes(name):
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    for o in bpy.context.scene.objects:
        o.select_set(o in meshes)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name
    return ob


def export(name):
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_apply=True, export_yup=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False, export_animations=False,
    )
    tris = sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for p in o.data.polygons)
    seats = [o.name for o in bpy.context.scene.objects if o.type == "EMPTY"]
    print(f"wrote {path.name}: {path.stat().st_size / 1024:.0f} KB, {tris} triangles, seats {seats}")


def preview(name):
    """Workbench render, three-quarter front view, with outlines and cavity."""
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    sh = scene.display.shading
    sh.light, sh.color_type = "STUDIO", "MATERIAL"
    sh.show_cavity = True
    sh.show_object_outline = True
    scene.render.resolution_x = scene.render.resolution_y = 520
    scene.world = bpy.data.worlds.new("w")
    scene.world.color = (0.82, 0.85, 0.88)
    pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == "MESH" for c in o.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    center, size = (lo + hi) / 2, (hi - lo).length
    cam = link(bpy.data.objects.new("cam", bpy.data.cameras.new("cam")))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = size * 1.05
    cam.location = center + Vector((size * 0.9, -size * 1.6, size * 0.8))
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    PREVIEW.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(PREVIEW / f"{name}.png")
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- props

def bench():
    """Park bench: wooden slats on curved cast-iron frames with scrolled armrests."""
    wood = [material("Wood", "#b07a4a"), material("WoodLight", "#c79a62")]
    iron = material("Iron", "#33363e", rough=0.45, metal=0.5)
    L, H = 1.5, 0.44
    for i, y in enumerate((-0.17, -0.057, 0.057, 0.17)):
        box(f"slat{i}", (L, 0.098, 0.036), (0, y, H - 0.018), wood[i % 2], bevel=0.012)
        for s in (-1, 1):  # bolt heads where the slats meet the frames
            cyl(f"bolt{i}{s}", 0.011, 0.011, 0.008, (0.64 * s, y, H + 0.002), iron, segs=8)

    def post_y(z):  # rear post: up from the leg, leaning back
        return 0.19 + (z - 0.4) / 0.22 * 0.05 if z < 0.62 else 0.24 + (z - 0.62) / 0.28 * 0.07

    tilt = math.radians(14)
    for i, z in enumerate((0.58, 0.70, 0.82)):
        box(f"back{i}", (L, 0.03, 0.095), (0, post_y(z) - 0.035, z), wood[(i + 1) % 2], bevel=0.012, rot=(-tilt, 0, 0))
    for s in (-1, 1):
        x = 0.64 * s
        tube(f"legF{s}", [(x, -0.21, 0.0), (x, -0.23, 0.2), (x, -0.19, H - 0.04)], 0.022, iron)
        tube(f"legB{s}", [(x, 0.23, 0.0), (x, 0.19, H - 0.04), (x, post_y(0.62), 0.62), (x, post_y(0.9), 0.9)], 0.022, iron)
        tube(f"rail{s}", [(x, -0.22, H - 0.05), (x, 0.0, H - 0.058), (x, 0.21, H - 0.05)], 0.018, iron)
        tube(f"armpost{s}", [(x, -0.19, H - 0.04), (x, -0.2, 0.62)], 0.018, iron)
        tube(f"arm{s}", [(x, post_y(0.66), 0.66), (x, 0.05, 0.645), (x, -0.2, 0.635), (x, -0.27, 0.6),
                         (x, -0.255, 0.55), (x, -0.215, 0.57)], 0.02, iron)
        for y in (-0.21, 0.23):
            cyl(f"foot{s}{y}", 0.034, 0.04, 0.03, (x, y, 0.015), iron, segs=10)
    for i, x in enumerate((-0.46, 0.0, 0.46)):
        seat(i, x, -0.05, H)


def log():
    """Fallen log seat: ridged bark, growth rings on the cut ends, moss and mushrooms."""
    random.seed("log")
    mats = [material("Bark", "#6e4a32"), material("BarkDark", "#4a3021"),
            material("LogWood", "#dcb37c"), material("LogRing", "#b8895a")]
    moss, cap, dots, stem = (material("Moss", "#6f9a3f"), material("Mushroom", "#d9473f"),
                             material("MushroomDots", "#fff4e6"), material("Stem", "#f3e6d0"))
    L, R, N, M = 1.6, 0.21, 20, 12
    bm = bmesh.new()
    ridge = [1 + 0.05 * math.sin(j * 2.7) + 0.035 * random.uniform(-1, 1) for j in range(N)]
    rings = []
    for i in range(M + 1):
        x = -L / 2 + L * i / M
        flare = 1 + 0.035 * math.sin(i * 1.3) + (0.05 if i in (0, M) else 0)
        ring = []
        for j in range(N):
            a = 2 * math.pi * j / N
            r = R * ridge[j] * flare * (1 + 0.015 * random.uniform(-1, 1))
            ring.append(bm.verts.new((x, r * math.cos(a), R + r * math.sin(a))))
        rings.append(ring)
    for i in range(M):
        for j in range(N):
            f = bm.faces.new((rings[i][j], rings[i][(j + 1) % N], rings[i + 1][(j + 1) % N], rings[i + 1][j]))
            f.material_index = 1 if j % 3 == 0 else 0  # darker grooves between bark plates
    # Cut ends: a bark rim, then light wood with two growth rings.
    for outer in (rings[0], rings[M]):
        x = outer[0].co.x
        prev = outer
        for fac, mi in ((0.86, 1), (0.62, 2), (0.56, 3), (0.32, 2), (0.27, 3)):
            cur = [bm.verts.new((x, v.co.y * fac, R + (v.co.z - R) * fac)) for v in outer]
            for j in range(N):
                bm.faces.new((prev[j], prev[(j + 1) % N], cur[(j + 1) % N], cur[j])).material_index = mi
            prev = cur
        c = bm.verts.new((x, 0, R))
        for j in range(N):
            bm.faces.new((prev[j], prev[(j + 1) % N], c)).material_index = 2
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish(mesh_object("trunk", bm, mats), smooth=50)
    # A broken branch stub on the side.
    cyl("stub", 0.04, 0.055, 0.22, (0.25, -0.2, 0.28), mats[0], segs=8, rot=(math.radians(70), 0, math.radians(15)))
    # Moss on the top and side (kept clear of the two seats).
    blob("moss1", (0.2, 0.13, 0.035), (0.02, 0.05, 2 * R - 0.005), moss)
    blob("moss2", (0.12, 0.09, 0.03), (-0.72, -0.08, 2 * R - 0.03), moss, rot=(0.3, 0, 0))
    blob("moss3", (0.14, 0.03, 0.09), (0.6, 0.2, R + 0.05), moss)
    # A little mushroom family by one end.
    for i, (dx, dy, h, r) in enumerate(((0.86, -0.12, 0.13, 0.07), (0.92, -0.02, 0.09, 0.05), (0.84, 0.06, 0.07, 0.04))):
        cyl(f"mstem{i}", r * 0.35, r * 0.45, h, (dx, dy, h / 2), stem, segs=8)
        blob(f"mcap{i}", (r, r, r * 0.6), (dx, dy, h), cap)
        for k in range(3):
            a = k * 2.1 + i
            blob(f"mdot{i}{k}", (r * 0.18,) * 3, (dx + math.cos(a) * r * 0.55, dy + math.sin(a) * r * 0.55, h + r * 0.38), dots, subdiv=1)
    for i, x in enumerate((-0.4, 0.4)):
        seat(i, x, 0.0, 2 * R - 0.02)


def sofa():
    """Cosy sofa: soft cushions, rolled arms, wooden feet and a throw pillow."""
    fabric, soft = material("Fabric", "#6d8fb8", rough=0.95), material("FabricSoft", "#7f9fc6", rough=0.95)
    wood, accent = material("WoodDark", "#5a3a26"), material("Accent", "#f2d4a8", rough=0.95)
    W, D = 1.8, 0.86
    box("base", (W - 0.3, D - 0.08, 0.22), (0, 0.0, 0.21), fabric, bevel=0.04, segments=3, smooth=50)
    box("back", (W - 0.3, 0.2, 0.5), (0, 0.33, 0.55), fabric, bevel=0.06, segments=4, smooth=50)
    for s in (-1, 1):
        x = (W / 2 - 0.12) * s
        box(f"arm{s}", (0.22, D, 0.42), (x, 0.0, 0.31), fabric, bevel=0.05, segments=3, smooth=50)
        cyl(f"roll{s}", 0.12, 0.12, D, (x, 0.0, 0.54), soft, segs=18, rot=(math.radians(90), 0, 0), bevel=0.03, smooth=50)
        box(f"seat{s}", (0.72, 0.52, 0.16), (0.37 * s, -0.08, 0.40), soft, bevel=0.06, segments=4, smooth=50)
        box(f"cush{s}", (0.72, 0.17, 0.42), (0.37 * s, 0.18, 0.66), soft, bevel=0.07, segments=4,
            rot=(-math.radians(10), 0, 0), smooth=50)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"foot{sx}{sy}", 0.035, 0.024, 0.1, (0.78 * sx, 0.33 * sy, 0.05), wood, segs=10)
    box("pillow", (0.32, 0.12, 0.32), (-0.6, 0.04, 0.6), accent, bevel=0.06, segments=4, rot=(-0.25, 0, 0.35), smooth=50)
    for i, x in enumerate((-0.37, 0.37)):
        seat(i, x, -0.14, 0.48)


def chair():
    """Wooden chair: tapered legs, spindle back, a cushion pad (the game recolours it)."""
    wood, dark = material("Wood", "#a8743f"), material("WoodDark", "#7a5232")
    fabric = material("Fabric", "#c0533f", rough=0.95)
    H, lean = 0.44, -math.radians(8)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cyl(f"leg{sx}{sy}", 0.022, 0.03, H, (0.19 * sx, 0.18 * sy, H / 2), wood, segs=10)
        cyl(f"stretch{sx}", 0.012, 0.012, 0.36, (0.19 * sx, 0, 0.14), dark, segs=8, rot=(math.radians(90), 0, 0))
    box("seatboard", (0.48, 0.46, 0.05), (0, 0, H), wood, bevel=0.015)
    for sx in (-1, 1):
        cyl(f"post{sx}", 0.022, 0.025, 0.5, (0.19 * sx, 0.21, H + 0.25), wood, segs=10, rot=(lean, 0, 0))
    box("toprail", (0.46, 0.04, 0.09), (0, 0.245, 0.88), wood, bevel=0.015, rot=(lean, 0, 0))
    for i, x in enumerate((-0.09, 0.0, 0.09)):
        cyl(f"spindle{i}", 0.012, 0.012, 0.36, (x, 0.225, 0.68), dark, segs=8, rot=(lean, 0, 0))
    box("cushion", (0.42, 0.4, 0.05), (0, -0.01, H + 0.045), fabric, bevel=0.022, segments=3, smooth=50)
    seat(0, 0.0, -0.06, H + 0.07)


def rocking_chair():
    """Rocking chair: curved rockers, tall spindle back, armrests, a cushion."""
    wood, dark = material("Wood", "#b98a5e"), material("WoodDark", "#7a5232")
    fabric = material("Fabric", "#e8b4a0", rough=0.95)
    H = 0.42
    for s in (-1, 1):
        x = 0.23 * s
        tube(f"rocker{s}", [(x, y, 0.025 + 0.32 * y * y) for y in (-0.5, -0.3, 0.0, 0.3, 0.5)], 0.024, dark)
        cyl(f"legF{s}", 0.022, 0.026, 0.6, (x, -0.2, 0.3), wood, segs=10)  # front leg up to the armrest
        cyl(f"legB{s}", 0.022, 0.026, 1.06, (x, 0.24, 0.53), wood, segs=10, rot=(-math.radians(9), 0, 0))
        tube(f"arm{s}", [(x * 1.08, 0.24, 0.62), (x * 1.12, 0.0, 0.63), (x * 1.08, -0.24, 0.6)], 0.022, wood)
    box("seatboard", (0.5, 0.48, 0.05), (0, 0.0, H), wood, bevel=0.015)
    box("toprail", (0.5, 0.045, 0.1), (0, 0.32, 1.02), wood, bevel=0.018, rot=(-math.radians(9), 0, 0))
    for i, x in enumerate((-0.14, -0.07, 0.0, 0.07, 0.14)):
        cyl(f"spindle{i}", 0.011, 0.011, 0.56, (x, 0.28, 0.74), dark, segs=8, rot=(-math.radians(9), 0, 0))
    box("cushion", (0.44, 0.42, 0.06), (0, -0.01, H + 0.05), fabric, bevel=0.025, segments=3, smooth=50)
    box("backpad", (0.34, 0.05, 0.34), (0, 0.24, 0.68), fabric, bevel=0.024, segments=3, rot=(-math.radians(9), 0, 0), smooth=50)
    seat(0, 0.0, -0.07, H + 0.08)


def haybale():
    """A small rectangular hay bale: tufty straw, two twine bands, loose strands."""
    random.seed("hay")
    hay, pale, twine = material("Hay", "#e0c06a"), material("HayPale", "#f0d98e"), material("Twine", "#7a5a32")
    W, D, H = 0.95, 0.5, 0.46
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(W, D, H), verts=bm.verts)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=5, use_grid_fill=True)
    for v in bm.verts:  # rough, strawy surface
        n = Vector((v.co.x / W, v.co.y / D, v.co.z / H))
        v.co += n.normalized() * random.uniform(-0.012, 0.014)
    bmesh.ops.translate(bm, vec=(0, 0, H / 2), verts=bm.verts)
    ob = mesh_object("bale", bm, [hay])
    finish(ob, bevel=0.03, segments=1, smooth=25)
    for s in (-1, 1):
        box(f"twine{s}", (0.035, D + 0.02, H + 0.02), (0.22 * s, 0, H / 2), twine, bevel=0.008)
    for i in range(14):  # loose strands poking out
        side = random.choice((-1, 1))
        loc = (side * (W / 2 + 0.02), random.uniform(-0.2, 0.2), random.uniform(0.08, H - 0.05))
        cyl(f"straw{i}", 0.006, 0.002, random.uniform(0.08, 0.15), loc, pale, segs=4,
            rot=(random.uniform(-0.6, 0.6), side * math.radians(90) + random.uniform(-0.4, 0.4), 0))
    for i, x in enumerate((-0.22, 0.22)):
        seat(i, x, 0.0, H + 0.01)


PROPS = {"bench": bench, "log": log, "sofa": sofa, "chair": chair, "rocking_chair": rocking_chair, "haybale": haybale}

for name, build in PROPS.items():
    if ONLY and name not in ONLY:
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    build()
    join_meshes(name)
    export(name)
    if PREVIEW:
        preview(name)
