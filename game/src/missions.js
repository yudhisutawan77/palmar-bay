// Marisol's story: five missions for Dante Cruz, wheelman of the Palmar Bay crew.
// Each mission is a small state machine — reach a marker, do the job, reach the
// next one — with phone texts from Marisol between beats. Finishing mission 5 is
// the victory; the cash and reputation carry across missions and into the save.
import { MISSIONS } from './config.js';
import { phoneText, raiseHeat } from './player.js';

export const MISSION_DEFS = [
  {
    id: 1, title: 'First Wheels', brief: 'Steal any car and bring it to the drop-off in Old Town.',
    cash: MISSIONS.cash[0],
    intro: 'Dante, I need wheels. Any car. Bring it to the lot on Coral Row and do not get cute.',
  },
  {
    id: 2, title: 'Package Run', brief: 'Pick up the package at the marina, deliver it to Portside. The law is watching.',
    cash: MISSIONS.cash[1],
    intro: 'Package waiting at the marina kiosk. Portside buyer, cash on delivery. Patrols are thick tonight.',
  },
  {
    id: 3, title: 'Lose the Tail', brief: 'Three stars on you. Shake the patrol cars and reach the safehouse.',
    cash: MISSIONS.cash[2],
    intro: 'You are burning, Dante. Three stars. Get to the safehouse on Palm Court and lay low.',
  },
  {
    id: 4, title: 'Bank Job', brief: 'Grab the loot at Sol Bank, then run four stars to the docks.',
    cash: MISSIONS.cash[3],
    intro: 'Sol Bank, two minutes, in and out. The docks are your way out — the boat leaves when you do.',
  },
  {
    id: 5, title: 'The Big One', brief: 'Final heist: three stops across the city, then the docks. Finish it and we are free.',
    cash: MISSIONS.cash[4],
    intro: 'This is it. Three stops, one night, then the boat. Do this and Palmar Bay is ours.',
  },
];

// Markers are fixed city spots, so the autopilot and the player learn the same map.
export const SPOTS = {
  dropOff: { x: 560, y: 300, label: 'Drop-off lot' },
  marina: { x: 260, y: 300, label: 'Marina kiosk' },
  portside: { x: 2120, y: 1380, label: 'Portside buyer' },
  safehouse: { x: 674, y: 1205, label: 'Safehouse' },
  bank: { x: 1040, y: 660, label: 'Sol Bank' },
  docks: { x: 2420, y: 900, label: 'Docks — escape boat' },
  stopA: { x: 320, y: 1020, label: 'Stop 1 — Coral Court' },
  stopB: { x: 1760, y: 300, label: 'Stop 2 — Harbor View' },
  stopC: { x: 680, y: 1380, label: 'Stop 3 — Dune House' },
};

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  state.mission.index = index;
  state.mission.stage = 0;
  state.mission.done = false;
  state.mission.title = def.title;
  state.mission.brief = def.brief;
  state.mission.cash = def.cash;
  phoneText(state, 'MARISOL', def.intro);
  setMissionTarget(state);
  if (index === 2) raiseHeat(state, Math.max(0, 3 - state.wanted.heat), '');
  if (index === 3) raiseHeat(state, 1.2, 'Bank alarm tripped — four stars and climbing.');
  if (index === 4) raiseHeat(state, 1.0, 'The whole city is awake. Finish the three stops.');
}

// Pick the current objective marker for the mission and stage.
export function setMissionTarget(state) {
  const m = state.mission;
  const i = m.index; const s = m.stage;
  if (i === 0) m.target = { ...SPOTS.dropOff };
  else if (i === 1) m.target = s === 0 ? { ...SPOTS.marina } : { ...SPOTS.portside };
  else if (i === 2) m.target = { ...SPOTS.safehouse };
  else if (i === 3) m.target = s === 0 ? { ...SPOTS.bank } : { ...SPOTS.docks };
  else if (i === 4) m.target = s === 0 ? { ...SPOTS.stopA } : s === 1 ? { ...SPOTS.stopB } : s === 2 ? { ...SPOTS.stopC } : { ...SPOTS.docks };
  else m.target = null;
  m.targetLabel = m.target ? m.target.label : '';
}

// Are we close enough to the marker to count as arrived? On foot counts too.
export function atTarget(state, radius) {
  const t = state.mission.target;
  if (!t) return false;
  return Math.hypot(state.player.x - t.x, state.player.y - t.y) < (radius || 70);
}

// Advance the mission when the player reaches a marker or finishes a beat.
export function updateMissions(state) {
  const m = state.mission;
  if (m.done || state.victory || state.gameOver) return;
  const i = m.index;
  if (i === 0) {
    // Mission 1 needs a stolen car at the drop-off.
    if (state.player.carId !== null && atTarget(state, 80)) completeMission(state);
  } else if (i === 1) {
    if (m.stage === 0 && atTarget(state, 70)) {
      m.stage = 1;
      phoneText(state, 'MARISOL', 'Package in hand. Now Portside — and drive like you mean it.');
      setMissionTarget(state);
      raiseHeat(state, 1.0, 'A patrol spotted the handoff. Two stars.');
    } else if (m.stage === 1 && atTarget(state, 80)) {
      completeMission(state);
    }
  } else if (i === 2) {
    if (atTarget(state, 90)) completeMission(state);
  } else if (i === 3) {
    if (m.stage === 0 && atTarget(state, 70)) {
      m.stage = 1;
      state.cash += 800;
      phoneText(state, 'MARISOL', 'Loot secured. Now run — four stars, docks, go!');
      setMissionTarget(state);
      raiseHeat(state, 2.0, '');
    } else if (m.stage === 1 && atTarget(state, 90)) {
      completeMission(state);
    }
  } else if (i === 4) {
    if (m.stage < 3 && atTarget(state, 70)) {
      m.stage += 1;
      state.cash += 500;
      phoneText(state, 'MARISOL', m.stage === 3 ? 'Last stop done. Docks. Now!' : `Stop ${m.stage} done. Next one — keep moving.`);
      setMissionTarget(state);
    } else if (m.stage === 3 && atTarget(state, 90)) {
      completeMission(state);
    }
  }
}

function completeMission(state) {
  const m = state.mission;
  m.done = true;
  state.cash += m.cash;
  state.rep += MISSIONS.repPerMission;
  state.stats.missionsDone += 1;
  state.audioEvent = 'mission';
  phoneText(state, 'MARISOL', `Job done. $${m.cash} in the bag. Rep up.`);
  state.missionFlash = 3;
  if (m.index >= MISSION_DEFS.length - 1) {
    state.victory = true;
    phoneText(state, 'MARISOL', 'We did it, Dante. Palmar Bay is ours. The boat is waiting — go.');
  } else {
    state.pendingNextMission = true;
  }
}

// Begin the next mission after a short breather (the world keeps running).
export function advanceToNextMission(state) {
  if (!state.pendingNextMission) return;
  state.pendingNextMission = false;
  startMission(state, state.mission.index + 1);
}
