// The Palmar Bay police: a wanted level from 0 to 5 stars, patrol cars that spawn
// off-screen and chase Dante, ramming his car or grabbing him on foot, roadblocks
// on the getaway route at 3 stars and up, and a wanted level that fades when no
// officer can see him — fastest of all near the safehouse.
import { WANTED, POLICE, DRIVE, HEAT } from './config.js';
import { ROADS_V, ROADS_H, nearestRoadPoint, planRoute, collideBuildings, clampToLand } from './city.js';
import { damageCar } from './combat.js';
import { phoneText } from './player.js';

// Police ids live on the state, not the module: two worlds in one process must
// never share a counter, or the same seed would replay to different ids.
export function resetPoliceIds() { /* ids now live on state.nextPoliceId */ }

function wantedTargetCount(level) {
  return WANTED.maxPolice[level] || 0;
}

export function policeCars(state) {
  return state.cars.filter((c) => c.kind === 'police' && !c.wrecked);
}

// Spawn patrol cars just out of sight of Dante, on the road grid.
export function updatePoliceSpawns(state, dt) {
  const p = state.player;
  const want = wantedTargetCount(state.wanted.level);
  const have = policeCars(state).length;
  state.policeSpawnTimer -= dt;
  if (have < want && state.policeSpawnTimer <= 0) {
    state.policeSpawnTimer = 1.2;
    const angle = state.rng.next() * Math.PI * 2;
    const sx = p.x + Math.cos(angle) * POLICE.spawnDistance;
    const sy = p.y + Math.sin(angle) * POLICE.spawnDistance;
    const spot = nearestRoadPoint(Math.max(220, Math.min(2340, sx)), Math.max(40, Math.min(1760, sy)));
    const car = {
      id: state.nextPoliceId++, x: spot.x, y: spot.y, angle: 0, speed: 0,
      color: '#1f6fd6', kind: 'police', hp: DRIVE.policeCarHealth,
      wasParked: false, wasTraffic: false, wrecked: false,
      ramCooldown: 0, roadAxis: 'h', dir: 1, wait: 0, sirenPhase: state.rng.next() * 6,
    };
    state.cars.push(car);
    if (have === 0) phoneText(state, 'MARISOL', 'Patrol cars are on you. Lose them or make them pay.');
  }
  // Despawn patrol cars that fell far behind, and clear wrecks after a while.
  state.cars = state.cars.filter((car) => {
    if (car.kind !== 'police') return true;
    if (car.wrecked) return state.time - (car.wreckedAt || 0) < 20;
    return Math.hypot(car.x - p.x, car.y - p.y) < POLICE.despawnDistance;
  });
}

// Chase steering: close in, drive straight at Dante; far away, follow the road
// grid to him (a patrol car that beelines through buildings never arrives).
// Same turn-and-brake discipline as a driver: slow for sharp turns.
export function updatePoliceChase(state, dt) {
  const p = state.player;
  for (const car of policeCars(state)) {
    car.sirenPhase += dt * 6;
    car.ramCooldown = Math.max(0, car.ramCooldown - dt);
    car.routeTimer = (car.routeTimer || 0) - dt;
    const dist = Math.hypot(p.x - car.x, p.y - car.y);
    let targetAngle;
    if (dist < 170) {
      targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
    } else {
      if (!car.route || car.route.length === 0 || car.routeTimer <= 0) {
        car.route = planRoute({ x: car.x, y: car.y }, { x: p.x, y: p.y });
        car.routeTimer = 3;
      }
      while (car.route.length > 0 && Math.hypot(car.route[0].x - car.x, car.route[0].y - car.y) < 50) car.route.shift();
      const wp = car.route[0] || { x: p.x, y: p.y };
      targetAngle = Math.atan2(wp.y - car.y, wp.x - car.x);
    }
    let diff = targetAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const turn = Math.max(-2.4, Math.min(2.4, diff * 3));
    car.angle += turn * dt;
    const wantSpeed = state.wanted.level >= 4 ? POLICE.carSpeed * 1.08 : POLICE.carSpeed;
    const turningHard = Math.abs(diff) > 0.9;
    const cruise = turningHard ? Math.min(wantSpeed, 200) : wantSpeed;
    car.speed += (cruise - car.speed) * Math.min(1, 1.5 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const body = { x: car.x, y: car.y, r: DRIVE.carRadius - 2 };
    if (collideBuildings(state.city, body)) {
      car.speed *= 0.5;
      car.angle += 0.6;
      if (Math.abs(car.speed) > 300) damageCar(state, car, 8);
    }
    clampToLand(body);
    car.x = body.x; car.y = body.y;
    // A patrol car that smashes into a traffic car nudges it aside. Never the
    // player's car: shoving it every step would push the getaway across the
    // map, and the ram rule in combat.js already covers police vs player.
    for (const other of state.cars) {
      if (other === car || other.kind === 'police' || other.kind === 'player' || other.wrecked) continue;
      const d = Math.hypot(other.x - car.x, other.y - car.y);
      if (d < 40 && d > 0.01) {
        const push = Math.min(4, 40 - d);
        other.x += ((other.x - car.x) / d) * push;
        other.y += ((other.y - car.y) / d) * push;
      }
    }
  }
}

// Roadblocks: at 3+ stars, two patrol cars park across the road ahead of Dante's
// objective, forcing a detour or a smash-through.
export function updateRoadblocks(state) {
  const want = state.wanted.level >= WANTED.roadblockAt ? 2 : 0;
  while (state.roadblocks.length < want) {
    const target = state.mission.target || { x: 1400, y: 900 };
    const spot = nearestRoadPoint(
      target.x + state.rng.range(-260, 260), target.y + state.rng.range(-260, 260));
    state.roadblocks.push({ x: spot.x, y: spot.y, angle: state.rng.next() * Math.PI });
  }
  while (state.roadblocks.length > want) state.roadblocks.pop();
  for (const rb of state.roadblocks) {
    const p = state.player;
    if (p.carId !== null && Math.hypot(rb.x - p.x, rb.y - p.y) < 40) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) { damageCar(state, car, 18); car.speed *= 0.3; }
      rb.hit = true;
    }
  }
  state.roadblocks = state.roadblocks.filter((rb) => !rb.hit);
}

// Wanted decay: heat falls when no patrol car can see Dante, and falls fast near
// the safehouse. The star level follows the heat.
export function updateWantedDecay(state, dt) {
  const w = state.wanted;
  const p = state.player;
  const seen = policeCars(state).some((car) => Math.hypot(car.x - p.x, car.y - p.y) < WANTED.sightRange);
  const nearSafe = Math.hypot(p.x - state.city.safehouse.doorX, p.y - state.city.safehouse.doorY) < 260;
  if (seen) {
    w.unseenTimer = 0;
  } else {
    w.unseenTimer += dt;
    if (w.unseenTimer > 1) {
      w.heat = Math.max(0, w.heat - (nearSafe ? WANTED.decaySafehouse : WANTED.decayUnseen) * dt);
    }
  }
  const level = Math.min(5, Math.floor(w.heat + 0.0001));
  if (level < w.level && w.heat <= 0.05) {
    phoneText(state, 'MARISOL', 'You are clean. For now.');
  }
  w.level = level;
  // HEAT IS BOOST: the meter charges faster the hotter Dante is.
  const charge = HEAT.passiveCharge + w.level * HEAT.chargePerStar;
  state.boost = Math.min(100, state.boost + charge * dt);
}
