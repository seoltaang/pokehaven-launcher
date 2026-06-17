// src/main/settings-store.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { Settings } from '../shared/ipc.js';
import { instanceDir } from './config.js';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

function file(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function defaults(): Settings {
  return { ramMB: 6144, directConnect: true, instanceDir: instanceDir() };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const parsed = JSON.parse(await readFile(file(), 'utf8')) as Partial<Settings>;
    return { ...defaults(), ...parsed, instanceDir: instanceDir() };
  } catch {
    return defaults();
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch, instanceDir: instanceDir() };
  const f = file();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
