import { Renderer } from './Renderer.js';
import { Input } from './Input.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Rifle } from '../entities/Rifle.js';
import { EngineError } from '../utils/Errors.js';
import { AudioEngine } from './AudioEngine.js';

export class GameEngine {
  constructor({ canvas, level, debug }) {
    if (!canvas) {
      throw new EngineError('Canvas element is required');
    }
    this.canvas = canvas;
    this.level = level;
    this.debug = debug;
    this.renderer = new Renderer(canvas, debug);
    this.input = new Input(debug);
    this.audio = new AudioEngine({ debug });
    this.entities = [];
    this.camera = {
      position: { x: 0, y: 0, z: 0 },
      rotation: { yaw: 0, pitch: 0 }
    };
    this.state = {
      running: false,
      lastFrame: 0,
      fps: 0,
      frameCount: 0,
      frameFaults: 0
    };
    this.debug.setFlag('engine_state', 'idle');
    this.spawnDefaults();
  }

  spawnDefaults() {
    const player = new Player({ x: 64, y: 64 });
    const desiredEnemyZ = player.position.z + (this.level?.tileSize ?? 32) * 4;
    let enemySpawnZ = desiredEnemyZ;

    if (this.level?.isWallAt(player.position.x, desiredEnemyZ)) {
      enemySpawnZ = player.position.z + (this.level?.tileSize ?? 32) * 5;
      this.debug.log('Adjusted enemy spawn to avoid wall', { from: desiredEnemyZ, to: enemySpawnZ });
      this.debug.incrementCounter('enemy_spawn_adjustments');
    }

    const enemy = new Enemy({ x: player.position.x, z: enemySpawnZ });

    this.entities.push(player);
    this.entities.push(enemy);

    player.weapon = new Rifle(this.debug);
    this.debug.setFlag('rifle_ammo', this.entities[0].weapon.ammo);
    this.debug.setFlag('rifle_state', 'ready');
    this.debug.setFlag('enemy_state', 'patrolling');
    this.debug.setFlag('enemy_x', enemy.position.x, { log: false });
    this.debug.setFlag('enemy_z', enemy.position.z, { log: false });
    this.debug.log('Entities initialized', { count: this.entities.length });
  }

  start() {
    if (this.state.running) return;
    this.debug.log('Engine start');
    this.state.running = true;
    this.debug.setFlag('engine_state', 'running');
    requestAnimationFrame(this.loop.bind(this));
  }

  stop() {
    this.state.running = false;
    this.debug.log('Engine stopped');
  }

  loop(timestamp) {
    if (!this.state.running) return;

    const delta = (timestamp - this.state.lastFrame) / 1000;
    this.state.fps = delta > 0 ? 1 / delta : 0;
    this.state.lastFrame = timestamp;
    this.state.frameCount += 1;
    this.debug.setSample('frame_time_ms', Number((delta * 1000).toFixed(3)));
    this.debug.setFlag('frame_budget', delta > 1 / 30 ? 'over-budget' : 'on-track', { log: false });
    this.debug.incrementCounter('engine_frames_seen', 1, { log: false });

    const updateResult = this.debug.guard('engine_update', () => this.update(delta));
    const renderResult = this.debug.guard('engine_render', () =>
      this.renderer.render(this.level, { camera: this.camera, entities: this.entities })
    );

    if (!updateResult.ok || !renderResult.ok) {
      this.state.frameFaults += 1;
      this.debug.setFlag('engine_state', 'degraded');
      this.debug.incrementCounter('engine_fault_frames', 1, { log: false });
      if (this.state.frameFaults >= 3) {
        this.debug.recordWarning('Engine halted after consecutive faults');
        this.stop();
        this.debug.setFlag('engine_state', 'halted');
        return;
      }
    } else {
      this.state.frameFaults = 0;
      this.debug.setFlag('engine_state', 'running', { log: false });
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  update(delta) {
    const player = this.entities.find((e) => e.type === 'player');

    this.entities.forEach((entity) => {
      try {
        entity.update({
          delta,
          input: this.input,
          level: this.level,
          debug: this.debug,
          entities: this.entities,
          audio: this.audio,
          player
        });
      } catch (error) {
        throw new EngineError(`Entity ${entity.type} update failed`, { cause: error });
      }
    });

    this.entities = this.entities.filter((entity) => !entity.dead);

    if (player) {
      const mouseDelta = this.input.consumeMouseDelta();
      if (mouseDelta.dx !== 0 || mouseDelta.dy !== 0) {
        player.rotation.yaw += mouseDelta.dx * 0.0025;
        player.rotation.pitch += mouseDelta.dy * -0.0025;
        player.rotation.pitch = Math.max(player.pitchLimits.min, Math.min(player.pitchLimits.max, player.rotation.pitch));
      }

      this.camera.position = {
        x: player.position.x + player.cameraOffset.x,
        y: player.position.y + player.cameraOffset.y,
        z: player.position.z + player.cameraOffset.z
      };
      this.camera.rotation = { ...player.rotation };

      this.debug.setFlag('camera_x', this.camera.position.x.toFixed(2), { log: false });
      this.debug.setFlag('camera_z', this.camera.position.z.toFixed(2), { log: false });
      this.debug.setSample('player_yaw', Number(player.rotation.yaw.toFixed(3)));
    }
  }
}
