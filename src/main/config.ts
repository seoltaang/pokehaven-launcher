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

/**
 * The Node binary used to fork the install/launch worker. Electron's own Node
 * hangs on it, so in a packaged app we fork the Node binary bundled under
 * resources/node; in dev we use the Node that launched us.
 */
export function workerNodePath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'node', process.platform === 'win32' ? 'node.exe' : 'node');
  }
  return process.env['npm_node_execpath'] || 'node';
}

export const MINECRAFT_VERSION = '1.21.1';
export const NEOFORGE_VERSION = '21.1.233';

/**
 * Remote modpack manifest URL (GitHub release asset). When set, the launcher
 * syncs mods/config from here; leave empty to skip sync (install + launch only).
 */
export const MANIFEST_URL =
  'https://github.com/seoltaang/pokehaven-modpack/releases/download/modpack/manifest.json';

/** PokeHaven Frontier server for direct-connect. */
export const SERVER = { ip: 'ysknd.kro.kr', port: 25565 };
