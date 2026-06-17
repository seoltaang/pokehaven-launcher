# Microsoft Auth — Implementation Plan (Plan 5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the launcher's "Microsoft 로그인" button perform a real Microsoft/Xbox/Minecraft login (via `msmc`), persist the session encrypted (Electron `safeStorage`), restore it on startup, and expose only safe profile info (`{username, uuid, loggedIn}`) to the renderer — the Minecraft access token never leaves the main process.

**Architecture:** A main-process auth service (`src/main/auth.ts`) drives `msmc`'s Electron login flow and holds the live `Minecraft` session. A token store (`src/main/token-store.ts`) encrypts the serialized `MCToken` with `safeStorage` and writes it under the user data dir. Pure mapping/expiry helpers live in `src/core/account.ts` (unit-tested). IPC handlers (`auth:login`/`auth:logout`/`auth:restore`) replace the mock preload methods; the renderer's existing login/logout/getAccount calls become real. The access token is kept in main and surfaced only to the launch engine (Plan 4) via a main-only `getGameAccount()`.

**Tech Stack:** `msmc` 5.0.5, Electron `safeStorage`, Node 20+, TypeScript strict ESM, Vitest. Auth runs in the **main** process (msmc opens a BrowserWindow; `safeStorage` is main-only).

This is **Plan 5**. Builds on Plan 3 (Electron app, IPC, login button already present) and Plan 4 (`GameAccount` shape in `launch-game.ts`). No Azure registration required: msmc defaults to the official launcher client id (public, pre-approved); overriding it is a later option. Spec: `docs/superpowers/specs/2026-06-16-pokehaven-frontier-launcher-design.md`.

### API reference (verified against installed `msmc` 5.0.5 type defs)
- `new Auth(prompt: 'select_account')` → `auth.launch('electron', { width, height }): Promise<Xbox>`.
- `xbox.getMinecraft(): Promise<Minecraft>`; `Minecraft.profile: { id: string; name: string }`, `.mcToken: string`, `.validate(): boolean`, `.refresh(force?): Promise<this>`, `.getToken(full: boolean): MCToken`.
- `MCToken = { refresh?: string; mcToken: string; profile: MCProfile; xuid: string; exp: number }` (`exp` = epoch seconds).
- `tokenUtils.fromToken(auth: Auth, token: MCToken, refresh: true): Promise<Minecraft>` — restore + refresh a saved session.
- Electron `safeStorage.isEncryptionAvailable(): boolean`, `.encryptString(s): Buffer`, `.decryptString(buf): string`.

---

## File Structure
- `src/core/account.ts` (+ `account.test.ts`) — pure: `toAccount`, `isExpired`.
- `src/main/token-store.ts` — encrypted MCToken persistence (`saveToken`/`loadToken`/`clearToken`).
- `src/main/auth.ts` — `login`, `restore`, `logout`, `getCurrentAccount`, `getGameAccount`.
- `src/main/index.ts` — register `auth:*` IPC handlers (modify).
- `src/preload/index.ts` — real `login`/`logout`/`getAccount` via `ipcRenderer.invoke` (modify).
- `src/shared/ipc.ts` — no shape change (`Account` stays `{username, uuid, loggedIn}`).

---

### Task 1: Pure account helpers

**Files:**
- Create: `src/core/account.ts`
- Test: `src/core/account.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/core/account.test.ts
import { describe, it, expect } from 'vitest';
import { toAccount, isExpired } from './account.js';

describe('toAccount', () => {
  it('maps a Minecraft profile to a renderer-safe Account (no token)', () => {
    expect(toAccount({ id: 'uuid-1', name: 'Trainer_Red' })).toEqual({
      username: 'Trainer_Red',
      uuid: 'uuid-1',
      loggedIn: true,
    });
  });
});

describe('isExpired', () => {
  it('is false well before expiry', () => {
    // exp is epoch SECONDS; now is ms
    expect(isExpired(2_000, 1_000_000)).toBe(false); // exp=2000s=2_000_000ms > 1_000_000ms
  });
  it('is true at/after expiry', () => {
    expect(isExpired(1_000, 1_000_000)).toBe(true); // exp=1000s=1_000_000ms <= now
  });
  it('treats a 60s skew window as expired early', () => {
    // exp 1_000_000ms, now 950_000ms, skew 60s → 950_000 + 60_000 = 1_010_000 >= 1_000_000 → expired
    expect(isExpired(1_000, 950_000, 60)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it; confirm fail**

Run: `npx vitest run src/core/account.test.ts`
Expected: FAIL — `./account.js` not found.

- [ ] **Step 3: Implement `account.ts`**

```ts
// src/core/account.ts
import type { Account } from '../shared/ipc.js';

/** Map a Minecraft profile (from msmc) to the renderer-safe Account (no token). */
export function toAccount(profile: { id: string; name: string }): Account {
  return { username: profile.name, uuid: profile.id, loggedIn: true };
}

