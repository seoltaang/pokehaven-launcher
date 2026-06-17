// src/core/manifest-build.test.ts
import { describe, it, expect } from 'vitest';
import { classifyFile, assetUrl } from './manifest-build.js';

describe('classifyFile', () => {
  it('manages and force-syncs mods', () => {
    expect(classifyFile('mods/Pixelmon-1.21.1.jar')).toEqual({ managed: true, force: true });
  });
  it('manages and force-syncs gameplay configs by default', () => {
    expect(classifyFile('config/pixelmon/spawning.yml')).toEqual({ managed: true, force: true });
  });
  it('manages but preserves client-preference configs', () => {
    expect(classifyFile('config/iris.properties')).toEqual({ managed: true, force: false });
    expect(classifyFile('config/xaero/minimap.txt')).toEqual({ managed: true, force: false });
    expect(classifyFile('config/jei/jei-client.ini')).toEqual({ managed: true, force: false });
  });
  it('does not manage personal/world data', () => {
    expect(classifyFile('saves/world/level.dat').managed).toBe(false);
    expect(classifyFile('options.txt').managed).toBe(false);
    expect(classifyFile('screenshots/x.png').managed).toBe(false);
    expect(classifyFile('logs/latest.log').managed).toBe(false);
  });
});

describe('assetUrl', () => {
  it('joins base url and sha1 (single slash)', () => {
    expect(assetUrl('https://x/dl/', 'abc123')).toBe('https://x/dl/abc123');
    expect(assetUrl('https://x/dl', 'abc123')).toBe('https://x/dl/abc123');
  });
});
