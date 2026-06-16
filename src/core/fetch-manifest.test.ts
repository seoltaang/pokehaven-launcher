// src/core/fetch-manifest.test.ts
import { describe, it, expect } from 'vitest';
import { fetchManifest } from './fetch-manifest.js';

const validManifest = {
  packVersion: '2026.06.16',
  minecraft: '1.21.1',
  neoforge: '21.1.233',
  files: [],
};

function fakeFetch(status: number, body: unknown, etag: string | null) {
  return async (_url: string, _init?: RequestInit): Promise<Response> => {
    const headers = new Headers();
    if (etag) headers.set('etag', etag);
    return {
      status,
      ok: status >= 200 && status < 300,
      headers,
      json: async () => body,
    } as unknown as Response;
  };
}

describe('fetchManifest', () => {
  it('parses a 200 response and returns the new etag', async () => {
    const r = await fetchManifest('https://x/m.json', null, fakeFetch(200, validManifest, '"v1"'));
    expect(r.notModified).toBe(false);
    expect(r.manifest?.packVersion).toBe('2026.06.16');
    expect(r.etag).toBe('"v1"');
  });

  it('returns notModified with null manifest on 304', async () => {
    const r = await fetchManifest('https://x/m.json', '"v1"', fakeFetch(304, null, null));
    expect(r.notModified).toBe(true);
    expect(r.manifest).toBeNull();
    expect(r.etag).toBe('"v1"');
  });

  it('sends If-None-Match when an etag is provided', async () => {
    let seen: RequestInit | undefined;
    const spy = async (_url: string, init?: RequestInit): Promise<Response> => {
      seen = init;
      const headers = new Headers({ etag: '"v2"' });
      return { status: 200, ok: true, headers, json: async () => validManifest } as unknown as Response;
    };
    await fetchManifest('https://x/m.json', '"v1"', spy);
    expect(new Headers(seen?.headers).get('if-none-match')).toBe('"v1"');
  });

  it('throws on a non-OK, non-304 response (transient failure)', async () => {
    await expect(
      fetchManifest('https://x/m.json', null, fakeFetch(503, null, null)),
    ).rejects.toThrow(/503/);
  });
});
