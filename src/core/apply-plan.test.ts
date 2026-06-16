// src/core/apply-plan.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySyncPlan } from './apply-plan.js';
import { readInstallState, isUpdateInProgress } from './install-state.js';
import type { SyncPlan, ManifestFile, ProgressEvent } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-apply-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function mf(path: string): ManifestFile {
  return { path, sha1: 'h', size: 1, url: `https://x/${path}`, force: true };
}
// Fake downloader: writes the dest file directly (stands in for a verified download).
function fakeDownload(order: string[]) {
  return async (file: ManifestFile, destPath: string): Promise<void> => {
    order.push(`download:${file.path}`);
    mkdirSync(join(destPath, '..'), { recursive: true });
    writeFileSync(destPath, file.path);
  };
}

describe('applySyncPlan', () => {
  it('downloads before deleting, writes version, and clears the marker', async () => {
    const order: string[] = [];
    // Pre-existing orphan to be deleted.
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(join(dir, 'mods/old.jar'), 'old');

    const plan: SyncPlan = { toDownload: [mf('mods/new.jar')], toDelete: ['mods/old.jar'] };
    const events: ProgressEvent[] = [];
    await applySyncPlan(dir, plan, '2026.06.17', {
      download: fakeDownload(order),
      onProgress: (e) => events.push(e),
    });

    // Ordering: every download happens before every delete.
    expect(order).toEqual(['download:mods/new.jar']);
    expect(existsSync(join(dir, 'mods/new.jar'))).toBe(true);
    expect(existsSync(join(dir, 'mods/old.jar'))).toBe(false);
    // Version persisted, marker cleared.
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.17' });
    expect(await isUpdateInProgress(dir)).toBe(false);
    // Progress ends with a 'done' phase.
    expect(events.at(-1)?.phase).toBe('done');
  });

  it('emits a delete event only after download events', async () => {
    const phases: string[] = [];
    const plan: SyncPlan = { toDownload: [mf('mods/a.jar')], toDelete: ['mods/x.jar'] };
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(join(dir, 'mods/x.jar'), 'x');
    await applySyncPlan(dir, plan, 'v', {
      download: async (_f, dest) => { mkdirSync(join(dest, '..'), { recursive: true }); writeFileSync(dest, '.'); },
      onProgress: (e) => phases.push(e.phase),
    });
    const firstDelete = phases.indexOf('delete');
    const lastDownload = phases.lastIndexOf('download');
    expect(lastDownload).toBeGreaterThanOrEqual(0);
    expect(firstDelete).toBeGreaterThan(lastDownload);
  });

  it('leaves the marker set and version unwritten if a download fails', async () => {
    const plan: SyncPlan = { toDownload: [mf('mods/a.jar'), mf('mods/b.jar')], toDelete: [] };
    let calls = 0;
    const failingDownload = async (file: ManifestFile, destPath: string): Promise<void> => {
      calls += 1;
      if (file.path === 'mods/b.jar') throw new Error('network boom');
      mkdirSync(join(destPath, '..'), { recursive: true });
      writeFileSync(destPath, file.path);
    };

    await expect(
      applySyncPlan(dir, plan, '2026.06.17', { download: failingDownload }),
    ).rejects.toThrow(/network boom/);

    expect(calls).toBe(2);
    // First file landed, but the update is NOT marked complete.
    expect(existsSync(join(dir, 'mods/a.jar'))).toBe(true);
    expect(await isUpdateInProgress(dir)).toBe(true);
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('handles an empty plan as a clean no-op install (version written)', async () => {
    await applySyncPlan(dir, { toDownload: [], toDelete: [] }, 'v1', {
      download: async () => { throw new Error('should not be called'); },
    });
    expect(await readInstallState(dir)).toEqual({ packVersion: 'v1' });
    expect(await isUpdateInProgress(dir)).toBe(false);
  });
});
