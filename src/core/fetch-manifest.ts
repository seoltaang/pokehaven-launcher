// src/core/fetch-manifest.ts
import { parseManifest } from './manifest.js';
import type { ManifestFetchResult } from './types.js';

/**
 * Fetch and validate the remote manifest with ETag support.
 * - 304 Not Modified → { manifest: null, notModified: true, etag: <previous> }
 * - 2xx              → parsed manifest + the response ETag
 * - anything else    → throws (caller must treat as transient, NOT as "update available")
 */
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export async function fetchManifest(
  url: string,
  etag: string | null,
  fetchImpl: FetchFn = fetch,
): Promise<ManifestFetchResult> {
  const headers: Record<string, string> = {};
  if (etag) headers['If-None-Match'] = etag;

  const res = await fetchImpl(url, { headers });

  if (res.status === 304) {
    return { manifest: null, etag, notModified: true };
  }
  if (!res.ok) {
    throw new Error(`manifest fetch failed: ${res.status}`);
  }

  const json: unknown = await res.json();
  return {
    manifest: parseManifest(json),
    etag: res.headers.get('etag'),
    notModified: false,
  };
}
