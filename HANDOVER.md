# Little Duck Pond — Project Handover

A calming interactive web app: a half-pond / half-grass scene with cute Indian Runner ducks. You tap (or drag) anywhere to drop food pellets; the nearest ducks run or swim over to eat them, then do a little happy celebration. It's meant as a gentle thing to poke at instead of doom-scrolling. It's now an installable PWA deployed on GitHub Pages.

This document is a handover so the project can be continued in a fresh session (e.g. Claude Cowork).

---

## Current state

- Fully working and deployed to GitHub Pages.
- Installable as a PWA on Android and iPhone, works offline.
- Audio redesigned to a peaceful nature bed (breeze + birdsong) and tuned to taste.
- Duck count currently 8.

## Files (all live in the repo root, next to each other)

- **index.html** — the entire app. Single self-contained file: HTML + CSS + vanilla JS using a `<canvas>`. No framework, no build step. This is the deployed file.
- **manifest.webmanifest** — PWA manifest (name, colours, icons). Uses relative paths so it works in a GitHub Pages project subpath.
- **sw.js** — service worker. Network-first for the page (so you always get the latest when online), cache-first for icons/manifest, offline fallback to the cached page.
- **icon-192.png**, **icon-512.png** — app icons (a white runner duck by the pond).
- **icon-maskable-512.png** — same but with extra padding for Android's circular icon crop.

There may also be a **duck-pond.html** lying around from earlier — it's an identical copy of the app from before it was renamed. `index.html` is the real/deployed one; duck-pond.html can be ignored or deleted to avoid confusion.

---

## How the app is built (architecture)

Everything is inside one IIFE in `index.html`. Rough map, top to bottom:

