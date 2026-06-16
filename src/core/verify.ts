// src/core/verify.ts
import type { Manifest, ManifestFile, LocalFile, VerifyResult } from './types.js';

export function verifyInstance(manifest: Manifest, local: LocalFile[]): VerifyResult {
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const missing: ManifestFile[] = [];
  const corrupt: ManifestFile[] = [];
  for (const f of manifest.files) {
    const l = localByPath.get(f.path);
    if (!l) {
      missing.push(f);
    } else if (l.sha1 !== f.sha1 || l.size !== f.size) {
      corrupt.push(f);
    }
  }
  return { missing, corrupt };
}
