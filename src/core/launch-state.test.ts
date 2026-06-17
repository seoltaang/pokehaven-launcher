// src/core/launch-state.test.ts
import { describe, it, expect } from 'vitest';
import { deriveLaunchState } from './launch-state.js';

describe('deriveLaunchState', () => {
  it('is logged-out when not authenticated', () => {
    expect(deriveLaunchState({ loggedIn: false, installed: true, syncNeeded: false })).toBe('logged-out');
  });
  it('needs install when not installed yet', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: false, syncNeeded: false })).toBe('install-needed');
  });
  it('needs update when a mod sync is pending', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: true, syncNeeded: true })).toBe('update-available');
  });
  it('is ready to play when installed and in sync', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: true, syncNeeded: false })).toBe('play');
  });
});
