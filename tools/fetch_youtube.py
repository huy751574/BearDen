"""Match the channel's YouTube videos to Archive scenes -> tools/youtube_map.csv

Each scene gets up to two videos: an "instrumental" slot and a "lyrics" slot.
Signals used per (scene, video) pair:
  - song-title similarity  (WAV names vs video title)
  - scene keywords         (folder name words found in the title)
  - duration               (WAV length vs video length; sum for compilations)
  - lyrics flag            ("Lyrics" in the title vs lyrics songs in the scene)

Review workflow:
  1. python tools/fetch_youtube.py            (fetches the channel list, writes the CSV)
  2. Open tools/youtube_map.csv and check rows with status = review / missing.
     Fix video_id where needed and put "y" in the confirmed column.
  3. Re-run: confirmed rows are kept as-is, everything else is re-matched.
  4. python tools/build_manifest.py           (copies links into the game data)

Options: --refresh re-downloads the video list (otherwise the cache is reused).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import struct
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np
from rapidfuzz import fuzz
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = Path(r"F:\LoopVid\Archive")
CHANNEL = "https://www.youtube.com/@BearDenLofi"
MANIFEST = ROOT / "src" / "data" / "manifest.json"
CACHE = ROOT / "tools" / "cache" / "youtube_videos.json"
OUT_CSV = ROOT / "tools" / "youtube_map.csv"
OUT_UNUSED = ROOT / "tools" / "youtube_unmatched.txt"

FIELDS = ["scene_id", "scene_title", "kind", "video_id", "video_title", "score", "status", "confirmed"]
MIN_SCORE = 0.33
OK_SCORE = 0.62
OK_MARGIN = 0.08

STOP = {
    "the", "a", "an", "and", "of", "in", "on", "at", "to", "with", "is", "are", "his", "her",
    "bear", "black", "friends", "friend", "being", "out", "up", "for", "by", "from", "through",
    "lyrics", "top", "get", "got", "too", "make", "having", "visit", "visiting",
}
GENERIC_SONGS = {"audio", "audio slow", "the bear"}


# ---------------------------------------------------------------- text utils

def norm(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-zA-Z0-9]+", " ", text).lower()
    return re.sub(r"\s+", " ", text).strip()


def stem(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    for suf in ("ing", "es", "s"):
        if len(word) > 4 and word.endswith(suf):
            return word[: -len(suf)]
    return word


def song_core(title: str) -> str:
    """'Midnight Through the Window (3)' -> 'midnight through the window'."""
    t = re.sub(r"\((lyrics|\d+)\)", " ", title, flags=re.I)
    t = re.sub(r"^\s*0\s+", "", t)
    return norm(t)


def keywords(scene: dict) -> set[str]:
    words = norm(" ".join([scene["title"], scene.get("subLabel", ""), scene["theme"].replace("-", " ")])).split()
    return {stem(w) for w in words if w not in STOP and len(w) > 2}


# ---------------------------------------------------------------- durations

def wav_seconds(path: Path) -> float | None:
    """Read duration from the RIFF header (works for PCM, float and extensible)."""
    try:
        with path.open("rb") as f:
            if f.read(12)[8:12] != b"WAVE":
                return None
            byte_rate = None
            while True:
                head = f.read(8)
                if len(head) < 8:
                    return None
                cid, size = head[:4], struct.unpack("<I", head[4:])[0]
                if cid == b"fmt ":
                    fmt = f.read(size)
                    byte_rate = struct.unpack("<I", fmt[8:12])[0]
                elif cid == b"data":
                    if not byte_rate:
                        return None
                    if size in (0, 0xFFFFFFFF):  # streamed / unknown size
                        size = path.stat().st_size - f.tell()
                    return size / byte_rate
                else:
                    f.seek(size + (size & 1), 1)
    except OSError:
        return None


def duration_score(video_dur: float | None, wav_durs: list[float]) -> float:
    if not video_dur or not wav_durs:
        return 0.0
    candidates = wav_durs + [sum(wav_durs)]
    d = min(abs(video_dur - w) for w in candidates)
    if d <= 1.5:
        return 1.0
    if d <= 4:
        return 0.6
    return max(0.0, 0.3 - d / 200)


# ---------------------------------------------------------------- youtube

def fetch_videos(refresh: bool) -> list[dict]:
    if CACHE.exists() and not refresh:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    print(f"Fetching video list from {CHANNEL}/videos ...")
    proc = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "--flat-playlist", "--dump-json", f"{CHANNEL}/videos"],
        capture_output=True, text=True, encoding="utf-8", check=True,
    )
    videos = []
    for line in proc.stdout.splitlines():
        v = json.loads(line)
        videos.append({"id": v["id"], "title": v.get("title") or "", "duration": v.get("duration")})
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(videos, ensure_ascii=False, indent=1), encoding="utf-8")
    return videos


# ---------------------------------------------------------------- matching

def score_pair(scene: dict, video: dict) -> float:
    vt = norm(video["title"])
    if not vt:
        title_s = 0.0
        kw_s = 0.0
    else:
        title_s = 0.0
        for s in scene["_songs"]:
            if s in GENERIC_SONGS or len(s) < 4:
                continue
            weight = min(1.0, len(s) / 12)
            title_s = max(title_s, fuzz.partial_ratio(s, vt) / 100 * weight)
        kws = scene["_kw"]
        vwords = {stem(w) for w in vt.split()}
        kw_s = len(kws & vwords) / len(kws) if kws else 0.0
    dur_s = duration_score(video["duration"], scene["_durs"])

    score = 0.4 * title_s + 0.25 * kw_s + 0.35 * dur_s
    if video["_lyrics"] and not scene["hasLyrics"]:
        score *= 0.6
    return score


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download the channel video list")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    scenes = manifest["scenes"]
    videos = fetch_videos(args.refresh)
    vids_by_id = {v["id"]: v for v in videos}
    for v in videos:
        v["_lyrics"] = "lyric" in v["title"].lower()

    print(f"{len(videos)} videos, {len(scenes)} scenes. Reading WAV durations ...")
    for s in scenes:
        s["_songs"] = sorted({song_core(x["title"]) for x in s["songs"]})
        s["_kw"] = keywords(s)
        s["_durs"] = [d for x in s["songs"] if (d := wav_seconds(ARCHIVE / x["file"]))]
        has_inst = any(not x["lyrics"] for x in s["songs"]) or not s["songs"]
        s["_slots"] = (["instrumental"] if has_inst else []) + (["lyrics"] if s["hasLyrics"] else [])

    # Keep rows the user confirmed.
    confirmed: dict[tuple[str, str], dict] = {}
    if OUT_CSV.exists():
        with OUT_CSV.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("confirmed", "").strip().lower() in ("y", "yes", "1", "x", "claude"):
                    confirmed[(row["scene_id"], row["kind"])] = row
    used_videos = {r["video_id"] for r in confirmed.values() if r["video_id"]}

    # Score every (slot, video) pair, then solve the assignment that maximises
    # the total score (a greedy pick-best-first gets chains of swaps wrong).
    free_videos = [v for v in videos if v["id"] not in used_videos]
    slots = [(s["id"], k) for s in scenes for k in s["_slots"] if (s["id"], k) not in confirmed]
    scene_by_id = {s["id"]: s for s in scenes}
    score = np.zeros((len(slots), len(free_videos)))
    for i, (sid, kind) in enumerate(slots):
        sc = scene_by_id[sid]
        for j, v in enumerate(free_videos):
            vk = "lyrics" if v["_lyrics"] else "instrumental"
            if vk != kind and len(sc["_slots"]) > 1:
                continue  # scene has both slots: lyrics videos only fill the lyrics slot
            score[i, j] = score_pair(sc, v)

    rows_i, cols_j = linear_sum_assignment(score, maximize=True)
    assigned: dict[tuple[str, str], tuple[float, str]] = {}
    for i, j in zip(rows_i, cols_j):
        if score[i, j] >= MIN_SCORE:
            assigned[slots[i]] = (float(score[i, j]), free_videos[j]["id"])
            used_videos.add(free_videos[j]["id"])

    # Ambiguity: how much better this video fits its slot than any other slot.
    runner_up: dict[str, float] = {}
    for j, v in enumerate(free_videos):
        col = np.sort(score[:, j])[::-1]
        runner_up[v["id"]] = float(col[1]) if len(col) > 1 else 0.0

    rows = []
    counts = {"ok": 0, "review": 0, "missing": 0, "confirmed": 0}
    for s in scenes:
        # Confirmed rows may add a slot the folders don't imply (e.g. an
        # instrumental video for a lyrics-only scene); keep those too.
        extra = [k for (sid, k) in confirmed if sid == s["id"] and k not in s["_slots"]]
        for kind in s["_slots"] + extra:
            key = (s["id"], kind)
            if key in confirmed:
                rows.append({k: confirmed[key].get(k, "") for k in FIELDS})
                counts["confirmed"] += 1
                continue
            if key in assigned:
                sc, vid = assigned[key]
                margin = sc - runner_up[vid] if runner_up[vid] < sc else 0.0
                status = "ok" if sc >= OK_SCORE and margin >= OK_MARGIN else "review"
                rows.append({
                    "scene_id": s["id"], "scene_title": s["title"], "kind": kind,
                    "video_id": vid, "video_title": vids_by_id[vid]["title"],
                    "score": f"{sc:.2f}", "status": status, "confirmed": "",
                })
            else:
                status = "missing"
                rows.append({
                    "scene_id": s["id"], "scene_title": s["title"], "kind": kind,
                    "video_id": "", "video_title": "", "score": "", "status": status, "confirmed": "",
                })
            counts[status] += 1

    with OUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

    unused = [v for v in videos if v["id"] not in used_videos]
    OUT_UNUSED.write_text(
        "Videos not linked to any scene (use these ids to fill 'missing' rows):\n\n"
        + "\n".join(f"{v['id']}\t{v['duration']}s\t{v['title']}" for v in unused),
        encoding="utf-8",
    )

    print(f"Wrote {OUT_CSV.relative_to(ROOT)}")
    print(f"  ok: {counts['ok']}  review: {counts['review']}  missing: {counts['missing']}  confirmed: {counts['confirmed']}")
    print(f"  {len(unused)} unlinked videos listed in {OUT_UNUSED.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
