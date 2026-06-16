import { contextBridge } from "electron";
let account = { username: "Trainer_Red", uuid: "00000000-0000-0000-0000-000000000001", loggedIn: true };
let settings = { ramMB: 6144, directConnect: true, instanceDir: "C:/Users/you/PokeHavenLauncher/instance" };
const api = {
  getStatus: async () => ({
    state: "update-available",
    packVersion: "2026.06.17",
    minecraft: "1.21.1",
    neoforge: "21.1.233",
    online: true
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
  },
  setSettings: async (patch) => {
    settings = { ...settings, ...patch };
    return settings;
  }
};
contextBridge.exposeInMainWorld("launcher", api);
