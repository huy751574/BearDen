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


# ---------------------------------------------------------------- island layout

# Themes whose scenes always use one island template.
THEME_ISLAND = {
    "power-bearer": "hangar",
    "sun-and-moon": "skygarden",
    "parfum": "parisbridge",
    "to-hong": "riverside",
    "vietnam": "riverside",
    "lullabies": "nursery",
    "bloom": "stage",
}
# Otherwise: first keyword rule that matches, then the theme default.
ISLAND_RULES: list[tuple[str, list[str]]] = [
    ("onsen", ["onsen", "onset"]),
    ("stage", ["singer", "idol", "stage", "orchestra", "conduct", "conducts", "podium", "philharmonic",
               "waltz", "ballroom", "tango", "concert"]),
    ("landmark", ["castle", "neuschwanstein", "pyramids", "pyramid", "angkor", "fuji", "moon", "universe",
                  "cosmos", "island", "beach", "hawaiian", "atlantis", "mammoth", "throne", "trailblazing",
                  "trailblaze", "tarzan", "aircraft", "pilot", "bay", "rolling", "ocean"]),
    ("camp", ["camping", "campfire"]),
    ("arena", ["dojo", "training", "arena", "duel", "dueling", "boss", "dungeon", "assasins", "assassins",
               "husky", "defending", "siege"]),
    ("town", ["town", "guild", "guildhall", "tavern", "feast", "strolling", "signing", "traveling",
              "caravan", "summoning", "mourning", "portal"]),
    ("cave", ["cave"]),
    ("meadow", ["butterflies", "meadow", "lyre", "pigeons", "goat", "stargazing", "floating", "cliff",
                "drawing", "paints", "honey", "beehive", "graveyard"]),
    ("pavilion", ["tea", "liyue", "cultivate", "jianghu", "jade"]),
    ("cozyroom", ["cafe", "library", "reading", "books", "writing", "book", "bed", "lazy", "radio", "working",
                  "gaming", "bar", "jazz", "lounge", "ramen", "train", "waking"]),
    ("wheatfield", ["wheat", "windmill"]),
    ("snowfield", ["snow", "winter", "frozen", "ice"]),
    ("lakeside", ["lake", "river", "fishing", "salmon", "shore", "stream", "swamp", "alligator"]),
]
THEME_DEFAULT_ISLAND = {
    "adventure": "landmark", "chill": "cozyroom", "relax": "meadow", "hunting": "wildforest",
    "isekai": "town", "wuxia": "pavilion", "cover": "meadow",
}
# Landmark sub-types (which mini-model sits on the island).
LANDMARK_RULES: list[tuple[str, list[str]]] = [
    ("castle", ["castle", "neuschwanstein"]),
    ("pyramid", ["pyramid", "pyramids", "egypt", "camel"]),
    ("temple", ["angkor", "temple"]),
    ("fuji", ["fuji"]),
    ("moon", ["moon", "earthrise", "universe", "cosmos", "astronaut"]),
    ("throne", ["throne", "kings"]),
    ("train", ["trailblazing", "trailblaze", "train"]),
    ("ruins", ["atlantis", "ruins", "underwater", "whale"]),
    ("bones", ["mammoth", "giant", "bones"]),
    ("ship", ["rolling", "ocean", "deck", "steers", "stormy"]),
    ("bay", ["bay", "turtle"]),
    ("beach", ["island", "beach", "hawaiian", "dancing"]),
    ("jungle", ["tarzan", "jungle", "aircraft", "pilot", "amazon", "rainforest"]),
]


# ---------------------------------------------------------------- companion

