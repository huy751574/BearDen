# Character models (Tripo3D)

The game uses a code-built chibi bear until a real model is installed. When
`public/models/bear.glb` exists (and is registered in `src/data/models.json`),
the game swaps it in automatically. If the model is missing or broken, the
game keeps the procedural bear.

## 1. Make a clean reference image (you, ~5 min)

Tripo needs **one character, front view, full body, standing in an A-pose, on
a plain background**. Your scene images don't work well because the bear
sits, holds things and has scenery around it. Generate a new image with
Gemini (or your usual image tool) using this prompt, attaching one or two of
your bear images (e.g. `Image/Black_Bear_walking_in_snow_…jpeg`) as style
reference:

> Character reference sheet of the same cute chibi black bear from the
> attached image. **Front view, full body, standing straight in an A-pose**:
> arms held slightly away from the body, legs slightly apart, feet flat,
> looking straight at the viewer. Big round head (about 40% of total height),
> small round ears with light-brown insides, rounded tan muzzle, small black
> nose, small shiny black eyes, soft pink blush on the cheeks, chubby round
> body with dark charcoal fur, short stubby arms and legs. No clothes, no
> accessories, nothing in the hands. **Plain pure white background**, soft
> even lighting, no shadows on the ground, whole body visible including the
> feet, centered, no perspective distortion. Clean flat anime / cel-shaded
> style with dark outlines.

Tips:
- Keep the arms clear of the body. Arms touching the belly make rigging fail.
- If you want the bear to always wear the cream scarf and sweater, add them to
  the prompt. A bare bear is more versatile.
- Save the result as PNG, e.g. `refs/bear.png` in this project. That folder
  is yours, and nothing reads it except the command below.

## 2. Tripo API key (you, once)

1. Sign in at https://platform.tripo3d.ai, go to **API Keys**, and create a key.
   It's shown only once.
2. Buy or check credits on the same site. One character with 5 animations
   costs roughly 100–150 credits. The script prints the exact credits used
   after each step.
3. Put the key in `.env.local` in the project folder (git-ignored, never
   uploaded):
   ```
   TRIPO_API_KEY=tsk_your_key_here
   ```
   Never name it `VITE_…`: `VITE_` variables are built into the public website.

## 3. Generate, rig, animate, install (one command)

```bash
python tools/tripo_character.py --name bear --image refs/bear.png
```

It shows the plan and asks before spending credits, then:
upload → 3D model → rig check → skeleton → animations (idle, walk, run, sit,
wave) → downloads to `public/models/` → compresses them for the web
(`tools/compress_models.py`, about 75% smaller) → runs `tools/check_models.py`.
Takes about 5–10 minutes. A preview render is saved to
`tools/cache/bear_preview.webp`.

- **Something failed?** Re-run the same command. Finished steps are skipped
  and not paid again. Use `--restart` to start over from scratch.
- **Other options:** `--anims idle,walk,run,sit,wave,dance,cheer,sing`,
  `--face-limit 20000` (fewer = lighter file), `--autofix` (Tripo cleans the image).

## 4. Check it in the game

```bash
npm run dev
```

Walk around (WASD), sit (E), wave (Q). If the model:
- **faces sideways or backwards:** edit `"forward"` for it in
  `src/data/models.json` (`"+x"`, `"-x"`, `"+z"` or `"-z"`) and reload.
- **is too big or small:** change `"height"` (metres; the procedural bear is 1.5).

Re-running `tools/check_models.py` keeps those edits.

## Emotes

The bear also has `dance`, `cheer`, `sing`, `clap`, `victory` and `hurt`
(keys 1-4 in the game; mini-games play victory / hurt). Add them to any
character with
`--anims idle,walk,run,sit,wave,dance,cheer,sing,clap,victory,hurt`
(10 credits each). Emotes a model lacks fall back to similar ones.

## Friends

