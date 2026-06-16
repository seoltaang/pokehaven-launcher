// src/core/manifest.test.ts
import { describe, it, expect } from 'vitest';
import { parseManifest } from './manifest.js';

const validFile = {
  path: 'mods/Pixelmon.jar',
  sha1: 'abc123',
  size: 413000000,
  url: 'https://example.com/pixelmon.jar',
  force: true,
};

const valid = {
  packVersion: '2026.06.16',
  minecraft: '1.21.1',
  neoforge: '21.1.233',
  files: [validFile],
};

describe('parseManifest', () => {
  it('parses a valid manifest', () => {
    const m = parseManifest(valid);
    expect(m.packVersion).toBe('2026.06.16');
    expect(m.files).toHaveLength(1);
    expect(m.files[0]).toEqual(validFile);
  });

  it('rejects a non-object', () => {
    expect(() => parseManifest(null)).toThrow(/object/);
  });

  it('rejects a missing string field', () => {
    expect(() => parseManifest({ ...valid, packVersion: 123 })).toThrow(/packVersion/);
  });

  it('rejects files that is not an array', () => {
    expect(() => parseManifest({ ...valid, files: {} })).toThrow(/files/);
  });

  it('reports the index of an invalid file entry', () => {
    const bad = { ...valid, files: [validFile, { ...validFile, force: 'yes' }] };
    expect(() => parseManifest(bad)).toThrow(/files\[1\]\.force/);
  });
});
