# Electron + Svelte UI Skeleton — Implementation Plan (Plan 3, UI-first)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A runnable Electron app that opens a frameless window and renders three Arknights-style cool-tone screens (Login / Main / Settings) with mock data and working navigation, plus a typed preload bridge — no real auth, launch, or sync yet.

**Architecture:** electron-vite drives three build targets (main / preload / renderer). The renderer is a Svelte 5 app. A typed `LauncherApi` lives in `src/shared/ipc.ts` and is exposed by the preload as `window.launcher`, currently returning mock data. The existing `src/core` library (Plans 1–2) is untouched and stays node-typed. View logic that can be unit-tested (PLAY/UPDATE button state, status-line/progress formatting) lives in pure `src/renderer/src/lib/*.ts` modules with Vitest tests; Svelte components and CSS are verified by running the app.

**Tech Stack:** Electron, electron-vite, Vite, Svelte 5 (runes), TypeScript 5 (strict), Vitest. No real Microsoft/Minecraft integration in this plan.

This is **Plan 3** (UI-first, requested before the @xmcl install/launch work). Builds on Plans 1–2 in `src/core`. Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md` §7 (UI).

---

## File Structure

- `electron.vite.config.ts` — electron-vite config (main/preload externalized, renderer uses Svelte plugin).
- `tsconfig.json` — node/electron + core/shared typecheck project (replaces the old single config).
- `tsconfig.web.json` — renderer (DOM + Svelte) typecheck project.
- `svelte.config.js` — Svelte + vitePreprocess.
- `src/shared/ipc.ts` — shared API/data types (`LauncherApi`, `LauncherStatus`, `Account`, `Settings`, `LaunchState`).
- `src/main/index.ts` — Electron main: frameless `BrowserWindow`, loads renderer.
- `src/preload/index.ts` — `contextBridge.exposeInMainWorld('launcher', mockApi)`.
- `src/renderer/index.html` — renderer entry HTML.
- `src/renderer/src/main.ts` — mounts the Svelte `App`.
- `src/renderer/src/global.d.ts` — `Window.launcher` type.
- `src/renderer/src/styles/theme.css` — Arknights cool-tone design tokens + base styles.
- `src/renderer/src/lib/playButton.ts` (+test) — PLAY/UPDATE button state from `LaunchState`.
- `src/renderer/src/lib/format.ts` (+test) — status-line, bytes, progress formatting.
- `src/renderer/src/components/{TitleBar,Button,Panel,ProgressBar,StatusBar}.svelte`
- `src/renderer/src/screens/{Login,Main,Settings}.svelte`
- `src/renderer/src/App.svelte` — root shell: holds app state + screen switch.

---

### Task 1: Add Electron + Svelte toolchain (keep core green)

**Files:**
- Modify: `package.json`
- Create: `electron.vite.config.ts`
- Modify: `tsconfig.json`
- Create: `tsconfig.web.json`
- Create: `svelte.config.js`

- [ ] **Step 1: Install toolchain dependencies**

Run (lets npm resolve current compatible versions):
```bash
npm install -D electron electron-vite vite svelte @sveltejs/vite-plugin-svelte svelte-check
```
Expected: installs without peer-dependency errors. If a peer conflict appears, STOP and report it (do not use `--force`).

- [ ] **Step 2: Set the Electron entry + scripts in `package.json`**

Edit `package.json` so it has the `"main"` field and these scripts (keep existing `test`, `test:watch`; replace `typecheck`):

```json
{
  "name": "pokehaven-launcher",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./out/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron-vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "typecheck": "tsc -p tsconfig.json --noEmit && tsc -p tsconfig.web.json --noEmit",
    "check:svelte": "svelte-check --tsconfig tsconfig.web.json"
  }
}
```
(Leave the `devDependencies` block as npm wrote it.)

- [ ] **Step 3: Create `electron.vite.config.ts`**

```ts
import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    root: resolve('src/renderer'),
    build: {
      rollupOptions: {
        input: resolve('src/renderer/index.html'),
      },
    },
    plugins: [svelte()],
  },
});
```

- [ ] **Step 4: Create `svelte.config.js`**

```js
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
};
```

- [ ] **Step 5: Replace `tsconfig.json` (node/electron + core/shared)**

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
    "noEmit": true
  },
  "include": ["src/core", "src/shared", "src/main", "src/preload", "electron.vite.config.ts"]
}
```