Same steps, one image per friend, saved in `refs/`. Use the bear prompt's
ending ("Front view, full body, standing straight in an A-pose … Plain pure
white background … Clean flat anime / cel-shaded style with dark outlines.")
and start it with the friend's description below, attaching one of your
scene images with that friend as a style reference.

| Friend | Scenes | Save as | Description to start the prompt with |
|---|---|---|---|
| Fox | 24 | `refs/fox.png` | Cute chibi orange fox standing upright on two legs, big round head, pointed ears with dark tips, white muzzle and chest, big fluffy orange tail with a white tip, dark brown paws. |
| Capybara | 21 | `refs/capybara.png` | Cute chibi capybara standing upright on two legs, chubby round brown body, blunt square muzzle, small round ears, sleepy calm eyes, pink blush. |
| Cat idol | 7 | `refs/cat_idol.png` | Cute chibi cat-eared idol girl, very long pastel pink-to-blue twin tails falling behind her back (clear of the arms and legs), cat ears, pink and blue frilly idol dress with a big bow, white thigh-high socks, pink shoes, no microphone. |

| Moon bunny | 5 (Sun and Moon) | `refs/moon_bunny.png` | Cute chibi white bunny girl standing upright on two legs, long upright ears with pink insides, big glossy grey eyes, soft pink blush, small worried-sweet expression, knee-length open pale blue coat (legs clearly visible below it), lilac scarf, small beige crossbody bag, white feet. |

**Dragon** (Game of Thrones cover scene) is four-legged with wings, so it
can't use the two-legged animations. It is generated as a still model and
animated in code: it breathes, its ember cracks glow with each breath, and
it flares up for a moment when something disturbs it. That suits the
sleeping dragon in that scene. Its prompt is different: **three-quarter
front view** instead of front view, because a front view hides a four-legged
body:

> Cute chibi dragon from the attached image, full body, **three-quarter front
> view, lying curled up asleep on the ground**, chubby rounded body, big head
> with two curved horns and a short snout, moss-green scales, folded wings on
> its back, long tail curled around its body, glowing amber-orange cracks
> between the scales. Plain pure white background, soft even lighting, no
> ground shadow, whole body visible, centered. Clean flat anime / cel-shaded
> style with dark outlines.

Save it as `refs/dragon.png`, then:
```bash
python tools/tripo_character.py --name dragon --image refs/dragon.png --no-rig
```
(30 credits: model only.)

### Cover and Power Bearer characters

Same recipe: start the prompt with the description, end it with the bear
prompt's ending (front view, A-pose, plain white background, cel-shaded),
and attach the scene's image as a style reference. **Walking characters**
get a skeleton and animations (~135 credits); **big or legless ones** are
still models animated in code like the dragon (`--no-rig`, 30 credits; use a
three-quarter view instead of the A-pose).

| Name (save as `refs/<name>.png`) | Scene | Kind | Description |
|---|---|---|---|
| `eula_cat` | Genshin: Eula cat tango | walking | Cute chibi white cat girl standing upright, light-blue hair in a short bob, dark navy hairband, elegant white and navy dance dress with a short cape, graceful. |
| `pink_panther` | Pink Panther & Tom jazz bar | walking | Cute chibi pink panther standing upright, slim pink body, long thin tail, cream muzzle, black nose, bartender outfit: white shirt, black vest, bow tie. |
| `tom_cat` | Pink Panther & Tom jazz bar | walking | Cute chibi blue-grey cat standing upright, white muzzle and chest, big whiskers, black suit jacket over a white shirt (pianist). |
| `lucia` | ZZZ: Lucia and the little goat | walking | Cute chibi girl with short light-blue hair, two small curved horns, big gentle eyes, teal jacket over a white shirt, dark shorts, boots. |
| `cloud_retainer` | Genshin: tea with Cloud Retainer | still | Elegant chibi crane, white and pale-blue feathers, long flowing ribbon-like tail feathers, small crest, standing on both legs, wings folded. |
| `mecha_bear` | every Power Bearer scene | walking | Giant chibi mecha bear robot, rounded silver-grey armour plates, glowing cyan chest core and joints, cyan eyes, large metal wings folded on its back, heroic stance. |
| `croc_king` | villain: alligator | walking | Cute chibi green crocodile standing upright, small gold crown, big yellow eyes, cream belly, short tail. |
| `wolf_pup` | villain: dire wolf | walking | Cute chibi grey wolf pup standing upright, glowing blue markings on the face and paws, fluffy tail, fierce but cute. |
| `captain_grimtide` | villain: maelstrom | walking | Cute chibi pirate captain (a young man), dark tricorn hat, long dark-teal coat with gold buttons, boots, glowing teal amulet. |
| `mecha_alligator` | villain: alligator | still | Giant mecha alligator robot, silver-grey armoured plates, glowing red eyes, crawling on four legs, long spiked tail. |
| `mecha_wolf` | villain: dire wolf | still | Giant mecha dire wolf robot, dark gunmetal armour, glowing red eyes and joints, standing on four legs. |
| `mecha_kraken` | villain: maelstrom | still | Giant steampunk mecha kraken, bronze and dark-steel body, one big glowing teal eye, coiled mechanical tentacles. |
| `mecha_hydra` | villain: hydra | still | Giant nine-headed mecha hydra, dark steel necks, glowing red eyes, coiled body, low-poly chunky shapes. |

### Star Rail train passengers

From the scene's own art (`Cover_Honkai_Star_Rail-The_Bear_trailblazing`).
The game seats them in the lounge car with their props (ball, coffee, book),
so the reference image still shows them **standing in an A-pose with empty
hands**. The black bear is the existing bear model; his outfit (pale-blue
shirt, dark vest, teal neckerchief) can be added in code for free.

| Name (save as `refs/<name>.png`) | In the train | Kind | Description |
|---|---|---|---|
| `raccoon_baseball` | sprawled on the bench, tossing a ball | walking | Cute chibi raccoon standing upright, grey and white fur, black eye mask, cheeky grin, big fluffy tail with dark grey rings, navy baseball cap with a small gold emblem, navy varsity jacket with cream trim over a white shirt. |
| `himekat` | curled in the armchair with her coffee | walking | Cute chibi red-orange cat girl standing upright, white chest and muzzle, tall pointed ears with white tufts, calm amber eyes, big fluffy orange tail, dark brown fitted jacket over a white blouse, confident and elegant. |
| `march_bunny` | chin on the windowsill, watching the nebula | walking | Cute chibi pastel-pink bunny standing upright, long upright ears with a pink bow on one ear, big bright blue eyes, cheerful, white and pale-blue short jacket with a white collar, small fluffy white tail. |
| `mr_yang` | book open, unread, perfectly still | walking | Cute chibi grey-brown wolf gentleman standing upright, ash-blond tuft of hair, round glasses, calm wise eyes, dark grey-green suit jacket over a light-blue shirt, dark trousers, bushy tail. |
| `woof_dan` | dozing in the corner | walking | Cute chibi dark charcoal-grey wolf dog standing upright, messy dark fur on the head, sleepy calm half-closed eyes, small tassel earring on one ear, plain white t-shirt, dark shorts, long fluffy tail. |
| `sundove` | perched by the far window, quiet | still | Cute chibi white dove, soft grey face, small orange beak, white hooded cloak, golden star-pointed halo floating behind the head, blue gem brooch on the chest, perched with wings folded (three-quarter view). |

Cost: five walking passengers with idle, walk, run, sit and wave (105 credits
each) plus Sundove as a still model (30) = **555 credits**. They only rest in
the train, so `--anims idle,sit,wave` (85 each, 455 total) is enough.

### Common animals (`common_`)

Animals that appear in many scenes, drawn the same way everywhere in your
art. One model per animal, and **every scene with that animal uses it**: the
game looks for `common_<animal>` (e.g. `common_frog` for the frog), so just
save `refs/common_<animal>.png` and run the tool with `--name common_<animal>`.
Scene counts come from `src/data/sceneEnv.json`.

| Name | Scenes | Kind | Description (from your art) |
|---|---|---|---|
| `common_frog` | 5 (Vietnam, Wuxia) | walking | Cute chibi green frog standing upright, big round eyes on top of the head, wide gentle smile, pale-yellow belly, simple sage-green wrap robe with a brown cloth belt, bare webbed feet. |
| `common_monkey` | 4 (Adventure, Chill) | walking | Cute chibi Japanese snow monkey standing upright, fluffy pale grey-white fur, pink face and ears, sleepy content eyes, short tail. |
| `common_dog` | 3 (Chill) | walking | Cute chibi shiba inu standing upright, orange fur with cream cheeks, chest and paws, curled fluffy tail, pointy ears, friendly smile. |
| `common_tanuki` | 2 (Chill, Isekai) | walking | Cute chibi tanuki standing upright, brown fur, dark eye patches and legs, cream muzzle, round belly, fluffy striped tail. |
| `common_dormouse` | 2 (Chill, Cover) | walking | Cute chibi grey dormouse standing upright, very small, big round ears, big black eyes, cream belly, long fluffy tail. |

Not on the list, and why:
- **Rabbit** (4 scenes): your rabbit is the white bunny in a coat, which is
  the moon bunny. Reusing her model costs nothing.
- **Cat** (11 scenes): your cat is a real **four-legged black cat**, sitting
  or curled up asleep, but the game shows an orange cat standing upright. A
  four-legged model needs Tripo's quadruped rig, which the tool doesn't
  support yet. A still model can work for sitting and sleeping cats.
- **Birds** (crane 6, robin 5, egret 4, owl, dove): they fly, and a still
  model can't flap its wings. The code-built birds stay.
- **Wolf and alligator** (Hunting, Power Bearer): they are four-legged and
  are being replaced by mecha villains in Power Bearer.

**Lounge avatars** reuse these models with code-built accessories (hats,
glasses, scarves...). For that, each model in `src/data/models.json` has a
`"head"` and `"neck"` entry (centre in metres, facing +Z, and radius) that
places the accessories; adjust them if an accessory floats or sinks. The cat
idol has `"hairFix": true`, which re-binds her twin tails to her head (the
auto-rig tied them to her arms). `tools/compress_models.py` also writes a
`<name>.lite.glb` (about a quarter of the triangles) that the lounge uses so
50 avatars stay light.

Then, per friend:
```bash
python tools/tripo_character.py --name fox --image refs/fox.png --anims idle,walk,run,sit,wave,dance,cheer,sing
```
About 135 credits each (model 30, rig 25, 8 animations × 10).
