// The renderer: one canvas, one camera that follows Dante, the whole city drawn
// from the state every frame — roads and buildings, beach and docks, traffic,
// police lights, the HUD (stars, cash, health, the HEAT BOOST meter, mission
// objective, phone texts) and the minimap. Screens are drawn here too.
import { VIEW, CITY, PALETTE } from './config.js';
import { ROADS_V, ROADS_H, ROAD_W, WATER_X, BEACH_X, PORT_X, isRoad } from './city.js';
import { MISSION_DEFS } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const scale = Math.min(window.innerWidth / VIEW.width, window.innerHeight / VIEW.height);
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
    canvas.style.width = `${Math.floor(VIEW.width * scale)}px`;
    canvas.style.height = `${Math.floor(VIEW.height * scale)}px`;
  }
  resize();
  window.addEventListener('resize', resize);

  function camera(state) {
    const cx = Math.max(VIEW.width / 2, Math.min(CITY.width - VIEW.width / 2, state.player.x));
    const cy = Math.max(VIEW.height / 2, Math.min(CITY.height - VIEW.height / 2, state.player.y));
    return { x: cx - VIEW.width / 2, y: cy - VIEW.height / 2 };
  }

  function drawCity(state, cam) {
    // Ground: grass base, then sand, ocean and docks over it.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(-cam.x, -cam.y, CITY.width, CITY.height);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WATER_X - cam.x, -cam.y, BEACH_X - WATER_X, CITY.height);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(-cam.x, -cam.y, WATER_X, CITY.height);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = 40; y < CITY.height; y += 180) {
      ctx.fillRect(8 - cam.x, y - cam.y, WATER_X - 16, 5);
    }
    // Park grass, darker, with trees.
    const park = state.city.park;
    ctx.fillStyle = PALETTE.grassDark;
    ctx.fillRect(park.x - cam.x, park.y - cam.y, park.w, park.h);
    ctx.fillStyle = PALETTE.parkTree;
    for (let i = 0; i < 14; i += 1) {
      const tx = park.x + 30 + ((i * 97) % (park.w - 60));
      const ty = park.y + 30 + ((i * 61) % (park.h - 60));
      ctx.beginPath(); ctx.arc(tx - cam.x, ty - cam.y, 13, 0, Math.PI * 2); ctx.fill();
    }
    // Roads.
    ctx.fillStyle = PALETTE.asphalt;
    for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2 - cam.x, -cam.y, ROAD_W, CITY.height);
    for (const ry of ROADS_H) ctx.fillRect(-cam.x, ry - ROAD_W / 2 - cam.y, CITY.width, ROAD_W);
    // Lane dashes.
    ctx.fillStyle = PALETTE.lane;
    for (const rx of ROADS_V) {
      for (let y = 20; y < CITY.height; y += 64) ctx.fillRect(rx - 2 - cam.x, y - cam.y, 4, 30);
    }
    for (const ry of ROADS_H) {
      for (let x = 220; x < CITY.width; x += 64) ctx.fillRect(x - cam.x, ry - 2 - cam.y, 30, 4);
    }
    // Docks: wooden piers and container stacks.
    ctx.fillStyle = PALETTE.dock;
    for (let i = 0; i < 4; i += 1) ctx.fillRect(PORT_X + 20 - cam.x, 300 + i * 320 - cam.y, 120, 40);
    const containerColors = ['#c0392b', '#2980b9', '#27ae60', '#f39c12'];
    for (let i = 0; i < 12; i += 1) {
      ctx.fillStyle = containerColors[i % 4];
      ctx.fillRect(PORT_X + 30 + ((i % 3) * 60) - cam.x, 420 + Math.floor(i / 3) * 300 - cam.y, 52, 26);
    }
    // Safehouse: a yellow house with a green door, marked on the map.
    const sh = state.city.safehouse;
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(sh.x - cam.x, sh.y - cam.y, sh.w, sh.h);
    ctx.fillStyle = '#2f7a3d';
    ctx.fillRect(sh.doorX - 12 - cam.x, sh.doorY - 12 - cam.y, 24, 24);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('SAFEHOUSE', sh.x + 18 - cam.x, sh.y + 22 - cam.y);
    // Buildings with roofs, windows and a shaded edge for height.
    for (const b of state.city.buildings) {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x - cam.x, b.y - cam.y, b.w, b.h);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(b.x - cam.x, b.y + b.h - 10 - cam.y, b.w, 10);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let cx = 0; cx < cols; cx += 1) {
        for (let cy = 0; cy < rows; cy += 1) {
          ctx.fillRect(b.x + 10 + cx * 34 - cam.x, b.y + 10 + cy * 34 - cam.y, 12, 14);
        }
      }
    }
  }

  function drawCar(car, cam, isPlayer) {
    ctx.save();
    ctx.translate(car.x - cam.x, car.y - cam.y);
    ctx.rotate(car.angle);
    if (car.wrecked) ctx.globalAlpha = 0.75;
    // Body, cabin, windshield, headlights.
    ctx.fillStyle = car.wrecked ? '#333' : car.color;
    roundRect(-22, -11, 44, 22, 6);
    ctx.fill();
    ctx.fillStyle = car.wrecked ? '#222' : 'rgba(20,30,40,0.85)';
    roundRect(-6, -9, 16, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(20, -8, 3, 5); ctx.fillRect(20, 3, 3, 5);
    if (car.kind === 'police') {
      const phase = Math.floor(car.sirenPhase || 0) % 2;
      ctx.fillStyle = phase === 0 ? '#ff3b30' : '#2b7de3';
      ctx.fillRect(-14, -11, 10, 5);
      ctx.fillStyle = phase === 0 ? '#2b7de3' : '#ff3b30';
      ctx.fillRect(-14, 6, 10, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('PD', -4, 3);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      roundRect(-24, -13, 48, 26, 7);
      ctx.stroke();
    }
    // Damage smoke.
    if (car.hp < 90 && !car.wrecked) {
      ctx.fillStyle = 'rgba(120,120,120,0.7)';
      ctx.beginPath(); ctx.arc(-14, -6, 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawPed(ped, cam) {
    if (ped.down) {
      ctx.fillStyle = '#5a2d2d';
      ctx.beginPath(); ctx.ellipse(ped.x - cam.x, ped.y - cam.y, 12, 6, ped.angle, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const bob = Math.sin(ped.walkPhase) * 2;
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x - cam.x, ped.y - cam.y + bob, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(ped.x - cam.x, ped.y - cam.y + bob - 2, 5, 0, Math.PI * 2); ctx.fill();
    if (ped.fleeing) {
      ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ped.x - cam.x - 8, ped.y - cam.y - 14); ctx.lineTo(ped.x - cam.x + 8, ped.y - cam.y - 14); ctx.stroke();
    }
  }

  function drawPlayer(state, cam) {
    const p = state.player;
    if (p.carId !== null) return;
    ctx.fillStyle = '#e33e2b';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath(); ctx.arc(p.x - cam.x, p.y - cam.y, 6, 0, Math.PI * 2); ctx.fill();
    // Aim line and pistol.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(p.x - cam.x, p.y - cam.y);
    ctx.lineTo(p.x - cam.x + Math.cos(p.angle) * 34, p.y - cam.y + Math.sin(p.angle) * 34);
    ctx.stroke();
    ctx.fillStyle = '#222';
    ctx.fillRect(p.x - cam.x + Math.cos(p.angle) * 12 - 3, p.y - cam.y + Math.sin(p.angle) * 12 - 3, 6, 6);
  }

  function drawMinimap(state) {
    const mw = 208; const mh = 146;
    const mx = VIEW.width - mw - 14; const my = 14;
    const sx = mw / CITY.width; const sy = mh / CITY.height;
    ctx.fillStyle = 'rgba(10,14,20,0.85)';
    ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#3f8347';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#2e7fa8';
    ctx.fillRect(mx, my, WATER_X * sx, mh);
    ctx.fillStyle = '#3a3f4a';
    for (const rx of ROADS_V) ctx.fillRect(mx + (rx - 36) * sx, my, 72 * sx, mh);
    for (const ry of ROADS_H) ctx.fillRect(mx, my + (ry - 36) * sy, mw, 72 * sy);
    const sh = state.city.safehouse;
    ctx.fillStyle = '#f2c230';
    ctx.fillRect(mx + sh.x * sx - 3, my + sh.y * sy - 3, 6, 6);
    if (state.mission.target) {
      const t = state.mission.target;
      ctx.fillStyle = '#ffb400';
      ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 9, 0, Math.PI * 2); ctx.stroke();
    }
    for (const car of state.cars) {
      if (car.kind === 'police') {
        ctx.fillStyle = '#4da3ff';
        ctx.fillRect(mx + car.x * sx - 2, my + car.y * sy - 2, 4, 4);
      }
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#e33e2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  }

  // Split a phone message into whole-word lines that fit a pixel width, so
  // a long text never runs past its bubble or gets cut off mid-word. A single
  // word wider than the limit is hard-split so it still fits.
  function wrapPhoneLines(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const trial = current === '' ? word : `${current} ${word}`;
      if (ctx.measureText(trial).width <= maxWidth) {
        current = trial;
        continue;
      }
      if (current !== '') lines.push(current);
      current = word;
      while (ctx.measureText(current).width > maxWidth) {
        let cut = 1;
        while (cut < current.length && ctx.measureText(current.slice(0, cut + 1)).width <= maxWidth) cut += 1;
        lines.push(current.slice(0, cut));
        current = current.slice(cut);
      }
    }
    if (current !== '') lines.push(current);
    return lines;
  }

  function drawHud(state) {
    // Top-left: wanted stars, cash, rep, health.
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect(12, 12, 300, 118);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 22px sans-serif';
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted.level ? '★' : '☆';
    ctx.fillText(stars, 22, 40);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`$${state.cash.toLocaleString('en-US')}`, 22, 68);
    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#9fd6ff';
    ctx.fillText(`REP ${state.rep}   MISSION ${state.mission.index + 1}/5`, 22, 90);
    ctx.fillStyle = '#222';
    ctx.fillRect(22, 100, 160, 12);
    ctx.fillStyle = state.player.health > 30 ? '#37b06a' : '#e33e2b';
    ctx.fillRect(22, 100, 160 * (state.player.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(`HP ${Math.ceil(state.player.health)}`, 190, 110);
    // HEAT BOOST meter — the game's signature, always on screen.
    const bw = 300; const bx = 12; const by = 138;
    ctx.fillStyle = 'rgba(10,14,20,0.78)';
    ctx.fillRect(bx, by, bw, 52);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('HEAT BOOST — hotter = faster getaway', bx + 10, by + 17);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx + 10, by + 24, bw - 20, 12);
    const grad = ctx.createLinearGradient(bx + 10, 0, bx + bw - 10, 0);
    grad.addColorStop(0, '#f2c230'); grad.addColorStop(1, '#ff3b30');
    ctx.fillStyle = grad;
    ctx.fillRect(bx + 10, by + 24, (bw - 20) * (state.boost / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = '12px sans-serif';
    ctx.fillText(state.player.carId !== null ? 'SPACE to boost' : 'Get in a car — SPACE boosts', bx + 10, by + 48);
    // Mission objective banner, bottom centre.
    ctx.fillStyle = 'rgba(10,14,20,0.82)';
    const label = `${state.mission.index + 1}. ${state.mission.title} — ${state.mission.targetLabel || state.mission.brief}`;
    ctx.font = 'bold 16px sans-serif';
    const tw = ctx.measureText(label).width;
    ctx.fillRect((VIEW.width - tw) / 2 - 14, VIEW.height - 64, tw + 28, 34);
    ctx.fillStyle = '#ffb400';
    ctx.fillText(label, (VIEW.width - tw) / 2, VIEW.height - 41);
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    const brief = state.mission.brief;
    const bw2 = ctx.measureText(brief).width;
    ctx.fillText(brief, (VIEW.width - bw2) / 2, VIEW.height - 14);
    // Phone texts from Marisol, bottom-left. Each bubble word-wraps to the
    // panel's inner width and grows taller for a second line, so every line
    // is shown whole — never sliced mid-word at the panel edge.
    let ty = VIEW.height - 130;
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const msg = state.messages[i];
      const age = state.time - msg.t;
      if (age > 9) continue;
      ctx.globalAlpha = Math.max(0.35, 1 - age / 12);
      ctx.font = '13px sans-serif';
      const textX = 92;
      const textW = 12 + 430 - textX - 10;
      const wrapped = wrapPhoneLines(msg.text, textW);
      const lineGap = 16;
      const bubbleH = 34 + (wrapped.length - 1) * lineGap;
      const bubbleTop = ty - 20 - (wrapped.length - 1) * lineGap;
      ctx.fillStyle = 'rgba(20,28,40,0.9)';
      ctx.fillRect(12, bubbleTop, 430, bubbleH);
      ctx.fillStyle = '#9fd6ff';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`${msg.from}:`, 20, bubbleTop + 14);
      ctx.fillStyle = '#fff';
      ctx.font = '13px sans-serif';
      wrapped.forEach((line, n) => {
        ctx.fillText(line, textX, bubbleTop + 14 + n * lineGap);
      });
      ctx.globalAlpha = 1;
      ty -= bubbleH + 6;
    }
    // Steal prompt when Dante stands by a car.
    if (state.nearCarPrompt) {
      ctx.fillStyle = 'rgba(10,14,20,0.85)';
      ctx.font = 'bold 18px sans-serif';
      const prompt = 'STEAL CAR  [E]';
      const pw = ctx.measureText(prompt).width;
      ctx.fillRect((VIEW.width - pw) / 2 - 12, 190, pw + 24, 36);
      ctx.fillStyle = '#ffb400';
      ctx.fillText(prompt, (VIEW.width - pw) / 2, 215);
    }
    if (state.missionFlash > 0) {
      ctx.fillStyle = '#37b06a';
      ctx.font = 'bold 30px sans-serif';
      ctx.fillText('MISSION COMPLETE!', 430, 300);
    }
    drawMinimap(state);
  }

  function drawScreen(state, screen, best) {
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    if (screen === SCREEN_TITLE) {
      drawTitle(state);
      return;
    }
    const cam = camera(state);
    drawCity(state, cam);
    // Mission marker beacon.
    if (state.mission.target) {
      const t = state.mission.target;
      const pulse = 18 + Math.sin(state.time * 4) * 5;
      ctx.strokeStyle = '#ffb400'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffb400';
      ctx.beginPath(); ctx.arc(t.x - cam.x, t.y - cam.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      ctx.fillStyle = pk.kind === 'health' ? '#37b06a' : '#f2c230';
      ctx.beginPath(); ctx.arc(pk.x - cam.x, pk.y - cam.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(pk.kind === 'health' ? '+' : '$', pk.x - cam.x - 4, pk.y - cam.y + 4);
    }
    for (const rb of state.roadblocks) {
      ctx.save();
      ctx.translate(rb.x - cam.x, rb.y - cam.y);
      ctx.rotate(rb.angle);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(-34, -8, 68, 16);
      ctx.fillStyle = '#fff';
      ctx.fillRect(-34, -8, 10, 16); ctx.fillRect(-10, -8, 10, 16); ctx.fillRect(14, -8, 10, 16);
      ctx.restore();
      ctx.fillStyle = '#ff3b30';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText('ROADBLOCK', rb.x - cam.x - 34, rb.y - cam.y - 16);
    }
    for (const car of state.cars) drawCar(car, cam, car.id === state.player.carId);
    for (const ped of state.peds) drawPed(ped, cam);
    drawPlayer(state, cam);
    for (const b of state.bullets) {
      ctx.fillStyle = '#ffe9a3';
      ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawOverlay('PAUSED', 'P or Esc to keep playing. M mutes the sound.');
    if (screen === SCREEN_OVER) {
      const busted = state.gameOver === 'busted';
      drawOverlay(busted ? 'BUSTED' : 'WASTED', busted
        ? 'The patrol cars got you on foot. Press Space to try again.'
        : 'Dante went down. Press Space to try again.');
      drawStats(state, best);
    }
    if (screen === SCREEN_VICTORY) {
      drawOverlay('THE BIG ONE — COMPLETE', 'Palmar Bay is yours, Dante. Marisol sends her regards.');
      drawStats(state, best);
    }
  }

  function drawOverlay(title, sub) {
    ctx.fillStyle = 'rgba(8,10,16,0.72)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 64px sans-serif';
    const tw = ctx.measureText(title).width;
    ctx.fillText(title, (VIEW.width - tw) / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '20px sans-serif';
    const sw = ctx.measureText(sub).width;
    ctx.fillText(sub, (VIEW.width - sw) / 2, 340);
  }

  function drawStats(state, best) {
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    const lines = [
      `Cash earned: $${state.cash.toLocaleString('en-US')}`,
      `Missions finished: ${state.stats.missionsDone} / 5`,
      `Cars stolen: ${state.stats.carsStolen}   Shots: ${state.stats.shots}   Hits: ${state.stats.hits}`,
      `Reputation: ${state.rep}`,
    ];
    lines.forEach((line, i) => {
      const w = ctx.measureText(line).width;
      ctx.fillText(line, (VIEW.width - w) / 2, 390 + i * 28);
    });
  }

  function drawTitle(state) {
    // A living city behind the title: the camera drifts over downtown.
    const fake = { ...state, player: { ...state.player, x: 1040, y: 660 } };
    const cam = { x: 1040 - VIEW.width / 2, y: 660 - VIEW.height / 2 };
    drawCity(fake, cam);
    for (const car of state.cars.slice(0, 10)) drawCar(car, cam, false);
    ctx.fillStyle = 'rgba(8,10,16,0.62)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('PALMAR BAY', 90, 190);
    ctx.fillStyle = '#fff';
    ctx.font = '26px sans-serif';
    ctx.fillText('A sun-soaked open-world crime story — steal, drive, outrun the law.', 92, 232);
    ctx.fillStyle = '#9fd6ff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('HEAT IS BOOST — your wanted stars charge a boost meter: the hotter you are,', 92, 300);
    ctx.fillText('the faster your getaway. But the more police hunt you.', 92, 328);
    ctx.fillStyle = '#fff';
    ctx.font = '18px sans-serif';
    const lines = [
      'WASD move / drive  •  Mouse aim  •  F shoot  •  E steal / exit car',
      'SPACE boost (in a car)  •  SHIFT run  •  P pause  •  M mute',
      'Five story missions for Marisol — finish The Big One to win.',
    ];
    lines.forEach((line, i) => ctx.fillText(line, 92, 380 + i * 30));
    ctx.fillStyle = '#ffb400';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(state.hasSave ? 'Press ENTER — Continue your story' : 'Press ENTER — New Game', 92, 520);
    ctx.fillStyle = '#ccc';
    ctx.font = '16px sans-serif';
    ctx.fillText('Original game. No characters, places or art from any commercial game.', 92, 560);
  }

  return { draw: drawScreen, resize, camera };
}
