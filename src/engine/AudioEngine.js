import { EngineError } from '../utils/Errors.js';

export class AudioEngine {
  constructor({ debug }) {
    this.debug = debug;
    this.buffers = new Map();
    this.state = 'uninitialized';
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
      return;
    }

    if (!url) {
      this.debug?.recordError(new EngineError('playSegmented requires a url'));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return;
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
      source.onended = () => {
        this.debug?.incrementCounter('audio_playbacks_completed');
      };
    } catch (error) {
      this.debug?.recordError(new EngineError('Audio playback failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
      this.playWithElement({ key, url, halfGain: clampedGain, reason: 'web_audio_exception' });
    }
  }

  playWithElement({ key, url, halfGain, reason }) {
    if (typeof Audio === 'undefined') {
      this.debug?.recordError(new EngineError('HTMLAudioElement unavailable for fallback playback'));
      this.debug?.incrementCounter('audio_playbacks_failed');
      return;
    }

    try {
      const element = new Audio(url);
      element.volume = 1;

      const safeHalfGain = Math.max(0, Math.min(1, halfGain));
      element.addEventListener('loadedmetadata', () => {
        const halfDurationMs = Number.isFinite(element.duration) ? (element.duration / 2) * 1000 : null;
        if (halfDurationMs && halfDurationMs > 0) {
          setTimeout(() => {
            element.volume = safeHalfGain;
          }, halfDurationMs);
        }
      });

      element.addEventListener('ended', () => {
        this.debug?.incrementCounter('audio_fallback_completed');
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
        });
    } catch (error) {
      this.debug?.recordError(new EngineError('Fallback audio creation failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
    }
  }

  configureSoundtrack(tracks = []) {
    this.soundtrackTracks = Array.isArray(tracks) ? [...tracks] : [];
    this.soundtrackIndex = 0;
    this.debug?.setFlag('soundtrack_tracks_configured', this.soundtrackTracks.length);
  }

  async startSoundtrackPlaylist() {
    this.debug?.incrementCounter('soundtrack_start_attempts');

    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    const hasAudioElement = typeof Audio !== 'undefined';

    if (!this.soundtrackTracks || this.soundtrackTracks.length === 0) {
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_block_reason', 'no_tracks');
      this.debug?.incrementCounter('soundtrack_start_blocked');
      return;
    }

    if (this.state === 'unsupported' || !AudioContext || !hasAudioElement) {
      const reasons = [];
      if (this.state === 'unsupported') reasons.push('engine_unsupported');
      if (!AudioContext) reasons.push('audiocontext_missing');
      if (!hasAudioElement) reasons.push('audio_element_missing');
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_block_reason', reasons.join(',') || 'unknown');
      this.debug?.incrementCounter('soundtrack_start_blocked');
      return;
    }

    const nextTrack = this.soundtrackTracks[this.soundtrackIndex] ?? this.soundtrackTracks[0];
    if (!nextTrack?.url) {
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_block_reason', 'invalid_track');
      this.debug?.incrementCounter('soundtrack_start_blocked');
      return;
    }

    try {
      await this.ensureContextReady();
    } catch (error) {
      this.debug?.recordError(new EngineError('Soundtrack context resume failed', { cause: error }));
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_block_reason', 'context_resume_failed');
      this.debug?.incrementCounter('soundtrack_start_blocked');
      return;
    }

    this.debug?.setFlag('soundtrack_state', 'starting');
    this.debug?.incrementCounter('soundtrack_starting');

    try {
      this.soundtrackElement = new Audio(nextTrack.url);
      this.soundtrackElement.loop = true;
      this.soundtrackElement.volume = 0.6;
      this.soundtrackElement.addEventListener('ended', () => {
        this.debug?.incrementCounter('soundtrack_loops_completed');
      });

      await this.soundtrackElement.play();
      this.debug?.setFlag('soundtrack_state', 'playing');
      this.debug?.setFlag('soundtrack_current_track', nextTrack.key || 'unknown');
      this.debug?.incrementCounter('soundtrack_start_successes');
    } catch (error) {
      this.debug?.recordError(new EngineError('Soundtrack start failed', { cause: error }));
      this.debug?.setFlag('soundtrack_state', 'blocked');
      this.debug?.setFlag('soundtrack_block_reason', 'play_rejected');
      this.debug?.incrementCounter('soundtrack_start_blocked');
    }
  }
}
