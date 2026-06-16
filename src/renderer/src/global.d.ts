// src/renderer/src/global.d.ts
import type { LauncherApi } from '../../shared/ipc.js';

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}

export {};
