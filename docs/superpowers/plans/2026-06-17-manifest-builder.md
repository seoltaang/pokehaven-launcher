# Manifest Builder — Implementation Plan (Plan 7)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev/deploy tool that scans a Minecraft instance (the Modrinth `pokemon` profile) and produces a `manifest.json` (the schema the launcher consumes in Plans 1-2/6) plus a content-addressed file staging folder ready to upload to a GitHub Release — so the launcher can deliver the real Pixelmon modpack.

**Architecture:** Pure classification logic (`src/core/manifest-build.ts`: which files are managed, and force vs preserve) is unit-tested. A Node script (`scripts/build-manifest.ts`) walks the instance's managed dirs, applies the policy, computes SHA-1 + size, builds the manifest with content-addressed URLs (`<baseUrl>/<sha1>`), and (unless `--manifest-only`) copies each file to `out/manifest-stage/files/<sha1>` for upload. The launcher already decouples a file's install `path` from its download `url`, so flat sha1-named release assets restore to nested paths correctly.

**Tech Stack:** Node 20+ (`fs/promises`, `crypto`), TypeScript strict ESM, Vitest, `tsx` (already added in Plan 4). Reuses `sha1OfFile` (Plan 1) and `parseManifest` (Plan 1) for self-validation.

This is **Plan 7** (deploy tooling). Hosting decision (from the spec): full self-hosting incl. Pixelmon. GitHub Release assets allow up to 2 GB/file (Pixelmon is ~394 MB; normal repo/Pages cap at 100 MB, so Release assets are required). Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`.

---

## File Structure
- `src/core/manifest-build.ts` (+ `manifest-build.test.ts`) — `classifyFile`, `MANAGED_ROOTS`, `FORCE_FALSE_PATTERNS`, `assetUrl`.
- `scripts/build-manifest.ts` — the CLI tool.
- `package.json` — add `build:manifest` script.

---

### Task 1: Pure classification + URL logic

**Files:**
- Create: `src/core/manifest-build.ts`
- Test: `src/core/manifest-build.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/manifest-build.test.ts
import { describe, it, expect } from 'vitest';
import { classifyFile, assetUrl } from './manifest-build.js';

describe('classifyFile', () => {
  it('manages and force-syncs mods', () => {
    expect(classifyFile('mods/Pixelmon-1.21.1.jar')).toEqual({ managed: true, force: true });
  });
  it('manages and force-syncs gameplay configs by default', () => {
    expect(classifyFile('config/pixelmon/spawning.yml')).toEqual({ managed: true, force: true });
  });
  it('manages but preserves client-preference configs', () => {
    expect(classifyFile('config/iris.properties')).toEqual({ managed: true, force: false });
    expect(classifyFile('config/xaero/minimap.txt')).toEqual({ managed: true, force: false });
    expect(classifyFile('config/jei/jei-client.ini')).toEqual({ managed: true, force: false });
  });
  it('does not manage personal/world data', () => {
    expect(classifyFile('saves/world/level.dat').managed).toBe(false);
    expect(classifyFile('options.txt').managed).toBe(false);
    expect(classifyFile('screenshots/x.png').managed).toBe(false);
    expect(classifyFile('logs/latest.log').managed).toBe(false);
  });
});

describe('assetUrl', () => {
  it('joins base url and sha1 (single slash)', () => {
    expect(assetUrl('https://x/dl/', 'abc123')).toBe('https://x/dl/abc123');
    expect(assetUrl('https://x/dl', 'abc123')).toBe('https://x/dl/abc123');
  });
});
```

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/core/manifest-build.test.ts`
Expected: FAIL — `./manifest-build.js` not found.

- [ ] **Step 3: Implement `manifest-build.ts`**

