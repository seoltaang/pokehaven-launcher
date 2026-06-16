// src/core/install-state.ts
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const STATE_FILE = '.phf-state.json';
const LOCK_FILE = '.phf-update.lock';

export interface InstallState {
  /** The packVersion currently installed, or null if none/corrupt. */
  packVersion: string | null;
}

export async function readInstallState(instanceRoot: string): Promise<InstallState> {
  try {
    const raw = await readFile(join(instanceRoot, STATE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as { packVersion?: unknown };
    return { packVersion: typeof parsed.packVersion === 'string' ? parsed.packVersion : null };
  } catch {
    return { packVersion: null };
  }
}

export async function writeInstalledVersion(instanceRoot: string, packVersion: string): Promise<void> {
  await mkdir(instanceRoot, { recursive: true });
  await writeFile(join(instanceRoot, STATE_FILE), JSON.stringify({ packVersion }, null, 2), 'utf8');
}

export async function markUpdateInProgress(instanceRoot: string, targetVersion: string): Promise<void> {
  await mkdir(instanceRoot, { recursive: true });
  await writeFile(join(instanceRoot, LOCK_FILE), targetVersion, 'utf8');
}

export async function clearUpdateInProgress(instanceRoot: string): Promise<void> {
  await rm(join(instanceRoot, LOCK_FILE), { force: true });
}

export async function isUpdateInProgress(instanceRoot: string): Promise<boolean> {
  try {
    await readFile(join(instanceRoot, LOCK_FILE), 'utf8');
    return true;
  } catch {
    return false;
  }
}
