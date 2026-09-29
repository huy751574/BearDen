"""Create web media for every scene in the manifest (needs ffmpeg on PATH).

  public/media/<scene-id>/thumb.webp   480px menu thumbnail (frame at 2s)
  public/media/<scene-id>/loop.mp4     960x540 silent H.264 loop for the in-game backdrop

Existing files are skipped, so re-running only processes new scenes.
    python tools/make_media.py [--force] [--jobs 3]
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = Path(r"F:\LoopVid\Archive")
MANIFEST = ROOT / "src" / "data" / "manifest.json"
MEDIA = ROOT / "public" / "media"


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def process(scene: dict, force: bool) -> str:
    src = ARCHIVE / scene["video"]
    out = MEDIA / scene["id"]
    out.mkdir(parents=True, exist_ok=True)
    thumb, loop = out / "thumb.webp", out / "loop.mp4"
    done = []
    try:
        if force or not thumb.exists():
            run(["ffmpeg", "-y", "-ss", "2", "-i", str(src), "-frames:v", "1",
                 "-vf", "scale=480:-2", "-quality", "82", str(thumb)])
            done.append("thumb")
        if force or not loop.exists():
            run(["ffmpeg", "-y", "-i", str(src), "-an",
                 "-vf", "scale=960:-2,fps=24", "-c:v", "libx264", "-preset", "slow", "-crf", "28",
                 "-pix_fmt", "yuv420p", "-profile:v", "main", "-movflags", "+faststart", str(loop)])
            done.append("loop")
    except subprocess.CalledProcessError as e:
        return f"FAIL {scene['id']}: {e.stderr.decode(errors='replace')[-300:]}"
    return f"{'made ' + '+'.join(done) if done else 'skip':<16} {scene['id']}"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="rebuild even if files exist")
    ap.add_argument("--jobs", type=int, default=3)
    args = ap.parse_args()

    scenes = [s for s in json.loads(MANIFEST.read_text(encoding="utf-8"))["scenes"] if s["video"]]
    with ThreadPoolExecutor(args.jobs) as pool:
        results = list(pool.map(lambda s: process(s, args.force), scenes))
    for r in results:
        print(r)
    fails = [r for r in results if r.startswith("FAIL")]
    size = sum(f.stat().st_size for f in MEDIA.rglob("*") if f.is_file()) / 1e6
    print(f"{len(scenes) - len(fails)}/{len(scenes)} scenes ok, public/media = {size:.0f} MB")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
