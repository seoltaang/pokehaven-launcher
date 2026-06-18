// src/renderer/src/lib/playButton.ts
import type { LaunchState } from '../../../shared/ipc.js';

export interface PlayButton {
  label: string;
  disabled: boolean;
  variant: 'primary' | 'busy';
}

export function playButtonState(state: LaunchState): PlayButton {
  switch (state) {
    case 'play':
      return { label: 'PLAY', disabled: false, variant: 'primary' };
    case 'install-needed':
      return { label: 'INSTALL', disabled: false, variant: 'primary' };
    case 'update-available':
      return { label: 'UPDATE', disabled: false, variant: 'primary' };
    case 'updating':
      return { label: 'UPDATING', disabled: true, variant: 'busy' };
    case 'launching':
      return { label: 'LAUNCHING', disabled: true, variant: 'busy' };
    case 'playing':
      return { label: 'PLAYING', disabled: true, variant: 'busy' };
    case 'logged-out':
      return { label: 'PLAY', disabled: true, variant: 'primary' };
  }
}
