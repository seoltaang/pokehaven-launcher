# Capstone — Wire the PLAY Button (Plan 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the launcher actually work end-to-end: on the logged-in main screen the button reflects real state (PLAY / UPDATE), and pressing it runs the real pipeline — fetch manifest → sync changed mods/config (Plan 1-2) → ensure game installed (Plan 4) → launch with the signed-in account (Plan 5) — with progress and state surfaced to the UI, plus persisted RAM / direct-connect settings.

**Architecture:** A main-process `launcher-service` orchestrates the existing core/auth/install modules and is the single owner of launcher state. Config (paths, MC/NeoForge versions, optional manifest URL, server) lives in `src/main/config.ts`. Two small JSON stores in `userData` persist Settings and the install state (`gameVersionId`, `packVersion`). The pure `deriveLaunchState` decides the button state and is unit-tested. IPC exposes `launcher:status` / `launcher:playOrUpdate` / `settings:get` / `settings:set` and pushes `launcher:progress` + `launcher:state` events; the renderer reacts. Mod sync is **conditional on a configured manifest URL** (unset → skipped), so install→launch works today and mod sync activates once a manifest is published.

**Tech Stack:** Builds on Plans 1-5 (`@xmcl`, `msmc`, core sync/downloader/scan, auth). Electron main + IPC, Svelte renderer, TypeScript strict ESM, Vitest.

This is **Plan 6** (capstone). Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`. After this, remaining work is deployment: generate + host the real `manifest.json` (separate task) and fill the real server address.

---

## File Structure
- `src/core/launch-state.ts` (+ `launch-state.test.ts`) — pure `deriveLaunchState`.
- `src/main/config.ts` — paths, versions, manifest URL, server (constants).
- `src/main/settings-store.ts` — load/save `Settings`.
- `src/main/launcher-state.ts` — load/save `{ gameVersionId?, packVersion? }`.
- `src/main/launcher-service.ts` — `getStatus`, `playOrUpdate` (sync+install or launch), progress emit.
- `src/main/index.ts` — IPC handlers + wire service to a window (modify).
- `src/preload/index.ts` — real `getStatus`/`playOrUpdate`/`getSettings`/`setSettings` + `onProgress`/`onState` (modify).
- `src/shared/ipc.ts` — add `onProgress`/`onStateChange` to `LauncherApi` (modify).
- `src/renderer/src/App.svelte` — subscribe to progress/state, drive flow (modify).
- `src/renderer/src/screens/Main.svelte` — use real progress (modify).

---

### Task 1: Pure launch-state logic

**Files:**
- Create: `src/core/launch-state.ts`
- Test: `src/core/launch-state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/launch-state.test.ts
import { describe, it, expect } from 'vitest';
import { deriveLaunchState } from './launch-state.js';

describe('deriveLaunchState', () => {
  it('is logged-out when not authenticated', () => {
    expect(deriveLaunchState({ loggedIn: false, installed: true, syncNeeded: false })).toBe('logged-out');
  });
  it('needs update when not installed yet', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: false, syncNeeded: false })).toBe('update-available');
  });
  it('needs update when a mod sync is pending', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: true, syncNeeded: true })).toBe('update-available');
  });
  it('is ready to play when installed and in sync', () => {
    expect(deriveLaunchState({ loggedIn: true, installed: true, syncNeeded: false })).toBe('play');
  });
});
```

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/core/launch-state.test.ts`
Expected: FAIL — `./launch-state.js` not found.

- [ ] **Step 3: Implement `launch-state.ts`**

```ts
// src/core/launch-state.ts
import type { LaunchState } from '../shared/ipc.js';

export interface StateInputs {
  loggedIn: boolean;
  installed: boolean;
  syncNeeded: boolean;
}

/** Decide the main action-button state. 'updating'/'launching' are set transiently by the service. */
export function deriveLaunchState(i: StateInputs): LaunchState {
  if (!i.loggedIn) return 'logged-out';
  if (!i.installed || i.syncNeeded) return 'update-available';
  return 'play';
}
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/core/launch-state.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/launch-state.ts src/core/launch-state.test.ts
git commit -m "feat(core): add deriveLaunchState"
```

---

### Task 2: Config

**Files:**
- Create: `src/main/config.ts`

- [ ] **Step 1: Implement `config.ts`**

