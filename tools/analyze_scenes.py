"""Work out each scene's sky + world-below-the-island -> src/data/sceneEnv.json

From the video frame (public/media/<id>/thumb.webp, made by make_media.py):
  - skyTop / skyBottom colours: average of the top rows and the horizon band,
    so the 3D sky blends into the painted backdrop
  - time of day: night / sunset / day from brightness and warmth

From keywords (folder name, scene title, song + YouTube titles):
  - below:   what lies under the sky island (sea, clouds, city, space, ...)
  - weather: rain / snow / petals / fireflies / sparks / none

Edit the JSON freely: set "locked": true on an entry and re-runs keep it as-is.
    python tools/analyze_scenes.py
"""
from __future__ import annotations

import colorsys
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "src" / "data" / "manifest.json"
MEDIA = ROOT / "public" / "media"
OUT = ROOT / "src" / "data" / "sceneEnv.json"

# First matching rule wins, so order = priority.
BELOW_RULES: list[tuple[str, list[str]]] = [
    ("space", ["universe", "cosmos", "space", "astronaut", "earthrise", "trailblazing", "trailblaze", "stardust"]),
    ("storm", ["maelstrom", "maestrom", "kraken", "typhoon", "storm", "stormy", "rolling"]),
    ("sea", ["sea", "ocean", "beach", "island", "bay", "atlantis", "whale", "underwater", "hawaiian", "shanty"]),
    ("desert", ["pyramid", "pyramids", "egypt", "desert", "camel"]),
    ("city", ["city", "neon", "cafe", "café", "ramen", "train", "tokyo", "rooftop", "bar", "jazz", "lounge", "town", "tavern", "guild", "guildhall", "ballroom", "waltz", "stage", "arena", "festival", "square"]),
    ("snow", ["snow", "snowy", "winter", "frozen", "ice", "snowfall", "aurora"]),
    ("lake", ["lake", "river", "stream", "shore", "lakeside", "swamp", "alligator", "salmon", "fishing", "bridge", "onsen", "spring", "suoi", "ho"]),
    ("mountains", ["mountain", "mountains", "peak", "fuji", "cliff", "summit", "canyon", "clouds", "cloud", "castle", "neuschwanstein"]),
    ("forest", ["forest", "jungle", "tarzan", "bamboo", "pines", "camping", "rainforest", "amazon", "angkor", "temple", "dojo", "courtyard"]),
    ("fields", ["wheat", "field", "meadow", "garden", "windmill", "park", "countryside", "butterflies"]),
]

WEATHER_RULES: list[tuple[str, list[str]]] = [
    ("rain", ["rain", "rainy", "storm", "stormy", "typhoon"]),
    ("snow", ["snow", "snowy", "winter", "snowfall", "frozen", "blizzard"]),
    ("sparks", ["mecha", "fire", "battle", "fighting", "boss", "villain", "burning", "transform", "transforms"]),
    ("petals", ["bloom", "sakura", "blossom", "petals", "flower", "flowers", "cherry", "fleurit"]),
    ("fireflies", ["fireflies", "firefly", "lantern", "lanterns", "campfire", "candlelight", "candlelit"]),
]

NIGHT_WORDS = {"night", "midnight", "moon", "moonlit", "moonlight", "stars", "stargazing", "starry", "nocturne", "dark", "darken"}
SUNSET_WORDS = {"sunset", "dusk", "golden", "dawn", "sunrise", "evening", "twilight"}


def words_of(*texts: str) -> set[str]:
    text = " ".join(texts).lower().replace("đ", "d")
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return set(re.findall(r"[a-z]+", text))


def first_rule(rules: list[tuple[str, list[str]]], words: set[str], default: str) -> str:
    for name, keys in rules:
        if words & set(keys):
            return name
    return default


def hexcolor(rgb: tuple[float, float, float]) -> str:
    return "#{:02x}{:02x}{:02x}".format(*(max(0, min(255, round(c))) for c in rgb))


def band_mean(img: Image.Image, y0: float, y1: float) -> tuple[float, float, float]:
    w, h = img.size
    crop = img.crop((0, int(h * y0), w, max(int(h * y0) + 1, int(h * y1)))).resize((1, 1), Image.BOX)
    return crop.getpixel((0, 0))[:3]


