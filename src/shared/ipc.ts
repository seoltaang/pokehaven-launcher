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
  minimize(): void;
  close(): void;
}
