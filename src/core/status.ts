// src/core/status.ts

/**
 * Fast "are we current?" check by version label. This is a hint only; an
 * authoritative answer requires a full hash scan via computeSyncPlan. Returns
 * false when nothing is installed yet (localInstalled === null).
 */
export function isUpToDateByVersion(remote: string, localInstalled: string | null): boolean {
  return localInstalled !== null && remote === localInstalled;
}