# (keywords, creature kind, behaviour): first match wins. Kinds are defined in
# src/character/creatures.ts, behaviours in src/character/Companion.ts.
COMPANION_RULES: list[tuple[list[str], str, str]] = [
    # Named friends from the artwork
    (["witch"], "cat_idol_witch", "fly"),  # the cat singer on her broom
    (["eula", "tango"], "cat_eula", "dance"),
    (["singer", "idol"], "cat_idol", "perform"),
    (["shifu", "red"], "red_panda", "sit"),
    (["panda"], "panda", "spar"),
    (["husky"], "husky", "spar"),
    (["hyena", "assasins", "assassins"], "hyena", "spar"),
    (["meditating"], "frog", "float"),
    (["tea", "liyue", "fuji", "jade", "cultivate", "healing", "jianghu"], "crane", "fly"),
    (["training", "summoning", "defending", "traveling", "strolling"], "fox", "follow"),
    (["onsen", "onset"], "monkey", "float"),
    (["ramen"], "tanuki", "sit"),
    (["train", "trailblazing"], "dormouse", "sit"),
    (["graveyard"], "ghost", "fly"),
    (["library"], "owl", "fly"),
    (["honey"], "bees", "swarm"),
    (["butterflies"], "rabbit", "wander"),
    (["dogs"], "dog", "perform"),
    (["cats"], "cat", "perform"),
    (["drawing", "cliff", "clouds"], "dove", "fly"),
    (["neon", "working", "writing"], "fox", "sit"),
    (["waking", "lazy", "cave", "radio"], "cat", "sleep"),
    (["fishing"], "otter", "float"),
    (["snow", "stargazing"], "robin", "fly"),
    (["shore", "lake"], "capybara", "sit"),
    (["wheat"], "rabbit", "wander"),
    (["waltz"], "fox", "dance"),
    (["cafe", "story"], "cat", "sit"),
    (["guild", "signing"], "lion", "sit"),
    (["tavern", "feast"], "tanuki", "sit"),
    (["camping", "pines"], "capybara", "sit"),
    (["boss", "dungeon"], "slime", "wander"),
    (["mourning"], "crane", "fly"),
    (["moon"], "rabbit", "wander"),
    (["universe", "cosmos"], "star", "orbit"),
    (["angkor", "tarzan"], "monkey", "follow"),
    (["aircraft", "pilot"], "parrot", "fly"),
    (["atlantis", "whale"], "whale", "swim"),
    (["rolling", "ocean", "sea"], "seagull", "fly"),
    (["lyre", "pigeons"], "pigeon", "fly"),
    (["goat", "lucia"], "goat", "wander"),
    (["jazz", "bar"], "cat_grey", "perform"),
    (["throne", "kings"], "dragon", "sleep"),  # asleep by the throne, as in the art
    (["lattern", "lantern"], "crane", "fly"),
    (["pyramids", "island", "bay", "castle", "mammoth", "war"], "fox", "follow"),
]
# Hunting: the animal being hunted or faced.
HUNTING_RULES: list[tuple[list[str], str, str]] = [
    (["salmon"], "salmon", "swim"),
    (["prey", "deer", "stalk"], "deer", "flee"),
    (["alligator", "swamp", "drinking"], "alligator", "prowl"),
    (["roar", "teeth", "wolf"], "wolf", "prowl"),
    (["dark"], "owl", "fly"),
]
THEME_COMPANION = {
    "lullabies": ("cub", "follow"),
    "parfum": ("doe", "wander"),
    "sun-and-moon": ("sun", "orbit"),
    "bloom": ("cat_idol", "perform"),
}
# Villain for "@villain" (defeated) scenes, by keyword.
VILLAINS = [(["alligator", "sobek", "swamp", "egypt"], "alligator"), (["wolf", "dire", "direwolf"], "wolf"),
            (["maelstrom", "maestrom", "kraken", "storm"], "kraken"), (["hydra", "head"], "hydra")]


def companion_for(theme: str, sid: str, words: set[str]) -> tuple[str, str]:
    if theme in ("to-hong",):
        return ("magpie", "fly") if "nguu" in words else ("weaver", "sit")
    if theme == "vietnam":
        return ("frog", "float") if words & {"vo", "nga", "thuong", "tuong", "vi"} else ("egret", "fly")
    if theme in THEME_COMPANION:
        kind, beh = THEME_COMPANION[theme]
        if theme == "bloom" and "witch" in words:
            return "cat_idol_witch", "fly"
        if theme == "bloom" and "snow" in words:
            return "cat_idol", "sit"
        if theme == "lullabies" and ("nap" in words or "sleepy" in words):
            return "cub", "sleep"
        if theme == "sun-and-moon" and words & {"darken", "abyss", "night", "fogged"}:
            return "moon", "orbit"
        return kind, beh
    if theme == "power-bearer":
        villain = next((v for ks, v in VILLAINS if words & set(ks)), None)
        if villain is None:
            return "mecha_bear", "follow"  # waking / transforming / repairing: the giant mecha buddy
        if villain in ("kraken", "hydra"):
            return f"mecha_{villain}", "emerge"  # too big for the island: rises at the edge
        won = bool(words & {"victory", "triumph", "defeated", "fallen", "reigns"})
        return f"mecha_{villain}", "defeated" if won else "prowl"
    rules = HUNTING_RULES + COMPANION_RULES if theme == "hunting" else COMPANION_RULES
    for keys, kind, beh in rules:
        if words & set(keys):
            return kind, beh
    return "fox", "wander"


