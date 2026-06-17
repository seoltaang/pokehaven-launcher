# Game Install + Launch Engine — Implementation Plan (Plan 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Java + vanilla Minecraft 1.21.1 + NeoForge into the launcher's instance directory and launch the game (offline-capable), using `@xmcl/core` + `@xmcl/installer`.

**Architecture:** Three thin `src/core` modules over `@xmcl`: `java` (reuse a local JDK or download Mojang's runtime that matches the version's required `javaVersion`), `install-game` (vanilla via `getVersionList`+`install`, then `installNeoForged` using the resolved Java), and `launch-game` (map our settings/account to `@xmcl`'s `LaunchOption` and spawn). Pure helpers (`javaExecutablePath`, `buildLaunchOption`) are unit-tested; the network/spawn-heavy wrappers are verified by a manual smoke script (multi-GB download + real JVM, not runnable in CI).

**Tech Stack:** `@xmcl/core` 2.15.1, `@xmcl/installer` 6.1.2 (already in `dependencies`), Node 20+, TypeScript strict ESM, Vitest, `tsx` (for the smoke script).

This is **Plan 4**. Builds on Plans 1–2 (`src/core` instance/sync). The mod/config sync (Plan 2) populates `instanceRoot/mods` and `instanceRoot/config`; this plan installs the game runtime into the *same* `instanceRoot` so `gamePath === resourcePath === instanceRoot`. Real account/login is Plan 5 (auth); UI wiring of the PLAY button to this engine comes later. Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`.

### API reference (verified against the installed `@xmcl` type defs)
- `getVersionList(): Promise<{ versions: { id: string; url: string }[] }>` — find the `1.21.1` entry.
- `install(versionMeta, minecraftDir): Promise<ResolvedVersion>` — installs version json + client jar + libraries + assets. `ResolvedVersion.javaVersion = { component: string; majorVersion: number }`.
- `fetchJavaRuntimeManifest({ target }): Promise<JavaRuntimeManifest>` — `target` is the `component` string (e.g. `"java-runtime-delta"`); platform auto-resolved.
- `installJavaRuntimeTask({ destination, manifest, lzma }): Task<void>` — call `.startAndWait()`.
- `resolveJava(path): Promise<JavaInfo | undefined>` (JavaInfo = `{ path, version, majorVersion }`); `scanLocalJava(paths)`, `getPotentialJavaLocations()`.
- `installNeoForged('neoforge', neoforgeVersion, minecraftDir, { java }): Promise<string>` — returns the installed version id; needs a Java executable to run installer processors.
- `launch(option: LaunchOption): Promise<ChildProcess>`; `createMinecraftProcessWatcher(proc)` emits `minecraft-window-ready` / `minecraft-exit` / `error`.
- `getPlatform(): { name: 'osx' | 'linux' | 'windows'; arch }`.

---

## File Structure
- `src/core/java.ts` (+ `java.test.ts`) — `javaExecutablePath` (pure), `findLocalJava`, `ensureJava`.
- `src/core/install-game.ts` — `installGame` (vanilla + java + neoforge).
- `src/core/launch-game.ts` (+ `launch-game.test.ts`) — `buildLaunchOption` (pure), `launchGame`, re-export watcher.
- `scripts/smoke-launch.ts` — manual end-to-end install+launch.
- `package.json` — add `tsx` devDep + `smoke:launch` script.

---

### Task 1: Java module

**Files:**
- Create: `src/core/java.ts`
- Test: `src/core/java.test.ts`

- [ ] **Step 1: Write the failing test (pure helper only)**

```ts
// src/core/java.test.ts
import { describe, it, expect } from 'vitest';
import { javaExecutablePath } from './java.js';

describe('javaExecutablePath', () => {
  it('windows uses bin/java.exe', () => {
    expect(javaExecutablePath('C:/rt/delta', 'windows')).toBe('C:/rt/delta\\bin\\java.exe');
  });
  it('linux uses bin/java', () => {
    expect(javaExecutablePath('/rt/delta', 'linux')).toBe('/rt/delta/bin/java');
  });
  it('macOS uses the jre.bundle layout', () => {
    expect(javaExecutablePath('/rt/delta', 'osx')).toBe('/rt/delta/jre.bundle/Contents/Home/bin/java');
  });
});
```

> Note: the Windows expectation uses `\\` because `node:path`'s `join` emits the host separator. If the test runs on a non-Windows host the separators differ; since this project is developed on Windows, keep `\\`. If a runner is on POSIX, replace the windows expectation with `join('C:/rt/delta','bin','java.exe')` imported from `node:path`.

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/core/java.test.ts`
Expected: FAIL — `./java.js` not found.

- [ ] **Step 3: Implement `java.ts`**

```ts
// src/core/java.ts
import { join } from 'node:path';
import {
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
  resolveJava,
  scanLocalJava,
  getPotentialJavaLocations,
} from '@xmcl/installer';
import { getPlatform } from '@xmcl/core';

/** Path to the java executable inside a Mojang runtime install `home`. */
export function javaExecutablePath(home: string, platformName: string): string {
  if (platformName === 'windows') return join(home, 'bin', 'java.exe');
  if (platformName === 'osx') return join(home, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  return join(home, 'bin', 'java');
}

/** Find an already-installed JDK/JRE on this machine matching the major version. */
export async function findLocalJava(majorVersion: number): Promise<string | undefined> {
  const locations = await getPotentialJavaLocations();
  const javas = await scanLocalJava(locations);
  return javas.find((j) => j.majorVersion === majorVersion)?.path;
}

/**
 * Ensure a Java executable for the given runtime component is available, returning
 * its path. Order: a previously-downloaded runtime → a matching system Java →
 * download Mojang's runtime for this component.
 */
export async function ensureJava(component: string, majorVersion: number, runtimeDir: string): Promise<string> {
  const platform = getPlatform();
  const dest = join(runtimeDir, component);

  const previously = javaExecutablePath(dest, platform.name);
  if (await resolveJava(previously)) return previously;

  const local = await findLocalJava(majorVersion);
  if (local) return local;

  const manifest = await fetchJavaRuntimeManifest({ target: component });
  await installJavaRuntimeTask({ destination: dest, manifest, lzma: false }).startAndWait();

  const installed = javaExecutablePath(dest, platform.name);
  if (!(await resolveJava(installed))) {
    throw new Error(`java install did not produce a runnable executable at ${installed}`);
  }
  return installed;
}
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/core/java.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/java.ts src/core/java.test.ts
git commit -m "feat(core): add java runtime resolver (reuse or download)"
```

---

### Task 2: Install module (vanilla + NeoForge)

No pure logic to unit-test here (it orchestrates network installs); correctness is verified by the smoke script in Task 4. This task creates the module and confirms it typechecks.

**Files:**
- Create: `src/core/install-game.ts`

- [ ] **Step 1: Implement `install-game.ts`**

```ts
// src/core/install-game.ts
import { getVersionList, install, installNeoForged } from '@xmcl/installer';
import type { ResolvedVersion } from '@xmcl/core';
import { ensureJava } from './java.js';

export type InstallPhase = 'vanilla' | 'java' | 'neoforge' | 'done';

export interface InstallGameOptions {
  /** Where the game (versions/libraries/assets) and mods/config live. */
  instanceRoot: string;
  /** Minecraft version, e.g. '1.21.1'. */
  minecraft: string;
  /** NeoForge version, e.g. '21.1.233'. */
  neoforge: string;
  /** Where downloaded Java runtimes are stored. */
  runtimeDir: string;
  onPhase?: (phase: InstallPhase) => void;
}

export interface InstallGameResult {
  /** The launchable version id produced by NeoForge install. */
  versionId: string;
  /** The Java executable used (and to launch with). */
  javaPath: string;
}

/**
 * Install vanilla Minecraft, ensure a matching Java, then install NeoForge.
 * Idempotent enough to re-run: @xmcl skips already-valid files.
 */
export async function installGame(options: InstallGameOptions): Promise<InstallGameResult> {
  const { instanceRoot, minecraft, neoforge, runtimeDir, onPhase } = options;

  onPhase?.('vanilla');
  const list = await getVersionList();
  const meta = list.versions.find((v) => v.id === minecraft);
  if (!meta) throw new Error(`Minecraft version not found in manifest: ${minecraft}`);
  const resolved: ResolvedVersion = await install(meta, instanceRoot);

  onPhase?.('java');
  const javaPath = await ensureJava(
    resolved.javaVersion.component,
    resolved.javaVersion.majorVersion,
    runtimeDir,
  );

  onPhase?.('neoforge');
  const versionId = await installNeoForged('neoforge', neoforge, instanceRoot, { java: javaPath });

  onPhase?.('done');
  return { versionId, javaPath };
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS (confirms the `@xmcl` signatures line up).

- [ ] **Step 3: Commit**

```bash
git add src/core/install-game.ts
git commit -m "feat(core): add game install (vanilla + java + neoforge)"
```

---

### Task 3: Launch module

**Files:**
- Create: `src/core/launch-game.ts`
- Test: `src/core/launch-game.test.ts`

- [ ] **Step 1: Write the failing test (pure builder)**

```ts
// src/core/launch-game.test.ts
import { describe, it, expect } from 'vitest';
import { buildLaunchOption } from './launch-game.js';

const base = {
  instanceRoot: '/inst',
  versionId: 'neoforge-21.1.233',
  javaPath: '/jre/bin/java',
  maxMemoryMB: 6144,
  account: { name: 'Trainer_Red', uuid: 'uuid-1', accessToken: 'tok' },
};

describe('buildLaunchOption', () => {
  it('maps instance/java/version/memory/account', () => {
    const o = buildLaunchOption(base);
    expect(o.gamePath).toBe('/inst');
    expect(o.resourcePath).toBe('/inst');
    expect(o.javaPath).toBe('/jre/bin/java');
    expect(o.version).toBe('neoforge-21.1.233');
    expect(o.maxMemory).toBe(6144);
    expect(o.gameProfile).toEqual({ name: 'Trainer_Red', id: 'uuid-1' });
    expect(o.accessToken).toBe('tok');
    expect(o.userType).toBe('mojang');
  });

  it('omits quickPlay when no server is given', () => {
    expect(buildLaunchOption(base).quickPlayMultiplayer).toBeUndefined();
  });

  it('sets quickPlayMultiplayer to ip:port when a server is given', () => {
    expect(buildLaunchOption({ ...base, server: { ip: 'play.phf.gg', port: 25577 } }).quickPlayMultiplayer)
      .toBe('play.phf.gg:25577');
  });

  it('defaults the server port to 25565', () => {
    expect(buildLaunchOption({ ...base, server: { ip: 'play.phf.gg' } }).quickPlayMultiplayer)
      .toBe('play.phf.gg:25565');
  });
});
```

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/core/launch-game.test.ts`
Expected: FAIL — `./launch-game.js` not found.

- [ ] **Step 3: Implement `launch-game.ts`**

```ts
// src/core/launch-game.ts
import type { ChildProcess } from 'node:child_process';
import { launch, createMinecraftProcessWatcher } from '@xmcl/core';
import type { LaunchOption } from '@xmcl/core';

export interface GameAccount {
  name: string;
  uuid: string;
  accessToken: string;
}

export interface LaunchParams {
  /** Instance dir (used as both gamePath and resourcePath). */
  instanceRoot: string;
  /** Launchable version id from installGame. */
  versionId: string;
  /** Java executable path. */
  javaPath: string;
  /** Max heap in MB (-Xmx). */
  maxMemoryMB: number;
  account: GameAccount;
  /** Optional direct-connect target. */
  server?: { ip: string; port?: number };
}

/** Pure mapping from our params to @xmcl's LaunchOption. */
export function buildLaunchOption(p: LaunchParams): LaunchOption {
  const option: LaunchOption = {
    gamePath: p.instanceRoot,
    resourcePath: p.instanceRoot,
    javaPath: p.javaPath,
    version: p.versionId,
    maxMemory: p.maxMemoryMB,
    gameProfile: { name: p.account.name, id: p.account.uuid },
    accessToken: p.account.accessToken,
    userType: 'mojang',
  };
  if (p.server) {
    option.quickPlayMultiplayer = `${p.server.ip}:${p.server.port ?? 25565}`;
  }
  return option;
}

/** Launch Minecraft and return the child process. */
export function launchGame(p: LaunchParams): Promise<ChildProcess> {
  return launch(buildLaunchOption(p));
}

export { createMinecraftProcessWatcher };
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/core/launch-game.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core/launch-game.ts src/core/launch-game.test.ts
git commit -m "feat(core): add launch option builder + launchGame"
```

---

### Task 4: Manual smoke script (real end-to-end)

This is the integration verification. It downloads multiple GB and starts a real JVM, so it is **manual** (not part of CI). It launches offline with a dummy profile — enough to confirm install + launch reach the Minecraft main menu.

**Files:**
- Create: `scripts/smoke-launch.ts`
- Modify: `package.json` (add `tsx` devDep + `smoke:launch` script)

- [ ] **Step 1: Add `tsx` and the script entry**

Run: `npm install -D tsx`
Then add to `package.json` scripts:
```json
    "smoke:launch": "tsx scripts/smoke-launch.ts"
```

- [ ] **Step 2: Create `scripts/smoke-launch.ts`**

```ts
// scripts/smoke-launch.ts
// Manual end-to-end: install MC 1.21.1 + NeoForge into a throwaway instance and
// launch it offline. Multi-GB download; requires a desktop session for the window.
//   npm run smoke:launch
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installGame } from '../src/core/install-game.js';
import { launchGame, createMinecraftProcessWatcher } from '../src/core/launch-game.js';

const instanceRoot = join(tmpdir(), 'phf-smoke-instance');
const runtimeDir = join(tmpdir(), 'phf-smoke-runtime');

async function main() {
  console.log('[smoke] instance:', instanceRoot);
  const { versionId, javaPath } = await installGame({
    instanceRoot,
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    runtimeDir,
    onPhase: (p) => console.log('[smoke] phase:', p),
  });
  console.log('[smoke] installed versionId:', versionId, 'java:', javaPath);

  const proc = await launchGame({
    instanceRoot,
    versionId,
    javaPath,
    maxMemoryMB: 4096,
    account: { name: 'DevTrainer', uuid: '00000000000000000000000000000001', accessToken: '0' },
  });

  const watcher = createMinecraftProcessWatcher(proc);
  watcher.on('error', (e) => console.error('[smoke] error:', e));
  watcher.on('minecraft-window-ready', () => console.log('[smoke] window ready ✅'));
  watcher.on('minecraft-exit', ({ code }) => {
    console.log('[smoke] minecraft exited code', code);
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error('[smoke] failed:', e);
  process.exit(1);
});
```

- [ ] **Step 3: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS. (Do NOT run `npm run smoke:launch` in CI/headless — it downloads GBs and opens a window. It is for manual/human verification.)

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-launch.ts package.json package-lock.json
git commit -m "chore(core): add manual install+launch smoke script"
```

---

### Task 5: Final gate

**Files:** none (verification only).

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS — core suites green plus the new pure helpers (java 3, launch-game 4 → ~68 total).

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS (node + web projects).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: electron-vite build succeeds.

- [ ] **Step 4: Commit (allow empty)**

```bash
git add -A
git commit -m "test: green game install/launch engine" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- Java 21 auto-managed (reuse local or download Mojang runtime matching the version's `javaVersion`) → Task 1 `ensureJava`. ✅ (cross-platform incl. macOS arm64 via `getPlatform` + Mojang's `mac-os-arm64` runtime, auto-resolved.)
- Vanilla + libraries + assets + NeoForge install into the instance → Task 2 `installGame` (`install` + `installNeoForged`). ✅ (addresses the reviewer's "MLC doesn't install NeoForge" blocker — `@xmcl/installer` runs the NeoForge installer.)
- Launch NeoForge 1.21.1 with RAM control + direct-connect → Task 3 `launchGame`/`buildLaunchOption` (`maxMemory`, `quickPlayMultiplayer`). ✅
- Crash/exit/window-ready signals for diagnostics → Task 3 re-exports `createMinecraftProcessWatcher` (emits `minecraft-exit` with `crashReport`). ✅
- Single-dir model: `gamePath === resourcePath === instanceRoot`, so Plan-2's synced `mods/` and `config/` are picked up at launch. ✅

**Deferred (intentionally, not gaps):** real Microsoft account (Plan 5 — the smoke script uses a dummy offline profile; `GameAccount` is shaped to accept the real one later); wiring the PLAY button/IPC to `installGame`+`launchGame` with progress in the UI (later); byte-level download progress (only coarse `onPhase` now — `@xmcl` Task progress can be layered on without API changes); resumable/parallel tuning (left to `@xmcl` defaults).

**Placeholder scan:** none — every code/test step is complete; the `@xmcl` calls use signatures verified against the installed type defs.

**Type consistency:** `InstallGameResult.{versionId,javaPath}` flow into `LaunchParams.{versionId,javaPath}`. `ResolvedVersion.javaVersion.{component,majorVersion}` feed `ensureJava(component, majorVersion, …)`. `javaExecutablePath(home, platformName)` uses `getPlatform().name` values (`'windows'|'osx'|'linux'`). `buildLaunchOption` returns a real `@xmcl/core` `LaunchOption`. Names stable across tasks.
