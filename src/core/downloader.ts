// src/core/downloader.ts
import { open, stat, rename, rm, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { sha1OfFile } from './hash.js';
import type { ManifestFile, FetchFn } from './types.js';

export type ProgressFn = (bytesDownloaded: number, totalBytes: number) => void;

export interface DownloadOptions {
  fetchImpl?: FetchFn;
  onProgress?: ProgressFn;
}

const PART_SUFFIX = '.part';

/**
 * Download one manifest file to `destPath`, resuming a `.part` partial via HTTP
 * Range when possible, verifying size then SHA-1, and atomically renaming the
 * verified `.part` into place. On any verification failure the `.part` is
 * removed and the function throws; `destPath` is only ever the fully verified file.
 */
export async function downloadVerified(
  file: ManifestFile,
  destPath: string,
  options: DownloadOptions = {},
): Promise<void> {
  const fetchImpl: FetchFn = options.fetchImpl ?? fetch;
  const partPath = destPath + PART_SUFFIX;
  await mkdir(dirname(destPath), { recursive: true });

  // How many verified-prefix bytes do we already have?
  let existing = 0;
  try {
    existing = (await stat(partPath)).size;
  } catch {
    existing = 0;
  }
  if (existing > file.size) {
    await rm(partPath, { force: true });
    existing = 0;
  }

  if (existing < file.size) {
    const headers: Record<string, string> = {};
    if (existing > 0) headers['Range'] = `bytes=${existing}-`;
    const res = await fetchImpl(file.url, { headers });
    if (!res.ok) throw new Error(`download failed: ${file.url} -> ${res.status}`);
    if (!res.body) throw new Error(`download has no body: ${file.url}`);

    // If we asked for a range but the server replied 200, it sent the whole
    // file: start over from byte 0.
    const startByte = existing > 0 && res.status === 200 ? 0 : existing;
    const append = startByte > 0;

    const fh = await open(partPath, append ? 'a' : 'w');
    let downloaded = startByte;
    try {
      for await (const chunk of res.body as AsyncIterable<Uint8Array>) {
        await fh.write(chunk);
        downloaded += chunk.length;
        options.onProgress?.(downloaded, file.size);
      }
    } finally {
      await fh.close();
    }
  } else {
    options.onProgress?.(file.size, file.size);
  }

  const actualSize = (await stat(partPath)).size;
  if (actualSize !== file.size) {
    await rm(partPath, { force: true });
    throw new Error(`size mismatch for ${file.path}: expected ${file.size}, got ${actualSize}`);
  }
  const actualSha1 = await sha1OfFile(partPath);
  if (actualSha1 !== file.sha1) {
    await rm(partPath, { force: true });
    throw new Error(`sha1 mismatch for ${file.path}: expected ${file.sha1}, got ${actualSha1}`);
  }

  await rename(partPath, destPath);
}
