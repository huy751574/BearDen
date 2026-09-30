"""Image -> rigged, animated 3D character with the Tripo API (v3) -> game.

    python tools/tripo_character.py --name bear --image refs/bear.png

Pipeline (each step is a Tripo task that is polled until done):
  1. upload the image                POST /v3/files
  2. image -> 3D model               POST /v3/generation/image-to-model
  3. can it be rigged?               POST /v3/animations/rig-check
  4. add a skeleton                  POST /v3/animations/rig
  5. one retarget per animation      POST /v3/animations/retarget
Writes public/models/<name>.glb (model + idle) and <name>@<clip>.glb, then
runs tools/check_models.py so the game picks the model up.

PAID: every step costs Tripo credits. The script prints the plan and asks
before spending; credits used are printed after each step. Progress is saved
in tools/cache/tripo_<name>.json, so if something fails, re-running resumes
without paying again for finished steps. --restart starts over.

API key: set TRIPO_API_KEY in the environment or put
    TRIPO_API_KEY=tsk_...
in .env.local (git-ignored). Never use a VITE_ prefix for it: VITE_ variables
are baked into the public website.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API = "https://openapi.tripo3d.ai/v3"
MODELS = ROOT / "public" / "models"
CACHE = ROOT / "tools" / "cache"

# Game clip name -> Tripo preset (rig model v1.0-20240301, biped).
PRESETS = {
    "idle": "preset:biped:idle",
    "walk": "preset:biped:walk",
    "run": "preset:biped:run",
    "sit": "preset:biped:sit",
    "wave": "preset:biped:wave_goodbye_01",
    # Extras the game may use later:
    "dance": "preset:biped:dance_01",
    "cheer": "preset:biped:cheer",
    "sing": "preset:biped:sing_01",
}
POLL_SECONDS = 3
TASK_TIMEOUT = 20 * 60


class TripoError(RuntimeError):
    pass


def api_key() -> str:
    key = os.environ.get("TRIPO_API_KEY", "").strip()
    env_file = ROOT / ".env.local"
    if not key and env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.strip().startswith("TRIPO_API_KEY="):
                key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("No TRIPO_API_KEY. Add TRIPO_API_KEY=... to .env.local (see the docstring).")
    return key


class Tripo:
    def __init__(self, key: str):
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {key}"

    def _check(self, r: requests.Response) -> dict:
        try:
            body = r.json()
        except ValueError:
            raise TripoError(f"HTTP {r.status_code}: {r.text[:300]}")
        if r.status_code >= 400 or body.get("code", 0) != 0:
            raise TripoError(f"HTTP {r.status_code} code {body.get('code')}: {body.get('message') or body}")
        return body["data"]

    def upload(self, path: Path) -> str:
        with path.open("rb") as f:
            data = self._check(self.s.post(f"{API}/files", files={"file": (path.name, f)}, timeout=120))
        return data["file_token"]

    def create(self, endpoint: str, body: dict) -> str:
        return self._check(self.s.post(f"{API}/{endpoint}", json=body, timeout=60))["task_id"]

    def wait(self, task_id: str, label: str) -> dict:
        start = time.time()
        last = None
        while True:
            data = self._check(self.s.get(f"{API}/tasks/{task_id}", timeout=60))
            status, progress = data.get("status"), data.get("progress")
            if (status, progress) != last:
                print(f"    {label}: {status} {progress if progress is not None else ''}".rstrip())
                last = (status, progress)
            if status == "success":
                if data.get("credits_consumed") is not None:
                    print(f"    credits used: {data['credits_consumed']}")
                return data
            if status in ("failed", "cancelled", "banned", "expired", "unknown"):
                raise TripoError(f"{label} task {task_id} ended with status '{status}': {data.get('error') or ''}")
            if time.time() - start > TASK_TIMEOUT:
                raise TripoError(f"{label} task {task_id} timed out (still {status}); re-run to keep waiting")
            time.sleep(POLL_SECONDS)

    def download(self, url: str, dest: Path):
        dest.parent.mkdir(parents=True, exist_ok=True)
        with requests.get(url, stream=True, timeout=300) as r:
            r.raise_for_status()
            tmp = dest.with_suffix(dest.suffix + ".part")
            with tmp.open("wb") as f:
                for chunk in r.iter_content(1 << 16):
                    f.write(chunk)
            tmp.replace(dest)
        print(f"    saved {dest.relative_to(ROOT)} ({dest.stat().st_size / 1e6:.1f} MB)")


def model_url(task: dict) -> str:
    """Output URL of a finished task (download links expire after ~5 minutes)."""
    out = task.get("output") or {}
    for key in ("model_url", "model", "pbr_model", "base_model"):
        if isinstance(out.get(key), str):
            return out[key]
    urls = out.get("model_urls")
    if isinstance(urls, list) and urls:
        return urls[0] if isinstance(urls[0], str) else urls[0].get("url")
    raise TripoError(f"no model URL in task output: {out}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--name", required=True, help="model name in the game, e.g. bear")
    ap.add_argument("--image", required=True, type=Path, help="front view, full body, plain background (PNG/JPEG/WebP)")
    ap.add_argument("--anims", default="idle,walk,run,sit,wave", help=f"comma list from: {', '.join(PRESETS)}")
    ap.add_argument("--model", default="v3.1-20260211", help="Tripo generation model version")
    ap.add_argument("--face-limit", type=int, default=20000, help="max triangles (web: 10k-50k)")
    ap.add_argument("--autofix", action="store_true", help="let Tripo clean up the input image first")
    ap.add_argument("--yes", action="store_true", help="don't ask before spending credits")
    ap.add_argument("--restart", action="store_true", help="ignore saved progress and start over")
    args = ap.parse_args()

    anims = [a.strip() for a in args.anims.split(",") if a.strip()]
    unknown = [a for a in anims if a not in PRESETS]
    if unknown:
        sys.exit(f"Unknown animation(s) {unknown}. Choose from: {', '.join(PRESETS)}")
    if "idle" not in anims:
        anims.insert(0, "idle")  # idle carries the geometry: always first
    if not args.image.exists():
        sys.exit(f"Image not found: {args.image}")

    CACHE.mkdir(parents=True, exist_ok=True)
    state_path = CACHE / f"tripo_{args.name}.json"
    image_sha = hashlib.sha256(args.image.read_bytes()).hexdigest()[:16]
    state = {} if args.restart or not state_path.exists() else json.loads(state_path.read_text(encoding="utf-8"))
    if state and state.get("image_sha") != image_sha:
        print("Image changed since the last run: starting over.")
        state = {}
    state.setdefault("image_sha", image_sha)
    state.setdefault("anims", {})
    save = lambda: state_path.write_text(json.dumps(state, indent=1), encoding="utf-8")

    todo = []
    if "model_task" not in state: todo.append(f"generate 3D model ({args.model}, face_limit {args.face_limit})")
    if "rig_task" not in state: todo += ["rig check", "auto-rig (biped, mixamo bones)"]
    todo += [f"animation '{a}' ({PRESETS[a]})" for a in anims if a not in state["anims"]]
    if not todo:
        print("Everything is already generated; re-downloading files.")
    else:
        print(f"Tripo pipeline for '{args.name}' from {args.image}:")
        for t in todo:
            print(f"  - {t}")
        print("These steps cost Tripo credits (see https://platform.tripo3d.ai for your balance).")
        if not args.yes and input("Continue? [y/N] ").strip().lower() != "y":
            print("Cancelled; nothing was spent.")
            return 1

    tripo = Tripo(api_key())
    try:
        # 1-2. Upload + image -> model
        if "model_task" not in state:
            print("\n[1/4] Uploading image")
            token = tripo.upload(args.image)
            print("[2/4] Generating 3D model (about 1-2 minutes)")
            body = {"input": token, "model": args.model, "texture": True, "pbr": False,
                    "face_limit": args.face_limit, "texture_alignment": "original_image"}
            if args.autofix:
                body["enable_image_autofix"] = True
            state["model_task"] = tripo.create("generation/image-to-model", body)
            save()
        model_task = tripo.wait(state["model_task"], "model")
        preview = (model_task.get("output") or {}).get("rendered_image_url")
        if preview:
            tripo.download(preview, CACHE / f"{args.name}_preview.webp")

        # 3-4. Rig check + rig
        if "rig_task" not in state:
            print("\n[3/4] Checking the model can be rigged")
            check = tripo.wait(tripo.create("animations/rig-check", {"input": state["model_task"]}), "rig-check")
            out = check.get("output") or {}
            if not out.get("riggable", True):
                raise TripoError("Tripo says this model can't be rigged. Try an image with a clear, "
                                 "standing A-pose (arms slightly out, legs apart) and a plain background.")
            rig_type = out.get("rig_type", "biped")
            if rig_type != "biped":
                print(f"    note: Tripo suggests rig_type '{rig_type}', but the game's animations need biped; using biped")
            print("[4/4] Rigging")
            state["rig_task"] = tripo.create("animations/rig", {
                "input": state["model_task"], "model": "v1.0-20240301", "rig_type": "biped",
                "spec": "mixamo", "out_format": "glb",
            })
            save()
        tripo.wait(state["rig_task"], "rig")

        # 5. One retarget per animation (clear clip names, one file each).
        print("\nAnimations")
        for anim in anims:
            if anim not in state["anims"]:
                state["anims"][anim] = tripo.create("animations/retarget", {
                    "input": state["rig_task"], "animation": PRESETS[anim], "out_format": "glb",
                    "bake_animation": True, "animate_in_place": True,
                    "export_with_geometry": anim == "idle",  # the idle file is the model itself
                })
                save()
            task = tripo.wait(state["anims"][anim], anim)
            dest = MODELS / (f"{args.name}.glb" if anim == "idle" else f"{args.name}@{anim}.glb")
            tripo.download(model_url(task), dest)
    except (TripoError, requests.RequestException) as e:
        print(f"\nStopped: {e}\nProgress is saved; re-run the same command to resume.")
        return 1

    print("\nRegistering models for the game")
    return subprocess.call([sys.executable, str(ROOT / "tools" / "check_models.py")])


if __name__ == "__main__":
    sys.exit(main())
