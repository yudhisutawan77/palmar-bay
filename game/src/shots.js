// Screenshot scenes for Palmar Bay: each one plays the real rules forward from
// a fresh world, steered by an autopilot that drives the road grid like a player
// would — steal a car, follow intersections to the marker, boost on the straights.
// Same seed, same frame, every time. ?shot=chase|steal|heist|victory&seed=7.
import { STEP } from './config.js';
import { ROADS_V, ROADS_H, nearestRoadPoint, isRoad, planRoute } from './city.js';
import { EVENT_VICTORY, EVENT_OVER } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_VICTORY } from './render.js';
import { nearestEnterableCar, playerCar } from './player.js';
import { startMission } from './missions.js';

const STUCK_SECONDS = 1.4;

// planRoute lives in city.js now (the police use it too); re-exported here so
// older imports keep working.
export { planRoute } from './city.js';

function walkToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x; const dy = ty - p.y;
  return {
    up: dy < -8, down: dy > 8,
    left: dx < -8, right: dx > 8,
    run: true, boost: false, shoot: false, interact: false,
    aimX: tx, aimY: ty,
  };
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// One autopilot decision: returns an input object for this step. `route` is a
// mutable waypoint list the pilot consumes as it arrives.
export function autopilotDrive(state, route, boost) {
  const p = state.player;
  const car = playerCar(state);
  // On foot: WASD moves in screen directions, so map the direction to the
  // target straight onto the keys (not onto the facing angle). First choice is
  // a car within stealing reach; then the nearest drivable car anywhere close;
  // then, with no car at all, run for the mission marker on foot.
  if (!car) {
    const close = nearestEnterableCar(state);
    if (close) {
      const dx = close.x - p.x; const dy = close.y - p.y;
      if (Math.hypot(dx, dy) < 40) return { up: false, down: false, left: false, right: false, run: false, boost: false, shoot: false, interact: true };
      return walkToward(state, close.x, close.y);
    }
    let bestCar = null; let bestD = 600;
    for (const c of state.cars) {
      if (c.wrecked || c.kind === 'police') continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { bestD = d; bestCar = c; }
    }
    if (bestCar) return walkToward(state, bestCar.x, bestCar.y);
    const t = state.mission.target;
    if (t) return walkToward(state, t.x, t.y);
    return { up: false, down: false, left: false, right: false, run: true, boost: false, shoot: false, interact: false };
  }
  // Driving: chase the next waypoint; drop it once close.
  while (route.length > 0 && Math.hypot(route[0].x - car.x, route[0].y - car.y) < 46) route.shift();
  if (route.length === 0) return { up: false, down: true, left: false, right: false, run: false, boost: false, shoot: false, interact: false };
  const wp = route[0];
  const wpDist = Math.hypot(wp.x - car.x, wp.y - car.y);
  const want = Math.atan2(wp.y - car.y, wp.x - car.x);
  const diff = angleDiff(want, car.angle);
  const aligned = Math.abs(diff) < 0.25;
  // Slow down for the waypoint itself: a car that arrives at 500 units a
  // second blows straight past the turn and into the next block.
  const approach = wpDist < 200 && Math.abs(car.speed) > 260;
  // The waypoint is behind us: a three-point turn. Brake first, then reverse
  // with the steering flipped (reversing turns the car the other way).
  if (Math.abs(diff) > 2.4) {
    if (Math.abs(car.speed) > 40) {
      return { up: false, down: true, left: diff < -0.12, right: diff > 0.12, run: false, boost: false, shoot: false, interact: false };
    }
    return { up: false, down: true, left: diff > 0.12, right: diff < -0.12, run: false, boost: false, shoot: false, interact: false };
  }
  // Never accelerate into a sharp turn: brake first, turn tight, then go.
  // Except from a standstill: a stopped car cannot steer at all, so creep
  // forward while turning hard instead of waiting forever to be aligned.
  const turning = Math.abs(diff) > 0.6;
  const creeping = Math.abs(car.speed) < 30 && Math.abs(diff) > 0.5;
  return {
    up: (!turning || creeping) && !approach, down: (turning && !creeping && Math.abs(car.speed) > 90) || approach,
    left: diff < -0.12, right: diff > 0.12,
    run: false, boost: Boolean(boost) && aligned && state.boost > 15 && Math.abs(car.speed) > 180,
    shoot: false, interact: false,
    aimX: car.x + Math.cos(want) * 40, aimY: car.y + Math.sin(want) * 40,
  };
}