# Hand-placed casts for scenes whose art has a specific group. "rest" =
# stays at "at" [x, z(, height)] in "pose", with a prop and thought bubbles;
# the island template puts furniture at these spots.
SCENE_CAST: dict[str, list[dict]] = {
    # Cover scenes: the characters from each cover's art.
    "cover-genshin-impact-black-bear-drinking-watching-eula-cat-tango": [{"kind": "eula_cat", "behavior": "dance"}],
    "cover-pinkpanther-tom-black-bear-chill-in-bar-with-jazz": [
        {"kind": "tom_cat", "behavior": "perform"}, {"kind": "pink_panther", "behavior": "perform"}],
    "cover-zzz-bear-noting-with-lucia-about-little-goat": [
        {"kind": "lucia", "behavior": "follow"}, {"kind": "goat", "behavior": "wander"}],
    "cover-genshin-impact-bear-drinking-tea-with-cloud-retainer": [{"kind": "cloud_retainer", "behavior": "sit"}],
    # Honkai: Star Rail, the Astral Express lounge car (the black bear is the
    # player, journaling at the table, tea going cold).
    "cover-honkai-star-rail-the-bear-trailblazing": [
        {"kind": "raccoon_baseball", "behavior": "rest", "at": [3.0, 1.8, 0.45], "pose": "sleep", "prop": "ball", "emotes": ["⚾", "😎"]},
        {"kind": "himekat", "behavior": "rest", "at": [-2.4, 2.6, 0.38], "pose": "sit", "prop": "cup", "emotes": ["☕", "😌"]},
        {"kind": "march_bunny", "behavior": "rest", "at": [-1.2, -3.55], "face": 180, "pose": "stand", "emotes": ["🌌", "✨", "📸"]},
        {"kind": "mr_yang", "behavior": "rest", "at": [3.4, -1.4, 0.45], "pose": "sit", "prop": "book", "emotes": ["📖", "…"]},
        {"kind": "woof_dan", "behavior": "rest", "at": [-3.4, -2.4, 0.18], "pose": "sleep", "emotes": ["💤"]},
        {"kind": "sundove", "behavior": "rest", "at": [1.6, -3.95, 0.66], "pose": "stand", "emotes": ["🕊️", "…"]},
    ],
}

FRIEND_WORDS = {"friends", "party", "heroes", "caravan", "feast", "tavern", "camping", "waltz", "island", "bay"}


def extras_for(theme: str, words: set[str], main: str, main_beh: str) -> list[tuple[str, str]]:
    """Extra companions for scenes whose art shows more than one friend (max 3)."""
    out: list[tuple[str, str]] = []
    # Pairs and groups that belong together.
    if theme == "sun-and-moon":
        out.append(("moon", "orbit") if main == "sun" else ("sun", "orbit"))
        out.append(("moon_bunny", "follow"))  # the white bunny from the art walks with the bear
    if theme == "to-hong":
        out.append(("magpie", "fly") if main == "weaver" else ("weaver", "sit"))
    if theme == "power-bearer":
        if main == "mecha_bear":
            out.append(("drone", "orbit"))  # the helper bot
        else:
            # The villain's chibi sidekick from the art, and the bear's mecha.
            sidekick = {"mecha_alligator": "croc_king", "mecha_wolf": "wolf_pup",
                        "mecha_kraken": "captain_grimtide", "mecha_hydra": "little_snake"}[main]
            out += [(sidekick, "wander"), ("mecha_bear", "follow")]
    if "dogs" in words:
        out += [("dog", "perform")] * 2  # a little orchestra
    if "cats" in words:
        out += [("cat", "perform")] * 2
    if words & {"hyena", "assasins", "assassins"}:
        out += [("hyena", "spar")] * 2  # the assassin pack
    if "library" in words:
        out.append(("cat_white", "sleep"))  # the Persian cat from the art
    if words & {"jazz", "pinkpanther"}:
        out.append(("cat_pink", "perform"))
    if "working" in words:
        out.append(("cat", "sleep"))  # friends relaxing while the bear works
    if "stargazing" in words:
        out.append(("robin", "fly"))
    # The fox and capybara party ("Bear & Friends" in the art), when nothing more specific applies.
    if not out and words & FRIEND_WORDS:
        beh = main_beh if main_beh in ("sit", "dance", "follow") else "follow"
        if words & {"music", "playing"}:
            beh = "sit"
        if words & {"island", "waltz", "dancing"}:
            beh = "dance"
        out += [(k, beh) for k in ("fox", "capybara") if k != main]
    return out[:3]


