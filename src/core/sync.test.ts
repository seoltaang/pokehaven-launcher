// src/core/sync.test.ts
import { describe, it, expect } from 'vitest';
import { computeSyncPlan, needsUpdate, MANAGED_DELETE_ROOTS } from './sync.js';
import type { Manifest, LocalFile } from './types.js';

function mf(path: string, sha1: string, force: boolean) {
  return { path, sha1, size: 10, url: `https://x/${path}`, force };
}
function manifest(files: ReturnType<typeof mf>[]): Manifest {
  return { packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', files };
}
function lf(path: string, sha1: string): LocalFile {
  return { path, sha1, size: 10 };
}

describe('computeSyncPlan', () => {
  it('downloads files missing locally', () => {
    const plan = computeSyncPlan(manifest([mf('mods/a.jar', 'h1', true)]), []);
    expect(plan.toDownload.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(plan.toDelete).toEqual([]);
  });

  it('re-downloads a forced file whose hash changed', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h2', true)]),
      [lf('mods/a.jar', 'h1')],
    );
    expect(plan.toDownload.map((f) => f.path)).toEqual(['mods/a.jar']);
  });

  it('keeps a forced file whose hash matches', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1')],
    );
    expect(plan.toDownload).toEqual([]);
  });

  it('preserves an existing unforced file even when its hash differs', () => {
    const plan = computeSyncPlan(
      manifest([mf('config/sodium.json', 'h2', false)]),
      [lf('config/sodium.json', 'h1-user-edited')],
    );
    expect(plan.toDownload).toEqual([]);
  });

  it('downloads an unforced file when it is missing', () => {
    const plan = computeSyncPlan(
      manifest([mf('config/sodium.json', 'h1', false)]),
      [],
    );
    expect(plan.toDownload.map((f) => f.path)).toEqual(['config/sodium.json']);
  });

  it('deletes a local mods/ file not in the manifest (full lock)', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('mods/personal-extra.jar', 'hx')],
    );
    expect(plan.toDelete).toEqual(['mods/personal-extra.jar']);
  });

  it('never deletes files outside managed roots (e.g. user config/saves)', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('config/orphan.toml', 'hc'), lf('saves/world/level.dat', 'hs')],
    );
    expect(plan.toDelete).toEqual([]);
  });

  it('exposes mods/ as the default managed delete root', () => {
    expect(MANAGED_DELETE_ROOTS).toEqual(['mods/']);
  });

  it('sibling-prefix safety: does not delete mods-extra/personal.jar even though it shares the "mods" prefix', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('mods-extra/personal.jar', 'hx')],
    );
    expect(plan.toDelete).toEqual([]);
  });

  it('normalization: root without trailing slash still deletes orphan mods/old.jar but not mods-extra/x.jar', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('mods/old.jar', 'hold'), lf('mods-extra/x.jar', 'hx')],
      ['mods'],
    );
    expect(plan.toDelete).toEqual(['mods/old.jar']);
    expect(plan.toDelete).not.toContain('mods-extra/x.jar');
  });
});

describe('needsUpdate', () => {
  it('is false for an empty plan', () => {
    expect(needsUpdate({ toDownload: [], toDelete: [] })).toBe(false);
  });
  it('is true when there is anything to download', () => {
    expect(needsUpdate({ toDownload: [mf('mods/a.jar', 'h', true)], toDelete: [] })).toBe(true);
  });
  it('is true when there is anything to delete', () => {
    expect(needsUpdate({ toDownload: [], toDelete: ['mods/x.jar'] })).toBe(true);
  });
});