```ts
// src/core/manifest-build.ts

/** Instance-relative dirs whose contents ship with the modpack (POSIX, trailing slash). */
export const MANAGED_ROOTS: readonly string[] = ['mods/', 'config/', 'kubejs/', 'defaultconfigs/'];

/**
 * Substrings of paths under config-like roots that are player preferences and must
 * be preserved across updates (installed once, never overwritten). Edit to taste.
 */
export const FORCE_FALSE_PATTERNS: readonly string[] = [
  'iris.properties',
  'sodium',
  'embeddium',
  'xaero',
  'jei/',
  'betterf3',
  'controlling',
  'mousetweaks',
  'borderless',
  'entityculling',
];

export interface FileClass {
  managed: boolean;
  force: boolean;
}

/** Decide whether an instance-relative POSIX path ships with the pack, and if forced. */
export function classifyFile(relPath: string): FileClass {
  const managed = MANAGED_ROOTS.some((root) => relPath.startsWith(root));
  if (!managed) return { managed: false, force: false };
  const preserve = FORCE_FALSE_PATTERNS.some((p) => relPath.includes(p));
  return { managed: true, force: !preserve };
}

/** Content-addressed download URL: `<baseUrl>/<sha1>` with exactly one slash. */
export function assetUrl(baseUrl: string, sha1: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${sha1}`;
}
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/core/manifest-build.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/manifest-build.ts src/core/manifest-build.test.ts
git commit -m "feat(core): add manifest-build classification + asset url"
```

---

### Task 2: The build-manifest CLI

**Files:**
- Create: `scripts/build-manifest.ts`
- Modify: `package.json` (add `build:manifest` script)

- [ ] **Step 1: Add the npm script**

Add to `package.json` scripts:
```json
    "build:manifest": "tsx scripts/build-manifest.ts"
```

- [ ] **Step 2: Create `scripts/build-manifest.ts`**

```ts
// scripts/build-manifest.ts
// Scan a Minecraft instance and emit manifest.json + content-addressed file staging.
//
//   npm run build:manifest -- --profile "<instanceDir>" --base-url "<releaseDownloadBase>" \
//       --pack-version 2026.06.17 [--mc 1.21.1] [--neoforge 21.1.233] \
//       [--out out/manifest-stage] [--manifest-only]
//
// Then create a GitHub release and upload everything in <out>/files/* as assets,
// where the release's download base equals --base-url. Point the launcher's
// MANIFEST_URL at the uploaded manifest.json.
import { readdir, stat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { sha1OfFile } from '../src/core/hash.js';
import { classifyFile, assetUrl } from '../src/core/manifest-build.js';
import { parseManifest } from '../src/core/manifest.js';
import type { Manifest, ManifestFile } from '../src/core/types.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required --${name}`);
}
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);
const toPosix = (p: string): string => p.split(sep).join('/');

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(root, full, out);
    else if (e.isFile()) out.push(toPosix(relative(root, full)));
  }
}

