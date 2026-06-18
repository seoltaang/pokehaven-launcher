// src/main/launcher-service.ts
import { fork, type ForkOptions } from 'node:child_process';
import { join } from 'node:path';
import type { LauncherStatus, Progress } from '../shared/ipc.js';
import { fetchManifest } from '../core/fetch-manifest.js';
import { scanInstance } from '../core/scan-instance.js';
import { computeSyncPlan, needsUpdate, MANAGED_DELETE_ROOTS } from '../core/sync.js';
import { applySyncPlan } from '../core/apply-plan.js';
import { downloadVerified } from '../core/downloader.js';
import type { InstallGameResult } from '../core/install-game.js';
import type { GameAccount } from '../core/launch-game.js';
import { deriveLaunchState } from '../core/launch-state.js';
import type { Manifest } from '../core/types.js';
import { getCurrentAccount, getGameAccount } from './auth.js';
import { loadSettings } from './settings-store.js';
import { loadState, saveState } from './launcher-state.js';
import {
  instanceDir, runtimeDir, MINECRAFT_VERSION, NEOFORGE_VERSION, MANIFEST_URL, SERVER,
} from './config.js';

export type ProgressSink = (p: Progress) => void;
export type StateSink = (state: LauncherStatus['state']) => void;

/**
 * Fork the task worker with the SYSTEM node binary. Both the NeoForge install
 * AND the game launch (natives extraction) hang under Electron's bundled Node
 * (main and utilityProcess alike), but complete in a normal Node process.
 */
function forkWorker(): ReturnType<typeof fork> {
  const workerPath = join(import.meta.dirname, 'install-worker.js');
  // npm sets npm_node_execpath to the system node that launched us (dev);
  // fall back to PATH lookup.
  const nodeExec = process.env['npm_node_execpath'] || 'node';
  return fork(workerPath, [], {
    execPath: nodeExec,
    stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    // windowsHide is forwarded to spawn() to suppress the console window on
    // Windows; it isn't in ForkOptions' type, so widen via the cast.
    windowsHide: true,
  } as ForkOptions);
}

function installViaWorker(onProgress: ProgressSink): Promise<InstallGameResult> {
  return new Promise((resolve, reject) => {
    const child = forkWorker();
    let settled = false;
    child.on('message', (msg: { type: string; [k: string]: unknown }) => {
      if (msg.type === 'ready') {
        child.send({
          command: 'install',
          instanceRoot: instanceDir(),
          minecraft: MINECRAFT_VERSION,
          neoforge: NEOFORGE_VERSION,
          runtimeDir: runtimeDir(),
        });
      } else if (msg.type === 'progress') {
        onProgress({ fraction: msg['fraction'] as number, currentFile: msg['detail'] as string });
      } else if (msg.type === 'done') {
        settled = true;
        resolve(msg['result'] as InstallGameResult);
      } else if (msg.type === 'error') {
        settled = true;
        reject(new Error(String(msg['message'])));
      }
    });
    child.on('error', (e) => {
      if (!settled) {
        settled = true;
        reject(e);
      }
    });
    child.on('exit', (code) => {
      if (!settled) reject(new Error(`install worker exited unexpectedly (code ${code})`));
    });
  });
}

/**
 * Launch the game in the worker. Resolves once the game process has spawned; the
 * worker keeps watching it and calls onState('play') when the game exits.
 */
function launchViaWorker(
  params: { versionId: string; maxMemoryMB: number; account: GameAccount; server?: { ip: string; port?: number } },
  onState: StateSink,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = forkWorker();
    let spawned = false;
    child.on('message', (msg: { type: string; [k: string]: unknown }) => {
      if (msg.type === 'ready') {
        child.send({
          command: 'launch',
          instanceRoot: instanceDir(),
          runtimeDir: runtimeDir(),
          versionId: params.versionId,
          maxMemoryMB: params.maxMemoryMB,
          account: params.account,
          server: params.server,
        });
      } else if (msg.type === 'launch-spawned') {
        spawned = true;
        console.log('[launcher] minecraft spawned (pid', msg['pid'], ')');
        resolve();
      } else if (msg.type === 'launch-window') {
        console.log('[launcher] minecraft window ready');
      } else if (msg.type === 'launch-exit') {
        console.log('[launcher] minecraft exited, code =', msg['code']);
        onState('play');
      } else if (msg.type === 'launch-error') {
        console.error('[launcher] launch error:', msg['message']);
        if (!spawned) reject(new Error(String(msg['message'])));
        else onState('play');
      }
    });
    child.on('error', (e) => {
      if (!spawned) reject(e);
    });
    child.on('exit', (code) => {
      if (!spawned) reject(new Error(`launch worker exited before spawn (code ${code})`));
    });
  });
}

