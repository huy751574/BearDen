"""Scan the Archive folder and build src/data/manifest.json.

Folder convention:  <Theme>-<Scene>[-Lyrics]
  - "X" and "X-Lyrics" are merged into one scene (hasLyrics = True).
  - Any "Cover_<Game>" prefix is grouped into the single "Cover" theme.
  - Every .wav in a scene folder becomes one song in that scene's playlist.

Scenes already in the manifest whose folders are gone (packed away, e.g.
into Archive.7z) are kept as they are: their media is already in
public/media. --prune drops them instead.

Re-run whenever you add folders:
    python tools/build_manifest.py [--archive F:/LoopVid/Archive] [--prune]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_ARCHIVE = Path(r"F:\LoopVid\Archive")
OUT = ROOT / "src" / "data" / "manifest.json"
YOUTUBE_CSV = ROOT / "tools" / "youtube_map.csv"  # written by fetch_youtube.py

LYRICS_SUFFIX = "-Lyrics"
COVER_PREFIX = "Cover_"


def slugify(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^A-Za-z0-9]+", "-", text).strip("-").lower()
    return text


def pretty(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace("_", " ")).strip()


def parse_folder(name: str, known_games: list[str]) -> tuple[str, str, str] | None:
    """Return (theme, subLabel, sceneName) or None if the name can't be parsed."""
    if name.startswith(COVER_PREFIX):
        rest = name[len(COVER_PREFIX):]
        if "-" in rest:
            game, scene = rest.split("-", 1)
            return "Cover", game, scene
        # No dash (e.g. "Cover_Genshin_Impact_Black_bear_..."): match a known game prefix.
        for game in sorted(known_games, key=len, reverse=True):
            if rest.startswith(game + "_"):
                return "Cover", game, rest[len(game) + 1:]
        return "Cover", "", rest
    if "-" not in name:
        return None
    theme, scene = name.split("-", 1)
    return theme, "", scene


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", type=Path, default=DEFAULT_ARCHIVE)
    ap.add_argument("--prune", action="store_true", help="drop scenes whose folders are no longer in the archive")
    args = ap.parse_args()
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {"themes": [], "scenes": []}

    folders = sorted(p for p in args.archive.iterdir() if p.is_dir())
    known_games = sorted({
        p.name[len(COVER_PREFIX):].split("-", 1)[0]
        for p in folders
        if p.name.startswith(COVER_PREFIX) and "-" in p.name
    })

    scenes: dict[str, dict] = {}
    unparsed: list[str] = []

    for folder in folders:
        is_lyrics = folder.name.endswith(LYRICS_SUFFIX)
        base = folder.name[: -len(LYRICS_SUFFIX)] if is_lyrics else folder.name
        parsed = parse_folder(base, known_games)
        if parsed is None:
            unparsed.append(folder.name)
            continue
        theme, sub, scene_name = parsed

        sid = slugify(base)
        scene = scenes.setdefault(sid, {
            "id": sid,
            "theme": theme,
            "subLabel": pretty(sub),
            "title": pretty(scene_name),
            "folders": [],
            "hasLyrics": False,
            "video": None,
            "songs": [],
            "youtube": [],
        })
        scene["folders"].append(folder.name)
        scene["hasLyrics"] = scene["hasLyrics"] or is_lyrics

        videos = sorted(folder.glob("*.mp4"))
        # Prefer the plain folder's video; the -Lyrics one is usually identical.
        if videos and (scene["video"] is None or not is_lyrics):
            scene["video"] = f"{folder.name}/{videos[0].name}"

        for wav in sorted(folder.glob("*.wav"), key=lambda p: natural_key(p.stem)):
            scene["songs"].append({
                "title": wav.stem,
                "file": f"{folder.name}/{wav.name}",
                "lyrics": is_lyrics,
            })

    # Keep earlier scenes whose folders were packed away (unless --prune).
    kept = 0
    if not args.prune:
        for s in old["scenes"]:
            if s["id"] not in scenes and not any((args.archive / f).is_dir() for f in s.get("folders", [])):
                scenes[s["id"]] = dict(s)
                kept += 1

    links = load_youtube_links()
    for sid, vids in links.items():
        if sid in scenes:
            scenes[sid]["youtube"] = vids

    # Themes by slug (kept scenes already carry the slug); names from the old manifest when known.
    old_names = {t["id"]: t["name"] for t in old["themes"]}
    themes: dict[str, dict] = {}
    for s in scenes.values():
        slug = slugify(s["theme"])
        t = themes.setdefault(slug, {"id": slug, "name": old_names.get(slug) or pretty(s["theme"]), "scenes": []})
        t["scenes"].append(s["id"])

    manifest = {
        "themes": sorted(themes.values(), key=lambda t: t["name"].lower()),
        "scenes": sorted(scenes.values(), key=lambda s: (slugify(s["theme"]), s["title"])),
    }
    for s in manifest["scenes"]:
        s["theme"] = slugify(s["theme"])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Wrote {OUT.relative_to(ROOT)}")
    print(f"{len(folders)} folders -> {len(manifest['scenes'])} scenes in {len(manifest['themes'])} themes"
          + (f" ({kept} kept from earlier, folders packed away)" if kept else ""))
    for t in manifest["themes"]:
        print(f"  {t['name']:<14} {len(t['scenes']):>3} scenes")
    linked = sum(1 for s in manifest["scenes"] if s["youtube"])
    print(f"YouTube: {linked}/{len(manifest['scenes'])} scenes linked"
          + ("" if YOUTUBE_CSV.exists() else " (run tools/fetch_youtube.py)"))
    no_song = [s["id"] for s in manifest["scenes"] if not s["songs"]]
    no_video = [s["id"] for s in manifest["scenes"] if not s["video"]]
    if no_song:
        print(f"WARNING scenes without .wav: {no_song}")
    if no_video:
        print(f"WARNING scenes without .mp4: {no_video}")
    if unparsed:
        print(f"WARNING unparsed folders (no '-'): {unparsed}")
    return 0


def load_youtube_links() -> dict[str, list[dict]]:
    """scene_id -> [{id, title, kind}], instrumental first."""
    links: dict[str, list[dict]] = {}
    if not YOUTUBE_CSV.exists():
        return links
    with YOUTUBE_CSV.open(encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            vid = row["video_id"].strip()
            if vid:
                links.setdefault(row["scene_id"], []).append(
                    {"id": vid, "title": row["video_title"], "kind": row["kind"]})
    for vids in links.values():
        vids.sort(key=lambda v: v["kind"] != "instrumental")
    return links


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


if __name__ == "__main__":
    sys.exit(main())
