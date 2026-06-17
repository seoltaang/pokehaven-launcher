// src/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron';
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
  minimize: () => ipcRenderer.send('window:minimize'),
  close: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('launcher', api);
