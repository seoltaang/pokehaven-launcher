// src/shared/ipc.ts

/** High-level state that drives the main action button. */
export type LaunchState =
  | 'logged-out'
  | 'play'
  | 'install-needed'
  | 'update-available'
  | 'updating'
  | 'launching'
  | 'playing';

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
  theme: 'light' | 'dark';
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
  /** Open the instance folder in the OS file manager. */
  openInstanceDir(): void;
  minimize(): void;
  close(): void;
  /** Subscribe to install/update progress. Returns an unsubscribe function. */
  onProgress(cb: (p: Progress) => void): () => void;
  /** Subscribe to launch-state changes. Returns an unsubscribe function. */
  onStateChange(cb: (state: LaunchState) => void): () => void;
  /** Subscribe to operation errors (install/update/launch). Returns an unsubscribe function. */
  onError(cb: (message: string) => void): () => void;
}
