// Combat: Dante's pistol, bullet flight, damage to people and cars, and the two
// ways a run ends — busted (police grab Dante on foot) or wasted (health hits 0).
// A wrecked getaway car strands Dante on foot, which is how most busts happen.
import { WALK, DRIVE, POLICE, WANTED } from './config.js';
import { collideBuildings } from './city.js';
import { exitCar, raiseHeat, phoneText } from './player.js';

export function firePistol(state) {
  const p = state.player;
  if (p.carId !== null || p.shootCooldown > 0) return false;
  p.shootCooldown = WALK.pistolCooldown;
  state.bullets.push({
    x: p.x + Math.cos(p.angle) * 20, y: p.y + Math.sin(p.angle) * 20,
    vx: Math.cos(p.angle) * WALK.bulletSpeed, vy: Math.sin(p.angle) * WALK.bulletSpeed,
    life: 0.6, fromPlayer: true,
  });
  state.stats.shots += 1;
  state.audioEvent = 'shot';
  raiseHeat(state, WANTED.shoot, '');
  return true;
}

// Advance bullets; return true when one hit something worth noticing.
export function updateBullets(state, dt) {
  let hitSomething = false;
  for (const b of state.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0) continue;
    const probe = { x: b.x, y: b.y, r: 2 };
    if (collideBuildings(state.city, probe)) { b.life = 0; hitSomething = true; continue; }
    if (b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          ped.down = true; ped.fleeing = false;
          b.life = 0; hitSomething = true;
          state.stats.hits += 1;
          raiseHeat(state, WANTED.killPed, 'You dropped a civilian — the whole city saw it.');
          scareNearbyPeds(state, ped.x, ped.y);
          break;
        }
      }
      if (b.life <= 0) continue;
      for (const car of state.cars) {
        if (car.kind === 'player') continue;
        if (Math.hypot(car.x - b.x, car.y - b.y) < 22) {
          damageCar(state, car, WALK.pistolDamage);
          b.life = 0; hitSomething = true;
          state.stats.hits += 1;
          if (car.kind === 'police') raiseHeat(state, WANTED.ramPolice, 'You shot a patrol car — backup is coming.');
          break;
        }
      }
    }
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);
  return hitSomething;
}

export function damageCar(state, car, amount) {
  car.hp -= amount;
  addDamagePuff(state, car.x, car.y);
  if (car.hp <= 0 && !car.wrecked) {
    car.wrecked = true;
    car.speed = 0;
    state.stats.wrecks += 1;
    if (car.kind === 'player') {
      phoneText(state, 'MARISOL', 'Your ride is scrap. Get out and run!');
      exitCar(state);
    } else if (car.kind === 'police') {
      state.wanted.heat = Math.min(5, state.wanted.heat + 0.4);
    }
  }
}

function addDamagePuff(state, x, y) {
  state.particles.push({
    x, y, vx: 0, vy: -30, life: 0.4, maxLife: 0.4, color: '#888888', size: 9,
  });
}

// Gunfire sends every pedestrian nearby running for cover.
export function scareNearbyPeds(state, x, y) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    if (Math.hypot(ped.x - x, ped.y - y) < 320) {
      ped.fleeing = true;
      ped.fleeX = ped.x + (ped.x - x);
      ped.fleeY = ped.y + (ped.y - y);
    }
  }
}

// Police ramming Dante's car, and police grabbing Dante on foot.
export function policeContact(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.kind !== 'police' || car.wrecked) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (p.carId !== null) {
      // Ram: only a fast patrol car that actually hits the getaway car counts —
      // a slow nudge is just traffic. No spin: the ram costs speed and paint.
      // One global cooldown: three patrol cars taking turns would otherwise
      // pin a slow car forever, and a getaway must be possible.
      if (d < 44 && car.ramCooldown <= 0 && Math.abs(car.speed) > 200
        && state.time - (state.lastRamAt || -10) > POLICE.ramCooldown) {
        car.ramCooldown = POLICE.ramCooldown;
        state.lastRamAt = state.time;
        const target = state.cars.find((c) => c.id === p.carId);
        if (target) {
          damageCar(state, target, POLICE.ramDamage);
          target.speed *= 0.9;
        }
        state.audioEvent = 'crash';
      }
    } else if (state.wanted.level > 0 && d < POLICE.bustRadius) {
      state.gameOver = 'busted';
      return;
    }
  }
  if (p.health <= 0) state.gameOver = 'wasted';
}

export function damagePlayer(state, amount) {
  state.player.health = Math.max(0, state.player.health - amount);
  if (state.player.health <= 0) state.gameOver = 'wasted';
}
