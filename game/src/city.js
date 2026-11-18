// Palmar Bay, the city itself: a seeded road grid with buildings in every block,
// a beach and ocean along the west edge, a park in the middle, container docks at
// the east port, and Marisol's safehouse. Pure data + geometry helpers; nothing here
// touches the screen or the clock, so the city is identical for every seed replay.
import { CITY, PALETTE } from './config.js';

export const ROAD_W = 72;
export const ROADS_V = [320, 680, 1040, 1400, 1760, 2120];
export const ROADS_H = [300, 660, 1020, 1380];
export const BEACH_X = 200;      // west of this is sand, then ocean
export const WATER_X = 88;       // west of this is water
export const PORT_X = 2360;      // east of this is the docks

const BUILDING_COLORS = ['buildingA', 'buildingB', 'buildingC', 'buildingD', 'buildingE'];

// Build the city from a seeded RNG: buildings get a colour, a height (for shading)
// and a name, but their footprints come from the fixed grid, so the map is readable.
export function buildCity(rng) {
  const buildings = [];
  const blockNames = [
    'Coral Court', 'Sunset Plaza', 'Harbor View', 'Palm Court', 'Bay Towers',
    'Marina Lofts', 'Sol Plaza', 'Cactus Row', 'Lagoon House', 'Fiesta Block',
    'Coral Flats', 'Palm Terrace', 'Dune House', 'Wave Court', 'Anchor Flats',
    'Siesta Court', 'Breeze House', 'Tide Plaza', 'Coral Row', 'Sun Court',
  ];
  let nameIndex = 0;
  const xs = [BEACH_X + ROAD_W, ...ROADS_V.map((x) => x + ROAD_W / 2)];
  const xe = [...ROADS_V.map((x) => x - ROAD_W / 2), PORT_X];
  const ys = [ROAD_W / 2, ...ROADS_H.map((y) => y + ROAD_W / 2)];
  const ye = [...ROADS_H.map((y) => y - ROAD_W / 2), CITY.height - 20];
  for (let col = 0; col < xs.length; col += 1) {
    for (let row = 0; row < ys.length; row += 1) {
      const bx = xs[col]; const by = ys[row];
      const bw = xe[col] - bx; const bh = ye[row] - by;
      if (bw < 90 || bh < 90) continue;
      // The park replaces one middle block with grass and trees.
      if (col === 2 && row === 2) continue;
      // Split wide blocks into two buildings with a gap between them.
      const split = bw > 260 && rng.chance(0.6);
      const parts = split ? 2 : 1;
      for (let p = 0; p < parts; p += 1) {
        const w = split ? bw / 2 - 14 : bw - 24;
        const h = bh - 24;
        const x = split ? bx + 12 + p * (bw / 2) : bx + 12;
        const y = by + 12;
        buildings.push({
          x, y, w, h,
          color: PALETTE[BUILDING_COLORS[Math.floor(rng.next() * BUILDING_COLORS.length)]],
          height: rng.int(1, 5),
          name: blockNames[nameIndex++ % blockNames.length],
        });
      }
    }
  }
  return {
    buildings,
    park: { x: 1040 + ROAD_W / 2, y: 1020 + ROAD_W / 2, w: 1400 - 1040 - ROAD_W, h: 1380 - 1020 - ROAD_W },
    safehouse: { x: 560, y: 1150, w: 150, h: 110, doorX: 680 - ROAD_W / 2 - 6, doorY: 1205 },
    docks: { x: PORT_X, y: 240, w: CITY.width - PORT_X, h: 1320 },
    spawn: { x: 680, y: 660 },
  };
}

export function isWater(x, y) { return x < WATER_X; }
export function isSand(x, y) { return x >= WATER_X && x < BEACH_X; }
export function isRoad(x, y) {
  if (x < BEACH_X) return false;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= ROAD_W / 2) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= ROAD_W / 2) return true;
  return false;
}
export function inPark(city, x, y) {
  return x >= city.park.x && x <= city.park.x + city.park.w && y >= city.park.y && y <= city.park.y + city.park.h;
}
export function inDocks(city, x, y) {
  return x >= city.docks.x && y >= city.docks.y && y <= city.docks.y + city.docks.h;
}
// Push a circle out of every building it overlaps, along the axis of least
// penetration — so a car sliding along a wall keeps moving instead of wedging
// into a corner. Returns true when it hit one.
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const overlapX = Math.min(body.x + body.r, b.x + b.w) - Math.max(body.x - body.r, b.x);
    const overlapY = Math.min(body.y + body.r, b.y + b.h) - Math.max(body.y - body.r, b.y);
    if (overlapX <= 0 || overlapY <= 0) continue;
    hit = true;
    if (overlapX < overlapY) {
      body.x += (body.x < b.x + b.w / 2 ? -overlapX : overlapX);
    } else {
      body.y += (body.y < b.y + b.h / 2 ? -overlapY : overlapY);
    }
  }
  return hit;
}
// Clamp a circle inside the playable land (ocean blocks, docks edge blocks).
export function clampToLand(body) {
  body.x = Math.max(WATER_X + body.r, Math.min(CITY.width - body.r, body.x));
  body.y = Math.max(body.r, Math.min(CITY.height - body.r, body.y));
}
// Nearest point on any road centreline, for spawning traffic and police.
export function nearestRoadPoint(x, y) {
  let best = null; let bestD = Infinity;
  for (const rx of ROADS_V) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y }; }
  }
  for (const ry of ROADS_H) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry }; }
  }
  return best;
}
// A random road intersection, for spawning parked cars and pickups.
export function randomRoadPoint(rng) {
  const rx = ROADS_V[Math.floor(rng.next() * ROADS_V.length)];
  const ry = ROADS_H[Math.floor(rng.next() * ROADS_H.length)];
  return { x: rx + rng.range(-140, 140), y: ry + rng.range(-140, 140) };
}

// Breadth-first route over the road intersections, Manhattan-style: from the
// intersection nearest `from` to the one nearest `to`, as a list of waypoints.
// The autopilot and the police both drive it, so the whole city is reachable.
export function planRoute(from, to) {
  const cols = ROADS_V.length; const rows = ROADS_H.length;
  const start = nearestNode(from); const goal = nearestNode(to);
  const prev = new Map();
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) break;
    for (const next of neighbours(node)) {
      if (seen.has(next)) continue;
      seen.add(next); prev.set(next, node); queue.push(next);
    }
  }
  const path = [];
  let node = goal;
  while (node !== undefined && node !== start) {
    path.unshift(nodeToPoint(node));
    node = prev.get(node);
  }
  path.push({ x: to.x, y: to.y });
  return path;
  function nearestNode(p) {
    let bi = 0; let bj = 0; let bd = Infinity;
    for (let i = 0; i < cols; i += 1) for (let j = 0; j < rows; j += 1) {
      const d = Math.hypot(ROADS_V[i] - p.x, ROADS_H[j] - p.y);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    return bj * cols + bi;
  }
  function neighbours(node) {
    const i = node % cols; const j = Math.floor(node / cols);
    const out = [];
    if (i > 0) out.push(node - 1);
    if (i < cols - 1) out.push(node + 1);
    if (j > 0) out.push(node - cols);
    if (j < rows - 1) out.push(node + cols);
    return out;
  }
  function nodeToPoint(node) {
    return { x: ROADS_V[node % cols], y: ROADS_H[Math.floor(node / cols)] };
  }
}
