# Update Executor — Implementation Plan (Plan 2 of N)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a `SyncPlan` (from Plan 1) into actual on-disk changes: resumable verified downloads, safe deletions, an interrupted-update marker, and a persisted installed version — atomically and testably.

**Architecture:** Pure-Node modules layered on Plan 1's `src/core`. `install-state` persists the installed `packVersion` and an "update in progress" lock. `downloader` fetches one file with HTTP Range resume, verifies size+SHA-1, and atomically renames `.part` → final. `scan-instance` walks the instance to produce `LocalFile[]` for `computeSyncPlan`. `apply-plan` orchestrates: set marker → download all → delete orphans last → write version → clear marker, emitting progress. Network and the per-file downloader are injected so all orchestration logic is unit-tested with fakes.

**Tech Stack:** Node.js 20+ (`node:fs/promises`, global `fetch`/`Response`, web `ReadableStream` async iteration), TypeScript 5 strict ESM, Vitest. No Electron, no `@xmcl`, no Minecraft.

This is **Plan 2**. It builds on Plan 1 (`docs/superpowers/plans/2026-06-16-launcher-core-sync.md`) and reuses `sha1OfFile`, `computeSyncPlan`, types. Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`. The `@xmcl`-based java/install/launch is a later plan.

---

### Task 1: Shared `FetchFn` type (DRY)

Both `fetch-manifest.ts` and the new `downloader.ts` need an injectable fetch whose narrowed signature avoids the `typeof fetch` overload-contravariance error. Lift it into `types.ts`.

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/fetch-manifest.ts`

- [ ] **Step 1: Add `FetchFn` to `types.ts`**

Append to `src/core/types.ts`:

```ts
/**
 * Narrowed fetch signature for dependency injection. `globalThis.fetch`
 * satisfies it; using this instead of `typeof fetch` avoids the overloaded
 * `URL | RequestInfo` parameter that breaks assignability of test fakes.
 */
export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;
```

- [ ] **Step 2: Use the shared type in `fetch-manifest.ts`**

In `src/core/fetch-manifest.ts`, delete the local `type FetchFn = ...` line and import the shared one. The import line becomes:

```ts
import { parseManifest } from './manifest.js';
import type { ManifestFetchResult, FetchFn } from './types.js';
```

and the function signature keeps using `FetchFn`:

```ts
export async function fetchManifest(
  url: string,
  etag: string | null,
  fetchImpl: FetchFn = fetch,
): Promise<ManifestFetchResult> {
```

(Leave the function body unchanged.)

- [ ] **Step 3: Run the existing suite to confirm no regression**

