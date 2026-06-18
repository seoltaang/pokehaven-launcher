// src/core/manifest-build.ts

/** Instance-relative dirs whose contents ship with the modpack (POSIX, trailing slash). */
export const MANAGED_ROOTS: readonly string[] = ['mods/', 'config/', 'kubejs/', 'defaultconfigs/'];

/**
 * Dirs/files distributed as install-once "seeds": shipped to new installs but
 * preserved afterwards so players keep their own changes. Roots end in '/'.
 * Includes the server list, default options, and resource/shader packs.
 */
export const SEED_ROOTS: readonly string[] = ['resourcepacks/', 'shaderpacks/'];
export const SEED_FILES: readonly string[] = ['servers.dat', 'options.txt'];

/**
 * Substrings of paths under config-like roots that are player preferences and must
 * be preserved across updates (installed once, never overwritten). Edit to taste.
 */
export const FORCE_FALSE_PATTERNS: readonly string[] = [
  'iris.properties',
  'sodium',
  'embeddium',
  'xaero',
  'jei/',
  'betterf3',
  'controlling',
  'mousetweaks',
  'borderless',
  'entityculling',
];

export interface FileClass {
  managed: boolean;
  force: boolean;
}

/** Decide whether an instance-relative POSIX path ships with the pack, and if forced. */
export function classifyFile(relPath: string): FileClass {
  if (MANAGED_ROOTS.some((root) => relPath.startsWith(root))) {
    const preserve = FORCE_FALSE_PATTERNS.some((p) => relPath.includes(p));
    return { managed: true, force: !preserve };
  }
  // Server list, default settings, resource/shader packs: ship once, then preserve.
  if (SEED_ROOTS.some((root) => relPath.startsWith(root)) || SEED_FILES.includes(relPath)) {
    return { managed: true, force: false };
  }
  return { managed: false, force: false };
}

/** Content-addressed download URL: `<baseUrl>/<sha1>` with exactly one slash. */
export function assetUrl(baseUrl: string, sha1: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${sha1}`;
}
