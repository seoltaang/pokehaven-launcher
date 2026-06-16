// src/core/verify.test.ts
import { describe, it, expect } from 'vitest';
import { verifyInstance } from './verify.js';
import type { Manifest, LocalFile } from './types.js';

function mf(path: string, sha1: string, size: number) {
  return { path, sha1, size, url: `https://x/${path}`, force: true };
}
function manifest(files: ReturnType<typeof mf>[]): Manifest {
  return { packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', files };
}

describe('verifyInstance', () => {
  it('flags a missing file', () => {
    const r = verifyInstance(manifest([mf('mods/a.jar', 'h1', 10)]), []);
    expect(r.missing.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(r.corrupt).toEqual([]);
  });

  it('flags a file with the wrong hash as corrupt', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'WRONG', size: 10 }],
    );
    expect(r.corrupt.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(r.missing).toEqual([]);
  });

  it('flags a file with the wrong size as corrupt', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'h1', size: 9 }],
    );
    expect(r.corrupt.map((f) => f.path)).toEqual(['mods/a.jar']);
  });

  it('reports nothing when everything matches', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'h1', size: 10 }],
    );
    expect(r.missing).toEqual([]);
    expect(r.corrupt).toEqual([]);
  });
});
