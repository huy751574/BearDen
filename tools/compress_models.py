"""Shrink the character GLBs in public/models for the web.

    python tools/compress_models.py          # new / changed files only
    python tools/compress_models.py --all    # redo every file from the originals

Per file (with gltf-transform, fetched by npx):
  resample  drop redundant animation keyframes (Tripo bakes every frame)
  prune     remove unused data
  resize    textures to at most 1024 px (2048 costs ~22 MB of GPU memory each)
  meshopt   compress meshes and animations (the game's loader decodes it)

Typically 70-80% smaller. The untouched Tripo downloads are kept in
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


def compress(src: Path, dest: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        a, b = Path(tmp) / "a.glb", Path(tmp) / "b.glb"
        run("resample", src, a)
        run("prune", a, b)
        run("resize", b, a, "--width", MAX_TEXTURE, "--height", MAX_TEXTURE)
        run("meshopt", a, b)
        shutil.copyfile(b, dest)


def main() -> int:
    redo = "--all" in sys.argv
    RAW.mkdir(parents=True, exist_ok=True)
    files = sorted(MODELS.glob("*.glb"))
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
    if before:
        print(f"Total {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB")
    else:
        print("All models are already compressed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
