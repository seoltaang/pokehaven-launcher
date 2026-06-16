# Launcher Core Sync — Implementation Plan (Plan 1 of 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pure-logic core that decides what the launcher must download/delete to make a local Minecraft instance exactly match a published modpack manifest — fully unit-tested, with no Electron or Minecraft dependencies.

**Architecture:** A standalone TypeScript package (`src/core/`) of pure functions: manifest parsing/validation, streaming SHA-1 hashing, a sync-plan computer (download + deletion planner with a managed-delete-root allowlist), an instance verifier (for verify/repair), an update/version status check, and an ETag-aware manifest fetcher (network isolated behind an injectable `fetch`). Later plans (install/launch/auth/UI) consume these functions.

**Tech Stack:** Node.js 20+, TypeScript 5 (strict, ESM), Vitest. No Electron/Minecraft deps in this plan.

This is **Plan 1 of 5**. Subsequent plans: (2) java+install+launch, (3) auth, (4) Electron shell + Arknights UI, (5) packaging/distribution. Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`.

---

## File Structure

- `package.json` — scripts (`test`, `test:watch`, `typecheck`), devDeps (typescript, vitest, @types/node).
- `tsconfig.json` — strict ESM config.
- `src/core/types.ts` — shared types: `ManifestFile`, `Manifest`, `LocalFile`, `SyncPlan`, `VerifyResult`, `ManifestFetchResult`.
- `src/core/manifest.ts` — `parseManifest()` (validation).
- `src/core/manifest.test.ts`
- `src/core/hash.ts` — `sha1OfFile()` streaming hash.
- `src/core/hash.test.ts`
- `src/core/sync.ts` — `computeSyncPlan()`, `needsUpdate()`, `MANAGED_DELETE_ROOTS`.
- `src/core/sync.test.ts`
- `src/core/verify.ts` — `verifyInstance()`.
- `src/core/verify.test.ts`
- `src/core/status.ts` — `isUpToDateByVersion()`.
- `src/core/status.test.ts`
- `src/core/fetch-manifest.ts` — `fetchManifest()` (injectable fetch, ETag).
- `src/core/fetch-manifest.test.ts`

Each file has one responsibility. `types.ts` is the single source of shared type definitions; every other module imports from it.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`

- [ ] **Step 1: Initialize git and create `package.json`**

Run: `git init`

Create `package.json`:

```json
{
  "name": "pokehaven-launcher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "typescript": "^5.7.2",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node"],
    "outDir": "dist"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: completes without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 5: Verify the test runner works (no tests yet)**

Run: `npx vitest run`
Expected: exits successfully reporting "No test files found" (exit code 0 with `--passWithNoTests`). If it fails on no tests, run `npx vitest run --passWithNoTests` and add `--passWithNoTests` to the `test` script.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore
git commit -m "chore: scaffold launcher core package (ts + vitest)"
```

---

### Task 2: Shared types

**Files:**
- Create: `src/core/types.ts`

- [ ] **Step 1: Write the types file**

```ts
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
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: PASS (no output, exit code 0).

- [ ] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add shared manifest/sync types"
```

---

### Task 3: Manifest parser/validator

**Files:**
- Create: `src/core/manifest.ts`
- Test: `src/core/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/manifest.test.ts
import { describe, it, expect } from 'vitest';
import { parseManifest } from './manifest.js';

const validFile = {
  path: 'mods/Pixelmon.jar',
  sha1: 'abc123',
  size: 413000000,
  url: 'https://example.com/pixelmon.jar',
  force: true,
};

const valid = {
  packVersion: '2026.06.16',
  minecraft: '1.21.1',
  neoforge: '21.1.233',
  files: [validFile],
};

describe('parseManifest', () => {
  it('parses a valid manifest', () => {
    const m = parseManifest(valid);
    expect(m.packVersion).toBe('2026.06.16');
    expect(m.files).toHaveLength(1);
    expect(m.files[0]).toEqual(validFile);
  });

  it('rejects a non-object', () => {
    expect(() => parseManifest(null)).toThrow(/object/);
  });

  it('rejects a missing string field', () => {
    expect(() => parseManifest({ ...valid, packVersion: 123 })).toThrow(/packVersion/);
  });

  it('rejects files that is not an array', () => {
    expect(() => parseManifest({ ...valid, files: {} })).toThrow(/files/);
  });

  it('reports the index of an invalid file entry', () => {
    const bad = { ...valid, files: [validFile, { ...validFile, force: 'yes' }] };
    expect(() => parseManifest(bad)).toThrow(/files\[1\]\.force/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/manifest.test.ts`
