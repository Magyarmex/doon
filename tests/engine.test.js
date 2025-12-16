import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { GameEngine } from '../src/engine/GameEngine.js';
import { Level } from '../src/engine/Level.js';
import { DebugMetrics } from '../src/engine/DebugMetrics.js';
import { EngineError } from '../src/utils/Errors.js';
import { primaryLevel } from '../src/data/levels.js';
import { AudioEngine } from '../src/engine/AudioEngine.js';

class StubContext {
  constructor() {
    this.commands = [];
  }
  fillRect(x, y, w, h) {
    this.commands.push({ x, y, w, h });
  }
  set fillStyle(value) {
    this.commands.push({ fillStyle: value });
  }
}

class StubCanvas {
  constructor() {
    this.width = 640;
    this.height = 360;
    this.context = new StubContext();
  }
  getContext() {
    return this.context;
  }
}

globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0);

describe('GameEngine', () => {
  test('throws when canvas is missing', () => {
    assert.throws(() => new GameEngine({ canvas: null, level: new Level(primaryLevel), debug: new DebugMetrics() }), EngineError);
  });

  test('updates player position based on input', () => {
    const canvas = new StubCanvas();
    const debug = new DebugMetrics();
    const engine = new GameEngine({ canvas, level: new Level(primaryLevel), debug });
    engine.input.keys.add('KeyW');
    const initialZ = engine.entities[0].position.z;
    engine.update(1); // one second
    assert.ok(engine.entities[0].position.z > initialZ, 'player should move forward');
  });

  test('rifle respects cooldown and reload', () => {
    const canvas = new StubCanvas();
    const debug = new DebugMetrics();
    const engine = new GameEngine({ canvas, level: new Level(primaryLevel), debug });
    engine.input.keys.add('Space');
    engine.update(0.1);
    const player = engine.entities.find((e) => e.type === 'player');
    assert.equal(player.weapon.ammo, 11, 'weapon should consume one round');
    engine.update(0.1);
    assert.equal(player.weapon.ammo, 11, 'cooldown should block rapid fire');
    player.weapon.cooldown = 0;
    player.weapon.ammo = 0;
    engine.input.keys.add('KeyR');
    engine.update(0.1);
    assert.ok(player.weapon.reloading > 0, 'reload should start when ammo is empty');
  });

  test('rifle queues audio playback when firing', () => {
    const canvas = new StubCanvas();
    const debug = new DebugMetrics();
    const engine = new GameEngine({ canvas, level: new Level(primaryLevel), debug });
    const stubAudio = {
      calls: 0,
      playSegmented: () => {
        stubAudio.calls += 1;
        return Promise.resolve();
      }
    };

    engine.audio = stubAudio;
    engine.input.keys.add('Space');
    engine.update(0.1);

    assert.equal(stubAudio.calls, 1, 'rifle should request audio playback');
  });

  test('enemy spawns ahead of the player and keeps patrolling', () => {
    const canvas = new StubCanvas();
    const debug = new DebugMetrics();
    const engine = new GameEngine({ canvas, level: new Level(primaryLevel), debug });

    const player = engine.entities.find((e) => e.type === 'player');
    const enemy = engine.entities.find((e) => e.type === 'enemy');

    assert.ok(enemy.position.z > player.position.z, 'enemy should start in front of the player');

    engine.update(0.25);

    assert.ok(!engine.level.isWallAt(enemy.position.x, enemy.position.z), 'enemy stays in navigable space');
    assert.ok(Math.abs(enemy.position.x - player.position.x) < engine.level.tileSize * 2, 'enemy should remain near the player lane');
    assert.equal(debug.getFlag('enemy_state'), 'patrolling');
  });
});

describe('DebugMetrics', () => {
  test('records errors and increments counter', () => {
    const debug = new DebugMetrics();
    debug.recordError(new Error('boom'));
    assert.equal(debug.errorCount, 1);
    assert.ok(debug.logs[0].message.includes('boom'));
  });

  test('increments named counters for instrumentation', () => {
    const debug = new DebugMetrics();
    assert.equal(debug.getCounter('example'), 0);
    debug.incrementCounter('example');
    debug.incrementCounter('example', 2);
    assert.equal(debug.getCounter('example'), 3);
  });
});

describe('AudioEngine soundtrack playlist', () => {
  test('configures and starts soundtrack playlist safely without audio context', async () => {
    const debug = new DebugMetrics();
    const audio = new AudioEngine({ debug });
    audio.configureSoundtrack([{ key: 'one', url: '/fake.mp3' }]);

    assert.equal(debug.getFlag('soundtrack_tracks_configured'), 1);
    await audio.startSoundtrackPlaylist();

    assert.equal(debug.getCounter('soundtrack_start_attempts'), 1);
    assert.ok(
      ['blocked', 'playing', 'starting', undefined].includes(debug.getFlag('soundtrack_state')),
      'soundtrack should set a state flag even when playback is skipped'
    );
  });
});