- [ ] **Step 6: Create `tsconfig.web.json` (renderer)**

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
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true
  },
  "include": ["src/renderer/src", "src/shared"]
}
```

- [ ] **Step 7: Verify core still typechecks and tests still pass**

Run: `npm run test`
Expected: PASS — still 52 tests green (core untouched).

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS (no output). (The web project has no files yet; that's fine.)

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json electron.vite.config.ts svelte.config.js tsconfig.json tsconfig.web.json
git commit -m "chore(app): add electron-vite + svelte toolchain"
```

---

### Task 2: Shared IPC types + mock preload bridge

**Files:**
- Create: `src/shared/ipc.ts`
- Create: `src/preload/index.ts`
- Create: `src/renderer/src/global.d.ts`

- [ ] **Step 1: Create the shared API types**

```ts
// src/shared/ipc.ts

/** High-level state that drives the main action button. */
export type LaunchState =
  | 'logged-out'
  | 'play'
  | 'update-available'
  | 'updating'
  | 'launching';

export interface LauncherStatus {
  state: LaunchState;
  packVersion: string;
  minecraft: string;
  neoforge: string;
  online: boolean;
}

export interface Account {
  username: string;
  uuid: string;
  loggedIn: boolean;
}

export interface Settings {
  ramMB: number;
  directConnect: boolean;
  instanceDir: string;
}

/** Progress for the updating/launching phases (0..1). */
export interface Progress {
  fraction: number;
  currentFile: string;
}

/** The surface exposed to the renderer via the preload bridge. */
export interface LauncherApi {
  getStatus(): Promise<LauncherStatus>;
  getAccount(): Promise<Account>;
  getSettings(): Promise<Settings>;
  login(): Promise<Account>;
  logout(): Promise<void>;
  playOrUpdate(): Promise<void>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
}
```

- [ ] **Step 2: Create the preload bridge with mock data**

```ts
// src/preload/index.ts
import { contextBridge } from 'electron';
import type { LauncherApi, Account, Settings } from '../shared/ipc.js';

let account: Account = { username: 'Trainer_Red', uuid: '00000000-0000-0000-0000-000000000001', loggedIn: true };
let settings: Settings = { ramMB: 6144, directConnect: true, instanceDir: 'C:/Users/you/PokeHavenLauncher/instance' };

const api: LauncherApi = {
  getStatus: async () => ({
    state: 'update-available',
    packVersion: '2026.06.17',
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    online: true,
  }),
  getAccount: async () => account,
  getSettings: async () => settings,
  login: async () => {
    account = { ...account, loggedIn: true };
    return account;
  },
  logout: async () => {
    account = { ...account, loggedIn: false };
  },
  playOrUpdate: async () => {
    /* mock: no-op in the skeleton */
  },
  setSettings: async (patch) => {
    settings = { ...settings, ...patch };
    return settings;
  },
};

contextBridge.exposeInMainWorld('launcher', api);
```

- [ ] **Step 3: Declare the renderer global**

```ts
// src/renderer/src/global.d.ts
import type { LauncherApi } from '../../shared/ipc.js';

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}

export {};
```

- [ ] **Step 4: Typecheck node side**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS (preload + shared compile).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ipc.ts src/preload/index.ts src/renderer/src/global.d.ts
git commit -m "feat(app): add shared ipc types + mock preload bridge"
```

---

### Task 3: View-logic libs (TDD)

Pure functions the components depend on — fully unit-tested in node.

**Files:**
- Create: `src/renderer/src/lib/playButton.ts`
- Test: `src/renderer/src/lib/playButton.test.ts`
- Create: `src/renderer/src/lib/format.ts`
- Test: `src/renderer/src/lib/format.test.ts`

- [ ] **Step 1: Write the failing tests for `playButton`**

```ts
// src/renderer/src/lib/playButton.test.ts
import { describe, it, expect } from 'vitest';
import { playButtonState } from './playButton.js';

