import { GameEngine } from './engine/GameEngine.js';
import { Level } from './engine/Level.js';
import { DebugMetrics } from './engine/DebugMetrics.js';
import { primaryLevel } from './data/levels.js';

const canvas = document.getElementById('game-canvas');
const debug = new DebugMetrics();

const level = new Level(primaryLevel);
const engine = new GameEngine({ canvas, level, debug });

canvas.addEventListener('click', () => {
  if (canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
});

engine.start();

function renderDebug() {
  const fpsEl = document.getElementById('metric-fps');
  const entityEl = document.getElementById('metric-entities');
  const errorEl = document.getElementById('metric-errors');
  const yawEl = document.getElementById('metric-yaw');
  const pitchEl = document.getElementById('metric-pitch');
  const ammoEl = document.getElementById('metric-ammo');
  const rifleStateEl = document.getElementById('metric-rifle-state');
  const logList = document.getElementById('log-entries');

  fpsEl.textContent = `FPS: ${engine.state.fps.toFixed(1)}`;
  entityEl.textContent = `Entities: ${engine.entities.length}`;
  errorEl.textContent = `Errors: ${debug.errorCount}`;
  yawEl.textContent = `Yaw: ${debug.getFlag('player_yaw') ?? '--'}`;
  pitchEl.textContent = `Pitch: ${debug.getFlag('player_pitch') ?? '--'}`;
  ammoEl.textContent = `Rifle Ammo: ${debug.getFlag('rifle_ammo') ?? 12}`;
  rifleStateEl.textContent = `Rifle State: ${debug.getFlag('rifle_state') ?? 'ready'}`;

  logList.innerHTML = '';
  debug.logs.slice(-6).forEach((log) => {
    const li = document.createElement('li');
    li.className = 'log-entry';
    li.textContent = `${log.timestamp} — ${log.message}`;
    logList.appendChild(li);
  });

  requestAnimationFrame(renderDebug);
}

renderDebug();