Expected: FAIL — cannot resolve `./manifest.js` / `parseManifest` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/manifest.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/manifest.ts src/core/manifest.test.ts
git commit -m "feat(core): add validating manifest parser"
```

---

### Task 4: Streaming SHA-1 file hash

**Files:**
- Create: `src/core/hash.ts`
- Test: `src/core/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/hash.test.ts`
Expected: FAIL — `sha1OfFile` not defined.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/hash.ts
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** Streaming SHA-1 of a file, returned as lowercase hex. Rejects on read error. */
export function sha1OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/hash.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/hash.ts src/core/hash.test.ts
git commit -m "feat(core): add streaming sha1 file hash"
```

---

### Task 5: Sync plan computer (download + deletion planner)

This is the correctness-critical module. It must implement: download-if-missing, force-overwrite-on-change, preserve-unforced-existing, and deletion **only** within managed roots (the "완전 잠금 mods/" rule) — never "delete everything not in the manifest".

**Files:**
- Create: `src/core/sync.ts`
- Test: `src/core/sync.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/sync.test.ts
import { describe, it, expect } from 'vitest';
import { computeSyncPlan, needsUpdate, MANAGED_DELETE_ROOTS } from './sync.js';
import type { Manifest, LocalFile } from './types.js';

function mf(path: string, sha1: string, force: boolean) {
  return { path, sha1, size: 10, url: `https://x/${path}`, force };
}
function manifest(files: ReturnType<typeof mf>[]): Manifest {
  return { packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', files };
}
function lf(path: string, sha1: string): LocalFile {
  return { path, sha1, size: 10 };
}

describe('computeSyncPlan', () => {
  it('downloads files missing locally', () => {
    const plan = computeSyncPlan(manifest([mf('mods/a.jar', 'h1', true)]), []);
    expect(plan.toDownload.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(plan.toDelete).toEqual([]);
  });

  it('re-downloads a forced file whose hash changed', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h2', true)]),
      [lf('mods/a.jar', 'h1')],
    );
    expect(plan.toDownload.map((f) => f.path)).toEqual(['mods/a.jar']);
  });

  it('keeps a forced file whose hash matches', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1')],
    );
    expect(plan.toDownload).toEqual([]);
  });

  it('preserves an existing unforced file even when its hash differs', () => {
    const plan = computeSyncPlan(
      manifest([mf('config/sodium.json', 'h2', false)]),
      [lf('config/sodium.json', 'h1-user-edited')],
    );
    expect(plan.toDownload).toEqual([]);
  });

  it('downloads an unforced file when it is missing', () => {
    const plan = computeSyncPlan(
      manifest([mf('config/sodium.json', 'h1', false)]),
      [],
    );
    expect(plan.toDownload.map((f) => f.path)).toEqual(['config/sodium.json']);
  });

  it('deletes a local mods/ file not in the manifest (full lock)', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('mods/personal-extra.jar', 'hx')],
    );
    expect(plan.toDelete).toEqual(['mods/personal-extra.jar']);
  });

  it('never deletes files outside managed roots (e.g. user config/saves)', () => {
    const plan = computeSyncPlan(
      manifest([mf('mods/a.jar', 'h1', true)]),
      [lf('mods/a.jar', 'h1'), lf('config/orphan.toml', 'hc'), lf('saves/world/level.dat', 'hs')],
    );
    expect(plan.toDelete).toEqual([]);
  });

  it('exposes mods/ as the default managed delete root', () => {
    expect(MANAGED_DELETE_ROOTS).toEqual(['mods/']);
  });
});

