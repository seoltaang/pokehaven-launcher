// src/renderer/src/lib/playButton.test.ts
import { describe, it, expect } from 'vitest';
import { playButtonState } from './playButton.js';

describe('playButtonState', () => {
  it('shows PLAY enabled when up to date', () => {
    expect(playButtonState('play')).toEqual({ label: 'PLAY', disabled: false, variant: 'primary' });
  });
  it('shows UPDATE enabled when an update is available', () => {
    expect(playButtonState('update-available')).toEqual({ label: 'UPDATE', disabled: false, variant: 'primary' });
  });
  it('shows a busy disabled button while updating', () => {
    expect(playButtonState('updating')).toEqual({ label: 'UPDATING', disabled: true, variant: 'busy' });
  });
  it('shows a busy disabled button while launching', () => {
    expect(playButtonState('launching')).toEqual({ label: 'LAUNCHING', disabled: true, variant: 'busy' });
  });
  it('disables PLAY when logged out', () => {
    expect(playButtonState('logged-out')).toEqual({ label: 'PLAY', disabled: true, variant: 'primary' });
  });
});
