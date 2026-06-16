// src/core/sync.ts
import type { Manifest, LocalFile, SyncPlan } from './types.js';

/**
 * Directories that are fully owned by the modpack: any local file under these
 * roots that is absent from the manifest will be deleted. Everything else
 * (config/, saves/, options.txt, ...) is never auto-deleted.
 */
export const MANAGED_DELETE_ROOTS: readonly string[] = ['mods/'];

export function computeSyncPlan(
  manifest: Manifest,
  local: LocalFile[],
  managedDeleteRoots: readonly string[] = MANAGED_DELETE_ROOTS,
): SyncPlan {
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const manifestPaths = new Set(manifest.files.map((f) => f.path));

  const toDownload = manifest.files.filter((f) => {
    const l = localByPath.get(f.path);
    if (!l) return true; // missing → always download
    if (f.force && l.sha1 !== f.sha1) return true; // server-authoritative & changed
    return false; // present and (unforced or matching) → keep
  });

  const roots = managedDeleteRoots.map((r) => (r.endsWith('/') ? r : `${r}/`));

  const toDelete = local
    .filter((l) => roots.some((root) => l.path.startsWith(root)))
    .filter((l) => !manifestPaths.has(l.path))
    .map((l) => l.path);

  return { toDownload, toDelete };
}

export function needsUpdate(plan: SyncPlan): boolean {
  return plan.toDownload.length > 0 || plan.toDelete.length > 0;
}