describe('needsUpdate', () => {
  it('is false for an empty plan', () => {
    expect(needsUpdate({ toDownload: [], toDelete: [] })).toBe(false);
  });
  it('is true when there is anything to download', () => {
    expect(needsUpdate({ toDownload: [mf('mods/a.jar', 'h', true)], toDelete: [] })).toBe(true);
  });
  it('is true when there is anything to delete', () => {
    expect(needsUpdate({ toDownload: [], toDelete: ['mods/x.jar'] })).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/sync.test.ts`
Expected: FAIL — `./sync.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/sync.ts
import type { Manifest, LocalFile, SyncPlan } from './types.js';

/**
 * Directories that are fully owned by the modpack: any local file under these
 * roots that is absent from the manifest will be deleted. Everything else
 * (config/, saves/, options.txt, ...) is never auto-deleted.
 */
export const MANAGED_DELETE_ROOTS: readonly string[] = ['mods/'];

export function computeSyncPlan(
  manifest: Manifest,
  local: LocalFile[],
  managedDeleteRoots: readonly string[] = MANAGED_DELETE_ROOTS,
): SyncPlan {
  const localByPath = new Map(local.map((f) => [f.path, f]));
  const manifestPaths = new Set(manifest.files.map((f) => f.path));

  const toDownload = manifest.files.filter((f) => {
    const l = localByPath.get(f.path);
    if (!l) return true; // missing → always download
    if (f.force && l.sha1 !== f.sha1) return true; // server-authoritative & changed
    return false; // present and (unforced or matching) → keep
  });

  const toDelete = local
    .filter((l) => managedDeleteRoots.some((root) => l.path.startsWith(root)))
    .filter((l) => !manifestPaths.has(l.path))
    .map((l) => l.path);

  return { toDownload, toDelete };
}

export function needsUpdate(plan: SyncPlan): boolean {
  return plan.toDownload.length > 0 || plan.toDelete.length > 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/sync.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/sync.ts src/core/sync.test.ts
git commit -m "feat(core): add sync plan computer with managed-root deletion"
```

---

### Task 6: Instance verifier (verify/repair)

**Files:**
- Create: `src/core/verify.ts`
- Test: `src/core/verify.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/verify.test.ts
import { describe, it, expect } from 'vitest';
import { verifyInstance } from './verify.js';
import type { Manifest, LocalFile } from './types.js';

function mf(path: string, sha1: string, size: number) {
  return { path, sha1, size, url: `https://x/${path}`, force: true };
}
function manifest(files: ReturnType<typeof mf>[]): Manifest {
  return { packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', files };
}

describe('verifyInstance', () => {
  it('flags a missing file', () => {
    const r = verifyInstance(manifest([mf('mods/a.jar', 'h1', 10)]), []);
    expect(r.missing.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(r.corrupt).toEqual([]);
  });

  it('flags a file with the wrong hash as corrupt', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'WRONG', size: 10 }],
    );
    expect(r.corrupt.map((f) => f.path)).toEqual(['mods/a.jar']);
    expect(r.missing).toEqual([]);
  });

  it('flags a file with the wrong size as corrupt', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'h1', size: 9 }],
    );
    expect(r.corrupt.map((f) => f.path)).toEqual(['mods/a.jar']);
  });

  it('reports nothing when everything matches', () => {
    const r = verifyInstance(
      manifest([mf('mods/a.jar', 'h1', 10)]),
      [{ path: 'mods/a.jar', sha1: 'h1', size: 10 }],
    );
    expect(r.missing).toEqual([]);
    expect(r.corrupt).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/verify.test.ts`
Expected: FAIL — `./verify.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/verify.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/verify.ts src/core/verify.test.ts
git commit -m "feat(core): add instance verifier for verify/repair"
```

---

### Task 7: Version status check (fast PLAY/UPDATE pre-check)

**Files:**
- Create: `src/core/status.ts`
- Test: `src/core/status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/status.test.ts
import { describe, it, expect } from 'vitest';
import { isUpToDateByVersion } from './status.js';

describe('isUpToDateByVersion', () => {
  it('is true when local installed version equals remote', () => {
    expect(isUpToDateByVersion('2026.06.16', '2026.06.16')).toBe(true);
  });
  it('is false when versions differ', () => {
    expect(isUpToDateByVersion('2026.06.17', '2026.06.16')).toBe(false);
  });
  it('is false when nothing has been installed yet', () => {
    expect(isUpToDateByVersion('2026.06.16', null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/status.test.ts`
Expected: FAIL — `./status.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/status.ts

/**
 * Fast "are we current?" check by version label. This is a hint only; an
 * authoritative answer requires a full hash scan via computeSyncPlan. Returns
 * false when nothing is installed yet (localInstalled === null).
 */
export function isUpToDateByVersion(remote: string, localInstalled: string | null): boolean {
  return localInstalled !== null && remote === localInstalled;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/status.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/status.ts src/core/status.test.ts
git commit -m "feat(core): add fast version up-to-date check"
```

---

### Task 8: ETag-aware manifest fetcher

Network is isolated behind an injectable `fetch` so it is unit-testable and so the offline/transient-failure behavior from the spec is explicit: 304 → reuse cached manifest; non-OK → throw (caller must NOT show UPDATE on a transient 5xx).

**Files:**
- Create: `src/core/fetch-manifest.ts`
- Test: `src/core/fetch-manifest.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/fetch-manifest.test.ts`
Expected: FAIL — `./fetch-manifest.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/fetch-manifest.ts
import { parseManifest } from './manifest.js';
import type { ManifestFetchResult } from './types.js';

/**
 * Fetch and validate the remote manifest with ETag support.
 * - 304 Not Modified → { manifest: null, notModified: true, etag: <previous> }
 * - 2xx              → parsed manifest + the response ETag
 * - anything else    → throws (caller must treat as transient, NOT as "update available")
 */
export async function fetchManifest(
  url: string,
  etag: string | null,
  fetchImpl: typeof fetch = fetch,
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/fetch-manifest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/fetch-manifest.ts src/core/fetch-manifest.test.ts
git commit -m "feat(core): add etag-aware manifest fetcher"
```

---

### Task 9: Full suite + typecheck gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — all files, ~29 tests total (manifest 5, hash 2, sync 11, verify 4, status 3, fetch-manifest 4).

- [ ] **Step 2: Run the typecheck**

Run: `npm run typecheck`
Expected: PASS (no output).

- [ ] **Step 3: Commit (only if anything changed)**

```bash
git add -A
git commit -m "test: green core suite + typecheck" --allow-empty
```

---

## Self-Review

**Spec coverage (Plan 1 portion):**
- manifest schema + `force` flag → Task 2 (types), Task 3 (parse/validate). ✅
- PLAY/UPDATE judgment (fast version check + authoritative hash scan) → Task 7 (`isUpToDateByVersion`) + Task 5 (`computeSyncPlan`/`needsUpdate`). ✅
- Update sync: download changed/new, force vs preserve policy → Task 5. ✅
- Deletion safety via managed-path allowlist (not "everything not in manifest") → Task 5 (`MANAGED_DELETE_ROOTS`, explicit tests for config/saves never deleted). ✅
- Full lock of `mods/` → Task 5 (delete local mods/ files absent from manifest). ✅
- Verify/repair (size+sha1 scan) → Task 6. ✅
- ETag caching + transient-failure must-not-show-UPDATE → Task 8 (throws on non-OK; 304 reuse). ✅
- SHA-1 integrity (Mojang/Modrinth-compatible) → Task 4. ✅

**Deferred to later plans (intentionally out of scope here, not gaps):** atomic temp→rename swap, HTTP Range resume, update-in-progress marker (Plan 2, the executor that consumes `SyncPlan`); vanilla/library/asset/NeoForge install driven by `minecraft`/`neoforge` (Plan 2); auth (Plan 3); UI/IPC (Plan 4); packaging/signing (Plan 5). The `ManifestFile.url` per-file host and the `minecraft`/`neoforge` fields are defined here so Plan 2 can consume them.

**Placeholder scan:** none — every code/test step contains complete content.

**Type consistency:** `ManifestFile`, `Manifest`, `LocalFile`, `SyncPlan`, `VerifyResult`, `ManifestFetchResult` defined once in `types.ts` and imported everywhere. Function names stable across tasks: `parseManifest`, `sha1OfFile`, `computeSyncPlan`/`needsUpdate`/`MANAGED_DELETE_ROOTS`, `verifyInstance`, `isUpToDateByVersion`, `fetchManifest`. No mismatches.
