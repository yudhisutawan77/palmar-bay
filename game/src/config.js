// Palmar Bay tuning: every number the rest of the game reads lives here, so a
// balance pass touches one file. The city is 2560 x 1800 world units; the camera
// shows a 1280 x 720 window of it. All speeds are world units per second.
export const VIEW = { width: 1280, height: 720 };
export const CITY = { width: 2560, height: 1800 };
export const STEP = 1 / 60;
export const SAVE_KEY = 'palmar-bay-save-v1';

// Player on foot.
export const WALK = {
  speed: 210, runSpeed: 330, radius: 13, health: 100,
  pistolDamage: 34, pistolRange: 420, pistolCooldown: 0.28, bulletSpeed: 900,
};
// Driving. Boost is the game's signature: it spends the heat meter (see HEAT).
export const DRIVE = {
  accel: 520, reverseAccel: 300, maxSpeed: 560, maxReverse: 180,
  steer: 3.4, grip: 3.2, brake: 700, handbrake: 900, carRadius: 20,
  boostMultiplier: 1.55, boostDrain: 26, carHealth: 280, policeCarHealth: 150,
};
// HEAT IS BOOST: wanted stars charge the meter; boost spends it and adds heat.
export const HEAT = {
  chargePerStar: 7,           // meter points per second per wanted star
  passiveCharge: 1.5,         // slow trickle even when clean
  boostHeatPerSecond: 0.06,   // wanted-heat gained while boosting
  max: 100,
};
// Wanted level 0-5. Heat (a 0..5 float) rises with crimes and decays when unseen.
export const WANTED = {
  stealCar: 1.0, shoot: 0.7, killPed: 1.2, ramPolice: 0.8, hitAndRun: 0.4,
  decayUnseen: 0.22, decaySafehouse: 0.9, sightRange: 560, loseSightSeconds: 6,
  maxPolice: [0, 1, 2, 3, 4, 6], roadblockAt: 3,
};
// Police behaviour.
export const POLICE = {
  carSpeed: 480, ramDamage: 4, ramCooldown: 2.5, bustRadius: 26,
  spawnDistance: 620, despawnDistance: 1400,
};
// Traffic and pedestrians.
export const TRAFFIC = { cars: 16, peds: 24, carSpeed: 150, pedSpeed: 55, fleeSpeed: 150 };
// Mission rewards and reputation.
export const MISSIONS = { cash: [400, 900, 1400, 2600, 6000], repPerMission: 20 };

export const PALETTE = {
  asphalt: '#3a3f4a', asphaltEdge: '#2c3038', lane: '#e8d44d',
  sidewalk: '#9aa0a8', grass: '#4f9e57', grassDark: '#3f8347',
  sand: '#e8d29a', water: '#2e7fa8', waterDeep: '#1f5f84',
  buildingA: '#c98a5e', buildingB: '#7fa3b8', buildingC: '#b85c6e',
  buildingD: '#e0b25a', buildingE: '#6e8f6a', roof: '#5b4a3f',
  parkTree: '#2f7a3d', dock: '#8a6f4d', hud: '#0d1117', accent: '#ffb400',
  police: '#1f6fd6', policeLight: '#ff3b30', playerCar: '#e33e2b',
};
export const CAR_COLORS = ['#e33e2b', '#2b7de3', '#f2c230', '#37b06a', '#8e44ad', '#e8e8e8', '#222831', '#e07b39'];
export const DISTRICTS = [
  { name: 'Marina Beach', x: 0, y: 0, w: 200, h: 1800 },
  { name: 'Old Town', x: 200, y: 0, w: 760, h: 900 },
  { name: 'Downtown', x: 960, y: 0, w: 800, h: 900 },
  { name: 'Palmar Park', x: 960, y: 900, w: 800, h: 420 },
  { name: 'Portside', x: 1760, y: 0, w: 800, h: 1800 },
];
