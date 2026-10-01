"""Shrink the character GLBs in public/models for the web.

    python tools/compress_models.py          # new / changed files only
    python tools/compress_models.py --all    # redo every file from the originals

Per file (with gltf-transform, fetched by npx):
  resample  drop redundant animation keyframes (Tripo bakes every frame)
  prune     remove unused data
  resize    textures to at most 1024 px (2048 costs ~22 MB of GPU memory each)
  meshopt   compress meshes and animations (the game's loader decodes it)

Typically 70-80% smaller. Each rigged model also gets <name>.lite.glb:
about a quarter of the triangles and 512 px textures, for crowds (the lounge
shows up to 50 avatars at once).

The untouched Tripo downloads are kept in
tools/cache/models_raw/ (git-ignored), so running again never compresses
twice and --all starts from the originals.
"""
from __future__ import annotations

import json
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"
RAW = ROOT / "tools" / "cache" / "models_raw"
GLTF_TRANSFORM = ["npx", "-y", "@gltf-transform/cli@4"]
MAX_TEXTURE = 1024
LITE_RATIO = 0.25
LITE_TEXTURE = 512


def extensions(path: Path) -> set[str]:
    """extensionsUsed from a GLB's JSON chunk."""
    data = path.read_bytes()
    if data[:4] != b"glTF":
        return set()
    length = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + length])
    return set(doc.get("extensionsUsed", []))


def run(*args: str | Path) -> None:
    cmd = [*GLTF_TRANSFORM, *map(str, args)]
    # npx is a .cmd on Windows, so it needs the shell there.
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
                         shell=sys.platform == "win32")
    if res.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd[3:5])} failed:\n{res.stdout}{res.stderr}")


def compress(src: Path, dest: Path, lite: bool = False) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp) / "a.glb", Path(tmp) / "b.glb"
        run("resample", src, a)
        run("prune", a, b)
        if lite:
            run("simplify", b, a, "--ratio", LITE_RATIO, "--error", "0.01")
            a, b = b, a
        size = LITE_TEXTURE if lite else MAX_TEXTURE
        run("resize", b, a, "--width", size, "--height", size)
        run("meshopt", a, b)
        shutil.copyfile(b, dest)


def is_rigged(path: Path) -> bool:
    data = path.read_bytes()
    length = struct.unpack_from("<I", data, 12)[0]
    return bool(json.loads(data[20:20 + length]).get("skins"))


def main() -> int:
    redo = "--all" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    files = sorted(f for f in MODELS.glob("*.glb") if not f.stem.endswith(".lite"))
    if not files:
        print("No models in public/models.")
        return 0
    before = after = 0
    for path in files:
        raw = RAW / path.name
        done = "EXT_meshopt_compression" in extensions(path)
        if done and not redo:
            continue
        if not done:
            shutil.copyfile(path, raw)  # a fresh download: keep it as the original
        elif not raw.exists():
            print(f"  skip {path.name}: already compressed and no original in {RAW.name}")
            continue
        size0 = raw.stat().st_size
        compress(raw, path)
        size1 = path.stat().st_size
        before += size0
        after += size1
        print(f"  {path.name}: {size0 / 1e6:.2f} MB -> {size1 / 1e6:.2f} MB")
    # Lighter copies of the rigged models (not clips), for crowds.
    for path in files:
        raw = RAW / path.name
        lite = path.with_name(f"{path.stem}.lite.glb")
        if "@" in path.stem or not raw.exists() or not is_rigged(raw):
            continue
        # Rebuild when the model was re-generated after the lite copy was made.
        if lite.exists() and not redo and lite.stat().st_mtime >= raw.stat().st_mtime:
            continue
        compress(raw, lite, lite=True)
        print(f"  {lite.name}: {lite.stat().st_size / 1e6:.2f} MB (crowd version)")
    if before:
        print(f"Total {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
    else:
        print("All models are already compressed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
