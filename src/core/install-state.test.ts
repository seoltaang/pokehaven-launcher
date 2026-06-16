// src/core/install-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readInstallState,
  writeInstalledVersion,
  markUpdateInProgress,
  clearUpdateInProgress,
  isUpdateInProgress,
} from './install-state.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-state-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('install-state', () => {
  it('reports null version for a fresh instance', async () => {
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('persists and reads back an installed version', async () => {
    await writeInstalledVersion(dir, '2026.06.16');
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.16' });
  });

  it('treats a corrupt state file as not installed', async () => {
    await writeInstalledVersion(dir, '2026.06.16');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, '.phf-state.json'), 'not json{');
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('sets and clears the update-in-progress marker', async () => {
    expect(await isUpdateInProgress(dir)).toBe(false);
    await markUpdateInProgress(dir, '2026.06.17');
    expect(await isUpdateInProgress(dir)).toBe(true);
    await clearUpdateInProgress(dir);
    expect(await isUpdateInProgress(dir)).toBe(false);
  });

  it('clearing a non-existent marker does not throw', async () => {
    await expect(clearUpdateInProgress(dir)).resolves.toBeUndefined();
  });

  it('creates the instance dir if missing when writing', async () => {
    const nested = join(dir, 'does', 'not', 'exist');
    await writeInstalledVersion(nested, 'v1');
    expect(await readInstallState(nested)).toEqual({ packVersion: 'v1' });
  });
});
