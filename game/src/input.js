// Keyboard + mouse for Palmar Bay. Keys are read live into a held set; the
// game polls `read()` once per fixed step, so input never depends on frame rate.
// `takeActions()` returns edge-triggered one-shot actions (confirm, pause, mute,
// interact) exactly once per press. Mouse position is converted to world
// coordinates by main.js, which knows the camera.
export const ACTION_NONE = 0;
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_INTERACT = 8;

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  function keyOf(event) {
    return event.code || event.key;
  }

  window.addEventListener('keydown', (event) => {
    const code = keyOf(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (!held.has(code)) pressed.add(code);
    held.add(code);
  });
  window.addEventListener('keyup', (event) => held.delete(keyOf(event)));
  window.addEventListener('blur', () => held.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouseY = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) mouseDown = true;
    mouseX = event.clientX; mouseY = event.clientY;
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });

  function down(...codes) {
    return codes.some((c) => held.has(c));
  }

  return {
    // Held state for one simulation step, plus the mouse in canvas pixels.
    read() {
      return {
        up: down('KeyW', 'ArrowUp'),
        down: down('KeyS', 'ArrowDown'),
        left: down('KeyA', 'ArrowLeft'),
        right: down('KeyD', 'ArrowRight'),
        run: down('ShiftLeft', 'ShiftRight'),
        boost: down('Space'),
        shoot: down('KeyF') || mouseDown,
        mouseX, mouseY,
      };
    },
    // Edge-triggered actions, consumed once.
    takeActions() {
      let actions = ACTION_NONE;
      if (pressed.has('Enter') || pressed.has('Space')) actions |= ACTION_CONFIRM;
      if (pressed.has('KeyP') || pressed.has('Escape')) actions |= ACTION_PAUSE;
      if (pressed.has('KeyM')) actions |= ACTION_MUTE;
      if (pressed.has('KeyE')) actions |= ACTION_INTERACT;
      pressed.clear();
      return actions;
    },
    // A raw held-key check, for the pause screen's "any key" behaviour.
    anyHeld() { return held.size > 0; },
  };
}
