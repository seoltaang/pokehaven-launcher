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
  openInstanceDir: () => ipcRenderer.send('instance:open'),
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
  onError: (cb: (message: string) => void) => {
    const listener = (_e: unknown, m: string) => cb(m);
    ipcRenderer.on('launcher:error', listener);
    return () => ipcRenderer.removeListener('launcher:error', listener);
  },
};

contextBridge.exposeInMainWorld('launcher', api);
