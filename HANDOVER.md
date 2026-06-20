# Little Duck Pond — Project Handover

A calming interactive web app: a half-pond / half-grass scene with cute Indian Runner ducks. You tap (or drag) anywhere to drop food pellets; the nearest ducks run or swim over to eat them, then do a little happy celebration. It's meant as a gentle thing to poke at instead of doom-scrolling. It's now an installable PWA deployed on GitHub Pages.

This document is a handover so the project can be continued in a fresh session (e.g. Claude Cowork).

---

## Current state

- Fully working and deployed to GitHub Pages.
- Installable as a PWA on Android and iPhone, works offline.
- Audio redesigned to a peaceful nature bed (breeze + birdsong) and tuned to taste.
- Duck count currently 8.
- **Live weather + day/night sync** for Wrexham, UK via the Open-Meteo API: real nighttime (deep-blue wash, twinkling stars, glowing moon, dimmed ducks) and rain effects (falling streaks + water-only splash ripples) that mirror the actual local conditions.
- Tighter pellet swarming: up to 4 ducks can chase one pellet, and ducks now re-target every frame instead of locking on.
- **Sleepy idle state**: after a randomised 1-2 minutes without feeding, the flock gathers into a huddle, tucks their bills down, closes their eyes and falls asleep with little floating "z" bubbles — a gentle cue to put the phone down. Dropping a pellet wakes them with a quick wing-stretch, then they run for the food.
- **"Call a visitor" shop**: a paw-print button (under the sound button) opens a small popup that lists every registered visitor with a "Call" button to summon it to the pond instantly. Currently a free testing/preview tool; it's the seed of the planned currency shop. The list is built automatically from the `VISITORS` registry, so new animals appear with no extra UI work.
- **Random visitors**: every 3-5 minutes (randomised, one at a time) a cute guest wanders in. Built on an extensible visitor framework so more animals can be added. So far:

A small **school of 3 koi** that glide calmly around the pond (water only — they never cross the shoreline) and pop up to the surface every few seconds with a ripple and a soft "bloop", faint and teal-tinted when deep, bright with a wet back-glint when surfacing. Each fish wanders independently. The ducks completely ignore them (`spooks:false`).

