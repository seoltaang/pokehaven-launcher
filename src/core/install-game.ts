// src/core/install-game.ts
import { getVersionList, install, installNeoForged } from '@xmcl/installer';
import type { ResolvedVersion } from '@xmcl/core';
import { ensureJava } from './java.js';

export type InstallPhase = 'vanilla' | 'java' | 'neoforge' | 'done';

export interface InstallGameOptions {
  /** Where the game (versions/libraries/assets) and mods/config live. */
  instanceRoot: string;
  /** Minecraft version, e.g. '1.21.1'. */
  minecraft: string;
  /** NeoForge version, e.g. '21.1.233'. */
  neoforge: string;
  /** Where downloaded Java runtimes are stored. */
  runtimeDir: string;
  /** Max concurrent asset/library downloads (default 8). Lower for flaky/limited networks. */
  downloadConcurrency?: number;
  onPhase?: (phase: InstallPhase) => void;
}

export interface InstallGameResult {
  /** The launchable version id produced by NeoForge install. */
  versionId: string;
  /** The Java executable used (and to launch with). */
  javaPath: string;
}

/**
 * Install vanilla Minecraft, ensure a matching Java, then install NeoForge.
 * Idempotent enough to re-run: @xmcl skips already-valid files.
 */
export async function installGame(options: InstallGameOptions): Promise<InstallGameResult> {
  const { instanceRoot, minecraft, neoforge, runtimeDir, onPhase } = options;
  const concurrency = options.downloadConcurrency ?? 8;

  onPhase?.('vanilla');
  const list = await getVersionList();
  const meta = list.versions.find((v) => v.id === minecraft);
  if (!meta) throw new Error(`Minecraft version not found in manifest: ${minecraft}`);
  const resolved: ResolvedVersion = await install(meta, instanceRoot, {
    assetsDownloadConcurrency: concurrency,
    librariesDownloadConcurrency: concurrency,
  });

  onPhase?.('java');
  const javaPath = await ensureJava(
    resolved.javaVersion.component,
    resolved.javaVersion.majorVersion,
    runtimeDir,
  );

  onPhase?.('neoforge');
  const versionId = await installNeoForged('neoforge', neoforge, instanceRoot, {
    java: javaPath,
    librariesDownloadConcurrency: concurrency,
  });

  onPhase?.('done');
  return { versionId, javaPath };
}
