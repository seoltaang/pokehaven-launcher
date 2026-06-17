// src/main/launcher-service.ts
import type { LauncherStatus, Progress } from '../shared/ipc.js';
import { fetchManifest } from '../core/fetch-manifest.js';
import { scanInstance } from '../core/scan-instance.js';
import { computeSyncPlan, needsUpdate, MANAGED_DELETE_ROOTS } from '../core/sync.js';
import { applySyncPlan } from '../core/apply-plan.js';
import { downloadVerified } from '../core/downloader.js';
import { installGame } from '../core/install-game.js';
import { launchGame, createMinecraftProcessWatcher } from '../core/launch-game.js';
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

    // 2) ensure Java + vanilla + NeoForge installed (streams real download progress)
    console.log('[launcher] installing game (java + vanilla + neoforge)…');
    const { versionId } = await installGame({
      instanceRoot: instanceDir(),
      minecraft: MINECRAFT_VERSION,
      neoforge: NEOFORGE_VERSION,
      runtimeDir: runtimeDir(),
      onProgress: (fraction, detail) => onProgress({ fraction, currentFile: detail }),
    });
    console.log('[launcher] install complete; versionId =', versionId);

    await saveState({ gameVersionId: versionId, packVersion: manifest?.packVersion });
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
    console.log('[launcher] launching minecraft (version', state.gameVersionId, ', ram', settings.ramMB, 'MB)…');
    const proc = await launchGame({
      instanceRoot: instanceDir(),
      versionId: state.gameVersionId,
      javaPath: await resolveJavaPath(),
      maxMemoryMB: settings.ramMB,
      account,
      server: settings.directConnect ? SERVER : undefined,
    });
    const watcher = createMinecraftProcessWatcher(proc);
    watcher.on('minecraft-exit', () => onState('play'));
    watcher.on('error', () => onState('play'));
  }
}

/** Re-resolve the Java path the same way install did (reuse local or the downloaded runtime). */
async function resolveJavaPath(): Promise<string> {
  // installGame already ensured Java; re-running ensureJava resolves the cached/downloaded one fast.
  const { ensureJava } = await import('../core/java.js');
  const { Version } = await import('@xmcl/core');
  const state = await loadState();
  const resolved = await Version.parse(instanceDir(), state.gameVersionId!);
  return ensureJava(resolved.javaVersion.component, resolved.javaVersion.majorVersion, runtimeDir());
}