```ts
// src/main/config.ts
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

/** Instance dir: game files (versions/libraries/assets) + mods/config live here. */
export function instanceDir(): string {
  return join(app.getPath('userData'), 'instance');
}

/** Where downloaded Java runtimes are stored. */
export function runtimeDir(): string {
  return join(app.getPath('userData'), 'runtime');
}

export const MINECRAFT_VERSION = '1.21.1';
export const NEOFORGE_VERSION = '21.1.233';

/**
 * Remote modpack manifest URL. Leave empty until the GitHub manifest is published —
 * while empty, mod sync is skipped (install + launch still work).
 */
export const MANIFEST_URL = '';

/** PokeHaven Frontier server for direct-connect. Replace host with the real address. */
export const SERVER = { ip: 'play.pokehaven.example', port: 25565 };
```

- [ ] **Step 2: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/main/config.ts
git commit -m "feat(main): add launcher config (paths/versions/manifest/server)"
```

---

### Task 3: Settings + launcher state stores

**Files:**
- Create: `src/main/settings-store.ts`
- Create: `src/main/launcher-state.ts`

- [ ] **Step 1: Implement `settings-store.ts`**

```ts
// src/main/settings-store.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { Settings } from '../shared/ipc.js';
import { instanceDir } from './config.js';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

function file(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function defaults(): Settings {
  return { ramMB: 6144, directConnect: true, instanceDir: instanceDir() };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const parsed = JSON.parse(await readFile(file(), 'utf8')) as Partial<Settings>;
    return { ...defaults(), ...parsed, instanceDir: instanceDir() };
  } catch {
    return defaults();
  }
}

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch, instanceDir: instanceDir() };
  const f = file();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
```

- [ ] **Step 2: Implement `launcher-state.ts`**

```ts
// src/main/launcher-state.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { app } = require('electron') as typeof import('electron');

export interface LauncherState {
  /** The launchable version id from the last successful install (NeoForge id). */
  gameVersionId?: string;
  /** The modpack packVersion currently applied. */
  packVersion?: string;
}

function file(): string {
  return join(app.getPath('userData'), 'launcher-state.json');
}

export async function loadState(): Promise<LauncherState> {
  try {
    return JSON.parse(await readFile(file(), 'utf8')) as LauncherState;
  } catch {
    return {};
  }
}