describe('playButtonState', () => {
  it('shows PLAY enabled when up to date', () => {
    expect(playButtonState('play')).toEqual({ label: 'PLAY', disabled: false, variant: 'primary' });
  });
  it('shows UPDATE enabled when an update is available', () => {
    expect(playButtonState('update-available')).toEqual({ label: 'UPDATE', disabled: false, variant: 'primary' });
  });
  it('shows a busy disabled button while updating', () => {
    expect(playButtonState('updating')).toEqual({ label: 'UPDATING', disabled: true, variant: 'busy' });
  });
  it('shows a busy disabled button while launching', () => {
    expect(playButtonState('launching')).toEqual({ label: 'LAUNCHING', disabled: true, variant: 'busy' });
  });
  it('disables PLAY when logged out', () => {
    expect(playButtonState('logged-out')).toEqual({ label: 'PLAY', disabled: true, variant: 'primary' });
  });
});
```

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/renderer/src/lib/playButton.test.ts`
Expected: FAIL — `./playButton.js` not found.

- [ ] **Step 3: Implement `playButton.ts`**

```ts
// src/renderer/src/lib/playButton.ts
import type { LaunchState } from '../../../shared/ipc.js';

export interface PlayButton {
  label: string;
  disabled: boolean;
  variant: 'primary' | 'busy';
}

export function playButtonState(state: LaunchState): PlayButton {
  switch (state) {
    case 'play':
      return { label: 'PLAY', disabled: false, variant: 'primary' };
    case 'update-available':
      return { label: 'UPDATE', disabled: false, variant: 'primary' };
    case 'updating':
      return { label: 'UPDATING', disabled: true, variant: 'busy' };
    case 'launching':
      return { label: 'LAUNCHING', disabled: true, variant: 'busy' };
    case 'logged-out':
      return { label: 'PLAY', disabled: true, variant: 'primary' };
  }
}
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/renderer/src/lib/playButton.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing tests for `format`**

```ts
// src/renderer/src/lib/format.test.ts
import { describe, it, expect } from 'vitest';
import { formatBytes, formatStatusLine, formatProgress } from './format.js';

describe('formatBytes', () => {
  it('formats bytes, KB, MB, GB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(413_000_000)).toBe('393.9 MB');
    expect(formatBytes(7_300_000_000)).toBe('6.8 GB');
  });
});

describe('formatStatusLine', () => {
  it('joins pack/mc/neoforge/online with separators', () => {
    expect(
      formatStatusLine({ packVersion: '2026.06.17', minecraft: '1.21.1', neoforge: '21.1.233', online: true }),
    ).toBe('PACK 2026.06.17  ·  MC 1.21.1  ·  NEOFORGE 21.1.233  ·  ONLINE');
  });
  it('shows OFFLINE when not online', () => {
    expect(
      formatStatusLine({ packVersion: 'v', minecraft: '1.21.1', neoforge: '21.1.233', online: false }),
    ).toContain('OFFLINE');
  });
});

describe('formatProgress', () => {
  it('clamps and rounds to a whole percent', () => {
    expect(formatProgress(0.5, 'mods/a.jar')).toEqual({ percent: 50, text: '50%  mods/a.jar' });
    expect(formatProgress(-1, 'x')).toEqual({ percent: 0, text: '0%  x' });
    expect(formatProgress(2, 'y')).toEqual({ percent: 100, text: '100%  y' });
  });
});
```

- [ ] **Step 6: Run it; confirm fail**

Run: `npx vitest run src/renderer/src/lib/format.test.ts`
Expected: FAIL — `./format.js` not found.

- [ ] **Step 7: Implement `format.ts`**

```ts
// src/renderer/src/lib/format.ts
import type { LauncherStatus } from '../../../shared/ipc.js';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function formatStatusLine(
  s: Pick<LauncherStatus, 'packVersion' | 'minecraft' | 'neoforge' | 'online'>,
): string {
  const parts = [
    `PACK ${s.packVersion}`,
    `MC ${s.minecraft}`,
    `NEOFORGE ${s.neoforge}`,
    s.online ? 'ONLINE' : 'OFFLINE',
  ];
  return parts.join('  ·  ');
}

