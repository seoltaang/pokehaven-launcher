// src/core/pipeline.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanInstance } from './scan-instance.js';
import { computeSyncPlan, MANAGED_DELETE_ROOTS } from './sync.js';
import { applySyncPlan } from './apply-plan.js';
import { readInstallState } from './install-state.js';
import type { Manifest, ManifestFile } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-pipe-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}
function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}
// Content-addressed fake downloader: the manifest url encodes the desired content.
function file(path: string, content: string, force = true): ManifestFile {
  return { path, sha1: sha1(content), size: content.length, url: `data:${content}`, force };
}
const fakeDownload = async (f: ManifestFile, dest: string): Promise<void> => {
  const content = f.url.slice('data:'.length);
  mkdirSync(join(dest, '..'), { recursive: true });
  writeFileSync(dest, content);
};

describe('scan -> computeSyncPlan -> applySyncPlan', () => {
  it('reconciles a drifted instance to exactly match the manifest', async () => {
    // Local state: a.jar is outdated, orphan.jar should be removed,
    // user config sodium.json should be preserved, b.jar is missing.
    write('mods/a.jar', 'OLD-A');
    write('mods/orphan.jar', 'REMOVE-ME');
    write('config/sodium.json', 'USER-EDITED');

    const manifest: Manifest = {
      packVersion: '2026.06.17',
      minecraft: '1.21.1',
      neoforge: '21.1.233',
      files: [
        file('mods/a.jar', 'NEW-A', true),
        file('mods/b.jar', 'NEW-B', true),
        file('config/sodium.json', 'DEFAULT-SODIUM', false), // unforced → preserve existing
      ],
    };

    const local = await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS);
    const plan = computeSyncPlan(manifest, local);
    await applySyncPlan(dir, plan, manifest.packVersion, { download: fakeDownload });

    // Forced file updated to new content.
    expect(readFileSync(join(dir, 'mods/a.jar'), 'utf8')).toBe('NEW-A');
    // Missing forced file downloaded.
    expect(readFileSync(join(dir, 'mods/b.jar'), 'utf8')).toBe('NEW-B');
    // Orphan in managed root removed.
    expect(existsSync(join(dir, 'mods/orphan.jar'))).toBe(false);
    // Unforced existing user file preserved (NOT overwritten).
    expect(readFileSync(join(dir, 'config/sodium.json'), 'utf8')).toBe('USER-EDITED');
    // Version recorded.
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.17' });
  });

  it('a second run is a no-op (already up to date, nothing downloaded)', async () => {
    const manifest: Manifest = {
      packVersion: 'v2',
      minecraft: '1.21.1',
      neoforge: '21.1.233',
      files: [file('mods/a.jar', 'A', true)],
    };
    // First run installs.
    let plan = computeSyncPlan(manifest, await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS));
    await applySyncPlan(dir, plan, manifest.packVersion, { download: fakeDownload });

    // Second run: recompute against current disk → empty plan.
    plan = computeSyncPlan(manifest, await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS));
    expect(plan.toDownload).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });
});
