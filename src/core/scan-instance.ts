// src/core/scan-instance.ts
import { readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { sha1OfFile } from './hash.js';
import type { Manifest, LocalFile } from './types.js';

function toPosix(p: string): string {
  return p.split(sep).join('/');
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return; // directory does not exist — nothing to collect
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out);
    } else if (entry.isFile()) {
      out.push(toPosix(relative(root, full)));
    }
  }
}

/**
 * Scan the instance for files relevant to a sync: every file under each managed
 * delete root (so orphans can be detected) plus every manifest path that exists
 * on disk (so changed/missing files can be detected). Returns LocalFile[] with
 * POSIX-normalized paths, SHA-1, and size.
 */
export async function scanInstance(
  instanceRoot: string,
  manifest: Manifest,
  managedDeleteRoots: readonly string[],
): Promise<LocalFile[]> {
  const relPaths = new Set<string>();

  for (const root of managedDeleteRoots) {
    const trimmed = root.endsWith('/') ? root.slice(0, -1) : root;
    const found: string[] = [];
    await walk(instanceRoot, join(instanceRoot, trimmed), found);
    for (const p of found) relPaths.add(p);
  }

  for (const f of manifest.files) {
    try {
      await stat(join(instanceRoot, f.path));
      relPaths.add(f.path);
    } catch {
      // manifest file absent on disk — not a local file
    }
  }

  const result: LocalFile[] = [];
  for (const rel of relPaths) {
    const full = join(instanceRoot, rel);
    const s = await stat(full);
    result.push({ path: rel, sha1: await sha1OfFile(full), size: s.size });
  }
  return result;
}