/**
 * Whether a session is expired. `expSeconds` is epoch seconds (msmc `exp`),
 * `nowMs` is epoch milliseconds. `skewSeconds` refreshes slightly early.
 */
export function isExpired(expSeconds: number, nowMs: number, skewSeconds = 0): boolean {
  return nowMs + skewSeconds * 1000 >= expSeconds * 1000;
}
```

- [ ] **Step 4: Run it; confirm pass**

Run: `npx vitest run src/core/account.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/account.ts src/core/account.test.ts
git commit -m "feat(core): add pure account mapping + expiry helpers"
```

---

### Task 2: Encrypted token store (main process)

No unit test (depends on Electron `safeStorage` + fs at runtime); verified by the manual run in Task 5 and by `tsc`.

**Files:**
- Create: `src/main/token-store.ts`

- [ ] **Step 1: Implement `token-store.ts`**

```ts
// src/main/token-store.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { types as MsmcTypes } from 'msmc';

const require = createRequire(import.meta.url);
const { app, safeStorage } = require('electron') as typeof import('electron');

type MCToken = MsmcTypes.MCToken;

function tokenFile(): string {
  return join(app.getPath('userData'), 'auth', 'session.bin');
}

/** Encrypt and persist the Minecraft session token. */
export async function saveToken(token: MCToken): Promise<void> {
  const file = tokenFile();
  await mkdir(dirname(file), { recursive: true });
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption (safeStorage) is unavailable; refusing to store token in plaintext');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(token));
  await writeFile(file, encrypted);
}

/** Load and decrypt the saved token, or null if none / unreadable. */
export async function loadToken(): Promise<MCToken | null> {
  try {
    const buf = await readFile(tokenFile());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return JSON.parse(safeStorage.decryptString(buf)) as MCToken;
  } catch {
    return null;
  }
}

