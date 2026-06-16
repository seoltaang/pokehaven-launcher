// src/core/manifest.ts
import type { Manifest, ManifestFile } from './types.js';

function asRecord(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null) {
    throw new Error(`${label} must be an object`);
  }
  return input as Record<string, unknown>;
}

function parseManifestFile(input: unknown, index: number): ManifestFile {
  const f = asRecord(input, `files[${index}]`);
  const prefix = `files[${index}]`;
  if (typeof f.path !== 'string') throw new Error(`${prefix}.path must be a string`);
  if (typeof f.sha1 !== 'string') throw new Error(`${prefix}.sha1 must be a string`);
  if (typeof f.size !== 'number') throw new Error(`${prefix}.size must be a number`);
  if (typeof f.url !== 'string') throw new Error(`${prefix}.url must be a string`);
  if (typeof f.force !== 'boolean') throw new Error(`${prefix}.force must be a boolean`);
  return { path: f.path, sha1: f.sha1, size: f.size, url: f.url, force: f.force };
}

export function parseManifest(input: unknown): Manifest {
  const m = asRecord(input, 'manifest');
  for (const key of ['packVersion', 'minecraft', 'neoforge'] as const) {
    if (typeof m[key] !== 'string') throw new Error(`manifest.${key} must be a string`);
  }
  if (!Array.isArray(m.files)) throw new Error('manifest.files must be an array');
  const files = m.files.map((f, i) => parseManifestFile(f, i));
  return {
    packVersion: m.packVersion as string,
    minecraft: m.minecraft as string,
    neoforge: m.neoforge as string,
    files,
  };
}
