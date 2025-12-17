import { AUDIO_FILES, resolveAudioPath } from '../utils/audioPaths.js';

export const soundtrackTracks = [
  {
    key: 'soundtrack_90s_chopped',
    url: resolveAudioPath(AUDIO_FILES.soundtrack.chopped)
  },
  {
    key: 'soundtrack_retro_wave',
    url: resolveAudioPath(AUDIO_FILES.soundtrack.retroWave)
  },
  {
    key: 'soundtrack_patrik_loop',
    url: resolveAudioPath(AUDIO_FILES.soundtrack.patrikLoop)
  },
  {
    key: 'soundtrack_techno_loop',
    url: resolveAudioPath(AUDIO_FILES.soundtrack.technoLoop)
  }
];
