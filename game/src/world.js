// The world: one state object, one fixed step, everything wired together. The
// step is pure simulation — no DOM, no audio, no clock — so the same seed replays
// identically in the browser, in the screenshot stager and in the Node play-tests.
// Save/load is the only browser touch, and it lives behind try/catch.
import { STEP, SAVE_KEY, WALK, DRIVE } from './config.js';
import { createRandom } from './random.js';
import { buildCity } from './city.js';
import { spawnStreetLife, updateTraffic, updatePeds } from './traffic.js';
import { updatePoliceSpawns, updatePoliceChase, updateRoadblocks, updateWantedDecay, resetPoliceIds } from './police.js';
import { updatePlayerOnFoot, updateDriving, tryEnterCar, exitCar, playerCar, raiseHeat } from './player.js';
import { firePistol, updateBullets, policeContact, damageCar } from './combat.js';
import { startMission, updateMissions, advanceToNextMission } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_OVER = 1;
export const EVENT_VICTORY = 2;
export const EVENT_MISSION = 4;

export function createWorld(rng) {
  const world = {
    rng,
    state: null,
    reset() {
      resetPoliceIds();
      const state = {
        rng,
        time: 0,
        city: buildCity(rng),
        player: {
          x: 680, y: 660, angle: -Math.PI / 2, health: WALK.health,
          carId: null, shootCooldown: 0, moving: false, running: false,
        },
        cars: [], peds: [], bullets: [], particles: [], pickups: [],
        roadblocks: [], messages: [],
        wanted: { level: 0, heat: 0, unseenTimer: 0 },
        boost: 25,
        cash: 0, rep: 0,
        mission: { index: 0, stage: 0, done: false, title: '', brief: '', cash: 0, target: null, targetLabel: '' },
        missionFlash: 0, pendingNextMission: false, nextMissionTimer: 0,
        policeSpawnTimer: 0,
        nextPoliceId: 900,
        gameOver: null, victory: false,
        stats: { shots: 0, hits: 0, carsStolen: 0, missionsDone: 0, wrecks: 0, crashes: 0 },
        audioEvent: null,
      };
      // A parked car right by the spawn, so mission 1 starts in seconds.
      spawnStreetLife(state);
      const starter = {
        id: 1, x: 680, y: 622, angle: 0, speed: 0, color: '#e33e2b',
        kind: 'parked', hp: DRIVE.carHealth, wasParked: true, wasTraffic: false,
        wrecked: false, ramCooldown: 0, roadAxis: 'h', dir: 1, wait: 0,
      };
      state.cars.unshift(starter);
      // Health and cash pickups scattered on the grid.
      for (let i = 0; i < 6; i += 1) {
        const spot = { x: 320 + rng.range(0, 1800), y: 300 + rng.range(0, 1080) };
        state.pickups.push({ x: spot.x, y: spot.y, kind: i % 2 === 0 ? 'health' : 'cash', taken: false });
      }
      this.state = state;
      startMission(state, 0);
      return state;
    },
    // One fixed 1/60 s step. `input` is {up,down,left,right,run,boost,shoot,
    // interact,aimX,aimY}; `attract` runs the ambient city with no player input.
    step(dt, input, attract) {
      const s = this.state;
      if (!s || s.gameOver || s.victory) return s.gameOver ? EVENT_OVER : s.victory ? EVENT_VICTORY : EVENT_NONE;
      s.time += dt;
      s.audioEvent = null;
      if (!attract && input) {
        if (input.interact) {
          if (s.player.carId !== null) exitCar(s);
          else tryEnterCar(s);
        }
        if (s.player.carId !== null) updateDriving(s, input, dt);
        else {
          updatePlayerOnFoot(s, input, dt);
          if (input.shoot) firePistol(s);
        }
      } else if (attract) {
        updatePlayerOnFoot(s, { up: false, down: false, left: false, right: false, run: false, aimX: s.player.x, aimY: s.player.y - 10 }, dt);
      }
      updateTraffic(s, dt);
      updatePeds(s, dt);
      updatePoliceSpawns(s, dt);
      updatePoliceChase(s, dt);
      updateRoadblocks(s);
      updateBullets(s, dt);
      policeContact(s, dt);
      updateWantedDecay(s, dt);
      updateMissions(s);
      updatePickups(s);
      updateParticles(s, dt);
      if (s.missionFlash > 0) s.missionFlash -= dt;
      if (s.pendingNextMission) {
        s.nextMissionTimer += dt;
        if (s.nextMissionTimer > 2.5) {
          s.nextMissionTimer = 0;
          advanceToNextMission(s);
        }
      }
      // A wrecked getaway car the player is still sitting in strands them.
      const car = playerCar(s);
      if (car && car.wrecked) exitCar(s);
      if (s.gameOver) return EVENT_OVER;
      if (s.victory) return EVENT_VICTORY;
      if (s.mission.done && !s.pendingNextMission) return EVENT_MISSION;
      return EVENT_NONE;
    },
  };
  world.reset();
  return world;
}

function updatePickups(s) {
  const p = s.player;
  for (const pk of s.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 30) {
      pk.taken = true;
      if (pk.kind === 'health') p.health = Math.min(WALK.health, p.health + 40);
      else s.cash += 150;
      s.audioEvent = 'pickup';
    }
  }
}

function updateParticles(s, dt) {
  for (const pt of s.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.life -= dt;
  }
  s.particles = s.particles.filter((pt) => pt.life > 0);
  if (s.particles.length > 200) s.particles.length = 200;
}

// Save: mission, cash, reputation, health and position. Load restores them onto a
// fresh world of the same seed, so a save never desyncs the simulation.
export function saveGame(state) {
  try {
    const data = {
      mission: state.mission.index, cash: state.cash, rep: state.rep,
      health: state.player.health, x: state.player.x, y: state.player.y,
      wanted: state.wanted.heat, boost: state.boost,
    };
    if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function applySave(world, save) {
  const s = world.state;
  s.cash = save.cash || 0;
  s.rep = save.rep || 0;
  s.player.health = save.health || WALK.health;
  s.player.x = save.x || 680;
  s.player.y = save.y || 660;
  s.wanted.heat = save.wanted || 0;
  s.wanted.level = Math.floor(s.wanted.heat);
  s.boost = save.boost || 25;
  startMission(s, Math.min(4, save.mission || 0));
  return s;
}

export function freshWorld(seed) {
  return createWorld(createRandom(seed));
}