Run: `npm test`
Expected: PASS — still 31 tests, all green.

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no output).

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/fetch-manifest.ts
git commit -m "refactor(core): share FetchFn type across fetch + download"
```

---

### Task 2: Install state (version + in-progress marker)

**Files:**
- Create: `src/core/install-state.ts`
- Test: `src/core/install-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/install-state.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readInstallState,
  writeInstalledVersion,
  markUpdateInProgress,
  clearUpdateInProgress,
  isUpdateInProgress,
} from './install-state.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-state-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('install-state', () => {
  it('reports null version for a fresh instance', async () => {
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('persists and reads back an installed version', async () => {
    await writeInstalledVersion(dir, '2026.06.16');
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.16' });
  });

  it('treats a corrupt state file as not installed', async () => {
    await writeInstalledVersion(dir, '2026.06.16');
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(dir, '.phf-state.json'), 'not json{');
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('sets and clears the update-in-progress marker', async () => {
    expect(await isUpdateInProgress(dir)).toBe(false);
    await markUpdateInProgress(dir, '2026.06.17');
    expect(await isUpdateInProgress(dir)).toBe(true);
    await clearUpdateInProgress(dir);
    expect(await isUpdateInProgress(dir)).toBe(false);
  });

  it('clearing a non-existent marker does not throw', async () => {
    await expect(clearUpdateInProgress(dir)).resolves.toBeUndefined();
  });

  it('creates the instance dir if missing when writing', async () => {
    const nested = join(dir, 'does', 'not', 'exist');
    await writeInstalledVersion(nested, 'v1');
    expect(await readInstallState(nested)).toEqual({ packVersion: 'v1' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/install-state.test.ts`
Expected: FAIL — `./install-state.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/core/install-state.ts
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const STATE_FILE = '.phf-state.json';
const LOCK_FILE = '.phf-update.lock';

export interface InstallState {
  /** The packVersion currently installed, or null if none/corrupt. */
  packVersion: string | null;
}

export async function readInstallState(instanceRoot: string): Promise<InstallState> {
  try {
    const raw = await readFile(join(instanceRoot, STATE_FILE), 'utf8');
    const parsed = JSON.parse(raw) as { packVersion?: unknown };
    return { packVersion: typeof parsed.packVersion === 'string' ? parsed.packVersion : null };
  } catch {
    return { packVersion: null };
  }
}

export async function writeInstalledVersion(instanceRoot: string, packVersion: string): Promise<void> {
  await mkdir(instanceRoot, { recursive: true });
  await writeFile(join(instanceRoot, STATE_FILE), JSON.stringify({ packVersion }, null, 2), 'utf8');
}

export async function markUpdateInProgress(instanceRoot: string, targetVersion: string): Promise<void> {
  await mkdir(instanceRoot, { recursive: true });
  await writeFile(join(instanceRoot, LOCK_FILE), targetVersion, 'utf8');
}

export async function clearUpdateInProgress(instanceRoot: string): Promise<void> {
  await rm(join(instanceRoot, LOCK_FILE), { force: true });
}

export async function isUpdateInProgress(instanceRoot: string): Promise<boolean> {
  try {
    await readFile(join(instanceRoot, LOCK_FILE), 'utf8');
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/install-state.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/install-state.ts src/core/install-state.test.ts
git commit -m "feat(core): add install-state (version + in-progress marker)"
```

---

### Task 3: Resumable verified downloader

Downloads one manifest file: resumes a partial `.part` via HTTP Range, verifies size then SHA-1, and atomically renames into place. Network is injected via `FetchFn`.

**Files:**
- Create: `src/core/downloader.ts`
- Test: `src/core/downloader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/downloader.test.ts`
Expected: FAIL — `./downloader.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/downloader.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/downloader.ts src/core/downloader.test.ts
git commit -m "feat(core): add resumable verified file downloader"
```

---

### Task 4: Instance scanner (disk → LocalFile[])

Produces the `LocalFile[]` that `computeSyncPlan` needs: every file under the managed delete roots (to find orphans) plus every manifest path that exists. Paths are normalized to POSIX (`/`) to match the manifest.

**Files:**
- Create: `src/core/scan-instance.ts`
- Test: `src/core/scan-instance.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/scan-instance.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanInstance } from './scan-instance.js';
import type { Manifest } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-scan-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}
function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}
function manifest(paths: string[]): Manifest {
  return {
    packVersion: 'v',
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    files: paths.map((p) => ({ path: p, sha1: 'x', size: 0, url: 'u', force: true })),
  };
}

describe('scanInstance', () => {
  it('returns files under managed roots and existing manifest paths, with sha1/size', async () => {
    write('mods/a.jar', 'AAAA');
    write('mods/sub/b.jar', 'BB');
    write('config/x.toml', 'CCC');
    write('saves/world/level.dat', 'DDDDD'); // not managed, not in manifest → excluded

    const m = manifest(['mods/a.jar', 'config/x.toml', 'mods/missing.jar']);
    const result = await scanInstance(dir, m, ['mods/']);
    const byPath = new Map(result.map((f) => [f.path, f]));

    // mods/ files (managed root) — recursive
    expect(byPath.get('mods/a.jar')).toEqual({ path: 'mods/a.jar', sha1: sha1('AAAA'), size: 4 });
    expect(byPath.get('mods/sub/b.jar')).toEqual({ path: 'mods/sub/b.jar', sha1: sha1('BB'), size: 2 });
    // config/x.toml included because it is a manifest path that exists
    expect(byPath.get('config/x.toml')).toEqual({ path: 'config/x.toml', sha1: sha1('CCC'), size: 3 });
    // excluded
    expect(byPath.has('saves/world/level.dat')).toBe(false);
    expect(byPath.has('mods/missing.jar')).toBe(false); // in manifest but absent on disk
  });

  it('returns empty for an empty instance', async () => {
    const result = await scanInstance(dir, manifest(['mods/a.jar']), ['mods/']);
    expect(result).toEqual([]);
  });

  it('tolerates a missing managed root directory', async () => {
    write('config/x.toml', 'C');
    const result = await scanInstance(dir, manifest(['config/x.toml']), ['mods/']);
    expect(result.map((f) => f.path)).toEqual(['config/x.toml']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/scan-instance.test.ts`
Expected: FAIL — `./scan-instance.js` not found.

- [ ] **Step 3: Write minimal implementation**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/scan-instance.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/scan-instance.ts src/core/scan-instance.test.ts
git commit -m "feat(core): add instance scanner (disk to LocalFile[])"
```

---

### Task 5: Apply-plan orchestrator

Applies a `SyncPlan` with the correct ordering and crash-safety guarantees: set marker first, download everything, delete orphans **last**, then persist the version and clear the marker. The per-file downloader is injected so this logic is fully unit-tested with fakes.

**Files:**
- Create: `src/core/apply-plan.ts`
- Test: `src/core/apply-plan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/apply-plan.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applySyncPlan } from './apply-plan.js';
import { readInstallState, isUpdateInProgress } from './install-state.js';
import type { SyncPlan, ManifestFile, ProgressEvent } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-apply-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function mf(path: string): ManifestFile {
  return { path, sha1: 'h', size: 1, url: `https://x/${path}`, force: true };
}
// Fake downloader: writes the dest file directly (stands in for a verified download).
function fakeDownload(order: string[]) {
  return async (file: ManifestFile, destPath: string): Promise<void> => {
    order.push(`download:${file.path}`);
    mkdirSync(join(destPath, '..'), { recursive: true });
    writeFileSync(destPath, file.path);
  };
}

describe('applySyncPlan', () => {
  it('downloads before deleting, writes version, and clears the marker', async () => {
    const order: string[] = [];
    // Pre-existing orphan to be deleted.
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(join(dir, 'mods/old.jar'), 'old');

    const plan: SyncPlan = { toDownload: [mf('mods/new.jar')], toDelete: ['mods/old.jar'] };
    const events: ProgressEvent[] = [];
    await applySyncPlan(dir, plan, '2026.06.17', {
      download: fakeDownload(order),
      onProgress: (e) => events.push(e),
    });

    // Ordering: every download happens before every delete.
    expect(order).toEqual(['download:mods/new.jar']);
    expect(existsSync(join(dir, 'mods/new.jar'))).toBe(true);
    expect(existsSync(join(dir, 'mods/old.jar'))).toBe(false);
    // Version persisted, marker cleared.
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.17' });
    expect(await isUpdateInProgress(dir)).toBe(false);
    // Progress ends with a 'done' phase.
    expect(events.at(-1)?.phase).toBe('done');
  });

  it('emits a delete event only after download events', async () => {
    const phases: string[] = [];
    const plan: SyncPlan = { toDownload: [mf('mods/a.jar')], toDelete: ['mods/x.jar'] };
    mkdirSync(join(dir, 'mods'), { recursive: true });
    writeFileSync(join(dir, 'mods/x.jar'), 'x');
    await applySyncPlan(dir, plan, 'v', {
      download: async (_f, dest) => { mkdirSync(join(dest, '..'), { recursive: true }); writeFileSync(dest, '.'); },
      onProgress: (e) => phases.push(e.phase),
    });
    const firstDelete = phases.indexOf('delete');
    const lastDownload = phases.lastIndexOf('download');
    expect(lastDownload).toBeGreaterThanOrEqual(0);
    expect(firstDelete).toBeGreaterThan(lastDownload);
  });

  it('leaves the marker set and version unwritten if a download fails', async () => {
    const plan: SyncPlan = { toDownload: [mf('mods/a.jar'), mf('mods/b.jar')], toDelete: [] };
    let calls = 0;
    const failingDownload = async (file: ManifestFile, destPath: string): Promise<void> => {
      calls += 1;
      if (file.path === 'mods/b.jar') throw new Error('network boom');
      mkdirSync(join(destPath, '..'), { recursive: true });
      writeFileSync(destPath, file.path);
    };

    await expect(
      applySyncPlan(dir, plan, '2026.06.17', { download: failingDownload }),
    ).rejects.toThrow(/network boom/);

    expect(calls).toBe(2);
    // First file landed, but the update is NOT marked complete.
    expect(existsSync(join(dir, 'mods/a.jar'))).toBe(true);
    expect(await isUpdateInProgress(dir)).toBe(true);
    expect(await readInstallState(dir)).toEqual({ packVersion: null });
  });

  it('handles an empty plan as a clean no-op install (version written)', async () => {
    await applySyncPlan(dir, { toDownload: [], toDelete: [] }, 'v1', {
      download: async () => { throw new Error('should not be called'); },
    });
    expect(await readInstallState(dir)).toEqual({ packVersion: 'v1' });
    expect(await isUpdateInProgress(dir)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/apply-plan.test.ts`
Expected: FAIL — `./apply-plan.js` not found (and `ProgressEvent` not exported from types yet).

- [ ] **Step 3: Add `ProgressEvent` to `types.ts`**

Append to `src/core/types.ts`:

```ts
/** Progress emitted while applying a SyncPlan. */
export interface ProgressEvent {
  phase: 'download' | 'delete' | 'done';
  /** Files downloaded so far. */
  completedFiles: number;
  /** Total files to download in this plan. */
  totalFiles: number;
  /** Instance-relative path currently being processed (omitted for 'done'). */
  currentPath?: string;
}
```

- [ ] **Step 4: Write minimal implementation**

```ts
// src/core/apply-plan.ts
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { SyncPlan, ManifestFile, ProgressEvent } from './types.js';
import { markUpdateInProgress, clearUpdateInProgress, writeInstalledVersion } from './install-state.js';

/** Downloads one file to an absolute destination path (verified + atomic). */
export type FileDownloader = (file: ManifestFile, destPath: string) => Promise<void>;

export interface ApplyPlanDeps {
  download: FileDownloader;
  onProgress?: (event: ProgressEvent) => void;
}

/**
 * Apply a SyncPlan to the instance, crash-safely:
 *  1. mark update-in-progress (so an interrupted run is detectable),
 *  2. download every file (each is verified + atomically placed by `download`),
 *  3. delete orphans LAST (never before downloads succeed),
 *  4. persist the installed version,
 *  5. clear the marker.
 * If any download throws, the marker stays set and the version is not written.
 */
export async function applySyncPlan(
  instanceRoot: string,
  plan: SyncPlan,
  targetVersion: string,
  deps: ApplyPlanDeps,
): Promise<void> {
  const totalFiles = plan.toDownload.length;
  await markUpdateInProgress(instanceRoot, targetVersion);

  let completed = 0;
  for (const file of plan.toDownload) {
    deps.onProgress?.({ phase: 'download', completedFiles: completed, totalFiles, currentPath: file.path });
    await deps.download(file, join(instanceRoot, file.path));
    completed += 1;
  }

  for (const relPath of plan.toDelete) {
    deps.onProgress?.({ phase: 'delete', completedFiles: completed, totalFiles, currentPath: relPath });
    await rm(join(instanceRoot, relPath), { force: true });
  }

  await writeInstalledVersion(instanceRoot, targetVersion);
  await clearUpdateInProgress(instanceRoot);
  deps.onProgress?.({ phase: 'done', completedFiles: completed, totalFiles });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/core/apply-plan.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/types.ts src/core/apply-plan.ts src/core/apply-plan.test.ts
git commit -m "feat(core): add crash-safe apply-plan orchestrator"
```

---

### Task 6: End-to-end pipeline integration test

Proves the real pieces compose: scan a populated instance → `computeSyncPlan` (Plan 1) → `applySyncPlan` with a fake downloader → instance now matches the manifest, version recorded.

**Files:**
- Test: `src/core/pipeline.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// src/core/pipeline.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanInstance } from './scan-instance.js';
import { computeSyncPlan, MANAGED_DELETE_ROOTS } from './sync.js';
import { applySyncPlan } from './apply-plan.js';
import { readInstallState } from './install-state.js';
import type { Manifest, ManifestFile } from './types.js';

let dir: string;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'phf-pipe-')); });
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function sha1(s: string): string {
  return createHash('sha1').update(s).digest('hex');
}
function write(rel: string, content: string) {
  const full = join(dir, rel);
  mkdirSync(join(full, '..'), { recursive: true });
  writeFileSync(full, content);
}
// Content-addressed fake downloader: the manifest url encodes the desired content.
function file(path: string, content: string, force = true): ManifestFile {
  return { path, sha1: sha1(content), size: content.length, url: `data:${content}`, force };
}
const fakeDownload = async (f: ManifestFile, dest: string): Promise<void> => {
  const content = f.url.slice('data:'.length);
  mkdirSync(join(dest, '..'), { recursive: true });
  writeFileSync(dest, content);
};

describe('scan -> computeSyncPlan -> applySyncPlan', () => {
  it('reconciles a drifted instance to exactly match the manifest', async () => {
    // Local state: a.jar is outdated, orphan.jar should be removed,
    // user config sodium.json should be preserved, b.jar is missing.
    write('mods/a.jar', 'OLD-A');
    write('mods/orphan.jar', 'REMOVE-ME');
    write('config/sodium.json', 'USER-EDITED');

    const manifest: Manifest = {
      packVersion: '2026.06.17',
      minecraft: '1.21.1',
      neoforge: '21.1.233',
      files: [
        file('mods/a.jar', 'NEW-A', true),
        file('mods/b.jar', 'NEW-B', true),
        file('config/sodium.json', 'DEFAULT-SODIUM', false), // unforced → preserve existing
      ],
    };

    const local = await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS);
    const plan = computeSyncPlan(manifest, local);
    await applySyncPlan(dir, plan, manifest.packVersion, { download: fakeDownload });

    // Forced file updated to new content.
    expect(readFileSync(join(dir, 'mods/a.jar'), 'utf8')).toBe('NEW-A');
    // Missing forced file downloaded.
    expect(readFileSync(join(dir, 'mods/b.jar'), 'utf8')).toBe('NEW-B');
    // Orphan in managed root removed.
    expect(existsSync(join(dir, 'mods/orphan.jar'))).toBe(false);
    // Unforced existing user file preserved (NOT overwritten).
    expect(readFileSync(join(dir, 'config/sodium.json'), 'utf8')).toBe('USER-EDITED');
    // Version recorded.
    expect(await readInstallState(dir)).toEqual({ packVersion: '2026.06.17' });
  });

  it('a second run is a no-op (already up to date, nothing downloaded)', async () => {
    const manifest: Manifest = {
      packVersion: 'v2',
      minecraft: '1.21.1',
      neoforge: '21.1.233',
      files: [file('mods/a.jar', 'A', true)],
    };
    // First run installs.
    let plan = computeSyncPlan(manifest, await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS));
    await applySyncPlan(dir, plan, manifest.packVersion, { download: fakeDownload });

    // Second run: recompute against current disk → empty plan.
    plan = computeSyncPlan(manifest, await scanInstance(dir, manifest, MANAGED_DELETE_ROOTS));
    expect(plan.toDownload).toEqual([]);
    expect(plan.toDelete).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `npx vitest run src/core/pipeline.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add src/core/pipeline.test.ts
git commit -m "test(core): end-to-end scan/plan/apply pipeline"
```

---

### Task 7: Full suite + typecheck gate

**Files:** none (verification only).

- [ ] **Step 1: Run the whole test suite**

Run: `npm test`
Expected: PASS — 11 test files, ~52 tests total (Plan 1: 31; Plan 2 adds install-state 6, downloader 6, scan-instance 3, apply-plan 4, pipeline 2 = 21).

- [ ] **Step 2: Run the typecheck**

Run: `npm run typecheck`
Expected: PASS (no output).

- [ ] **Step 3: Commit (allow empty)**

```bash
git add -A
git commit -m "test: green update-executor suite + typecheck" --allow-empty
```

---

## Self-Review

**Spec coverage (Plan 2 portion):**
- Update atomicity (temp → verify → atomic rename) → Task 3 `downloadVerified` (`.part` + rename, verify-before-rename). ✅
- HTTP Range resume for big files → Task 3 (resume + server-ignores-Range fallback tests). ✅
- "update-in-progress" marker to detect/resume interrupted updates → Task 2 + Task 5 (marker set first, cleared only on success; failure test proves it persists). ✅
- Deletion last, managed-root scope honored → Task 5 (downloads before deletes) + Task 4/6 (scan only managed roots + manifest paths; `computeSyncPlan` from Plan 1 enforces scope). ✅
- force vs preserve applied on real disk → Task 6 integration (forced updated, unforced preserved). ✅
- Persisted installed version for the fast PLAY/UPDATE check → Task 2 `writeInstalledVersion` / `readInstallState` (consumed by Plan 1's `isUpToDateByVersion`). ✅
- Progress reporting for UI → Task 3 `onProgress` + Task 5 `ProgressEvent`. ✅
- Verify/repair reuse: `scanInstance` + `verifyInstance` (Plan 1) + `computeSyncPlan` + `applySyncPlan` compose into repair; no new code needed. ✅

**Deferred (intentionally, not gaps):** wiring `downloadVerified` into `applySyncPlan` via a closure adapter, plus `fetchManifest`→`computeSyncPlan` glue, belongs to the app/IPC layer (later plan). Java/vanilla/NeoForge install + launch (@xmcl) is a separate plan. Retry/backoff policy and parallel downloads are deliberately out of scope for this executor (YAGNI for v1 correctness; can wrap `download` later without changing `applySyncPlan`).

**Placeholder scan:** none — every code/test step is complete.

**Type consistency:** `FetchFn` and `ProgressEvent` added to `types.ts` and imported where used. `ManifestFile`/`SyncPlan`/`LocalFile`/`Manifest` reused from Plan 1 unchanged. Names stable: `downloadVerified`, `DownloadOptions`, `ProgressFn`; `scanInstance`; `applySyncPlan`, `FileDownloader`, `ApplyPlanDeps`; `readInstallState`, `writeInstalledVersion`, `markUpdateInProgress`, `clearUpdateInProgress`, `isUpdateInProgress`. The fake `download` in Task 5/6 matches the `FileDownloader` signature `(file, destPath) => Promise<void>`.
