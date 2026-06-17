// src/core/install-game.ts
import { getVersionList, installTask, installNeoForgedTask } from '@xmcl/installer';
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
  /** Overall install progress as a fraction 0..1, with a short detail label. */
  onProgress?: (fraction: number, detail: string) => void;
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
  const { instanceRoot, minecraft, neoforge, runtimeDir, onPhase, onProgress } = options;
  const concurrency = options.downloadConcurrency ?? 8;

  // Progress is split across phases: vanilla 0..0.6, java 0.6..0.75, neoforge 0.75..1.
  onPhase?.('vanilla');
  onProgress?.(0, '게임 파일 확인 중');
  const list = await getVersionList();
  const meta = list.versions.find((v) => v.id === minecraft);
  if (!meta) throw new Error(`Minecraft version not found in manifest: ${minecraft}`);
  const vanillaTask = installTask(meta, instanceRoot, {
    assetsDownloadConcurrency: concurrency,
    librariesDownloadConcurrency: concurrency,
  });
  const resolved: ResolvedVersion = await vanillaTask.startAndWait({
    onUpdate: () => {
      if (vanillaTask.total > 0) {
        onProgress?.(0.6 * (vanillaTask.progress / vanillaTask.total), '게임 파일 다운로드');
      }
    },
  });

  onPhase?.('java');
  onProgress?.(0.6, 'Java 설치 중');
  const javaPath = await ensureJava(
    resolved.javaVersion.component,
    resolved.javaVersion.majorVersion,
    runtimeDir,
  );

  onPhase?.('neoforge');
  onProgress?.(0.75, 'NeoForge 설치 중 (마지막 처리는 1~2분 걸려요 · 닫지 마세요)');
  const nfTask = installNeoForgedTask('neoforge', neoforge, instanceRoot, {
    java: javaPath,
    librariesDownloadConcurrency: concurrency,
  });
  const versionId = await nfTask.startAndWait({
    onUpdate: () => {
      if (nfTask.total > 0) {
        onProgress?.(
          0.75 + 0.25 * (nfTask.progress / nfTask.total),
          'NeoForge 설치 중 (마지막 처리는 1~2분 걸려요 · 닫지 마세요)',
        );
      }
    },
  });

  onPhase?.('done');
  onProgress?.(1, '완료');
  return { versionId, javaPath };
}
