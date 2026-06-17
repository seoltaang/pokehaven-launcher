// src/main/index.ts
// Under ESM, Electron's built-in `electron` module is only resolvable via a
// CommonJS require (not an ESM import), so bridge to it with createRequire.
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, ipcMain } = require('electron') as typeof import('electron');

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
      preload: join(import.meta.dirname, '../preload/index.cjs'),
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

ipcMain.on('window:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('window:close', (e) => BrowserWindow.fromWebContents(e.sender)?.close());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
