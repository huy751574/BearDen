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

## Friends later

The same command works for the cat singer, fox, capybara, tanuki and others:
`--name cat --image refs/cat.png`. The game currently uses only `bear`.
Placing friends on scenes is a later step.