A **ginger cat** that strolls in from the grass, play-stalks and pounces at the ducks (who wake, bunch into a loose huddle and scatter at each pounce, then regroup), meows now and then, and saunters off after 20-30s. When he pounces the flock explodes apart in all directions like startled headless chickens; he then singles out the nearest unlucky duck and chases it around (that duck sprints flat-out and is faster than him, so it stays just ahead), while the rest of the flock — now that he's distracted and far away — hustle back together. He's a bit slower in water (85% of his land pace) but still quick. The ducks ignore food while he's around.

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
- **`assignFood()`** — each frame, assigns ducks to the best nearby pellet. Targets are re-evaluated every frame (no lock-in), so a duck instantly switches to a closer pellet dropped near it. A small contention penalty plus a per-pellet cap stop more than 4 ducks dogpiling one pellet.
- **Weather sync (`syncWeather()`)** — async `fetch` of the Open-Meteo current-conditions API for Wrexham (lat 53.0456, lon -2.9755), reading `is_day` and `weather_code`. WMO codes 51–67 and 80–82 are treated as rain/drizzle. Results land in the global `weather = {loaded, isDay, rain}`. Called **once at startup**; there's no polling, so state is fixed for the session until reload. Network failures are caught and the app keeps its defaults (day, no rain).
- **Visitors (`manageVisitor()` + `VISITORS[]` + the `Cat` class)** — called first in `update()` each frame. `state.nextVisitor` holds the time of the next guest; once it passes (and no pellets are out), one maker is picked at random from the `VISITORS` registry and stored as `state.visitor` (one at a time). A visitor is any object with `update(dt)`, a `done` flag and an optional `spooks` flag; it's depth-sorted with the ducks in `drawScene` (item kind `4`, dispatched by `drawVisitor`). When the visitor `spooks`, the flock is woken and forced into a `huddle` state around an anchor pushed away from the guest, and `state.scare` (0→1, set to 1 on each pounce, decays) balloons their huddle radius so they scatter then regroup. On `done`, everything is cleared, the ducks `pickIdle()`, and the next visit is scheduled. **The `Cat`** is a self-contained state machine (`enter → stalk → pounce → recover → … → leave`) that steers like a duck and crouches/lunges/hops/tail-swishes through `drawCat()`. He enters and leaves over the grass (`aim()` with no `water` option clamps to land via `landX()`), but when stalking/pouncing/chasing he follows the ducks onto the water, where a single `maxSpeed*=0.85` makes him 85% of his land speed (`drawCat` paints a waterline across his belly). Full state machine: `enter → stalk → pounce → recover → chase → (stalk | leave)`. As he commits to a pounce and closes within ~58px, `spookFlock()` fires once — every duck gets a `panicT`/wide `panicAng` and explodes off in its own direction (dramatic, all-directions). After a brief `recover`, `nearestDuck()` is stored as `state.chased` and put into the duck `flee` state (sprints away at `RUN*1.02`, faster than the cat's `chase` speed of `84`); the cat chases it for `chaseDur` seconds, then gives up and re-stalks. `flockCentroid()` excludes the chased/fleeing duck so the rest regroup around their own centre, and the calm-huddle uses a distance-aware speed so they hustle back briskly while the cat is busy. He meows on a random timer via `audio.meow()`. `VISITORS` is now an array of `{name, make}` objects: the random rotation picks `.make()`, and the shop (`buildShop()` in the UI section) renders one row per entry from `.name`. `summonVisitor(maker)` is what the shop's Call buttons invoke — it clears any current guest (resetting `alarm`/`huddle`/`scare` and un-huddling the ducks) then spawns the chosen one and pushes back the auto-timer. To add an animal: write its class (with `update`/`draw`/`done`, plus `spooks` if it should rattle the ducks), add a `drawX` case to `drawVisitor`, and push a `{name, make}` entry into `VISITORS` — it then appears in both the rotation and the shop automatically. The **`Koi`** is a school: the visitor holds `this.fish` (3 `makeKoiFish()` sprites), and `Koi.update` runs `updateKoiFish()` on each (one is the calm, non-spooking, water-bound example — wanders between random `waterPoint()`s, clamps west of `shoreX()`, runs a `surface` 0→1→0 cycle that spawns ripples + `audio.bloop()`). `drawKoi()` loops the school calling `drawKoiFish()`, which draws each fish top-down, rotated to its heading, opacity/teal-tint driven by `surface`. The school's `y` (avg of its fish) is used for depth sorting.
- **Sleepy idle (`manageSleep()`)** — called near the top of `update()` each frame. Tracks `state.lastFeed` (set in `dropPellet`); once `state.time - lastFeed` passes `SLEEP_DELAY` (and there are no pellets and no duck mid-meal), it picks a roost point at the flock's centroid and sends every duck to a golden-angle slot around it via a new `toRoost` state, after which each settles into a `sleep` state. Any new pellet flips `state.sleeping` off and calls `startWake()` on each duck (a brief `wake` stretch) before normal `assignFood()` seeking resumes. Sleeping/roosting/waking ducks are skipped by `assignFood()`. Each duck carries a `drowsy` 0→1 value (ramps up slowly, down briskly) that drives the head-tuck, closed eyes and breathing bob in `draw()`; `spawnZzz()` emits floating "z" particles while asleep.
- **Weather rendering** — `drawStarsAndMoon(g)` (twinkling stars from a once-generated `stars[]` map + a layered glowing moon) and `drawRain(g)` (falling streaks). `render()` applies a dark blue night wash behind the ducks and a lighter wash in front so ducks blend in and dim. Splash ripples are spawned in `update()` only over water (`isWater`) while it's raining.
- **Per-frame draw** — `render()` blits the static `bg`, then draws animated layers (clouds, water shimmer, ripples, depth-sorted ducks/pellets/lilies/reeds, particles, weather washes/effects, vignette).
- **`audio` module** — a self-contained IIFE using the Web Audio API. All sound is synthesised live (no audio files): a breeze bed, an airy shimmer, occasional birdsong, plus one-shot sounds (pellet plip, eat nom, happy chirp, a cat meow, and a koi "bloop"). All one-shots no-op unless sound is enabled.
- **Input / loop / resize** — pointer events for tap+drag feeding, the requestAnimationFrame loop, and canvas resize (re-runs scene build).
- **Service worker registration** — a small script at the very bottom.

