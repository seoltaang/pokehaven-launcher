// src/main/launcher-state.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

export interface LauncherState {
  /** The launchable version id from the last successful install (NeoForge id). */
  gameVersionId?: string;
  /** The modpack packVersion currently applied. */
  packVersion?: string;
}

function file(): string {
  return join(app.getPath('userData'), 'launcher-state.json');
}

export async function loadState(): Promise<LauncherState> {
  try {
    return JSON.parse(await readFile(file(), 'utf8')) as LauncherState;
  } catch {
    return {};
  }
}

export async function saveState(patch: Partial<LauncherState>): Promise<LauncherState> {
  const next = { ...(await loadState()), ...patch };
  const f = file();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