# ---------------------------------------------------------------- mini-game

# (keywords, engine, variant): first match wins. Variants live in
# src/games/catalog.ts.
GAME_RULES: list[tuple[list[str], str, str]] = [
    # Specific covers first ("drinking tea" must not match the swamp rule)
    (["tea"], "timing", "pour"),
    (["eula", "tango"], "simon", "dance"),
    # Wuxia
    (["hyena", "assasins", "assassins"], "shooter", "hyena"),
    (["husky", "panda", "dueling", "duel", "training", "shifu"], "timing", "parry"),
    (["cultivate", "healing", "meditating"], "timing", "breath"),
    (["lattern", "lantern"], "catcher", "lantern"),
    (["jade"], "simon", "lyre"),
    (["jianghu"], "dodge", "swords"),
    # Hunting
    (["salmon"], "timing", "salmon"),
    (["prey", "stalk"], "stealth", "deer"),
    (["roar"], "timing", "roar"),
    (["teeth"], "dodge", "snaps"),
    (["dark"], "collector", "fireflies"),
    (["drinking", "swamp"], "dodge", "snaps"),
    # Bloom / idols
    (["witch"], "catcher", "stars"),
    (["firework", "festival"], "timing", "firework"),
    (["edm", "hype"], "timing", "beat"),
    (["rooftop", "broadcast"], "catcher", "notes"),
    (["autumn"], "collector", "leaves"),
    (["silence"], "catcher", "snow"),
    (["idol", "singer", "bloom"], "timing", "beat"),
    # Chill
    (["honey"], "catcher", "honey"),
    (["ramen"], "catcher", "ramen"),
    (["butterflies"], "collector", "butterflies"),
    (["conduct", "orchestra"], "simon", "orchestra"),
    (["library"], "collector", "books"),
    (["train", "trailblazing"], "catcher", "stars"),
    (["onsen", "onset"], "collector", "ducks"),
    (["neon", "gaming"], "timing", "beat"),
    (["drawing", "cliff"], "collector", "paint"),
    (["waking", "lazy"], "timing", "stretch"),
    (["working"], "simon", "tasks"),
    # Relax
    (["fishing"], "timing", "fishing"),
    (["shore", "cooking"], "simon", "recipe"),
    (["waltz", "tango", "dancing"], "simon", "dance"),
    (["graveyard"], "collector", "pumpkins"),
    (["stargazing"], "catcher", "stars"),
    (["floating", "clouds"], "collector", "feathers"),
    (["rain"], "catcher", "rain"),
    (["grill"], "timing", "flip"),
    (["radio"], "timing", "tune"),
    (["story", "writing", "book"], "collector", "pages"),
    (["wheat"], "collector", "wheat"),
    (["snow", "frozen", "winter"], "catcher", "snow"),
    (["sleeping", "cave"], "stealth", "owl"),
    # Isekai
    (["boss", "dungeon"], "shooter", "slime"),
    (["defending", "siege"], "dodge", "boulders"),
    (["mourning"], "collector", "candles"),
    (["strolling", "town"], "collector", "coins"),
    (["summoning"], "collector", "runes"),
    (["guild", "signing"], "simon", "cards"),
    (["tavern", "feast"], "simon", "orders"),
    (["camping", "pines"], "collector", "firewood"),
    (["strolling", "town"], "collector", "coins"),
    (["traveling", "caravan"], "collector", "apples"),
    (["war"], "collector", "coins"),
    # Adventure
    (["castle", "neuschwanstein"], "collector", "gems"),
    (["moon"], "collector", "stardust"),
    (["angkor", "pyramids"], "collector", "relics"),
    (["tarzan"], "timing", "vine"),
    (["aircraft", "pilot"], "collector", "rings"),
    (["island"], "simon", "dance"),
    (["bay"], "collector", "pearls"),
    (["rolling", "ocean"], "dodge", "lightning"),
    (["atlantis"], "collector", "pearls"),
    (["mammoth"], "collector", "bones"),
    (["universe", "cosmos"], "catcher", "stars"),
    (["fuji"], "catcher", "petals"),
    # Covers
    (["tea"], "timing", "pour"),
    (["lyre", "pigeons"], "simon", "lyre"),
    (["eula"], "simon", "dance"),
    (["goat", "lucia"], "collector", "apples"),
    (["throne", "kings"], "dodge", "swords"),
    (["jazz", "bar"], "simon", "piano"),
]
POWER_BEARER_SHOOTER = [(["alligator", "sobek", "egypt", "swamp"], "alligator"), (["wolf", "dire", "direwolf"], "wolf"),
                        (["maelstrom", "maestrom", "kraken", "storm"], "jelly"), (["hydra", "head"], "snake")]


