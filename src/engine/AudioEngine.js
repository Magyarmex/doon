import { EngineError } from '../utils/Errors.js';

export class AudioEngine {
  constructor({ debug }) {
    this.debug = debug;
    this.buffers = new Map();
    this.state = 'uninitialized';
    this.soundtrack = {
      tracks: [],
      queue: [],
      currentSource: null,
      running: false,
      loadingNext: false,
      volume: 0.35
    };
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;

    if (!AudioContext) {
      this.state = 'unsupported';
      this.debug?.setFlag('audio_state', 'unsupported');
      return;
    }

    try {
      this.context = new AudioContext();
      this.state = 'ready';
      this.debug?.setFlag('audio_state', 'ready');
    } catch (error) {
      this.state = 'failed';
      this.debug?.recordError(error);
      this.debug?.setFlag('audio_state', 'failed');
    }
  }

  configureSoundtrack(tracks = []) {
    this.soundtrack.tracks = tracks.slice();
    this.soundtrack.queue = [];
    this.soundtrack.running = false;
    this.debug?.setFlag('soundtrack_tracks_configured', this.soundtrack.tracks.length);
    this.debug?.log('Soundtrack configured', {
      trackKeys: this.soundtrack.tracks.map((track) => track.key)
    });
  }

  shuffleTracks(tracks) {
    const shuffled = tracks.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  async startSoundtrackPlaylist() {
    if (!this.soundtrack.tracks.length) {
      this.debug?.recordError(new EngineError('No soundtrack tracks configured'));
      return;
    }

    if (this.soundtrack.running) {
      this.debug?.incrementCounter('soundtrack_start_duplicates');
      return;
    }

    this.soundtrack.running = true;
    this.debug?.setFlag('soundtrack_state', 'starting');
    this.debug?.incrementCounter('soundtrack_start_attempts');
    await this.playNextInSoundtrack();
  }

  async playNextInSoundtrack() {
    if (!this.soundtrack.running) return;
    if (this.soundtrack.loadingNext) return;
    this.soundtrack.loadingNext = true;

    try {
      const ready = await this.ensureContextReady();
      if (!ready) {
        this.debug?.incrementCounter('soundtrack_playback_skipped');
        this.debug?.setFlag('soundtrack_state', 'blocked');
        return;
      }

      if (this.soundtrack.tracks.length === 0) {
        this.debug?.recordError(new EngineError('Soundtrack playback requested without tracks'));
        this.soundtrack.running = false;
        return;
      }

      if (this.soundtrack.queue.length === 0) {
        this.soundtrack.queue = this.shuffleTracks(this.soundtrack.tracks);
        this.debug?.incrementCounter('soundtrack_loops');
        this.debug?.setFlag('soundtrack_state', 'looping');
      }

      const track = this.soundtrack.queue.shift();
      const buffer = await this.loadBuffer(track.key, track.url);
      if (!buffer) {
        this.debug?.incrementCounter('soundtrack_load_failures');
        this.soundtrack.loadingNext = false;
        await this.playNextInSoundtrack();
        return;
      }

      if (this.soundtrack.currentSource) {
        try {
          this.soundtrack.currentSource.stop();
        } catch (error) {
          this.debug?.recordError(new EngineError('Failed to stop previous soundtrack source', { cause: error }));
        }
      }

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(this.soundtrack.volume, this.context.currentTime);
      source.connect(gain).connect(this.context.destination);
      source.onended = () => {
        this.soundtrack.currentSource = null;
        this.debug?.incrementCounter('soundtrack_tracks_completed');
        void this.playNextInSoundtrack();
      };
      source.start();
      this.soundtrack.currentSource = source;
      this.debug?.setFlag('soundtrack_now_playing', track.key);
      this.debug?.incrementCounter('soundtrack_tracks_started');
      this.debug?.setFlag('soundtrack_state', 'playing');
    } catch (error) {
      this.soundtrack.running = false;
      this.debug?.recordError(new EngineError('Soundtrack playback failed', { cause: error }));
      this.debug?.incrementCounter('soundtrack_playback_errors');
    } finally {
      this.soundtrack.loadingNext = false;
    }
  }

  async ensureContextReady() {
    if (!this.context) return false;
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
        this.debug?.incrementCounter('audio_context_resumes');
      } catch (error) {
        this.debug?.recordError(new EngineError('Failed to resume audio context', { cause: error }));
        return false;
      }
    }
    return true;
  }

  async loadBuffer(key, url) {
    if (!this.context) {
      this.debug?.incrementCounter('audio_loads_skipped');
      return null;
    }

    if (this.buffers.has(key)) {
      return this.buffers.get(key);
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new EngineError(`Sound fetch failed: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => {
        this.context.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      });
      this.buffers.set(key, buffer);
      this.debug?.incrementCounter('audio_load_successes');
      return buffer;
    } catch (error) {
      this.debug?.recordError(error);
      this.debug?.incrementCounter('audio_load_failures');
      return null;
    }
  }

  async playSegmented({ key, url, halfGain = 0.5 } = {}) {
    if (!key) {
      this.debug?.recordError(new EngineError('playSegmented requires a key'));
      return;
    }

    const ready = await this.ensureContextReady();
    if (!ready) {
      this.debug?.incrementCounter('audio_playbacks_skipped');
      return;
    }

    const buffer = await this.loadBuffer(key, url);
    if (!buffer) {
      this.debug?.incrementCounter('audio_playbacks_failed');
      return;
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      const halfPoint = buffer.duration / 2;
      gain.gain.setValueAtTime(1, now);
      gain.gain.setValueAtTime(halfGain, now + halfPoint);
      source.connect(gain).connect(this.context.destination);
      source.start(now);
      this.debug?.incrementCounter('audio_playbacks_started');
      source.onended = () => {
        this.debug?.incrementCounter('audio_playbacks_completed');
      };
    } catch (error) {
      this.debug?.recordError(new EngineError('Audio playback failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
    }
  }
}
