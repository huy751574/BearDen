"""Check character models in public/models and register them for the game.

File convention (what tools/tripo_character.py produces):
    public/models/bear.glb          rigged model (+ its idle animation)
    public/models/bear@walk.glb     extra clips on the same skeleton
    public/models/bear@run.glb ...  clip names: idle, walk, run, sit, wave

Checks each GLB (rigged? has clips? do the clip files animate bones that
exist in the model?) and writes src/data/models.json, which the game reads
at build time. Per-model "forward", "height" and any other settings are kept from the previous
models.json, so edit them there if a model faces the wrong way or is too big.
    python tools/check_models.py
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"
OUT = ROOT / "src" / "data" / "models.json"

DEFAULTS = {"forward": "+x", "height": 1.5}  # Tripo exports X-forward
KNOWN_CLIPS = {"idle", "walk", "run", "sit", "wave", "dance", "cheer", "sing", "clap", "victory", "hurt"}
BIG_FILE_MB = 15


def read_gltf_json(path: Path) -> dict:
    data = path.read_bytes()
    magic, version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise ValueError("not a GLB file")
    chunk_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON":
        raise ValueError("first chunk is not JSON")
    return json.loads(data[20:20 + chunk_len])


def animated_node_names(gltf: dict) -> set[str]:
    nodes = gltf.get("nodes", [])
    names = set()
    for anim in gltf.get("animations", []):
        for ch in anim.get("channels", []):
            idx = ch.get("target", {}).get("node")
            if idx is not None and idx < len(nodes):
                names.add(nodes[idx].get("name", f"#{idx}"))
    return names


def main() -> int:
    if not MODELS.exists():
        print(f"No {MODELS.relative_to(ROOT)} folder yet: nothing to register.")
        OUT.write_text("{}\n", encoding="utf-8")
        return 0
    previous = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    files = sorted(MODELS.glob("*.glb"))
    # <name>.lite.glb is a lighter copy of <name>.glb (compress_models.py), not a model of its own.
    bases = sorted({f.stem.split("@")[0] for f in files if not f.stem.endswith(".lite")})
    registry: dict[str, dict] = {}
    problems = 0

    for base in bases:
        model_path = MODELS / f"{base}.glb"
        print(f"\n== {base}")
        if not model_path.exists():
            print(f"  ERROR: clip files found but no {base}.glb model")
            problems += 1
            continue
        try:
            model = read_gltf_json(model_path)
        except (ValueError, struct.error, json.JSONDecodeError) as e:
            print(f"  ERROR: {model_path.name}: {e}")
            problems += 1
            continue

        size = model_path.stat().st_size / 1e6
        skins, meshes = len(model.get("skins", [])), len(model.get("meshes", []))
        used = model.get("extensionsUsed", [])
        print(f"  model  {model_path.name}: {size:.1f} MB, {meshes} mesh(es), {skins} skin(s), "
              f"{len(model.get('animations', []))} clip(s)")
        if not skins:
            print("  WARN: no skin: the model isn't rigged, so it can't animate")
        if "KHR_draco_mesh_compression" in used:
            print("  ERROR: Draco-compressed mesh: the game has no Draco decoder; export without Draco")
            problems += 1
        if size > BIG_FILE_MB:
            print(f"  WARN: large file (> {BIG_FILE_MB} MB): consider a lower face_limit")
        bone_names = {n.get("name") for n in model.get("nodes", [])}

        clips: dict[str, str] = {}
        if model.get("animations"):
            clips["idle"] = f"models/{model_path.name}"
        for clip_path in sorted(MODELS.glob(f"{base}@*.glb")):
            clip = clip_path.stem.split("@", 1)[1]
            try:
                g = read_gltf_json(clip_path)
            except (ValueError, struct.error, json.JSONDecodeError) as e:
                print(f"  ERROR: {clip_path.name}: {e}")
                problems += 1
                continue
            targets = animated_node_names(g)
            match = len(targets & bone_names) / len(targets) if targets else 0
            note = "" if clip in KNOWN_CLIPS else "  (unknown clip name: the game won't use it)"
            print(f"  clip   {clip:<6} {clip_path.name}: {len(g.get('animations', []))} anim, "
                  f"{match:.0%} of {len(targets)} animated bones found in the model{note}")
            if not g.get("animations"):
                print(f"  ERROR: {clip_path.name} has no animation")
                problems += 1
                continue
            if match < 0.9:
                print(f"  ERROR: {clip_path.name} animates bones the model doesn't have (different rig?)")
                problems += 1
                continue
            clips[clip] = f"models/{clip_path.name}"

        missing = [c for c in ("idle", "walk") if c not in clips]
        if missing:
            print(f"  WARN: missing clips {missing}: the bear will slide/stand still for those")
        prev = previous.get(base, {})
        registry[base] = {
            "file": f"models/{model_path.name}",
            "clips": clips,
            "forward": prev.get("forward", DEFAULTS["forward"]),
            "height": prev.get("height", DEFAULTS["height"]),
            **({"lite": f"models/{base}.lite.glb"} if (MODELS / f"{base}.lite.glb").exists() else {}),
            # Any other hand-added settings (e.g. "hairFix") are kept too.
            **{k: v for k, v in prev.items() if k not in ("file", "clips", "forward", "height", "lite")},
        }

    OUT.write_text(json.dumps(registry, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {OUT.relative_to(ROOT)}: {', '.join(registry) or 'no models'}"
          + (f"  ({problems} problem(s))" if problems else ""))
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