export async function saveState(patch: Partial<LauncherState>): Promise<LauncherState> {
  const next = { ...(await loadState()), ...patch };
  const f = file();
  await mkdir(dirname(f), { recursive: true });
  await writeFile(f, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
```

- [ ] **Step 3: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/main/settings-store.ts src/main/launcher-state.ts
git commit -m "feat(main): add settings + launcher-state stores"
```

---

### Task 4: Launcher service (orchestration)

**Files:**
- Create: `src/main/launcher-service.ts`

- [ ] **Step 1: Implement `launcher-service.ts`**

```ts
// src/main/launcher-service.ts
import type { LauncherStatus, Progress } from '../shared/ipc.js';
import { fetchManifest } from '../core/fetch-manifest.js';
import { scanInstance } from '../core/scan-instance.js';
import { computeSyncPlan, needsUpdate, MANAGED_DELETE_ROOTS } from '../core/sync.js';
import { applySyncPlan } from '../core/apply-plan.js';
import { downloadVerified } from '../core/downloader.js';
import { installGame } from '../core/install-game.js';
import { launchGame, createMinecraftProcessWatcher } from '../core/launch-game.js';
import { deriveLaunchState } from '../core/launch-state.js';
import type { Manifest } from '../core/types.js';
import { getCurrentAccount, getGameAccount } from './auth.js';
import { loadSettings } from './settings-store.js';
import { loadState, saveState } from './launcher-state.js';
import {
  instanceDir, runtimeDir, MINECRAFT_VERSION, NEOFORGE_VERSION, MANIFEST_URL, SERVER,
} from './config.js';

export type ProgressSink = (p: Progress) => void;
export type StateSink = (state: LauncherStatus['state']) => void;

let etag: string | null = null;
let cachedManifest: Manifest | null = null;

async function fetchPackManifest(): Promise<Manifest | null> {
  if (!MANIFEST_URL) return null;
  try {
    const res = await fetchManifest(MANIFEST_URL, etag);
    if (res.notModified) return cachedManifest;
    etag = res.etag;
    cachedManifest = res.manifest;
    return res.manifest;
  } catch {
    // transient/offline: do not force an update on a fetch failure
    return cachedManifest;
  }
}

async function computeSyncNeeded(manifest: Manifest | null): Promise<boolean> {
  if (!manifest) return false;
  const local = await scanInstance(instanceDir(), manifest, MANAGED_DELETE_ROOTS);
  return needsUpdate(computeSyncPlan(manifest, local));
}

/** Build the current status for the UI. */
export async function getStatus(): Promise<LauncherStatus> {
  const account = getCurrentAccount();
  const state0 = await loadState();
  const manifest = await fetchPackManifest();
  const installed = Boolean(state0.gameVersionId);
  const syncNeeded = await computeSyncNeeded(manifest);
  return {
    state: deriveLaunchState({ loggedIn: account.loggedIn, installed, syncNeeded }),
    packVersion: manifest?.packVersion ?? state0.packVersion ?? '—',
    minecraft: MINECRAFT_VERSION,
    neoforge: NEOFORGE_VERSION,
    online: manifest !== null || installed,
  };
}

/**
 * Single button action. When an update is needed, sync mods + (re)install and
 * record state. When already in sync, launch the game with the signed-in account.
 */
export async function playOrUpdate(onProgress: ProgressSink, onState: StateSink): Promise<void> {
  const status = await getStatus();

  if (status.state === 'update-available') {
    onState('updating');
    const manifest = await fetchPackManifest();

    // 1) sync mods/config if a manifest is configured
    if (manifest) {
      const local = await scanInstance(instanceDir(), manifest, MANAGED_DELETE_ROOTS);
      const plan = computeSyncPlan(manifest, local);
      const total = plan.toDownload.length || 1;
      await applySyncPlan(instanceDir(), plan, manifest.packVersion, {
        download: (f, dest) => downloadVerified(f, dest, {}),
        onProgress: (e) => onProgress({ fraction: e.completedFiles / total, currentFile: e.currentPath ?? '' }),
      });
    }

    // 2) ensure Java + vanilla + NeoForge installed
    const phaseFraction: Record<string, number> = { vanilla: 0.3, java: 0.6, neoforge: 0.8, done: 1 };
    const { versionId } = await installGame({
      instanceRoot: instanceDir(),
      minecraft: MINECRAFT_VERSION,
      neoforge: NEOFORGE_VERSION,
      runtimeDir: runtimeDir(),
      onPhase: (p) => onProgress({ fraction: phaseFraction[p] ?? 0, currentFile: `installing: ${p}` }),
    });

    await saveState({ gameVersionId: versionId, packVersion: manifest?.packVersion });
    onState('play');
    return;
  }

  if (status.state === 'play') {
    const account = getGameAccount();
    if (!account) {
      onState('logged-out');
      return;
    }
    const state = await loadState();
    if (!state.gameVersionId) {
      onState('update-available');
      return;
    }
    const settings = await loadSettings();
    onState('launching');
    const proc = await launchGame({
      instanceRoot: instanceDir(),
      versionId: state.gameVersionId,
      javaPath: await resolveJavaPath(),
      maxMemoryMB: settings.ramMB,
      account,
      server: settings.directConnect ? SERVER : undefined,
    });
    const watcher = createMinecraftProcessWatcher(proc);
    watcher.on('minecraft-exit', () => onState('play'));
    watcher.on('error', () => onState('play'));
  }
}

/** Re-resolve the Java path the same way install did (reuse local or the downloaded runtime). */
async function resolveJavaPath(): Promise<string> {
  // installGame already ensured Java; re-running ensureJava resolves the cached/downloaded one fast.
  const { ensureJava } = await import('../core/java.js');
  const { Version } = await import('@xmcl/core');
  const state = await loadState();
  const resolved = await Version.parse(instanceDir(), state.gameVersionId!);
  return ensureJava(resolved.javaVersion.component, resolved.javaVersion.majorVersion, runtimeDir());
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS. (Confirms the core/auth module signatures all line up.)

- [ ] **Step 3: Commit**

```bash
git add src/main/launcher-service.ts
git commit -m "feat(main): add launcher service orchestration"
```

---

### Task 5: IPC + preload wiring

**Files:**
- Modify: `src/shared/ipc.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Extend `LauncherApi` in `src/shared/ipc.ts`**

Add these two methods to the `LauncherApi` interface (after `close()`):

```ts
  /** Subscribe to install/update progress. Returns an unsubscribe function. */
  onProgress(cb: (p: Progress) => void): () => void;
  /** Subscribe to launch-state changes. Returns an unsubscribe function. */
  onStateChange(cb: (state: LaunchState) => void): () => void;
```

- [ ] **Step 2: Wire handlers + events in `src/main/index.ts`**

Add imports near the other `./auth.js` import:

```ts
import { getStatus as svcStatus, playOrUpdate as svcPlayOrUpdate } from './launcher-service.js';
import { loadSettings, saveSettings } from './settings-store.js';
```

Replace the existing mock-free handlers area: keep the `auth:*` handlers, and add (next to them):

```ts
ipcMain.handle('launcher:status', () => svcStatus());
ipcMain.handle('settings:get', () => loadSettings());
ipcMain.handle('settings:set', (_e, patch) => saveSettings(patch));
ipcMain.handle('launcher:playOrUpdate', (e) => {
  const wc = e.sender;
  return svcPlayOrUpdate(
    (p) => wc.send('launcher:progress', p),
    (state) => wc.send('launcher:state', state),
  );
});
```

- [ ] **Step 3: Wire `src/preload/index.ts`**

Replace the mock `getStatus`, `getSettings`, `setSettings`, and `playOrUpdate` so they call main, and add the two subscriptions. Remove the `let settings = ...` mock line (settings now live in main). The full `api` becomes:

```ts
import { contextBridge, ipcRenderer } from 'electron';
import type { LauncherApi, Progress, LaunchState } from '../shared/ipc.js';

const api: LauncherApi = {
  getStatus: () => ipcRenderer.invoke('launcher:status'),
  getAccount: async () => (await ipcRenderer.invoke('auth:restore')) ?? { username: '', uuid: '', loggedIn: false },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  playOrUpdate: () => ipcRenderer.invoke('launcher:playOrUpdate'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
  onProgress: (cb: (p: Progress) => void) => {
    const listener = (_e: unknown, p: Progress) => cb(p);
    ipcRenderer.on('launcher:progress', listener);
    return () => ipcRenderer.removeListener('launcher:progress', listener);
  },
  onStateChange: (cb: (state: LaunchState) => void) => {
    const listener = (_e: unknown, s: LaunchState) => cb(s);
    ipcRenderer.on('launcher:state', listener);
    return () => ipcRenderer.removeListener('launcher:state', listener);
  },
};

contextBridge.exposeInMainWorld('launcher', api);
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/main/index.ts src/preload/index.ts
git commit -m "feat(app): IPC wiring for status/playOrUpdate/settings/progress"
```

---

### Task 6: Renderer flow + real progress

**Files:**
- Modify: `src/renderer/src/App.svelte`
- Modify: `src/renderer/src/screens/Main.svelte`

- [ ] **Step 1: Update `App.svelte` — subscribe to state/progress and drive the action**

In the `<script>`, add a `progress` state and subscriptions; make `onplay` call `playOrUpdate` and refresh status afterward. Replace the existing data/handlers block with:

```ts
  let status = $state<LauncherStatus | null>(null);
  let account = $state<Account | null>(null);
  let settings = $state<SettingsT | null>(null);
  let bootError = $state<string | null>(null);
  let progress = $state<{ fraction: number; currentFile: string } | null>(null);

  window.launcher.onStateChange((s) => {
    if (status) status = { ...status, state: s };
    if (s !== 'updating' && s !== 'launching') progress = null;
  });
  window.launcher.onProgress((p) => { progress = p; });

  async function refresh() {
    try {
      account = await window.launcher.getAccount();
      settings = await window.launcher.getSettings();
      status = await window.launcher.getStatus();
      screen = account.loggedIn ? 'main' : 'login';
    } catch (e) {
      bootError = e instanceof Error ? e.message : String(e);
    }
  }
  refresh();

  async function onlogin() { account = await window.launcher.login(); await refresh(); }
  async function onlogout() { await window.launcher.logout(); account = await window.launcher.getAccount(); screen = 'login'; }
  async function onplay() { await window.launcher.playOrUpdate(); status = await window.launcher.getStatus(); }
```

Then pass `progress` into the Main screen — change the Main render line to:

```svelte
      {:else if screen === 'main' && status && account}
        <Main {status} {account} {progress} {onplay} />
```

- [ ] **Step 2: Update `Main.svelte` — use the real progress prop**

Replace the props/derived block and the progress usage. The `<script>` becomes:

```ts
<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import Pokeball from '../components/Pokeball.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props {
    status: LauncherStatus;
    account: Account;
    progress?: { fraction: number; currentFile: string } | null;
    onplay: () => void;
  }
  let { status, account, progress = null, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');
  let bar = $derived(progress ? formatProgress(progress.fraction, progress.currentFile) : null);
  let stateLabel = $derived(
    status.state === 'update-available' ? '업데이트가 필요합니다'
    : status.state === 'updating' ? '업데이트 중…'
    : status.state === 'launching' ? '실행 중…'
    : status.state === 'logged-out' ? '로그인이 필요합니다'
    : '플레이 준비 완료',
  );

  const server = { players: 142, maxPlayers: 200, region: 'ASIA' };
</script>
```

And in the action bar, replace the progress block to use `bar`:

```svelte
      {#if busy && bar}<div class="pb"><ProgressBar percent={bar.percent} text={bar.text} /></div>{/if}
```

(Everything else in `Main.svelte` — markup and `<style>` — stays as is.)

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run check:svelte && npm run build`
Expected: all PASS (the 2 known Settings warnings are fine).

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/App.svelte src/renderer/src/screens/Main.svelte
git commit -m "feat(ui): drive PLAY/UPDATE flow with live state + progress"
```

---

### Task 7: Gate + manual end-to-end

**Files:** none (verification only).

- [ ] **Step 1: Tests + typecheck + build**

Run: `npm test && npm run typecheck && npm run build`
Expected: PASS — `launch-state` adds 4 → ~76 tests; both tsconfig projects clean; build OK.

- [ ] **Step 2: Manual end-to-end (human)** — do NOT run in CI

Run: `npm run dev`
- Log in (Plan 5). Main screen shows **UPDATE** (game not installed yet) with `플레이 준비 완료`/state text and version line.
- Click **UPDATE** → state → `업데이트 중…`, progress bar advances through install phases (no manifest configured yet, so mod sync is skipped) → button becomes **PLAY**.
- Click **PLAY** → `실행 중…` → Minecraft (NeoForge 1.21.1) launches with your account. On exit, button returns to PLAY.
- Settings → change RAM / toggle direct-connect → re-launch uses the new values (direct-connect adds `--quickPlayMultiplayer` to the configured SERVER).

- [ ] **Step 3: Commit (allow empty)**

```bash
git add -A
git commit -m "test: green capstone wiring" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- PLAY ↔ UPDATE auto-detection → `getStatus` + `deriveLaunchState` (Task 1/4): not-installed or sync-needed ⇒ UPDATE, else PLAY; offline/manifest-fetch-failure does not force UPDATE. ✅
- UPDATE syncs only changed mods/config then installs → `playOrUpdate` uses `computeSyncPlan`+`applySyncPlan` (Plan 1-2) + `installGame` (Plan 4). ✅
- PLAY launches with the signed-in account + RAM + direct-connect → `launchGame` with `getGameAccount` (Plan 5) + persisted `Settings`. ✅
- Progress + state surfaced to UI → `launcher:progress`/`launcher:state` events → Svelte. ✅
- Settings persisted (RAM, direct-connect) → `settings-store`. ✅
- Manifest optional/configurable so install+launch work pre-publish → `MANIFEST_URL` guard. ✅
- Token stays in main: launch uses `getGameAccount` inside main; renderer never sees it. ✅

**Deferred (intentionally):** generating + hosting the real `manifest.json` and setting `MANIFEST_URL`/`SERVER` (deployment); granular byte-level progress (coarse fraction now); auto-minimize launcher on `minecraft-window-ready`; crash-report surfacing UI (the watcher exposes it — UI later).

**Placeholder scan:** `MANIFEST_URL=''` and `SERVER.ip='play.pokehaven.example'` are intentional, documented config the user fills at deploy time — not code placeholders. All steps have complete code.

**Type consistency:** `LaunchState`/`LauncherStatus`/`Progress`/`Settings`/`Account` from `src/shared/ipc.ts` used consistently across service, IPC, preload, and Svelte. `deriveLaunchState` consumes `{loggedIn,installed,syncNeeded}`. Service feeds `installGame`(Plan 4) and `applySyncPlan`(Plan 2) with matching option shapes; `getGameAccount`(Plan 5) returns the `GameAccount` `launchGame` expects. `onProgress`/`onStateChange` return unsubscribe functions.