def game_for(theme: str, words: set[str]) -> dict:
    if theme == "power-bearer":
        variant = next((v for ks, v in POWER_BEARER_SHOOTER if words & set(ks)), "drone")
        return {"type": "shooter", "variant": variant}
    if theme == "lullabies":
        if words & {"nap", "sleepy", "night"}:
            return {"type": "stealth", "variant": "cub"}
        if words & {"reading", "books"}:
            return {"type": "collector", "variant": "books"}
        return {"type": "catcher", "variant": "sheep" if "cabin" not in words else "snow"}
    if theme == "parfum":
        return {"type": "catcher", "variant": "petals"} if "bloom" in words else {"type": "collector", "variant": "flowers"}
    if theme == "sun-and-moon":
        return {"type": "catcher", "variant": "light"}
    if theme == "to-hong":
        return {"type": "simon", "variant": "weave"} if "det" in words else {"type": "collector", "variant": "spools"}
    if theme == "vietnam":
        return {"type": "timing", "variant": "breath"} if words & {"vo", "nga", "thuong", "tuong", "vi"} else {"type": "collector", "variant": "lotus"}
    for keys, engine, variant in GAME_RULES:
        if words & set(keys):
            return {"type": engine, "variant": variant}
    return {"type": "collector", "variant": "coins"}


def island_for(theme: str, words: set[str]) -> tuple[str, str]:
    island = THEME_ISLAND.get(theme) or first_rule(ISLAND_RULES, words, THEME_DEFAULT_ISLAND.get(theme, "meadow"))
    if island == "stage" and "snow" in words:
        island = "snowfield"  # e.g. idol + bear sitting in a snow field
    variant = first_rule(LANDMARK_RULES, words, "castle") if island == "landmark" else ""
    return island, variant


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
        # Island layout: scene's own words only (YouTube titles add SEO noise).
        scene_words = words_of(sid.replace("-", " "), s["title"], *(v["title"].split("|")[0] for v in s["youtube"]))
        island, variant = island_for(s["theme"], scene_words)
        all_words = set(sid.split("-")) | scene_words
        companion, behavior = companion_for(s["theme"], sid, all_words)
        extras = extras_for(s["theme"], all_words, companion, behavior)
        if behavior == "follow" and any(bh == "dance" for _, bh in extras):
            behavior = "dance"  # the whole group dances together
        cast = [(companion, behavior)] + extras
        out[sid] = {
            "time": time,
            "below": below,
            "weather": weather,
            "skyTop": hexcolor(sky_top),
            "skyBottom": hexcolor(sky_bottom),
            "island": island,
            **({"variant": variant} if variant else {}),
            "companions": SCENE_CAST.get(sid) or [{"kind": k, "behavior": bh} for k, bh in cast],
            "game": game_for(s["theme"], set(sid.split("-")) | {w for w in words_of(s["title"])}),
        }
        key = f"island {island}{'/' + variant if variant else ''}"
        counts[key] = counts.get(key, 0) + 1

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)} ({len(out)} scenes)")
    for k, n in sorted(counts.items()):
        print(f"  {k:<18} {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