- **Config / state** — globals like `RUN`/`WALK` (duck speeds), `state` (arrays of ducks, pellets, particles, ripples, clouds, lilies, reeds), and the shoreline shape (`shoreSeed`). `shoreX(y)` / `isWater(x,y)` define the wavy boundary between pond (left) and grass (right).
- **`PALS`** — array of 4 duck colour palettes (white, fawn-with-neck-ring, cocoa, slate). Each is a set of fill colours for body/belly/wing/head/beak/legs/eye etc.
- **`Duck` class** — position, velocity, and a little state machine: `wander → pause/peck → seek → eat → happy → …`. `update(dt)` does the steering/animation; `draw(g)` draws the duck procedurally with canvas paths.
- **Scene building** — `renderStatic()` paints the sky, water, grass, shore, grass texture, flowers and pebbles **once** to an offscreen canvas (`bg`) for performance. Lilies, reeds, clouds are positioned in `initLilies/initReeds/initClouds`.
- **Spawns** — `dropPellet`, `eatPellet`, and particle spawners (crumbs, hearts, tap rings, ripples).
- **`assignFood()`** — each frame, assigns ducks to the best nearby pellet (with a sharing cap so they don't all dogpile).
- **Per-frame draw** — `render()` blits the static `bg`, then draws animated layers (clouds, water shimmer, ripples, depth-sorted ducks/pellets/lilies/reeds, particles, vignette).
- **`audio` module** — a self-contained IIFE using the Web Audio API. All sound is synthesised live (no audio files): a breeze bed, an airy shimmer, occasional birdsong, plus one-shot sounds (pellet plip, eat nom, happy chirp).
- **Input / loop / resize** — pointer events for tap+drag feeding, the requestAnimationFrame loop, and canvas resize (re-runs scene build).
- **Service worker registration** — a small script at the very bottom.

Key technique: the duck body is drawn as an upright "bowling-pin" teardrop with a continuous tapered neck (a `ribbon()` helper builds the neck as one smooth shape) so it reads as an Indian Runner rather than a generic duck. Ducks swim when over the pond (body clipped at the waterline, legs hidden). Depth is faked by scaling ducks/objects by their y-position (`depthScale`).

---

## Tuning knobs (where to change common things)

All in `index.html`.

- **Number of ducks** — `var DUCK_COUNT = 8;` just above `initDucks()`. Change to any number; positions auto-scatter and colours cycle through `PALS`.
- **Duck colours** — the `PALS` array. Add a 5th palette object to get a new colour into the rotation.
- **Duck speeds** — `RUN` and `WALK` near the top.
- **Food sharing** (how many ducks chase one pellet) — in `assignFood()`. Currently the score uses `pe.claims * (0.1 * minS)` and a pellet is "full" at `claims >= 4`. Lower the multiplier / raise the cap = more ducks per pellet; higher multiplier / lower cap = calmer, more spread out. (These were tuned up from the original 0.6 / 2 to suit 8 ducks.)
- **Audio bed** — in `startAmbient()`:
  - Breeze volume: `windGain.gain.value = 0.03`
  - Breeze tone: `wbp.frequency.value = 700` (lower = deeper/softer)
  - Gust strength: `gustG.gain.value = 0.035`
  - Water shimmer: `shimGain.gain.value = 0.01` (set to 0 to remove)
- **Birds** — how often: the delay in `scheduleBird()` is `1500 + Math.random()*9000` ms. Pitch: `base = 1950 + Math.random()*1300` in `bird()`. Song variety is the four `type` branches in `bird()`.

---

## Deployment & update workflow

- Hosted on **GitHub Pages** (HTTPS, which the service worker requires). Same pattern as the other PWAs (single-file HTML + Firebase-style hobby apps), reviewed via GitHub Desktop before committing.
- To update: edit `index.html` (or any file), commit, push. Because the service worker is **network-first for the page**, an online visit fetches the latest automatically — usually no cache-busting needed.
- The first visit after a deploy may need **one refresh** for the new service worker to take over (Safari + GitHub Pages both cache hard).
- To force a hard cache reset for everyone, bump the cache name in `sw.js`: `duckpond-v1` → `duckpond-v2`.
- Filenames are referenced by name across the files — keep them as-is.

## Installing it (for reference)

- **Android/Chrome**: shows an install prompt / address-bar install icon → lands on home screen, opens full-screen.
- **iPhone/Safari**: no auto prompt (Apple). Use Share → "Add to Home Screen". Uses the duck icon, opens full-screen.

---

## Known gotchas

- **iOS silent switch**: iOS mutes Web Audio when the physical ring/silent switch is on, regardless of volume. Mitigated in code by requesting the `'playback'` audio session (`navigator.audioSession.type`) and playing a silent unlock buffer inside the tap that enables sound. Net effect: once a user taps the speaker icon, sound plays even if the phone is set to silent.
- **Caching**: see the update workflow above — one refresh after deploy; bump cache name to force-reset.
- **Service worker scope**: `sw.js` must stay at the repo root (its scope is its own directory).
- **Audio needs a user gesture**: the AudioContext is created/resumed on the first tap of the speaker button (browser requirement). Don't try to start sound on page load.

---

## Ideas / possible next steps (none started)

- **iOS "Add to Home Screen" hint** — a small banner that appears only in iOS Safari when not yet installed, since iPhone users get no automatic install prompt.
- **Scale duck size down as `DUCK_COUNT` rises**, so a big flock doesn't feel crowded.
- **Remember the sound on/off preference** between visits with `localStorage` (works on the real GitHub Pages site).
- **Day/night or seasonal themes** (e.g. a dusk palette with crickets).
- **A gentle running-water trickle** layer near the shore.
- **Ducklings** following a parent, or more colour variety.

---

## How to resume in Claude Cowork

1. Put the project files (at least `index.html`, ideally the whole repo) into the Cowork workspace, along with this `HANDOVER.md`.
2. Start with something like: *"This is my Little Duck Pond PWA — see HANDOVER.md for context. I'd like to [your next change]."*
3. Good first tasks if you want them: the iOS Add-to-Home-Screen hint, persisting the sound preference, or a dusk/cricket evening theme.

The whole app is in `index.html`, so most changes are edits to that one file. The handover above points to the exact functions/variables for the common tweaks.
