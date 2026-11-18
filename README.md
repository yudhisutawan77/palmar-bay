# PALMAR BAY

![make.fun badge](https://make.fun/badge/gta6-01.svg)
![rank](https://make.fun/badge/gta6-01/yudhisutawan77/palmar-bay/rank.svg)
![reward](https://make.fun/badge/gta6-01/yudhisutawan77/palmar-bay/reward.svg)

An original open-world crime game — a sun-soaked coastal city, played in your
browser from static files, no network needed. Built for the
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

You are **Dante Cruz**, wheelman for Marisol's crew in Palmar Bay: a beach town
of palm-lined avenues, a downtown of pastel towers, a green central park and a
container port on the east docks. Steal cars, outrun the patrol cars, and run
five story missions — finish **The Big One** and the city is yours.

## The unique mechanic: HEAT IS BOOST

Your wanted stars charge a boost meter: the hotter you are, the faster your
getaway — but the more police hunt you. Boosting (Space, in a car) spends the
meter and adds a little heat of its own. Clean driving charges it slowly; three
stars charge it fast. The meter is always on the HUD, so every chase is a
choice: stay cool, or burn bright and run.

## How to play

Serve the `game/` folder with any static server (or `node serve.ts` from the
repo root) and open `index.html` in desktop Chrome. Keyboard and mouse.

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive a car |
| Mouse | Aim (on foot) |
| F or left click | Shoot the pistol |
| E | Steal / enter a car, exit a car |
| Space | Boost while driving (spends the heat meter) |
| Shift | Run on foot |
| P / Esc | Pause |
| M | Mute |
| Enter | Start / continue |

On foot the police can grab you — **busted**. Lose all your health — **wasted**.
Wreck your getaway car and you are on foot with the whole city watching.

## Missions (story from Marisol, by phone text)

1. **First Wheels** — steal any car, bring it to the drop-off in Old Town.
2. **Package Run** — pick up the package at the marina, deliver it to Portside
   while patrols watch.
3. **Lose the Tail** — three stars on you. Shake the patrol cars, reach the
   safehouse.
4. **Bank Job** — grab the loot at Sol Bank, then run four stars to the docks.
5. **The Big One** — the final heist: three stops across the city, then the
   escape boat at the docks. Finish it to win.

Each mission pays cash and reputation. Your progress saves automatically
(localStorage) — the title screen offers **Continue**.

## The city

- **Marina Beach** on the west: sand, surf and a kiosk.
- **Old Town and Downtown**: a road grid of pastel blocks, traffic and
  pedestrians on every street.
- **Palmar Park**: grass and trees in the middle of town.
- **Portside**: container docks and the escape boat on the east edge.
- **Safehouse**: Marisol's yellow house — the law loses you faster near it.

Traffic follows the roads, pedestrians stroll the sidewalks and flee gunfire,
patrol cars chase and ram, and at three stars and up the police throw up
roadblocks on your route. All of it runs on a seeded simulation (mulberry32,
fixed 60 Hz step), so the same seed replays the same city.

## Sound

Every sound is synthesised live with WebAudio — engine hum, sirens, gunshots,
pickups, mission stings and a bass loop. No audio files.

## Files

- `game/index.html` — the page, one canvas.
- `game/src/config.js` — tuning, palette, city constants.
- `game/src/random.js` — seeded RNG.
- `game/src/city.js` — the road grid, buildings, beach, park, docks, safehouse.
- `game/src/traffic.js` — traffic cars and pedestrians.
- `game/src/police.js` — wanted level, chases, roadblocks, decay.
- `game/src/missions.js` — the five story missions and Marisol's texts.
- `game/src/player.js` — on-foot movement, driving, stealing cars, heat boost.
- `game/src/combat.js` — shooting, damage, busted / wasted.
- `game/src/world.js` — the fixed-step simulation, save / load.
- `game/src/render.js` — city, cars, HUD, minimap, screens.
- `game/src/audio.js` — procedural WebAudio sound.
- `game/src/input.js` — keyboard and mouse.
- `game/src/shots.js` — the four staged screenshot scenes and their autopilot.
- `game/src/main.js` — boot, loop, screens.

## License

MIT — see `LICENSE`. An original game: no names, characters, places, art or
music from any commercial game.
