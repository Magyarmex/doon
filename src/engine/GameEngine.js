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
      fps: 0
    };
    this.spawnDefaults();
  }

  spawnDefaults() {
    this.entities.push(new Player({ x: 64, y: 64 }));
    this.entities.push(new Enemy({ x: 320, y: 200 }));
    this.entities[0].weapon = new Rifle(this.debug);
    this.debug.setFlag('rifle_ammo', this.entities[0].weapon.ammo);
    this.debug.setFlag('rifle_state', 'ready');
    this.debug.log('Entities initialized', { count: this.entities.length });
  }

  start() {
    if (this.state.running) return;
    this.debug.log('Engine start');
    this.state.running = true;
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

    try {
      this.update(delta);
      this.renderer.render(this.level, { camera: this.camera, entities: this.entities });
    } catch (error) {
      this.debug.recordError(error);
      this.stop();
    }

    requestAnimationFrame(this.loop.bind(this));
  }

  update(delta) {
    this.entities.forEach((entity) => {
      try {
        entity.update({
          delta,
          input: this.input,
          level: this.level,
          debug: this.debug,
          entities: this.entities,
          audio: this.audio
        });
      } catch (error) {
        throw new EngineError(`Entity ${entity.type} update failed`, { cause: error });
      }
    });

    this.entities = this.entities.filter((entity) => !entity.dead);

    const player = this.entities.find((e) => e.type === 'player');
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
    }
  }
}
