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
wave) → downloads to `public/models/` → runs `tools/check_models.py`.
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
animated in code (breathing, blinking ember glow, a slow head turn), which
suits the sleeping dragon in that scene. Its prompt is different: **three-quarter
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

Then, per friend:
```bash
python tools/tripo_character.py --name fox --image refs/fox.png --anims idle,walk,run,sit,wave,dance,cheer,sing
```
About 135 credits each (model 30, rig 25, 8 animations × 10).
