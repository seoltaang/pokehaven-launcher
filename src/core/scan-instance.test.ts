// src/core/scan-instance.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanInstance } from './scan-instance.js';
import type { Manifest } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-scan-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}
function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}
function manifest(paths: string[]): Manifest {
  return {
    packVersion: 'v',
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    files: paths.map((p) => ({ path: p, sha1: 'x', size: 0, url: 'u', force: true })),
  };
}

describe('scanInstance', () => {
  it('returns files under managed roots and existing manifest paths, with sha1/size', async () => {
    write('mods/a.jar', 'AAAA');
    write('mods/sub/b.jar', 'BB');
    write('config/x.toml', 'CCC');
    write('saves/world/level.dat', 'DDDDD'); // not managed, not in manifest → excluded

    const m = manifest(['mods/a.jar', 'config/x.toml', 'mods/missing.jar']);
    const result = await scanInstance(dir, m, ['mods/']);
    const byPath = new Map(result.map((f) => [f.path, f]));

    // mods/ files (managed root) — recursive
    expect(byPath.get('mods/a.jar')).toEqual({ path: 'mods/a.jar', sha1: sha1('AAAA'), size: 4 });
    expect(byPath.get('mods/sub/b.jar')).toEqual({ path: 'mods/sub/b.jar', sha1: sha1('BB'), size: 2 });
    // config/x.toml included because it is a manifest path that exists
    expect(byPath.get('config/x.toml')).toEqual({ path: 'config/x.toml', sha1: sha1('CCC'), size: 3 });
    // excluded
    expect(byPath.has('saves/world/level.dat')).toBe(false);
    expect(byPath.has('mods/missing.jar')).toBe(false); // in manifest but absent on disk
  });

  it('returns empty for an empty instance', async () => {
    const result = await scanInstance(dir, manifest(['mods/a.jar']), ['mods/']);
    expect(result).toEqual([]);
  });

  it('tolerates a missing managed root directory', async () => {
    write('config/x.toml', 'C');
    const result = await scanInstance(dir, manifest(['config/x.toml']), ['mods/']);
    expect(result.map((f) => f.path)).toEqual(['config/x.toml']);
  });
});