def luma(rgb) -> float:
    r, g, b = (c / 255 for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def analyze_image(path: Path) -> dict:
    img = Image.open(path).convert("RGB")
    top = band_mean(img, 0.0, 0.12)
    horizon = band_mean(img, 0.30, 0.45)
    whole = band_mean(img, 0.0, 1.0)
    return {"top": top, "horizon": horizon, "lumaTop": luma(top), "lumaAll": luma(whole),
            "warm": (top[0] + horizon[0] + 1) / (top[2] + horizon[2] + 1)}


def time_of_day(info: dict | None, words: set[str]) -> str:
    night_kw = bool(words & NIGHT_WORDS)
    sunset_kw = bool(words & SUNSET_WORDS)
    if info is None:
        return "night" if night_kw else "sunset" if sunset_kw else "day"
    lt, la, warm = info["lumaTop"], info["lumaAll"], info["warm"]
    if lt < 0.22 or la < 0.2 or (night_kw and lt < 0.4):
        return "night"
    if warm > 1.35 or (sunset_kw and warm > 1.1):
        return "sunset"
    return "day"


# Plausible sky hues (0..1 hue wheel) per time of day, and the fallback hue.
SKY_HUES = {
    "day": ([(0.54, 0.64)], 0.57),                      # sky blue (no teal)
    "night": ([(0.58, 0.80)], 0.65),                    # blue .. purple
    "sunset": ([(0.75, 1.0), (0.0, 0.12)], 0.05),       # purple .. pink .. orange
}


def hue_dist(a: float, b: float) -> float:
    d = abs(a - b) % 1
    return min(d, 1 - d)


def clamp_hue(h: float, s: float, time: str) -> float:
    """Snap a hue into the sky range for this time (tops of frames are often
    trees, cliffs or walls, so the raw colour can be green or brown)."""
    ranges, fallback = SKY_HUES[time]
    if s < 0.12:
        return fallback  # greyish: hue is meaningless
    if any(lo <= h <= hi for lo, hi in ranges):
        return h
    edges = [e for r in ranges for e in r]
    return min(edges, key=lambda e: hue_dist(h, e))


def tune_sky(rgb, time: str, lift: float) -> tuple[float, float, float]:
    """Keep the sampled colour where plausible, but force a sky-like hue,
    lightness and saturation for the time of day."""
    h, l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    h = clamp_hue(h, s, time)
    if time == "night":
        l = min(max(l, 0.08), 0.28) + lift * 0.5
        s = max(s, 0.35)
    elif time == "sunset":
        l = min(max(l, 0.45), 0.75) + lift
        s = max(s, 0.45)
    else:
        l = min(max(l, 0.5), 0.82) + lift
        s = max(s, 0.35)
    r, g, b = colorsys.hls_to_rgb(h, min(l, 0.92), min(s, 1))
    return (r * 255, g * 255, b * 255)


def main() -> int:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    out: dict[str, dict] = {}
    counts: dict[str, int] = {}

    for s in manifest["scenes"]:
        sid = s["id"]
        if old.get(sid, {}).get("locked"):
            out[sid] = old[sid]
            continue
        words = words_of(sid.replace("-", " "), s["title"], s.get("subLabel", ""),
                         *(x["title"] for x in s["songs"]), *(v["title"] for v in s["youtube"]))
        thumb = MEDIA / sid / "thumb.webp"
        info = analyze_image(thumb) if thumb.exists() else None
        time = time_of_day(info, words)
        below = first_rule(BELOW_RULES, words, "clouds")
        weather = first_rule(WEATHER_RULES, words, "none")
        if weather == "none" and time == "night" and below in ("forest", "lake", "fields"):
            weather = "fireflies"

        if info:
            sky_top, sky_bottom = tune_sky(info["top"], time, 0.0), tune_sky(info["horizon"], time, 0.06)
        else:
            sky_top, sky_bottom = (40, 50, 110), (150, 150, 190)
        out[sid] = {
            "time": time,
            "below": below,
            "weather": weather,
            "skyTop": hexcolor(sky_top),
            "skyBottom": hexcolor(sky_bottom),
        }
        key = f"{time}/{below}"
        counts[key] = counts.get(key, 0) + 1

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(out)} scenes)")
    for k, n in sorted(counts.items()):
        print(f"  {k:<18} {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
