import { EngineError } from '../utils/Errors.js';

function writeString(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function generateShotDataUrl() {
  const sampleRate = 44100;
  const durationSeconds = 0.35;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const headerBytes = 44;
  const buffer = new ArrayBuffer(headerBytes + sampleCount * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, sampleCount * 2, true);

  for (let i = 0; i < sampleCount; i += 1) {
    const t = i / sampleRate;
    const envelope = Math.exp(-5 * t);
    const tone = Math.sin(2 * Math.PI * 180 * t) * 0.6;
    const noise = (Math.random() * 2 - 1) * 0.35;
    const sample = Math.max(-1, Math.min(1, (tone + noise) * envelope));
    view.setInt16(headerBytes + i * 2, sample * 0x7fff, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function createProceduralRifleShot(debug) {
  try {
    const url = generateShotDataUrl();
    debug?.incrementCounter('sfx_rifle_generated');
    debug?.setFlag('sfx_rifle_source', 'procedural');
    debug?.setFlag('sfx_rifle_bytes', url.length);
    return url;
  } catch (error) {
    debug?.recordError(new EngineError('Failed to synthesize rifle shot', { cause: error }));
    debug?.setFlag('sfx_rifle_source', 'failed');
    return null;
  }
}