let etag: string | null = null;
let cachedManifest: Manifest | null = null;
let running = false;

async function fetchPackManifest(): Promise<Manifest | null> {
  if (!MANIFEST_URL) return null;
  try {
    const res = await fetchManifest(MANIFEST_URL, etag);
    if (res.notModified) return cachedManifest;
    etag = res.etag;
    cachedManifest = res.manifest;
    return res.manifest;
  } catch {
    // transient/offline: do not force an update on a fetch failure
    return cachedManifest;
  }
}

async function computeSyncNeeded(manifest: Manifest | null): Promise<boolean> {
  if (!manifest) return false;
  const local = await scanInstance(instanceDir(), manifest, MANAGED_DELETE_ROOTS);
  return needsUpdate(computeSyncPlan(manifest, local));
}

/** Build the current status for the UI. */
export async function getStatus(): Promise<LauncherStatus> {
  const account = getCurrentAccount();
  const state0 = await loadState();
  const manifest = await fetchPackManifest();
  const installed = Boolean(state0.gameVersionId);
  const syncNeeded = await computeSyncNeeded(manifest);
  return {
    state: deriveLaunchState({ loggedIn: account.loggedIn, installed, syncNeeded }),
    packVersion: manifest?.packVersion ?? state0.packVersion ?? '—',
    minecraft: MINECRAFT_VERSION,
    neoforge: NEOFORGE_VERSION,
    online: manifest !== null || installed,
  };
}

/**
 * Single button action. When an update is needed, sync mods + (re)install and
 * record state. When already in sync, launch the game with the signed-in account.
 */
export async function playOrUpdate(onProgress: ProgressSink, onState: StateSink): Promise<void> {
  if (running) {
    console.log('[launcher] playOrUpdate ignored — already running');
    return;
  }
  running = true;
  try {
    await runPlayOrUpdate(onProgress, onState);
  } finally {
    running = false;
  }
}

async function runPlayOrUpdate(onProgress: ProgressSink, onState: StateSink): Promise<void> {
  const status = await getStatus();
  console.log('[launcher] playOrUpdate start; state =', status.state);

  if (status.state === 'install-needed' || status.state === 'update-available') {
    onState('updating');
    const manifest = await fetchPackManifest();

    // 1) sync mods/config if a manifest is configured
    if (manifest) {
      const local = await scanInstance(instanceDir(), manifest, MANAGED_DELETE_ROOTS);
      const plan = computeSyncPlan(manifest, local);
      const total = plan.toDownload.length || 1;
      await applySyncPlan(instanceDir(), plan, manifest.packVersion, {
        download: (f, dest) => downloadVerified(f, dest, {}),
        onProgress: (e) => onProgress({ fraction: e.completedFiles / total, currentFile: e.currentPath ?? '모드 동기화' }),
      });
    }

    // 2) ensure Java + vanilla + NeoForge installed (in an off-main worker)
    console.log('[launcher] installing game (java + vanilla + neoforge) via worker…');
    const { versionId } = await installViaWorker(onProgress);
    console.log('[launcher] install complete; versionId =', versionId);

    await saveState({ gameVersionId: versionId, packVersion: manifest?.packVersion });
    console.log('[launcher] install done -> emitting state PLAY');
    onState('play');
    return;
  }

  if (status.state === 'play') {
    const account = getGameAccount();
    if (!account) {
      onState('logged-out');
      return;
    }
    const state = await loadState();
    if (!state.gameVersionId) {
      onState('install-needed');
      return;
    }
    const settings = await loadSettings();
    onState('launching');
    console.log('[launcher] launching minecraft via worker (version', state.gameVersionId, ', ram', settings.ramMB, 'MB)…');
    // Launch in the worker (off Electron's Node); resolves once the game spawns.
    await launchViaWorker(
      {
        versionId: state.gameVersionId,
        maxMemoryMB: settings.ramMB,
        account,
        server: settings.directConnect ? SERVER : undefined,
      },
      onState,
    );
  }
}
