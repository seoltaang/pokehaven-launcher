// src/renderer/src/global.d.ts
/// <reference types="svelte" />
import type { LauncherApi } from '../../shared/ipc.js';

declare global {
  interface Window {
    launcher: LauncherApi;
  }
}

export {};
