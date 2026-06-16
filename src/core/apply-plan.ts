// src/core/apply-plan.ts
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { SyncPlan, ManifestFile, ProgressEvent } from './types.js';
import { markUpdateInProgress, clearUpdateInProgress, writeInstalledVersion } from './install-state.js';

/** Downloads one file to an absolute destination path (verified + atomic). */
export type FileDownloader = (file: ManifestFile, destPath: string) => Promise<void>;

export interface ApplyPlanDeps {
  download: FileDownloader;
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * Apply a SyncPlan to the instance, crash-safely:
 *  1. mark update-in-progress (so an interrupted run is detectable),
 *  2. download every file (each is verified + atomically placed by `download`),
 *  3. delete orphans LAST (never before downloads succeed),
 *  4. persist the installed version,
 *  5. clear the marker.
 * If any download throws, the marker stays set and the version is not written.
 */
export async function applySyncPlan(
  instanceRoot: string,
  plan: SyncPlan,
  targetVersion: string,
  deps: ApplyPlanDeps,
): Promise<void> {
  const totalFiles = plan.toDownload.length;
  await markUpdateInProgress(instanceRoot, targetVersion);

  let completed = 0;
  for (const file of plan.toDownload) {
    deps.onProgress?.({ phase: 'download', completedFiles: completed, totalFiles, currentPath: file.path });
    await deps.download(file, join(instanceRoot, file.path));
    completed += 1;
  }

  for (const relPath of plan.toDelete) {
    deps.onProgress?.({ phase: 'delete', completedFiles: completed, totalFiles, currentPath: relPath });
    await rm(join(instanceRoot, relPath), { force: true });
  }

  await writeInstalledVersion(instanceRoot, targetVersion);
  await clearUpdateInProgress(instanceRoot);
  deps.onProgress?.({ phase: 'done', completedFiles: completed, totalFiles });
}
