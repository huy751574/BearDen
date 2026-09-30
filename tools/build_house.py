"""Write server/src/house.json: Bear Den songs the lounge plays when nobody
has queued anything. Uses the channel list cached by fetch_youtube.py for
durations (the server needs them to know when a song ends). Songs longer
than 10 minutes (the long mixes) are left out.
    python tools/build_house.py
Re-deploy the lounge server afterwards (cd server && npx wrangler deploy).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "src" / "data" / "manifest.json"
CACHE = ROOT / "tools" / "cache" / "youtube_videos.json"
OUT = ROOT / "server" / "src" / "house.json"
MAX_SECONDS = 600


def main() -> int:
    if not CACHE.exists():
        sys.exit("No tools/cache/youtube_videos.json: run tools/fetch_youtube.py first.")
    durations = {v["id"]: v.get("duration") for v in json.loads(CACHE.read_text(encoding="utf-8"))}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    songs, seen = [], set()
    for scene in manifest["scenes"]:
        for v in scene["youtube"]:
            d = durations.get(v["id"])
            if v["id"] in seen or not d or d > MAX_SECONDS:
                continue
            seen.add(v["id"])
            songs.append({"videoId": v["id"], "title": v["title"].split(" | ")[0][:100], "duration": int(d)})
    OUT.write_text(json.dumps(songs, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: {len(songs)} house songs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
