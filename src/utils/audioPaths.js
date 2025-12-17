import { EngineError } from './Errors.js';

export const AUDIO_ASSET_BASE = '/';

export const AUDIO_FILES = {
  rifleShot: 'shot-and-reload-6158.mp3',
  soundtrack: {
    chopped: '90s-chopped-2-435023.mp3',
    retroWave: 'retro-wave-melodie-128-bpm-8970.mp3',
    patrikLoop: 'patrik-loop-51-olistik-sound-project-patrizio-yoga-198970.mp3',
    technoLoop: 'techno-loop-273137.mp3'
  }
};

function normalizeBase(base) {
  return base.endsWith('/') ? base : `${base}/`;
}

export function resolveAudioPath(fileName) {
  if (!fileName || typeof fileName !== 'string') {
    throw new EngineError('Audio filename must be a non-empty string');
  }

  const normalizedBase = normalizeBase(AUDIO_ASSET_BASE);
  const sanitizedName = fileName.replace(/^\/+/, '');

  return `${normalizedBase}${sanitizedName}`;
}