Key technique: the duck body is drawn as an upright "bowling-pin" teardrop with a continuous tapered neck (a `ribbon()` helper builds the neck as one smooth shape) so it reads as an Indian Runner rather than a generic duck. Ducks swim when over the pond (body clipped at the waterline, legs hidden). Depth is faked by scaling ducks/objects by their y-position (`depthScale`).

---

## Tuning knobs (where to change common things)

All in `index.html`.

- **Number of ducks** — `var DUCK_COUNT = 8;` just above `initDucks()`. Change to any number; positions auto-scatter and colours cycle through `PALS`.
- **Duck colours** — the `PALS` array. Add a 5th palette object to get a new colour into the rotation.
- **Duck speeds** — `RUN` and `WALK` near the top.
- **Food sharing** (how many ducks chase one pellet) — in `assignFood()`. The score uses `pe.claims * (0.1 * minS)` and a pellet is "full" at `claims >= 4`. Lower the multiplier / raise the cap = more ducks per pellet (tighter swarming); higher multiplier / lower cap = calmer, more spread out. (Tuned up from the original `0.6` penalty / cap of `2` to encourage group swarming.) Note the target lock-in was removed, so ducks re-pick a pellet each frame — no extra knob needed.
- **Weather location** — the lat/lon and API URL in `syncWeather()` (currently Wrexham, UK). Swap the coordinates to relocate the pond's weather. To make weather refresh during a session, wrap `syncWeather()` in a `setInterval` (it's a one-shot call today).
- **Rain intensity** — splash spawn rate is the `Math.random() < dt * 15` test in `update()`; streak look is in `drawRain()`.
- **Night look** — wash colours/opacity in `render()`'s night branches, plus the moon size/position and star count (`for(...i<80...)`) near the top.
- **Visitor frequency** — `var VISITOR_MIN=180, VISITOR_MAX=300;` near the top (seconds between guests = 3-5 min; drop these to, say, `8`/`15` to see visitors quickly while testing). Which animals can appear is the `VISITORS` array. Cat visit length is `this.life=rand(20,30)` in `Cat()`; its stalk/pounce timings, speeds and crouch are in `Cat.prototype.update`. How slow he is in water is the single `if(inWater) maxSpeed*=0.85` in `Cat.prototype.update`. The panic scatter is `spookFlock()`: `panicT=rand(1.3,2.4)` is how long they scarper, `panicAng=away±1.7` how widely they fan out, and the panic run is `RUN*1.0` over a 95px lead in the duck `huddle` branch. The chase: `chaseDur=rand(3.5,6.5)` (how long he pursues), `maxSpeed=84` in the cat `chase` state vs the fleeing duck's `RUN*1.02` (keep the duck faster), and the regroup briskness is the `clamp(d2h*1.6, WALK*1.3, RUN*0.85)` in the calm-huddle branch. The stalk now pounces on **proximity, not a timer**: he trots over (`maxSpeed=58`) while >150px from the flock, drops into a low creep (`maxSpeed=30`, crouch) once closer, and only pounces when within `this.pounceRange` (`rand(74,104)`, re-rolled each pounce) — so he lands near the ducks instead of on empty space (a 9s safety fallback pounces anyway if he somehow can't close in). The pounce distance that sets off the scatter is the `<58` test; how far he dives in is `stopAt:16`. Meow cadence is `this.meowT=rand(4.5,9.5)`.
- **Koi** — school size is the `for(var i=0;i<3;i++)` in `Koi()`; visit length is `this.life=rand(24,38)`. Per-fish: glide speed `maxSpeed=20+...` and `dt*1.8` steer in `updateKoiFish`, surface frequency `nextSurf=rand(4.5,10)`, dwell `surfDur=rand(1.3,2.4)`. Colour variants (white-kohaku vs all-orange) are the `pal` ternary in `makeKoiFish()`.
- **Sleep timing** — `var SLEEP_MIN=60, SLEEP_MAX=120;` near the top (1-2 min of no feeding; a fresh value is rolled into `state.sleepDelay` by `rollSleepDelay()` on each feed). Huddle tightness is the `rad=20+(i%3)*13` slots in `manageSleep()`. Fall-asleep vs wake speed is the asymmetric `drowsyRate` (1.4 up / 4.5 down) in `Duck.update`. Zzz frequency is the `this.zzzT=2.2+...` reset in `Duck.update`; "z" look is the `type==='zzz'` branch in `drawParticles`.
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
- **Weather is fetched once, on load**: `syncWeather()` is only called at startup, so a session that spans dusk won't flip to night until reloaded. Open-Meteo is a free, key-less endpoint; if the request fails (offline, blocked, rate-limited) the app silently keeps daytime/no-rain defaults. The CSP / service-worker caching doesn't intercept the API call (it's cross-origin, network-only).
- **Tap highlight**: `-webkit-tap-highlight-color: transparent;` in the global CSS removes the blue flash from rapid tapping on mobile — keep it if you touch the CSS reset.

---

## Ideas / possible next steps (none started)

- **iOS "Add to Home Screen" hint** — a small banner that appears only in iOS Safari when not yet installed, since iPhone users get no automatic install prompt.
- **Scale duck size down as `DUCK_COUNT` rises**, so a big flock doesn't feel crowded.
- **Remember the sound on/off preference** between visits with `localStorage` (works on the real GitHub Pages site).
- **Periodic weather refresh** — wrap `syncWeather()` in a `setInterval` so a long-open session follows dusk/rain in real time.
- **Night-time audio** — crickets/owl bed when `weather.isDay === 0`, to match the visual night mode.
- **Sleep polish** — a soft sit-down pose or quieter audio bed while the flock is asleep (`state.sleeping`); maybe one duck stays "on watch".
- **More visitors** (the framework is built and ready — each is a new class added to `VISITORS`; cat + koi done): a strolling tortoise that climbs out then back in, a frog the ducks actually chase (inverts the cat logic — ducks approach instead of flee), dragonflies that flit over the pond, and a red panda ambling along the grass.
- **The game layer** (down the line): strip back to land + one duck, earn currency per minute on-app and per pellet, and a shop where each purchase (water/swimming, +1 duck, a visitor) costs more than the last. The world knobs this needs already exist — water is the `shoreX`/`isWater` system, ducks are `DUCK_COUNT`, visitors are the `VISITORS` registry — so it's mostly gating these behind saved flags + `localStorage` and adding a shop UI.
- **More weather states** — snow, fog, or wind-driven ripples driven off the same `weather_code`.
- **A gentle running-water trickle** layer near the shore.
- **Ducklings** following a parent, or more colour variety.

---

## How to resume in Claude Cowork

1. Put the project files (at least `index.html`, ideally the whole repo) into the Cowork workspace, along with this `HANDOVER.md`.
2. Start with something like: *"This is my Little Duck Pond PWA — see HANDOVER.md for context. I'd like to [your next change]."*
3. Good first tasks if you want them: the iOS Add-to-Home-Screen hint, persisting the sound preference, or a dusk/cricket evening theme.

The whole app is in `index.html`, so most changes are edits to that one file. The handover above points to the exact functions/variables for the common tweaks.