async function main() {
  const profile = arg('profile');
  const baseUrl = arg('base-url');
  const packVersion = arg('pack-version');
  const minecraft = arg('mc', '1.21.1');
  const neoforge = arg('neoforge', '21.1.233');
  const outDir = arg('out', 'out/manifest-stage');
  const manifestOnly = hasFlag('manifest-only');

  const all: string[] = [];
  await walk(profile, profile, all);
  const managed = all.filter((p) => classifyFile(p).managed).sort();

  const filesDir = join(outDir, 'files');
  if (!manifestOnly) await mkdir(filesDir, { recursive: true });

  const files: ManifestFile[] = [];
  let staged = 0;
  for (const path of managed) {
    const abs = join(profile, path);
    const { size } = await stat(abs);
    const sha1 = await sha1OfFile(abs);
    const { force } = classifyFile(path);
    files.push({ path, sha1, size, url: assetUrl(baseUrl, sha1), force });
    if (!manifestOnly) {
      await copyFile(abs, join(filesDir, sha1)); // content-addressed; dedupes identical files
      staged += 1;
    }
  }

  const manifest: Manifest = { packVersion, minecraft, neoforge, files };
  parseManifest(manifest); // self-validate before writing

  await mkdir(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const forced = files.filter((f) => f.force).length;
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  console.log(`[manifest] ${files.length} files (${forced} forced, ${files.length - forced} preserved)`);
  console.log(`[manifest] total ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`[manifest] wrote ${manifestPath}${manifestOnly ? ' (manifest only)' : `; staged ${staged} files in ${filesDir}`}`);
}

main().catch((e) => {
  console.error('[manifest] failed:', e);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS. (Note: `scripts/` is under the node tsconfig include via the existing config; if `scripts/build-manifest.ts` is not type-checked because it's outside `include`, that's acceptable — `tsx` runs it directly. The pure module it imports IS type-checked.)

- [ ] **Step 4: Commit**

```bash
git add scripts/build-manifest.ts package.json
git commit -m "feat(tools): add build-manifest CLI (scan profile -> manifest + staging)"
```

---

### Task 3: Verify against the real profile

This tool is fully verifiable locally (no network). Run it in `--manifest-only` mode against the real `pokemon` profile and confirm a valid manifest is produced.

**Files:** none (verification only).

- [ ] **Step 1: Run manifest-only against the Modrinth pokemon profile**

Run:
```bash
npm run build:manifest -- --profile "C:/Users/seolt/AppData/Roaming/ModrinthApp/profiles/pokemon" --base-url "https://github.com/OWNER/REPO/releases/download/v1" --pack-version 2026.06.17 --out out/manifest-stage --manifest-only
```
Expected: prints a file count (should include ~57 mods + many config files), a total size in the hundreds of MB, and writes `out/manifest-stage/manifest.json`. No error.

- [ ] **Step 2: Sanity-check the output**

Confirm `out/manifest-stage/manifest.json` exists, `packVersion`/`minecraft`/`neoforge` are set, `files[]` is non-empty, every entry has `path`/`sha1`/`size`/`url`/`force`, the Pixelmon jar appears with `force: true`, and at least one client-pref file (if present) appears with `force: false`. (Use the Read tool / a quick `node -e` to inspect counts; do not commit the generated `out/` — it is gitignored.)

- [ ] **Step 3: Full suite gate**

Run: `npm test && npm run typecheck`
Expected: PASS — `manifest-build` adds 6 → ~82 tests; typecheck clean.

- [ ] **Step 4: Commit (allow empty)**

```bash
git add -A
git commit -m "test: verify manifest builder against real profile" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- Produces the launcher's `manifest.json` schema (`packVersion`/`minecraft`/`neoforge`/`files[]` with `path`/`sha1`/`size`/`url`/`force`) → Task 2, self-validated via `parseManifest`. ✅
- Per-file `force` policy (gameplay forced, client-prefs preserved) → Task 1 `classifyFile` + `FORCE_FALSE_PATTERNS`. ✅
- Full self-hosting incl. Pixelmon, on GitHub Release assets (the only GitHub option above 100 MB) → content-addressed `<baseUrl>/<sha1>` URLs + flat `files/<sha1>` staging. ✅
- Managed-dir scope matches the launcher's sync (mods/config; never saves/options/screenshots/logs) → `MANAGED_ROOTS` + `classifyFile`. ✅

**Deferred (intentionally):** actually creating/uploading the GitHub release (the user does this with the staged files); auto-resolving official CDN URLs for redistributable mods (the spec chose full self-host, so all files are staged); tuning `FORCE_FALSE_PATTERNS` to the exact pack (editable constant with a sensible starter set — flagged for the user to review).

**Placeholder scan:** the `--base-url` `OWNER/REPO` in the run command is a documented value the user fills; no code placeholders. All steps have complete code.

**Type consistency:** emits `Manifest`/`ManifestFile` from `src/core/types.ts` (the exact types the launcher consumes), validated by Plan 1's `parseManifest`. `classifyFile`'s `force` flows into `ManifestFile.force`; `MANAGED_ROOTS` here is a superset of the launcher's `sync.MANAGED_DELETE_ROOTS` (`['mods/']`) — intentional: the builder ships config too, while the launcher only auto-deletes orphans under `mods/`.