/** Remove the persisted token. */
export async function clearToken(): Promise<void> {
  await rm(tokenFile(), { force: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS (confirms `msmc` types + `safeStorage` usage compile).

- [ ] **Step 3: Commit**

```bash
git add src/main/token-store.ts
git commit -m "feat(main): add safeStorage-encrypted token store"
```

---

### Task 3: Auth service (main process)

**Files:**
- Create: `src/main/auth.ts`

- [ ] **Step 1: Implement `auth.ts`**

```ts
// src/main/auth.ts
import { Auth, tokenUtils } from 'msmc';
import type { Minecraft } from 'msmc/types/auth/minecraft.js';
import type { Account } from '../shared/ipc.js';
import type { GameAccount } from '../core/launch-game.js';
import { toAccount } from '../core/account.js';
import { saveToken, loadToken, clearToken } from './token-store.js';

/** The live Minecraft session, held in main only. */
let current: Minecraft | null = null;

/** Open the Microsoft login window, persist the session, return safe account info. */
export async function login(): Promise<Account> {
  const auth = new Auth('select_account');
  const xbox = await auth.launch('electron', { width: 520, height: 680 });
  const mc = await xbox.getMinecraft();
  current = mc;
  await saveToken(mc.getToken(true));
  return toAccount({ id: mc.profile?.id ?? '', name: mc.profile?.name ?? '' });
}

/** Restore a saved session on startup (refreshing it). Returns null if none/invalid. */
export async function restore(): Promise<Account | null> {
  const token = await loadToken();
  if (!token) return null;
  try {
    const mc = await tokenUtils.fromToken(new Auth(), token, true);
    current = mc;
    await saveToken(mc.getToken(true)); // persist the refreshed token
    return toAccount({ id: mc.profile?.id ?? '', name: mc.profile?.name ?? '' });
  } catch {
    await clearToken();
    current = null;
    return null;
  }
}

/** Forget the session. */
export async function logout(): Promise<void> {
  current = null;
  await clearToken();
}

/** Renderer-safe account, or a logged-out placeholder. */
export function getCurrentAccount(): Account {
  if (!current) return { username: '', uuid: '', loggedIn: false };
  return toAccount({ id: current.profile?.id ?? '', name: current.profile?.name ?? '' });
}

/** Full account incl. access token — MAIN ONLY, for the launch engine (Plan 4). */
export function getGameAccount(): GameAccount | null {
  if (!current) return null;
  return {
    name: current.profile?.name ?? '',
    uuid: current.profile?.id ?? '',
    accessToken: current.mcToken,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `tsc -p tsconfig.json --noEmit`
Expected: PASS. (If the `msmc/types/...` deep import path for the `Minecraft` type does not resolve under `moduleResolution: Bundler`, replace the type import with `type Minecraft = Awaited<ReturnType<Awaited<ReturnType<Auth['launch']>>['getMinecraft']>>` — a structural fallback. Try the direct import first.)

- [ ] **Step 3: Commit**

```bash
git add src/main/auth.ts
git commit -m "feat(main): add msmc auth service (login/restore/logout)"
```

---

### Task 4: Wire IPC + preload to real auth

**Files:**
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Register auth IPC handlers in `main/index.ts`**

Add the auth import near the top (after the existing `createRequire`/electron destructure):

```ts
import { login as authLogin, logout as authLogout, restore as authRestore } from './auth.js';
```

Add these handlers next to the existing `ipcMain.on('window:*', ...)` lines (use `handle`, not `on`, since these return values):

```ts
ipcMain.handle('auth:login', () => authLogin());
ipcMain.handle('auth:logout', () => authLogout());
ipcMain.handle('auth:restore', () => authRestore());
```

- [ ] **Step 2: Replace the mock auth methods in `preload/index.ts`**

Replace the mock `account` state and the `getAccount`/`login`/`logout` implementations so they call main. Keep `getStatus`/`getSettings`/`playOrUpdate`/`setSettings` mock for now. The relevant parts become:

```ts
// remove the `let account = ...` mock line.

  getAccount: async () => (await ipcRenderer.invoke('auth:restore')) ?? { username: '', uuid: '', loggedIn: false },
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
```

So the full `api` object in `preload/index.ts` reads:

```ts
const api: LauncherApi = {
  getStatus: async () => ({
    state: 'update-available',
    packVersion: '2026.06.17',
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    online: true,
  }),
  getAccount: async () => (await ipcRenderer.invoke('auth:restore')) ?? { username: '', uuid: '', loggedIn: false },
  getSettings: async () => settings,
  login: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  playOrUpdate: async () => {
    /* mock: no-op until the launch wiring plan */
  },
  setSettings: async (patch) => {
    settings = { ...settings, ...patch };
    return settings;
  },
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
};
```

(The `let settings = ...` mock line stays; only the `account` mock and its three methods change.)

- [ ] **Step 3: Typecheck (node + web)**

Run: `npm run typecheck`
Expected: PASS. `login`/`logout`/`getAccount` still satisfy the `LauncherApi` interface (login returns `Promise<Account>`, logout `Promise<void>`, getAccount `Promise<Account>`).

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: electron-vite builds main/preload/renderer with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/main/index.ts src/preload/index.ts
git commit -m "feat(app): wire login/logout/getAccount to real msmc auth"
```

---

### Task 5: Gate + manual login verification

**Files:** none (verification only).

- [ ] **Step 1: Tests**

Run: `npm test`
Expected: PASS — adds `account` (4) → ~72 total.

- [ ] **Step 2: Typecheck + build**

Run: `npm run typecheck && npm run build`
Expected: both PASS.

- [ ] **Step 3: Manual login (human — requires a real Microsoft account)**

This step is for the human operator; do not run it in CI.
Run: `npm run dev`
- App boots; if no saved session, it shows the **Login** screen.
- Click **Microsoft 계정으로 로그인** → an msmc login window opens → sign in with a Microsoft account that owns Minecraft.
- On success the window closes and the app shows the **Main** screen with your real username (top-left nav avatar/name).
- Close and re-run `npm run dev` → it should land on **Main** directly (session restored from the encrypted token, no re-login).
- Go to **설정 → 로그아웃** → returns to Login; re-running `npm run dev` now shows Login again.

- [ ] **Step 4: Commit (allow empty)**

```bash
git add -A
git commit -m "test: green microsoft auth wiring" --allow-empty
```

---

## Self-Review

**Spec coverage:**
- Real Microsoft/Xbox/Minecraft login → Task 3 `login` (msmc `auth.launch('electron')` → `getMinecraft`). ✅
- No Azure registration blocker → msmc default client id (documented in the plan header); overridable later. ✅ (resolves the earlier reviewer's "new Azure app 403" risk.)
- Encrypted token storage (not plaintext) → Task 2 `safeStorage` (refuses to store if encryption unavailable). ✅
- Auto-restore + refresh on startup → Task 3 `restore` (`tokenUtils.fromToken(..., true)`); failure clears token and forces re-login. ✅
- Token isolation: access token stays in main; renderer gets only `{username, uuid, loggedIn}` → `getCurrentAccount`/IPC return `Account`; `getGameAccount` is main-only for the launch engine. ✅
- Electron security: auth runs in main; preload exposes only typed invoke calls; no token over IPC to the renderer. ✅

**Deferred (intentionally):** wiring PLAY to `getGameAccount()` + `installGame`/`launchGame` (next plan); own Azure client id (optional); `getStatus`/`getSettings` remain mock until their plans; account skin avatar image (we show the initial, not the skin head).

**Placeholder scan:** none — every code/test step is complete; msmc calls use signatures verified against the installed type defs, with a documented structural fallback for the one deep type import.

**Type consistency:** `Account` (`{username,uuid,loggedIn}`) from `src/shared/ipc.ts` is the renderer-facing shape returned by `toAccount`, `login`, `restore`, `getCurrentAccount`, and the IPC handlers. `GameAccount` (`{name,uuid,accessToken}`) from `src/core/launch-game.ts` is what `getGameAccount` returns, matching `launchGame`'s `LaunchParams.account`. `MCToken` from msmc flows `saveToken`↔`loadToken`↔`tokenUtils.fromToken`.