// Drive the current mission to completion (or the step cap), returning true on
// victory. A stuck detector reverses the car out of trouble; a wrecked car means
// the pilot steals the next one it finds. `tick`, when given, is called each
// step with the state (the trace harness uses it to log). `driveTo` steers at a
// fixed point instead of the mission marker (screenshot chases); `stopWhen`
// ends the drive early the moment it is true (screenshot staging).
export function driveMissionsToVictory(world, maxSteps, tick, driveTo, stopWhen) {
  const state = world.state;
  let route = [];
  let lastTarget = null;
  let stuckTime = 0;
  let reverseTime = 0;
  let lastX = state.player.x; let lastY = state.player.y;
  for (let step = 0; step < maxSteps; step += 1) {
    if (state.victory) return true;
    if (state.gameOver) return false;
    if (stopWhen && stopWhen(state)) return false;
    const target = driveTo || state.mission.target;
    // Plan once per target. Never replan on a timer: re-anchoring to the
    // nearest intersection behind a moving car sends it backwards forever.
    // Replan only when the target changes, the route runs dry, or a stuck
    // reverse just freed the car. The "from" point leads the car by its
    // motion, so the route starts at the intersection ahead, not behind.
    const movingCar = playerCar(state);
    const from = movingCar
      ? { x: movingCar.x + Math.cos(movingCar.angle) * Math.max(0, movingCar.speed) * 0.4, y: movingCar.y + Math.sin(movingCar.angle) * Math.max(0, movingCar.speed) * 0.4 }
      : { x: state.player.x, y: state.player.y };
    if (target && (!lastTarget || lastTarget.x !== target.x || lastTarget.y !== target.y || route.length === 0)) {
      route = planRoute(from, target);
      lastTarget = { x: target.x, y: target.y };
    }
    // Off the road grid (knocked into a block): head for the nearest road
    // first, before chasing the next waypoint.
    const pc0 = playerCar(state);
    if (pc0 && !isRoad(pc0.x, pc0.y)) {
      const rp = nearestRoadPoint(pc0.x, pc0.y);
      if (!route[0] || Math.hypot(route[0].x - rp.x, route[0].y - rp.y) > 30) route.unshift(rp);
    }
    let input = autopilotDrive(state, route, true);
    // Stuck? The car is barely moving — back up and swing around, then replan.
    // (Not while already reversing: that would just re-trigger forever.)
    const moved = Math.hypot(state.player.x - lastX, state.player.y - lastY);
    const car = playerCar(state);
    if (reverseTime <= 0 && car && moved < 1.5 && Math.abs(car.speed) < 40) stuckTime += STEP;
    else if (reverseTime <= 0) stuckTime = 0;
    if (stuckTime > STUCK_SECONDS) { reverseTime = 0.9; stuckTime = 0; route = []; }
    if (reverseTime > 0) {
      reverseTime -= STEP;
      input = { up: false, down: true, left: !input.left, right: !input.right, run: false, boost: false, shoot: false, interact: false };
    }
    lastX = state.player.x; lastY = state.player.y;
    const events = world.step(STEP, input, false);
    if (tick) tick(state, route);
    if (events & EVENT_VICTORY) return true;
    if (events & EVENT_OVER) return false;
  }
  return state.victory;
}

// Stage one named scene on a fresh world and say which screen to draw over it.
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'steal') {
    // Dante on foot beside the starter car, traffic and pedestrians around.
    state.player.x = 680; state.player.y = 648;
    state.player.angle = -Math.PI / 2;
    for (let i = 0; i < 4 * 60; i += 1) world.step(STEP, { up: false, down: false, left: false, right: false, run: false, boost: false, shoot: false, interact: false }, false);
    state.player.x = 680; state.player.y = 648;
    state.nearCarPrompt = true;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'chase') {
    // Three stars, mid-getaway: steal a car and run east for the docks with
    // the patrol cars behind. The mission stays "Lose the Tail" — the drive
    // is cut before the safehouse, while the chase is at its hottest.
    startMission(state, 2);
    driveMissionsToVictory(world, 60 * 7, null, { x: 2420, y: 900 });
    // The cover is a three-star chase: the steal that started the drive added
    // a star on top of the mission's three, so pin the heat back to 3.
    state.wanted.heat = 3.2;
    state.wanted.level = 3;
    state.boost = 82;
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'heist') {
    // Bank Job, loot in hand: drive to the bank until the alarm trips the
    // four-star escape, then run for the docks through the roadblocks.
    startMission(state, 3);
    driveMissionsToVictory(world, 60 * 30, null, null, (s) => s.mission.index === 3 && s.mission.stage === 1);
    driveMissionsToVictory(world, 60 * 8, null, { x: 2420, y: 900 });
    state.boost = 64;
    return { screen: SCREEN_PLAY, best: state.cash };
  }
  if (name === 'victory') {
    const won = driveMissionsToVictory(world, 60 * 60 * 12);
    return { screen: won ? SCREEN_VICTORY : SCREEN_PLAY, best: state.cash };
  }
  // Default: title over the living city.
  for (let i = 0; i < 5 * 60; i += 1) world.step(STEP, null, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
