// Traffic and pedestrians: cars cruise the road grid and stop for nothing except
// a wreck ahead, pedestrians stroll the sidewalks and run from gunfire. Both are
// seeded, so the same seed replays the same street life.
import { TRAFFIC, DRIVE, CAR_COLORS } from './config.js';
import { ROADS_V, ROADS_H, ROAD_W, isRoad, inPark, collideBuildings, clampToLand, randomRoadPoint } from './city.js';

let nextCarId = 100;

export function resetCarIds() { nextCarId = 100; }

function makeCar(rng, x, y, kind) {
  const car = {
    id: nextCarId++, x, y, angle: 0, speed: 0,
    color: rng.pick(CAR_COLORS), kind, hp: DRIVE.carHealth,
    wasParked: kind === 'parked', wasTraffic: kind === 'traffic',
    wrecked: false, ramCooldown: 0, roadAxis: 'h', dir: 1, wait: 0,
  };
  if (kind === 'traffic') {
    car.roadAxis = rng.chance(0.5) ? 'v' : 'h';
    car.dir = rng.chance(0.5) ? 1 : -1;
    car.angle = car.roadAxis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.speed = TRAFFIC.carSpeed * rng.range(0.8, 1.15);
  } else if (kind === 'parked') {
    car.angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
  }
  return car;
}

// Parked cars along the roads (stealable) plus moving traffic.
export function spawnStreetLife(state) {
  const rng = state.rng;
  resetCarIds();
  state.cars = [];
  state.peds = [];
  // Parked cars hugging the kerb.
  for (let i = 0; i < 14; i += 1) {
    const spot = randomRoadPoint(rng);
    const vertical = rng.chance(0.5);
    const car = makeCar(rng, spot.x + (vertical ? 26 : 0), spot.y + (vertical ? 0 : 26), 'parked');
    if (!isRoad(car.x, car.y)) continue;
    state.cars.push(car);
  }
  // Moving traffic on the grid.
  for (let i = 0; i < TRAFFIC.cars; i += 1) {
    const rx = rng.pick(ROADS_V);
    const ry = rng.pick(ROADS_H);
    const car = makeCar(rng, rx, ry, 'traffic');
    state.cars.push(car);
  }
  // Pedestrians on sidewalks and in the park.
  for (let i = 0; i < TRAFFIC.peds; i += 1) {
    const spot = randomRoadPoint(rng);
    const inParkSpot = rng.chance(0.25);
    state.peds.push({
      x: inParkSpot ? state.city.park.x + rng.range(20, state.city.park.w - 20) : spot.x + rng.range(-90, 90),
      y: inParkSpot ? state.city.park.y + rng.range(20, state.city.park.h - 20) : spot.y + rng.range(-90, 90),
      angle: rng.next() * Math.PI * 2, speed: TRAFFIC.pedSpeed * rng.range(0.7, 1.3),
      color: rng.pick(['#f2c230', '#e07b39', '#37b06a', '#8e44ad', '#e8e8e8', '#2b7de3']),
      fleeing: false, fleeX: 0, fleeY: 0, down: false, walkPhase: rng.next() * 6,
    });
  }
}

// Traffic cars follow their road; at an intersection they may turn onto the cross
// road. They slow for the car ahead and stop when they hit a building (should not
// happen on the grid, but the city is the authority).
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.wrecked) continue;
    const target = TRAFFIC.carSpeed;
    let ahead = null;
    for (const other of state.cars) {
      if (other === car || other.wrecked) continue;
      const dx = other.x - car.x; const dy = other.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (along > 0 && along < 70 && side < 26) ahead = other;
    }
    car.speed += ((ahead ? 0 : target) - car.speed) * Math.min(1, 2 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const body = { x: car.x, y: car.y, r: DRIVE.carRadius - 2 };
    if (collideBuildings(state.city, body)) { car.speed = 0; car.angle += Math.PI / 2; }
    clampToLand(body);
    car.x = body.x; car.y = body.y;
    // At an intersection, sometimes turn: keeps traffic spread over the whole city.
    if (isAtIntersection(car) && state.rng.chance(0.012)) {
      car.roadAxis = car.roadAxis === 'h' ? 'v' : 'h';
      car.dir = state.rng.chance(0.5) ? 1 : -1;
      car.angle = car.roadAxis === 'h' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
    // Wrap around the far edge so traffic never thins out.
    if (car.x < 210) { car.x = 2340; }
    if (car.x > 2350) { car.x = 220; }
    if (car.y < 10) { car.y = 1790; }
    if (car.y > 1790) { car.y = 20; }
  }
}

function isAtIntersection(car) {
  const onV = ROADS_V.some((rx) => Math.abs(car.x - rx) < 14);
  const onH = ROADS_H.some((ry) => Math.abs(car.y - ry) < 14);
  return onV && onH;
}

// Pedestrians wander; the fleeing ones sprint away from the last gunfire.
export function updatePeds(state, dt) {
  for (const ped of state.peds) {
    if (ped.down) continue;
    ped.walkPhase += dt * 6;
    if (ped.fleeing) {
      const d = Math.hypot(ped.fleeX - ped.x, ped.fleeY - ped.y);
      if (d < 30) { ped.fleeing = false; continue; }
      ped.angle = Math.atan2(ped.fleeY - ped.y, ped.fleeX - ped.x);
      ped.x += Math.cos(ped.angle) * TRAFFIC.fleeSpeed * dt;
      ped.y += Math.sin(ped.angle) * TRAFFIC.fleeSpeed * dt;
    } else {
      if (state.rng.chance(0.004)) ped.angle = state.rng.next() * Math.PI * 2;
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!isRoad(ped.x, ped.y) && !inPark(state.city, ped.x, ped.y) && state.rng.chance(0.05)) {
        ped.angle += Math.PI;
      }
    }
    const body = { x: ped.x, y: ped.y, r: 10 };
    collideBuildings(state.city, body);
    clampToLand(body);
    ped.x = body.x; ped.y = body.y;
  }
}
