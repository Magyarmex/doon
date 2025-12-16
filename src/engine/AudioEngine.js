import { EngineError } from '../utils/Errors.js';

export class AudioEngine {
  constructor({ debug }) {
    this.debug = debug;
    this.buffers = new Map();
    this.state = 'uninitialized';
    this.soundtrackTracks = [];
    this.soundtrackIndex = 0;
    this.soundtrackTimer = null;
    this.soundtrackLoopActive = false;
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
    if (!Array.isArray(tracks)) {
      this.debug?.recordError(new EngineError('configureSoundtrack requires an array of tracks'));
      this.debug?.incrementCounter('soundtrack_config_errors');
      this.debug?.setFlag('soundtrack_safe_state', 'blocked');
      return;
    }

    this.soundtrackTracks = [];
    this.soundtrackIndex = 0;

    tracks.forEach((track, index) => {
      if (!track?.key || !track?.url) {
        this.debug?.recordError(new EngineError(`Invalid soundtrack track at index ${index}`));
        this.debug?.incrementCounter('soundtrack_invalid_entries');
        return;
      }
      this.soundtrackTracks.push({ key: track.key, url: track.url });
      this.debug?.log(`Soundtrack track configured: ${track.key}`);
    });

    this.debug?.setFlag('soundtrack_tracks_configured', this.soundtrackTracks.length);
    this.debug?.setFlag('soundtrack_state', this.soundtrackTracks.length ? 'ready' : 'blocked');
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
      this.debug?.setFlag('audio_last_loaded', key);
      return buffer;
    } catch (error) {
      this.debug?.recordError(error);
      this.debug?.incrementCounter('audio_load_failures');
      this.debug?.setFlag('audio_last_loaded', 'failed');
      return null;
    }
  }

  async playSegmented({ key, url, halfGain = 0.5 } = {}) {
    if (!key) {
      this.debug?.recordError(new EngineError('playSegmented requires a key'));
      return Promise.resolve(null);
    }

    if (!url) {
      this.debug?.recordError(new EngineError('playSegmented requires a url'));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return Promise.resolve(null);
    }

    const clampedGain = Math.max(0, Math.min(1, halfGain));

    const ready = await this.ensureContextReady();
    if (!ready || this.state === 'unsupported' || this.state === 'failed') {
      this.debug?.incrementCounter('audio_playbacks_fallback');
      return this.playWithElement({ key, url, halfGain: clampedGain, reason: ready ? 'context_failed' : 'context_unready' });
    }

    const buffer = await this.loadBuffer(key, url);
    if (!buffer) {
      this.debug?.incrementCounter('audio_playbacks_failed');
      return this.playWithElement({ key, url, halfGain: clampedGain, reason: 'buffer_missing' });
    }

    try {
      const source = this.context.createBufferSource();
      source.buffer = buffer;
      const gain = this.context.createGain();
      const now = this.context.currentTime;
      const halfPoint = buffer.duration / 2;
      gain.gain.setValueAtTime(1, now);
      gain.gain.setValueAtTime(clampedGain, now + halfPoint);
      source.connect(gain).connect(this.context.destination);
      source.start(now);
      this.debug?.incrementCounter('audio_playbacks_started');
      this.debug?.setFlag('audio_last_play', 'web_audio');

      return await new Promise((resolve) => {
        source.onended = () => {
          this.debug?.incrementCounter('audio_playbacks_completed');
          resolve({ method: 'web_audio', duration: buffer.duration });
        };
      });
    } catch (error) {
      this.debug?.recordError(new EngineError('Audio playback failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return this.playWithElement({ key, url, halfGain: clampedGain, reason: 'web_audio_exception' });
    }
  }

  playWithElement({ key, url, halfGain, reason }) {
    if (typeof Audio === 'undefined') {
      this.debug?.recordError(new EngineError('HTMLAudioElement unavailable for fallback playback'));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return Promise.resolve(null);
    }

    try {
      const element = new Audio(url);
      element.volume = 1;

      const safeHalfGain = Math.max(0, Math.min(1, halfGain));
      let lastKnownDuration = null;

      element.addEventListener('loadedmetadata', () => {
        lastKnownDuration = Number.isFinite(element.duration) ? element.duration : null;
        const halfDurationMs = lastKnownDuration ? (element.duration / 2) * 1000 : null;
        if (halfDurationMs && halfDurationMs > 0) {
          setTimeout(() => {
            element.volume = safeHalfGain;
          }, halfDurationMs);
        }
      });

      return new Promise((resolve) => {
        element.addEventListener('ended', () => {
          this.debug?.incrementCounter('audio_fallback_completed');
          resolve({ method: 'html_audio', duration: lastKnownDuration });
        });

        element.play()
          .then(() => {
            this.debug?.incrementCounter('audio_fallback_started');
            this.debug?.setFlag('audio_last_play', 'html_audio');
            if (reason) {
              this.debug?.setFlag('audio_fallback_reason', reason);
            }
            this.buffers.set(key, null);
          })
          .catch((error) => {
            this.debug?.recordError(new EngineError('Fallback audio playback failed', { cause: error }));
            this.debug?.incrementCounter('audio_playbacks_failed');
            resolve(null);
          });
      });
    } catch (error) {
      this.debug?.recordError(new EngineError('Fallback audio creation failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return Promise.resolve(null);
    }
  }

  async startSoundtrackPlaylist() {
    this.debug?.incrementCounter('soundtrack_start_attempts');
    this.debug?.setFlag('soundtrack_state', 'starting');

    if (this.soundtrackLoopActive) {
      this.debug?.log('Soundtrack already running, ignoring new start request');
      this.debug?.incrementCounter('soundtrack_duplicate_starts');
      return;
    }

    if (!this.soundtrackTracks?.length) {
      this.debug?.log('Soundtrack blocked: no tracks configured');
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_safe_state', 'blocked');
      return;
    }

    const hasContext = Boolean(this.context);
    const hasAudioElement = typeof Audio !== 'undefined';

    if (!hasContext && !hasAudioElement) {
      this.debug?.log('Soundtrack blocked: audio unavailable in this environment');
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_safe_state', 'blocked');
      return;
    }

    this.soundtrackLoopActive = true;
    await this.playNextSoundtrackTrack();
  }

  async playNextSoundtrackTrack() {
    if (!this.soundtrackLoopActive) return;

    const track = this.soundtrackTracks[this.soundtrackIndex % this.soundtrackTracks.length];
    this.soundtrackIndex = (this.soundtrackIndex + 1) % this.soundtrackTracks.length;
    this.debug?.setFlag('soundtrack_next_track', track.key);

    const playResult = await this.playSegmented({ key: track.key, url: track.url, halfGain: 0.35 });

    if (!playResult) {
      this.debug?.incrementCounter('soundtrack_playback_failures');
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_safe_state', 'blocked');
      this.soundtrackLoopActive = false;
      return;
    }

    this.debug?.setFlag('soundtrack_state', 'playing');
    this.debug?.setFlag('soundtrack_last_track', track.key);
    this.debug?.setFlag('soundtrack_last_method', playResult.method);

    const durationMs = Number.isFinite(playResult.duration) ? playResult.duration * 1000 : 6000;
    const nextDelay = Math.max(500, durationMs + 250);
    this.debug?.setFlag('soundtrack_next_in_ms', Math.round(nextDelay));

    if (this.soundtrackTimer) clearTimeout(this.soundtrackTimer);
    this.soundtrackTimer = setTimeout(() => {
      void this.playNextSoundtrackTrack();
    }, nextDelay);

    this.debug?.incrementCounter('soundtrack_tracks_played');
  }
}
