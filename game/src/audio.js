// Procedural WebAudio for Palmar Bay: every sound is synthesised — engine hum,
// sirens, gunshots, pickups, mission stings and a simple bass loop. No audio
// files, no network. M mutes. The context starts on the first user gesture.
export function createAudio() {
  let ctx = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch { /* audio is decoration; never break the game */ }
  }

  function noiseBurst(dur, vol) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.2;
      src.connect(gain).connect(ctx.destination);
      src.start();
    } catch { /* ignore */ }
  }

  // A lazy two-bar bass loop: root notes of a minor groove, one note a beat.
  const BASS_LINE = [55, 55, 65.41, 49, 55, 55, 73.42, 65.41];
  let beat = 0;
  function startMusic() {
    if (!ctx || musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (muted) return;
      blip(BASS_LINE[beat % BASS_LINE.length], 0.42, 'triangle', 0.09);
      if (beat % 4 === 2) blip(220, 0.08, 'square', 0.03);
      beat += 1;
    }, 300);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); startMusic(); },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (sirenGain) sirenGain.gain.value = 0;
    },
    isMuted() { return muted; },
    // Called once a frame with the live state: engine follows speed, siren
    // follows the wanted level.
    update(state) {
      if (!ctx || muted) return;
      const car = state.cars.find((c) => c.id === state.player.carId);
      if (engineGain) {
        const speed = car ? Math.abs(car.speed) : 0;
        engineGain.gain.value = car ? 0.02 + (speed / 900) * 0.05 : 0;
        if (engineOsc) engineOsc.frequency.value = 50 + speed * 0.14;
      }
      if (sirenGain) {
        const wanted = state.wanted.level;
        sirenGain.gain.value = wanted > 0 ? 0.018 : 0;
        if (sirenOsc) sirenOsc.frequency.value = 650 + Math.sin(state.time * 5) * 180;
      }
    },
    event(name) {
      if (!ctx || muted) return;
      if (name === 'shot') noiseBurst(0.12, 0.25);
      else if (name === 'crash') noiseBurst(0.25, 0.2);
      else if (name === 'pickup') { blip(660, 0.12, 'sine', 0.12); blip(880, 0.18, 'sine', 0.12); }
      else if (name === 'mission') { blip(523, 0.15, 'triangle', 0.14); blip(659, 0.15, 'triangle', 0.14); blip(784, 0.3, 'triangle', 0.14); }
      else if (name === 'enter') blip(180, 0.1, 'square', 0.08, 320);
      else if (name === 'exit') blip(320, 0.1, 'square', 0.08, 180);
    },
  };
}
