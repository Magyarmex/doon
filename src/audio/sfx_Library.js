import { EngineError } from '../utils/Errors.js';

export class SfxLibrary {
  constructor(debug) {
    this.debug = debug;
    this.supported = typeof Audio !== 'undefined';
    this.sounds = new Map();
    this.debug.setFlag('sfx_capability', this.supported ? 'ready' : 'unsupported');
    this.debug.incrementCounter('sfx_library_inits');
  }

  register(name, url, options = {}) {
    this.debug.incrementCounter('sfx_register_attempts');
    if (!name || !url) {
      this.debug.recordError(new EngineError('Invalid SFX registration request'));
      return null;
    }

    if (!this.supported) {
      this.debug.log(`Audio not supported; skipping registration for ${name}`);
      this.debug.setFlag('sfx_capability', 'unsupported');
      return null;
    }

    const record = {
      url,
      baseVolume: options.baseVolume ?? 1,
      lastDuration: null
    };

    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.addEventListener('loadedmetadata', () => {
      record.lastDuration = audio.duration;
      this.debug.setFlag(`sfx_${name}_duration`, `${audio.duration.toFixed(2)}s`);
    });
    audio.addEventListener('error', (event) => {
      this.debug.recordError(new EngineError(`Failed to load SFX: ${name}`, { cause: event?.error }));
      this.debug.incrementCounter('sfx_register_failures');
    });

    this.sounds.set(name, record);
    this.debug.incrementCounter('sfx_register_successes');
    return record;
  }

  play(name, { baseVolume = 1 } = {}) {
    this.debug.incrementCounter('sfx_play_requests');
    if (!this.supported) {
      this.debug.setFlag('sfx_last', 'skipped:unsupported');
      return null;
    }

    const record = this.sounds.get(name);
    if (!record) {
      this.debug.recordError(new EngineError(`Unknown SFX: ${name}`));
      this.debug.incrementCounter('sfx_play_failures');
      return null;
    }

    const source = new Audio(record.url);
    const fullVolume = Math.max(0, Math.min(1, baseVolume * record.baseVolume));
    const halfVolume = Math.max(0, Math.min(1, fullVolume * 0.5));
    let halfVolumeApplied = false;

    const applyVolumeEnvelope = () => {
      if (!Number.isFinite(source.duration) || source.duration <= 0) return;
      const halfway = source.duration / 2;
      if (!halfVolumeApplied && source.currentTime >= halfway) {
        source.volume = halfVolume;
        halfVolumeApplied = true;
        this.debug.incrementCounter('sfx_half_mutes');
      } else if (halfVolumeApplied && source.currentTime < halfway) {
        source.volume = fullVolume;
        halfVolumeApplied = false;
      }
    };

    source.volume = fullVolume;
    source.addEventListener('timeupdate', applyVolumeEnvelope);
    source.addEventListener('loadedmetadata', applyVolumeEnvelope);
    source.addEventListener('ended', () => {
      source.removeEventListener('timeupdate', applyVolumeEnvelope);
      this.debug.setFlag('sfx_last', `${name}:ended`);
    });

    source
      .play()
      .then(() => {
        this.debug.setFlag('sfx_last', `${name}:playing`);
      })
      .catch((error) => {
        this.debug.recordError(new EngineError(`Failed to play SFX ${name}`, { cause: error }));
        this.debug.incrementCounter('sfx_play_failures');
      });

    return source;
  }
}

export function createSfxLibrary(debug) {
  return new SfxLibrary(debug);
}
