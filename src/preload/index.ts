// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
import type { LauncherApi, Account, Settings } from '../shared/ipc.js';

let settings: Settings = { ramMB: 6144, directConnect: true, instanceDir: 'C:/Users/you/PokeHavenLauncher/instance' };

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

contextBridge.exposeInMainWorld('launcher', api);
