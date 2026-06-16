// src/core/hash.test.ts
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sha1OfFile } from './hash.js';

const dir = mkdtempSync(join(tmpdir(), 'phf-hash-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe('sha1OfFile', () => {
  it('computes the known SHA-1 of "abc"', async () => {
    const file = join(dir, 'abc.txt');
    writeFileSync(file, 'abc');
    // SHA-1("abc") = a9993e364706816aba3e25717850c26c9cd0d89d
    expect(await sha1OfFile(file)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
  });

  it('rejects when the file does not exist', async () => {
    await expect(sha1OfFile(join(dir, 'nope.txt'))).rejects.toThrow();
  });
});
