import { GameEngine } from './engine/GameEngine.js';
import { Level } from './engine/Level.js';
import { DebugMetrics } from './engine/DebugMetrics.js';
import { primaryLevel } from './data/levels.js';
import { soundtrackTracks } from './data/soundtrack.js';

const canvas = document.getElementById('game-canvas');
const debug = new DebugMetrics();

debug.setFlag('session_boot', 'initializing');
debug.setFlag('boot_watchdog', 'armed');
debug.log('Bootstrapping game client');
debug.setFlag('shell_entrypoint', window.location.pathname || 'unknown');
debug.setFlag('hud_layout', 'compact-v2');

window.addEventListener('error', (event) => {
  debug.recordError(event.error ?? new Error(event.message || 'Unknown script error'));
  debug.incrementCounter('window_error_events');
});

window.addEventListener('unhandledrejection', (event) => {
  debug.recordError(event.reason ?? new Error('Unhandled promise rejection'));
  debug.incrementCounter('window_rejection_events');
});

const level = new Level(primaryLevel);
const engine = new GameEngine({ canvas, level, debug });
const hud = document.getElementById('hud');
const logPanel = document.getElementById('log-panel');
const debugToggle = document.getElementById('toggle-debug');
let soundtrackArmed = false;

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
  if (!canvas.requestPointerLock) {
    debug.recordError(new Error('Pointer lock not supported in this context'));
    debug.incrementCounter('pointer_lock_unsupported');
    return;
  }

  try {
    canvas.requestPointerLock();
    debug.incrementCounter('pointer_lock_requests');
  } catch (error) {
    debug.recordError(error);
    debug.incrementCounter('pointer_lock_failures');
  }
}

function primeSoundtrack() {
  if (soundtrackArmed) return;
  soundtrackArmed = true;
  debug.log('Soundtrack armed');
  void engine.audio.primeFromUserGesture('soundtrack');
  engine.audio.configureSoundtrack(soundtrackTracks);
  debug.setFlag('soundtrack_ready', true);
  void engine.audio.startSoundtrackPlaylist();
}

canvas.addEventListener('click', () => {
  requestPointer();
  primeSoundtrack();
});
document.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    void engine.audio.primeFromUserGesture('rifle');
  }
});
canvas.addEventListener('mouseenter', requestPointer);
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  debug.setFlag('pointer_locked', locked ? 'locked' : 'released');
  debug.log(`Pointer ${locked ? 'locked' : 'released'}`);
  if (locked) {
    primeSoundtrack();
    debug.incrementCounter('pointer_lock_success');
  } else {
    debug.incrementCounter('pointer_lock_releases');
  }
});

try {
  engine.start();
  debug.setFlag('session_boot', 'running');
  debug.setFlag('boot_watchdog', 'cleared');
  debug.incrementCounter('boot_successes');
  debug.setFlag('last_error', 'none');
  window.__doonBooted = true;
  if (typeof window.__clearBootWatchdog === 'function') {
    window.__clearBootWatchdog();
  }
  document.getElementById('auto-start-notice').textContent = 'Running — use WASD to move, mouse to look, Space to fire.';
} catch (error) {
  debug.recordError(error);
  debug.setFlag('session_boot', 'failed');
  debug.setFlag('boot_watchdog', 'tripped');
  debug.incrementCounter('boot_failures');
  document.getElementById('auto-start-notice').textContent = 'Failed to start — check logs.';
}

function setMetricValue(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  const target = el.querySelector('.value');
  (target ?? el).textContent = value;
}

function renderDebug() {
  const logList = document.getElementById('log-entries');

  setMetricValue('metric-fps', `${engine.state.fps.toFixed(1)} fps`);
  setMetricValue('metric-frame-time', `${(debug.getSample('frame_time_ms') ?? 0).toFixed(2)} ms`);
  setMetricValue('metric-loop-health', `${debug.getFlag('frame_budget') ?? 'n/a'} | faults ${engine.state.frameFaults}`);
  setMetricValue('metric-errors', debug.errorCount);
  setMetricValue('metric-log-volume', `${debug.logs.length} entries`);
  setMetricValue('metric-session', debug.getFlag('session_boot') ?? 'unknown');
  setMetricValue('metric-watchdog', debug.getFlag('boot_watchdog') ?? 'idle');
  setMetricValue(
    'metric-pointer-locks',
    `${debug.getCounter('pointer_lock_requests')} req / ${debug.getCounter('pointer_lock_success') || 0} ok`
  );
  setMetricValue(
    'metric-boot-counters',
    `${debug.getCounter('boot_successes')} ok / ${debug.getCounter('boot_failures')} fail`
  );
  setMetricValue('metric-aim', debug.getFlag('aim_band') ?? 'unknown');
  setMetricValue('metric-ammo', `${debug.getFlag('rifle_ammo') ?? 12} rds`);
  setMetricValue('metric-rifle-state', debug.getFlag('rifle_state') ?? 'ready');
  setMetricValue('metric-camera', `${debug.getFlag('camera_x') ?? '--'}, ${debug.getFlag('camera_z') ?? '--'}`);
  setMetricValue('metric-player-rotation', `${debug.getSample('player_yaw') ?? 0}`);
  setMetricValue('metric-entities', `${engine.entities.length} active`);
  setMetricValue('metric-engine-state', debug.getFlag('engine_state') ?? 'idle');
  setMetricValue(
    'metric-enemy-state',
    `${debug.getFlag('enemy_state') ?? 'unknown'} @ X:${debug.getFlag('enemy_x') ?? '--'} Z:${debug.getFlag('enemy_z') ?? '--'}`
  );
  setMetricValue('metric-audio-state', debug.getFlag('audio_state') ?? 'n/a');
  setMetricValue('metric-audio-base', debug.getFlag('audio_asset_base') ?? 'n/a');
  setMetricValue(
    'metric-soundtrack',
    `${debug.getFlag('soundtrack_state') ?? 'idle'} (${debug.getFlag('soundtrack_last_track') ?? 'none'})`
  );
  setMetricValue(
    'metric-soundtrack-next',
    `${debug.getFlag('soundtrack_next_track') ?? 'pending'} in ${debug.getFlag('soundtrack_next_in_ms') ?? '--'}ms`
  );
  setMetricValue('metric-last-error', debug.getFlag('last_error') ?? 'none');

  logList.innerHTML = '';
  debug.logs.slice(-8).forEach((log) => {
    const li = document.createElement('li');
    li.className = 'log-entry';
    li.dataset.level = log.level;

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = log.level ?? 'info';

    const message = document.createElement('span');
    message.className = 'message';
    message.textContent = `${log.timestamp} — ${log.message}`;

    li.appendChild(tag);
    li.appendChild(message);
    logList.appendChild(li);
  });

  requestAnimationFrame(renderDebug);
}

renderDebug();
