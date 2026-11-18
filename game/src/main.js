// Boot and the one loop for Palmar Bay: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// the renderer paints what is there, and the audio follows the state. Screens:
// title (with Continue when a save exists), play, paused, busted/wasted, victory.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|steal|heist|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { STEP, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createWorld, saveGame, loadSave, applySave, EVENT_OVER, EVENT_VICTORY } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_MUTE, ACTION_INTERACT, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';
import { nearestEnterableCar } from './player.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  const state = world.state;
  state.hasSave = false;
  let painted = 0;
  function paint() {
    renderer.draw(state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let saved = loadSave();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) { status.textContent = message; }

  function startGame(fromSave) {
    world.reset();
    if (fromSave && saved) applySave(world, saved);
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    announce(`Playing. Mission ${world.state.mission.index + 1}: ${world.state.mission.title}.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    saveGame(world.state);
    announce(world.state.gameOver === 'busted' ? 'Busted. Press Space to try again.' : 'Wasted. Press Space to try again.');
  }

  function winGame() {
    screen = SCREEN_VICTORY;
    saveGame(world.state);
    announce('The Big One is complete. Palmar Bay is yours.');
  }

  // Actions are read exactly once per frame, here in frame(), and handed to
  // step(): takeActions() consumes a press, so reading it twice in one frame
  // (once for the screens, once for the world) would swallow E and M.
  function step(actions) {
    const raw = input.read();
    const cam = renderer.camera(world.state);
    const state = world.state;
    // Mouse aim in world coordinates: canvas pixel + camera offset.
    const aimX = cam.x + raw.mouseX;
    const aimY = cam.y + raw.mouseY;
    const stepInput = { ...raw, aimX, aimY, interact: false };
    if (actions & ACTION_INTERACT) stepInput.interact = true;
    state.nearCarPrompt = state.player.carId === null && nearestEnterableCar(state) !== null;
    const events = world.step(STEP, stepInput, false);
    if (world.state.audioEvent) audio.event(world.state.audioEvent);
    audio.update(world.state);
    if (events & EVENT_OVER) endGame();
    else if (events & EVENT_VICTORY) winGame();
    // Autosave on every finished mission.
    if (world.state.stats.missionsDone > 0 && world.state.mission.done) saveGame(world.state);
  }

  // Returns the actions pressed this frame, after handling the screen-level
  // ones (start, pause, mute) that belong to no simulation step.
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY)) {
      startGame(screen === SCREEN_TITLE && saved !== null);
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      world.state.hasSave = saved !== null;
      renderer.draw(world.state, screen, world.state.cash);
      accumulator = 0;
      return;
    }
    if (screen === SCREEN_PLAY) {
      // One press is one action: E must enter the car on the first step of
      // the frame, not enter and exit it again on the second.
      let remaining = actions;
      while (accumulator >= STEP) {
        step(remaining);
        remaining &= ~ACTION_INTERACT;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, world.state.cash);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Palmar Bay. Press Enter to start. WASD to move, E to steal a car.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
