// src/renderer/src/lib/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatBytes, formatStatusLine, formatProgress } from './format.js';

describe('formatBytes', () => {
  it('formats bytes, KB, MB, GB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(413_000_000)).toBe('393.9 MB');
    expect(formatBytes(7_300_000_000)).toBe('6.8 GB');
  });
});

describe('formatStatusLine', () => {
  it('joins pack/mc/neoforge/online with separators', () => {
    expect(
      formatStatusLine({ packVersion: '2026.06.17', minecraft: '1.21.1', neoforge: '21.1.233', online: true }),
    ).toBe('PACK 2026.06.17  ·  MC 1.21.1  ·  NEOFORGE 21.1.233  ·  ONLINE');
  });
  it('shows OFFLINE when not online', () => {
    expect(
      formatStatusLine({ packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', online: false }),
    ).toContain('OFFLINE');
  });
});

describe('formatProgress', () => {
  it('clamps and rounds to a whole percent', () => {
    expect(formatProgress(0.5, 'mods/a.jar')).toEqual({ percent: 50, text: '50%  mods/a.jar' });
    expect(formatProgress(-1, 'x')).toEqual({ percent: 0, text: '0%  x' });
    expect(formatProgress(2, 'y')).toEqual({ percent: 100, text: '100%  y' });
  });
});
