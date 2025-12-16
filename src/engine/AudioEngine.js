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

    const resolvedUrl = this.resolveUrl(url);
    if (!resolvedUrl) {
      this.debug?.incrementCounter('audio_load_failures');
      this.debug?.setFlag('audio_last_error', 'unresolvable_url', { log: false });
      return null;
    }

    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) {
        throw new EngineError(`Sound fetch failed: ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await new Promise((resolve, reject) => {
        this.context.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
      });
      this.buffers.set(key, buffer);
      this.debug?.incrementCounter('audio_load_successes');
      this.debug?.setFlag('audio_last_buffer', key, { log: false });
      return buffer;
    } catch (error) {
      this.debug?.recordError(error);
      this.debug?.incrementCounter('audio_load_failures');
      this.debug?.setFlag('audio_last_error', error.message || 'unknown', { log: false });
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
      this.debug?.setFlag('audio_last_error', 'context_not_ready', { log: false });
      return;
    }

    const buffer = await this.loadBuffer(key, url);
    if (!buffer) {
      this.debug?.incrementCounter('audio_playbacks_failed');
      this.debug?.setFlag('audio_last_error', 'buffer_unavailable', { log: false });
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
      this.debug?.setFlag('audio_last_playback', 'started', { log: false });
      this.debug?.setFlag('audio_last_key', key, { log: false });
      source.onended = () => {
        this.debug?.incrementCounter('audio_playbacks_completed');
        this.debug?.setFlag('audio_last_playback', 'completed', { log: false });
      };
    } catch (error) {
      this.debug?.recordError(new EngineError('Audio playback failed', { cause: error }));
      this.debug?.incrementCounter('audio_playbacks_failed');
      this.debug?.setFlag('audio_last_error', error.message || 'playback_failed', { log: false });
    }
  }

  resolveUrl(url) {
    if (!url) return null;

    try {
      if (typeof window === 'undefined') return url;

      if (url.startsWith('/')) {
        return new URL(url.slice(1), window.location.href).toString();
      }

      return new URL(url, window.location.href).toString();
    } catch (error) {
      this.debug?.recordError(new EngineError('Failed to resolve audio URL', { cause: error }));
      return null;
    }
  }
}