export function formatProgress(fraction: number, currentFile: string): { percent: number; text: string } {
  const clamped = Math.min(1, Math.max(0, fraction));
  const percent = Math.round(clamped * 100);
  return { percent, text: `${percent}%  ${currentFile}` };
}
```

- [ ] **Step 8: Run it; confirm pass**

Run: `npx vitest run src/renderer/src/lib/format.test.ts`
Expected: PASS (4 tests). (If `formatBytes(413_000_000)` differs by 0.1 due to rounding, adjust the expectation to the actual `toFixed(1)` value — 413000000/1024/1024 = 393.86… → "393.9 MB".)

- [ ] **Step 9: Commit**

```bash
git add src/renderer/src/lib/
git commit -m "feat(ui): add play-button + formatting view logic (tested)"
```

---

### Task 4: Arknights cool-tone theme + renderer bootstrap

This task makes the window show *something*. Visual verification via `npm run dev`.

**Files:**
- Create: `src/renderer/index.html`
- Create: `src/renderer/src/main.ts`
- Create: `src/renderer/src/styles/theme.css`
- Create: `src/renderer/src/App.svelte` (temporary placeholder, replaced in Task 7)
- Create: `src/main/index.ts`

- [ ] **Step 1: Create `theme.css` (cool-tone design tokens + base)**

```css
/* src/renderer/src/styles/theme.css */
:root {
  --bg-0: #0a0e12;      /* near-black base */
  --bg-1: #11171d;      /* panel base */
  --bg-2: #18212a;      /* raised panel */
  --line: #2a3947;      /* thin frame lines */
  --line-bright: #3d5567;
  --ink: #e6eef3;       /* primary text */
  --ink-dim: #8aa0b0;   /* secondary text */
  --accent: #36e0e0;    /* cyan accent */
  --accent-2: #2aa7c4;  /* teal */
  --danger: #ff5c6c;
  --grid: rgba(54, 224, 224, 0.04);
  --mono: "Consolas", "SFMono-Regular", "Menlo", monospace;
  --sans: "Inter", "Segoe UI", system-ui, sans-serif;
}

* { box-sizing: border-box; }

html, body, #app { height: 100%; margin: 0; }

body {
  background:
    linear-gradient(0deg, var(--grid) 1px, transparent 1px) 0 0 / 100% 28px,
    linear-gradient(90deg, var(--grid) 1px, transparent 1px) 0 0 / 28px 100%,
    radial-gradient(120% 120% at 50% -10%, #14202a 0%, var(--bg-0) 60%);
  color: var(--ink);
  font-family: var(--sans);
  user-select: none;
  overflow: hidden;
}

.mono { font-family: var(--mono); }
.upper { text-transform: uppercase; letter-spacing: 0.12em; }

/* Angular cut-corner via clip-path, reused by panels/buttons. */
.cut {
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-thumb { background: var(--line-bright); }
```

- [ ] **Step 2: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PokeHaven Frontier</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Create `main.ts` (mount Svelte)**

```ts
// src/renderer/src/main.ts
import { mount } from 'svelte';
import './styles/theme.css';
import App from './App.svelte';

const app = mount(App, { target: document.getElementById('app')! });

export default app;
```

- [ ] **Step 4: Create a temporary `App.svelte` placeholder**

```svelte
<!-- src/renderer/src/App.svelte (placeholder; replaced in Task 7) -->
<main class="boot">
  <h1 class="mono upper">PokeHaven Frontier</h1>
  <p class="mono">launcher shell online</p>
</main>

<style>
  .boot {
    height: 100%;
    display: grid;
    place-content: center;
    text-align: center;
    gap: 8px;
  }
  h1 { color: var(--accent); font-size: 28px; margin: 0; }
  p { color: var(--ink-dim); margin: 0; }
</style>
```

- [ ] **Step 5: Create the Electron main process (frameless window)**

```ts
// src/main/index.ts
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1100,
    height: 680,
    minWidth: 940,
    minHeight: 600,
    frame: false,
    backgroundColor: '#0a0e12',
    show: false,
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
    },
  });

  win.on('ready-to-show', () => win.show());

  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(import.meta.dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

- [ ] **Step 6: Run the app and verify the shell window opens**

Run: `npm run dev`
Expected: an Electron window opens, frameless, dark cool-tone background with a faint grid, showing cyan "PokeHaven Frontier" / "launcher shell online". Close it (Ctrl+C in the terminal to stop dev).
If it fails to find the preload/renderer, confirm `electron.vite.config.ts` and the `out/` paths; report the exact error if unresolved.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/index.html src/renderer/src/main.ts src/renderer/src/styles/theme.css src/renderer/src/App.svelte src/main/index.ts
git commit -m "feat(app): boot frameless window with cool-tone theme"
```

---

### Task 5: Core components (TitleBar, Button, Panel, ProgressBar, StatusBar)

Presentational Svelte components. Verified visually in Task 7 once screens compose them; this task just creates them and confirms the build compiles.

**Files:**
- Create: `src/renderer/src/components/TitleBar.svelte`
- Create: `src/renderer/src/components/Button.svelte`
- Create: `src/renderer/src/components/Panel.svelte`
- Create: `src/renderer/src/components/ProgressBar.svelte`
- Create: `src/renderer/src/components/StatusBar.svelte`

- [ ] **Step 1: `TitleBar.svelte` (draggable, window controls)**

```svelte
<script lang="ts">
  interface Props { title: string; }
  let { title }: Props = $props();
</script>

<header class="titlebar">
  <div class="brand mono upper">{title}</div>
  <div class="spacer"></div>
  <div class="hint mono">PHF // LAUNCHER</div>
</header>

<style>
  .titlebar {
    height: 38px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--line);
    -webkit-app-region: drag;
    background: linear-gradient(180deg, rgba(54,224,224,0.04), transparent);
  }
  .brand { color: var(--accent); font-size: 12px; }
  .spacer { flex: 1; }
  .hint { color: var(--ink-dim); font-size: 11px; letter-spacing: 0.2em; }
