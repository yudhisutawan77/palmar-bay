// Dante Cruz on foot and behind the wheel. Movement, aiming, stealing cars and
// the heat-boost drive — all pure functions over the world state, so the autopilot
// in shots.js and the play-test harness drive the exact same code a player does.
import { WALK, DRIVE, HEAT, WANTED, STEP } from './config.js';
import { collideBuildings, clampToLand, isWater } from './city.js';

export function playerCar(state) {
  if (state.player.carId === null) return null;
  return state.cars.find((c) => c.id === state.player.carId) || null;
}

// On foot: WASD moves, Shift runs, mouse aims. Returns nothing; mutates state.
export function updatePlayerOnFoot(state, input, dt) {
  const p = state.player;
  let mx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let my = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const speed = input.run ? WALK.runSpeed : WALK.speed;
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  p.moving = len > 0;
  p.running = input.run && len > 0;
  // Face the mouse when aiming, else face the direction of travel.
  if (input.aimX !== undefined && (input.aimX !== p.x || input.aimY !== p.y)) {
    p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
  } else if (len > 0) {
    p.angle = Math.atan2(my, mx);
  }
  const body = { x: p.x, y: p.y, r: WALK.radius };
  collideBuildings(state.city, body);
  clampToLand(body);
  if (isWater(body.x, body.y)) body.x = 88 + WALK.radius;
  p.x = body.x; p.y = body.y;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
}

// Driving: W/S accelerate and brake, A/D steer (stronger at speed), Space boosts
// off the heat meter. Steering follows the car's heading, like a real car.
export function updateDriving(state, input, dt) {
  const car = playerCar(state);
  if (!car) return;
  const p = state.player;
  const boosting = input.boost && state.boost > 1 && car.hp > 0;
  if (boosting) {
    state.boost = Math.max(0, state.boost - DRIVE.boostDrain * dt);
    state.wanted.heat = Math.min(5, state.wanted.heat + HEAT.boostHeatPerSecond * dt);
    spawnBoostFlame(state, car);
  }
  const top = DRIVE.maxSpeed * (boosting ? DRIVE.boostMultiplier : 1);
  if (input.up) car.speed += DRIVE.accel * dt;
  if (input.down) car.speed -= (car.speed > 0 ? DRIVE.brake : DRIVE.reverseAccel) * dt;
  // Rolling drag and grip: the car slows when no pedal is down.
  car.speed -= car.speed * DRIVE.grip * 0.22 * dt;
  car.speed = Math.max(-DRIVE.maxReverse, Math.min(top, car.speed));
  if (Math.abs(car.speed) > 12) {
    const steerDir = car.speed >= 0 ? 1 : -1;
    car.angle += ((input.left ? -1 : 0) + (input.right ? 1 : 0)) * DRIVE.steer * steerDir * dt
      * Math.min(1, Math.abs(car.speed) / 140);
  }
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const body = { x: car.x, y: car.y, r: DRIVE.carRadius };
  if (collideBuildings(state.city, body)) {
    // A hard hit into a wall costs speed and a little paint (durability).
    if (Math.abs(car.speed) > 260) { car.hp -= 6; state.stats.crashes += 1; addSparks(state, car.x, car.y); }
    car.speed *= 0.45;
  }
  clampToLand(body);
  car.x = body.x; car.y = body.y;
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
}

function spawnBoostFlame(state, car) {
  const back = car.angle + Math.PI;
  state.particles.push({
    x: car.x + Math.cos(back) * 24, y: car.y + Math.sin(back) * 24,
    vx: Math.cos(back) * 120, vy: Math.sin(back) * 120,
    life: 0.25, maxLife: 0.25, color: '#ffb400', size: 7,
  });
}
function addSparks(state, x, y) {
  for (let i = 0; i < 6; i += 1) {
    const a = state.rng.next() * Math.PI * 2;
    state.particles.push({
      x, y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
      life: 0.3, maxLife: 0.3, color: '#ffd76a', size: 3,
    });
  }
}

// Nearest car Dante can steal or hop into, within arm's reach. Wrecked cars
// are scrap, not rides — entering one would strand the pilot in a loop.
export function nearestEnterableCar(state) {
  const p = state.player;
  let best = null; let bestD = 52;
  for (const car of state.cars) {
    if (car.wrecked) continue;
    if (car.kind === 'police' && state.wanted.level >= 4) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

// E: climb in. Stealing a car the city owns is a crime — the heat rises.
export function tryEnterCar(state) {
  const p = state.player;
  if (p.carId !== null) return false;
  const car = nearestEnterableCar(state);
  if (!car) return false;
  if (car.wrecked) return false;
  p.carId = car.id;
  car.kind = 'player';
  car.driver = null;
  state.stats.carsStolen += 1;
  if (car.wasParked || car.wasTraffic) {
    raiseHeat(state, WANTED.stealCar, 'Car stolen — witnesses called it in.');
  }
  state.audioEvent = 'enter';
  return true;
}

// E again (or when the car dies): step out beside the car.
export function exitCar(state) {
  const p = state.player;
  const car = playerCar(state);
  if (!car) return false;
  p.carId = null;
  p.x = car.x - Math.sin(car.angle) * 30;
  p.y = car.y + Math.cos(car.angle) * 30;
  const body = { x: p.x, y: p.y, r: WALK.radius };
  collideBuildings(state.city, body);
  clampToLand(body);
  p.x = body.x; p.y = body.y;
  car.speed = 0;
  state.audioEvent = 'exit';
  return true;
}

export function raiseHeat(state, amount, why) {
  const before = state.wanted.level;
  state.wanted.heat = Math.min(5, state.wanted.heat + amount);
  state.wanted.level = Math.min(5, Math.floor(state.wanted.heat + 0.0001));
  if (state.wanted.level > before && why) phoneText(state, 'MARISOL', why);
}

export function phoneText(state, from, text) {
  state.messages.push({ from, text, t: state.time });
  if (state.messages.length > 4) state.messages.shift();
}

// Keep the camera target cheap: the player, or their car.
export function focusPoint(state) {
  return { x: state.player.x, y: state.player.y };
}
export { STEP };
