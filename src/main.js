import { GameEngine } from './engine/GameEngine.js';
import { Level } from './engine/Level.js';
import { DebugMetrics } from './engine/DebugMetrics.js';
import { primaryLevel } from './data/levels.js';

const canvas = document.getElementById('game-canvas');
const debug = new DebugMetrics();

debug.setFlag('session_boot', 'initializing');
debug.log('Bootstrapping game client');

const level = new Level(primaryLevel);
const engine = new GameEngine({ canvas, level, debug });
const hud = document.getElementById('hud');
const logPanel = document.getElementById('log-panel');
const debugToggle = document.getElementById('toggle-debug');

function setDebugVisibility(enabled) {
  document.body.classList.toggle('debug-visible', enabled);
  hud.hidden = !enabled;
  logPanel.hidden = !enabled;
  debugToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  debug.setFlag('debug_overlay', enabled ? 'visible' : 'hidden');
}

setDebugVisibility(false);

debugToggle.addEventListener('click', () => {
  setDebugVisibility(!document.body.classList.contains('debug-visible'));
});

document.addEventListener('keydown', (event) => {
  if (event.code === 'F3') {
    setDebugVisibility(!document.body.classList.contains('debug-visible'));
  }
});

function requestPointer() {
  if (canvas.requestPointerLock) {
    canvas.requestPointerLock();
  }
}

canvas.addEventListener('click', requestPointer);
canvas.addEventListener('mouseenter', requestPointer);
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  debug.setFlag('pointer_locked', locked ? 'locked' : 'released');
  debug.log(`Pointer ${locked ? 'locked' : 'released'}`);
});

try {
  engine.start();
  debug.setFlag('session_boot', 'running');
  document.getElementById('auto-start-notice').textContent = 'Running — use WASD to move, mouse to look, Space to fire.';
} catch (error) {
  debug.recordError(error);
  debug.setFlag('session_boot', 'failed');
  document.getElementById('auto-start-notice').textContent = 'Failed to start — check logs.';
}

function renderDebug() {
  const fpsEl = document.getElementById('metric-fps');
  const entityEl = document.getElementById('metric-entities');
  const errorEl = document.getElementById('metric-errors');
  const sessionEl = document.getElementById('metric-session');
  const yawEl = document.getElementById('metric-yaw');
  const pitchEl = document.getElementById('metric-pitch');
  const ammoEl = document.getElementById('metric-ammo');
  const rifleStateEl = document.getElementById('metric-rifle-state');
  const logList = document.getElementById('log-entries');

  fpsEl.textContent = `FPS: ${engine.state.fps.toFixed(1)}`;
  entityEl.textContent = `Entities: ${engine.entities.length}`;
  errorEl.textContent = `Errors: ${debug.errorCount}`;
  sessionEl.textContent = `Session: ${debug.getFlag('session_boot') ?? 'unknown'}`;
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