</style>
```

- [ ] **Step 2: `Button.svelte` (angular, variants)**

```svelte
<script lang="ts">
  interface Props {
    label: string;
    variant?: 'primary' | 'ghost' | 'busy';
    disabled?: boolean;
    onclick?: () => void;
  }
  let { label, variant = 'primary', disabled = false, onclick }: Props = $props();
</script>

<button class="ak cut {variant}" {disabled} {onclick}>
  <span class="bar"></span>
  <span class="label mono upper">{label}</span>
</button>

<style>
  .ak {
    position: relative;
    border: 1px solid var(--line-bright);
    background: var(--bg-2);
    color: var(--ink);
    padding: 12px 22px;
    font-size: 13px;
    cursor: pointer;
    transition: background 0.12s, border-color 0.12s, box-shadow 0.12s;
  }
  .ak .bar {
    position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
    background: var(--accent);
  }
  .label { padding-left: 8px; }
  .ak.primary:hover:not(:disabled) {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 0 18px rgba(54,224,224,0.25);
  }
  .ak.ghost { background: transparent; }
  .ak.ghost .bar { background: var(--ink-dim); }
  .ak.busy { color: var(--ink-dim); }
  .ak.busy .bar { background: var(--accent-2); animation: pulse 1s ease-in-out infinite; }
  .ak:disabled { cursor: default; opacity: 0.7; }
  @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
</style>
```

- [ ] **Step 3: `Panel.svelte` (cut-corner framed container)**

```svelte
<script lang="ts">
  interface Props { label?: string; children?: import('svelte').Snippet; }
  let { label, children }: Props = $props();
</script>

