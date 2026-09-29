"""Run the whole content pipeline after adding folders to the Archive.

    python tools/sync_all.py            # uses the cached YouTube video list
    python tools/sync_all.py --refresh  # also re-downloads the channel list (after new uploads)

Steps: build manifest -> match YouTube videos -> rebuild manifest with links -> make media
-> analyze scenes (sky colours, time of day, world below the island).
Then check tools/youtube_map.csv for rows with status review/missing.
"""
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent


def step(script: str, *args: str) -> None:
    print(f"\n=== {script} {' '.join(args)}")
    subprocess.run([sys.executable, str(TOOLS / script), *args], check=True)


if __name__ == "__main__":
    refresh = ["--refresh"] if "--refresh" in sys.argv else []
    step("build_manifest.py")
    step("fetch_youtube.py", *refresh)
    step("build_manifest.py")
    step("make_media.py")
    step("analyze_scenes.py")
