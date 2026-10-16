# The Caffeine Trick — 3D explainer video

A 33-second educational 3D animation (1920×1080, 30 fps) on how caffeine fools the brain.

| Time | Scene | What happens |
|---|---|---|
| 0–10 s | **01 · The late shift** | Close-up of a tired person coding late at night by monitor light. They nod off, yawn, and sip a steaming cup of coffee. The camera then dives into their head. |
| 10–23 s | **02 · Inside the brain** | A stylized microscopic view of a neuron surface. *Adenosine* (violet, the fatigue signal) docks into a receptor and sends "sleepy" waves. *Caffeine* (amber, same purine core) slips into the receptor slots first, so they read as **blocked receptors**. More adenosine bounces off and keeps building up. Animated labels and glowing arrows mark each step. |
| 23–33 s | **03 · The trick** | The person snaps awake and types fast. Takeaway on screen: **"Caffeine doesn't give you energy — it just delays tiredness."** |

**Output:** `caffeine-trick.mp4`

## How it's built

All of it is code, with no stock footage:

- `scene.js` builds both worlds in three.js (the room with its character, and the molecular world) plus bloom. Each frame is a pure function of time `t`, so playback is deterministic.
- `index.html` holds the motion-graphics layer: 3D-anchored labels, captions, the adenosine meter, kinetic takeaway type, letterbox, grain and flashes.
- `audio.py` synthesizes the soundtrack with numpy (room tone, sip, whooshes, docking and lock sounds, beat).
- `render.mjs` steps through the timeline in headless Chromium and pipes the frames to ffmpeg.

## Run / re-render

```bash
npm install                       # three + fonts
npx http-server . -p 8080         # live preview: http://localhost:8080 (space = pause, click bar = seek)
python3 audio.py                  # -> audio.wav
node render.mjs                   # -> caffeine-trick.mp4
node render.mjs --stills 5,15,27  # review stills -> frames/
```

`render.mjs` needs Playwright (`npm i -D playwright`, or a global install) and ffmpeg.