<section class="panel cut">
  {#if label}<div class="head mono upper">{label}</div>{/if}
  <div class="body">
    {@render children?.()}
  </div>
</section>

<style>
  .panel {
    border: 1px solid var(--line);
    background: linear-gradient(180deg, var(--bg-1), var(--bg-0));
  }
  .head {
    color: var(--accent);
    font-size: 11px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    letter-spacing: 0.18em;
  }
  .body { padding: 14px; }
</style>
```

- [ ] **Step 4: `ProgressBar.svelte`**

```svelte
<script lang="ts">
  interface Props { percent: number; text?: string; }
  let { percent, text = '' }: Props = $props();
</script>

<div class="wrap">
  <div class="track">
    <div class="fill" style="width: {percent}%"></div>
  </div>
  {#if text}<div class="text mono">{text}</div>{/if}
</div>

<style>
  .wrap { display: flex; flex-direction: column; gap: 6px; }
  .track { height: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .fill {
    height: 100%;
    background: linear-gradient(90deg, var(--accent-2), var(--accent));
    box-shadow: 0 0 12px rgba(54,224,224,0.5);
    transition: width 0.2s ease;
  }
  .text { color: var(--ink-dim); font-size: 11px; }
</style>
```

- [ ] **Step 5: `StatusBar.svelte`**

```svelte
<script lang="ts">
  interface Props { text: string; }
  let { text }: Props = $props();
</script>

<footer class="status mono">
  <span class="dot"></span>{text}
</footer>

<style>
  .status {
    display: flex; align-items: center; gap: 8px;
    border-top: 1px solid var(--line);
    padding: 8px 14px;
    color: var(--ink-dim);
    font-size: 11px;
    letter-spacing: 0.08em;
  }
  .dot { width: 7px; height: 7px; background: var(--accent); box-shadow: 0 0 8px var(--accent); }
</style>
```

- [ ] **Step 6: Typecheck the renderer**

Run: `npm run check:svelte`
Expected: 0 errors (warnings acceptable). If `svelte-check` reports the components are unused, that's fine — they're consumed in Task 7.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/src/components/
git commit -m "feat(ui): add cool-tone core components"
```

---

### Task 6: Screens (Login, Main, Settings)

**Files:**
- Create: `src/renderer/src/screens/Login.svelte`
- Create: `src/renderer/src/screens/Main.svelte`
- Create: `src/renderer/src/screens/Settings.svelte`

- [ ] **Step 1: `Login.svelte`**

```svelte
<script lang="ts">
  import Button from '../components/Button.svelte';
  interface Props { onlogin: () => void; }
  let { onlogin }: Props = $props();
</script>

<div class="login">
  <div class="logo mono upper">PokeHaven<span class="accent"> Frontier</span></div>
  <div class="sub mono upper">NeoForge 1.21.1 · Pixelmon</div>
  <Button label="Microsoft 로그인" onclick={onlogin} />
</div>

<style>
  .login { height: 100%; display: grid; place-content: center; justify-items: center; gap: 16px; }
  .logo { font-size: 40px; letter-spacing: 0.1em; }
  .accent { color: var(--accent); }
  .sub { color: var(--ink-dim); font-size: 12px; }
</style>
```

- [ ] **Step 2: `Main.svelte`**

```svelte
<script lang="ts">
  import Button from '../components/Button.svelte';
  import ProgressBar from '../components/ProgressBar.svelte';
  import { playButtonState } from '../lib/playButton.js';
  import { formatProgress } from '../lib/format.js';
  import type { LauncherStatus, Account } from '../../../shared/ipc.js';

  interface Props { status: LauncherStatus; account: Account; onplay: () => void; }
  let { status, account, onplay }: Props = $props();

  let btn = $derived(playButtonState(status.state));
  let progress = $derived(formatProgress(0.42, 'mods/Pixelmon-1.21.1-9.3.16-universal.jar'));
  let busy = $derived(status.state === 'updating' || status.state === 'launching');
</script>

<div class="main">
  <div class="profile">
    <div class="avatar"></div>
    <div class="who">
      <div class="name mono">{account.username}</div>
      <div class="tag mono upper">{account.loggedIn ? 'authenticated' : 'offline'}</div>
    </div>
  </div>

  <div class="hero">
    <div class="title mono upper">PokeHaven <span class="accent">Frontier</span></div>
    {#if busy}
      <ProgressBar percent={progress.percent} text={progress.text} />
    {/if}
    <Button label={btn.label} variant={btn.variant} disabled={btn.disabled} onclick={onplay} />
  </div>
</div>

<style>
  .main { height: 100%; display: flex; flex-direction: column; }
  .profile { display: flex; align-items: center; gap: 10px; padding: 14px; }
  .avatar { width: 34px; height: 34px; background: var(--bg-2); border: 1px solid var(--line-bright); }
  .name { color: var(--ink); font-size: 13px; }
  .tag { color: var(--accent); font-size: 10px; }
  .hero { flex: 1; display: grid; place-content: center; justify-items: center; gap: 18px; width: min(560px, 80%); margin: 0 auto; }
  .title { font-size: 30px; letter-spacing: 0.08em; }
  .accent { color: var(--accent); }
</style>
```

- [ ] **Step 3: `Settings.svelte`**

```svelte
<script lang="ts">
  import Panel from '../components/Panel.svelte';
  import Button from '../components/Button.svelte';
  import type { Settings } from '../../../shared/ipc.js';

  interface Props { settings: Settings; onlogout: () => void; }
  let { settings, onlogout }: Props = $props();

  let ram = $state(settings.ramMB);
  let direct = $state(settings.directConnect);
</script>

<div class="settings">
  <Panel label="설정">
    <div class="row">
      <label class="mono upper" for="ram">RAM 할당</label>
      <input id="ram" type="range" min="2048" max="16384" step="512" bind:value={ram} />
      <span class="val mono">{(ram / 1024).toFixed(1)} GB</span>
    </div>
    <div class="row">
      <label class="mono upper" for="dc">서버 바로 접속</label>
      <input id="dc" type="checkbox" bind:checked={direct} />
    </div>
    <div class="row">
      <span class="mono upper">인스턴스 폴더</span>
      <span class="path mono">{settings.instanceDir}</span>
    </div>
    <div class="row end">
      <Button label="로그아웃" variant="ghost" onclick={onlogout} />
    </div>
  </Panel>
</div>

<style>
  .settings { padding: 18px; height: 100%; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .row.end { justify-content: flex-end; border-bottom: none; }
  label, .row > span:first-child { width: 130px; color: var(--ink-dim); font-size: 11px; }
  .val, .path { color: var(--ink); font-size: 12px; }
  input[type="range"] { flex: 1; accent-color: var(--accent); }
</style>
```

- [ ] **Step 4: Typecheck**

Run: `npm run check:svelte`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/screens/
git commit -m "feat(ui): add login/main/settings screens (mock data)"
```

---

### Task 7: App shell — navigation + wiring to the mock bridge

Replaces the placeholder `App.svelte`. Loads mock data from `window.launcher`, switches screens, and adds a left nav rail. This is the payoff: `npm run dev` shows all three screens.

**Files:**
- Modify: `src/renderer/src/App.svelte`

- [ ] **Step 1: Replace `App.svelte`**

```svelte
<script lang="ts">
  import TitleBar from './components/TitleBar.svelte';
  import StatusBar from './components/StatusBar.svelte';
  import Login from './screens/Login.svelte';
  import Main from './screens/Main.svelte';
  import Settings from './screens/Settings.svelte';
  import { formatStatusLine } from './lib/format.js';
  import type { LauncherStatus, Account, Settings as SettingsT } from '../../shared/ipc.js';

  type Screen = 'login' | 'main' | 'settings';
  let screen = $state<Screen>('main');

  let status = $state<LauncherStatus | null>(null);
  let account = $state<Account | null>(null);
  let settings = $state<SettingsT | null>(null);

  async function refresh() {
    status = await window.launcher.getStatus();
    account = await window.launcher.getAccount();
    settings = await window.launcher.getSettings();
    screen = account.loggedIn ? 'main' : 'login';
  }
  refresh();

  async function onlogin() { account = await window.launcher.login(); screen = 'main'; }
  async function onlogout() { await window.launcher.logout(); account = await window.launcher.getAccount(); screen = 'login'; }
  async function onplay() { await window.launcher.playOrUpdate(); }
</script>

<div class="app">
  <TitleBar title="PokeHaven Frontier" />
  <div class="shell">
    {#if account?.loggedIn}
      <nav class="rail">
        <button class="navbtn mono upper" class:active={screen === 'main'} onclick={() => (screen = 'main')}>홈</button>
        <button class="navbtn mono upper" class:active={screen === 'settings'} onclick={() => (screen = 'settings')}>설정</button>
      </nav>
    {/if}

    <div class="content">
      {#if screen === 'login'}
        <Login {onlogin} />
      {:else if screen === 'main' && status && account}
        <Main {status} {account} {onplay} />
      {:else if screen === 'settings' && settings}
        <Settings {settings} {onlogout} />
      {/if}
    </div>
  </div>
  <StatusBar text={status ? formatStatusLine(status) : 'CONNECTING…'} />
</div>

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  .shell { flex: 1; display: flex; min-height: 0; }
  .rail { width: 92px; border-right: 1px solid var(--line); display: flex; flex-direction: column; padding-top: 10px; }
  .navbtn {
    background: transparent; border: none; color: var(--ink-dim);
    padding: 14px 0; font-size: 11px; letter-spacing: 0.16em; cursor: pointer;
    border-left: 3px solid transparent;
  }
  .navbtn.active { color: var(--accent); border-left-color: var(--accent); background: rgba(54,224,224,0.05); }
  .content { flex: 1; min-width: 0; overflow: auto; }
</style>
```

- [ ] **Step 2: Run the full app and verify all three screens**

Run: `npm run dev`
Expected:
- Window opens on the **Main** screen (mock account is logged in): profile chip top-left, centered "PokeHaven Frontier", and an **UPDATE** button (mock status is `update-available`). Bottom status bar reads `PACK 2026.06.17  ·  MC 1.21.1  ·  NEOFORGE 21.1.233  ·  ONLINE`.
- Left rail: click **설정** → Settings panel with a RAM slider (shows GB), direct-connect checkbox, instance path, and a ghost **로그아웃** button.
- Click **로그아웃** → goes to **Login** screen (logo + Microsoft 로그인 button). Click it → returns to Main.
Stop dev (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/App.svelte
git commit -m "feat(ui): app shell with nav + mock-bridge wiring"
```

---

### Task 8: Final gate

**Files:** none (verification only).

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS — 13 test files, ~61 tests (core 52 + playButton 5 + format 4).

- [ ] **Step 2: Typecheck (node + web)**

Run: `npm run typecheck`
Expected: PASS (both projects, no output).

- [ ] **Step 3: Svelte check**

Run: `npm run check:svelte`
Expected: 0 errors.

- [ ] **Step 4: Production build smoke**

Run: `npm run build`
Expected: electron-vite builds main, preload, renderer into `out/` with no errors.

- [ ] **Step 5: Commit (allow empty)**

```bash
git add -A
git commit -m "chore(app): green ui skeleton (tests + typecheck + build)" --allow-empty
```

---

## Self-Review

**Spec coverage (UI §7):**
- Cool-tone Arknights aesthetic (near-black base, thin frame lines, cyan/teal accent, cut-corner panels, mono uppercase labels, faint grid) → `theme.css` + components. ✅ (visual)
- Three screens — Login / Main / Settings → Task 6 + Task 7 nav. ✅
- Main: profile, central PLAY/UPDATE button (state-driven label/variant), progress bar during busy, bottom status line (pack/MC/NeoForge/online) → `Main.svelte` + `playButtonState` + `formatStatusLine`. ✅
- Settings: RAM slider, direct-connect toggle, instance folder, logout → `Settings.svelte`. ✅
- Login: logo + Microsoft login button → `Login.svelte`. ✅
- Electron security posture (`contextIsolation: true`, `sandbox: true`, preload-only API, no nodeIntegration) → `main/index.ts` + preload bridge. ✅

**Intentionally deferred (not gaps):** real auth/launch/sync wiring (the bridge returns mock data; later plans replace the preload implementation with real IPC to `src/core` + auth/launch modules); window min/max/close controls (frameless drag region is in place; control buttons come with real main-process handlers later); verify/repair + diagnostics UI; component-render tests (skeleton components are presentational and verified by running the app — the testable view-logic is covered in Task 3).

**Placeholder scan:** none — every step has complete file content or an exact command. The `App.svelte` "placeholder" in Task 4 is intentional and fully replaced in Task 7.

**Type consistency:** `LauncherApi`, `LauncherStatus`, `Account`, `Settings`, `LaunchState` defined once in `src/shared/ipc.ts`; preload implements `LauncherApi`; renderer reads via `window.launcher` typed by `global.d.ts`. `playButtonState(state: LaunchState)` consumes the same `LaunchState`. `formatStatusLine` takes a `Pick<LauncherStatus, …>` matching the real fields. Component prop names (`label`, `variant`, `disabled`, `onclick`, `percent`, `text`, `title`) are consistent between definition and use in screens/App.
