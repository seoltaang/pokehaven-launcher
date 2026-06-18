// src/core/downloader.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadVerified } from './downloader.js';
import type { ManifestFile, FetchFn } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-dl-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function sha1(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex');
}
function mfFor(buf: Buffer, path = 'mods/a.jar'): ManifestFile {
  return { path, sha1: sha1(buf), size: buf.length, url: 'https://x/a.jar', force: true };
}

describe('downloadVerified', () => {
  it('downloads, verifies, and writes the final file (no leftover .part)', async () => {
    const data = Buffer.from('hello world contents');
    const file = mfFor(data);
    const fetchImpl: FetchFn = async () => new Response(data, { status: 200 });
    const dest = join(dir, 'mods/a.jar');

    await downloadVerified(file, dest, { fetchImpl });

    expect(readFileSync(dest)).toEqual(data);
    expect(existsSync(dest + '.part')).toBe(false);
  });

  it('writes a zero-byte file without crashing', async () => {
    const data = Buffer.alloc(0);
    const file = mfFor(data, 'config/empty.txt');
    const fetchImpl: FetchFn = async () => new Response(new Uint8Array(0), { status: 200 });
    const dest = join(dir, 'config/empty.txt');

    await downloadVerified(file, dest, { fetchImpl });

    expect(existsSync(dest)).toBe(true);
    expect(readFileSync(dest).length).toBe(0);
    expect(existsSync(dest + '.part')).toBe(false);
  });

  it('throws and removes .part on SHA-1 mismatch', async () => {
    const file = mfFor(Buffer.from('correct'));
    const wrong = Buffer.from('TAMPERED');
    // size must match so we reach the sha1 check
    const file2: ManifestFile = { ...file, size: wrong.length };
    const fetchImpl: FetchFn = async () => new Response(wrong, { status: 200 });
    const dest = join(dir, 'mods/a.jar');

    await expect(downloadVerified(file2, dest, { fetchImpl })).rejects.toThrow(/sha1 mismatch/);
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(dest + '.part')).toBe(false);
  });

  it('throws on size mismatch', async () => {
    const file = mfFor(Buffer.from('1234567890')); // size 10
    const short = Buffer.from('123');
    const fetchImpl: FetchFn = async () => new Response(short, { status: 200 });
    const dest = join(dir, 'mods/a.jar');

    await expect(downloadVerified(file, dest, { fetchImpl })).rejects.toThrow(/size mismatch/);
  });

  it('resumes from an existing .part using a Range request', async () => {
    const data = Buffer.from('ABCDEFGHIJ'); // 10 bytes
    const file = mfFor(data);
    const dest = join(dir, 'mods/a.jar');
    // Pre-seed a 4-byte partial download.
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(dest + '.part', data.subarray(0, 4));

    let rangeHeaderSeen: string | null = null;
    const fetchImpl: FetchFn = async (_url, init) => {
      rangeHeaderSeen = new Headers(init?.headers).get('range');
      // Server honors Range: return only the remaining bytes with 206.
      return new Response(data.subarray(4), { status: 206 });
    };

    await downloadVerified(file, dest, { fetchImpl });

    expect(rangeHeaderSeen).toBe('bytes=4-');
    expect(readFileSync(dest)).toEqual(data);
  });

  it('restarts cleanly when the server ignores Range (returns 200)', async () => {
    const data = Buffer.from('ABCDEFGHIJ');
    const file = mfFor(data);
    const dest = join(dir, 'mods/a.jar');
    const { mkdirSync } = await import('node:fs');
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(dest + '.part', Buffer.from('XXXX')); // stale partial

    const fetchImpl: FetchFn = async () => new Response(data, { status: 200 }); // full body
    await downloadVerified(file, dest, { fetchImpl });

    expect(readFileSync(dest)).toEqual(data);
  });

  it('reports progress up to the total size', async () => {
    const data = Buffer.from('progress-bytes');
    const file = mfFor(data);
    const dest = join(dir, 'mods/a.jar');
    const fetchImpl: FetchFn = async () => new Response(data, { status: 200 });
    let last = 0;
    await downloadVerified(file, dest, {
      fetchImpl,
      onProgress: (downloaded, total) => {
        expect(total).toBe(data.length);
        last = downloaded;
      },
    });
    expect(last).toBe(data.length);
  });
});
