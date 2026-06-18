// src/main/config.ts
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

/** Instance dir: game files (versions/libraries/assets) + mods/config live here. */
export function instanceDir(): string {
  return join(app.getPath('userData'), 'instance');
}

/** Where downloaded Java runtimes are stored. */
export function runtimeDir(): string {
  return join(app.getPath('userData'), 'runtime');
}

export const MINECRAFT_VERSION = '1.21.1';
export const NEOFORGE_VERSION = '21.1.233';

/**
 * Remote modpack manifest URL. Leave empty until the GitHub manifest is published —
 * while empty, mod sync is skipped (install + launch still work).
 */
export const MANIFEST_URL = '';

/** PokeHaven Frontier server for direct-connect + live status. Replace host with the real address. */
export const SERVER = { ip: 'play.pokehaven.example', port: 25565 };

/** Fallback max-player count shown when the server can't be reached. */
export const SERVER_MAX_PLAYERS = 220;
