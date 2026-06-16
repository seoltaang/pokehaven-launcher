// src/core/types.ts

/** One file tracked by the modpack manifest. */
export interface ManifestFile {
  /** Instance-relative POSIX path, e.g. "mods/Pixelmon-...jar". */
  path: string;
  /** Lowercase hex SHA-1 of the file contents. */
  sha1: string;
  /** File size in bytes. */
  size: number;
  /** Download URL (per-file, so the host can be swapped freely). */
  url: string;
  /**
   * true  = server-authoritative: overwrite on every update when content differs.
   * false = install-once: download only when missing, then preserve user edits.
   */
  force: boolean;
}

/** A published modpack version. */
export interface Manifest {
  /** Opaque version label used for the fast up-to-date check, e.g. "2026.06.16". */
  packVersion: string;
  /** Minecraft version, e.g. "1.21.1". Drives the install pipeline (Plan 2). */
  minecraft: string;
  /** NeoForge version, e.g. "21.1.233". Drives the install pipeline (Plan 2). */
  neoforge: string;
  files: ManifestFile[];
}

/** Observed state of a file already present in the local instance. */
export interface LocalFile {
  /** Instance-relative POSIX path. */
  path: string;
  /** Lowercase hex SHA-1 of the local file contents. */
  sha1: string;
  /** Local file size in bytes. */
  size: number;
}

/** The set of changes required to reconcile the instance with the manifest. */
export interface SyncPlan {
  /** Manifest files that must be (re)downloaded. */
  toDownload: ManifestFile[];
  /** Instance-relative paths that must be deleted. */
  toDelete: string[];
}

/** Result of a full integrity scan against the manifest. */
export interface VerifyResult {
  /** Manifest files absent locally. */
  missing: ManifestFile[];
  /** Manifest files present but with wrong sha1 or size. */
  corrupt: ManifestFile[];
}

/** Result of an ETag-aware manifest fetch. */
export interface ManifestFetchResult {
  /** Parsed manifest, or null when the server replied 304 Not Modified. */
  manifest: Manifest | null;
  /** ETag to store for the next request (echoed back on 304). */
  etag: string | null;
  /** true when the server replied 304 Not Modified. */
  notModified: boolean;
}
