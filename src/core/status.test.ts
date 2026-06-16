// src/core/status.test.ts
import { describe, it, expect } from 'vitest';
import { isUpToDateByVersion } from './status.js';

describe('isUpToDateByVersion', () => {
  it('is true when local installed version equals remote', () => {
    expect(isUpToDateByVersion('2026.06.16', '2026.06.16')).toBe(true);
  });
  it('is false when versions differ', () => {
    expect(isUpToDateByVersion('2026.06.17', '2026.06.16')).toBe(false);
  });
  it('is false when nothing has been installed yet', () => {
    expect(isUpToDateByVersion('2026.06.16', null)).toBe(false);
  });
});
