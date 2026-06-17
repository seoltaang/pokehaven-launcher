// scripts/smoke-launch.ts
// Manual end-to-end: install MC 1.21.1 + NeoForge into a throwaway instance and
// launch it offline. Multi-GB download; requires a desktop session for the window.
//   npm run smoke:launch
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { installGame } from '../src/core/install-game.js';
import { launchGame, createMinecraftProcessWatcher } from '../src/core/launch-game.js';

const instanceRoot = join(tmpdir(), 'phf-smoke-instance');
const runtimeDir = join(tmpdir(), 'phf-smoke-runtime');

async function main() {
  console.log('[smoke] instance:', instanceRoot);
  const { versionId, javaPath } = await installGame({
    instanceRoot,
    minecraft: '1.21.1',
    neoforge: '21.1.233',
    runtimeDir,
    downloadConcurrency: 4,
    onPhase: (p) => console.log('[smoke] phase:', p),
  });
  console.log('[smoke] installed versionId:', versionId, 'java:', javaPath);

  const proc = await launchGame({
    instanceRoot,
    versionId,
    javaPath,
    maxMemoryMB: 4096,
    account: { name: 'DevTrainer', uuid: '00000000000000000000000000000001', accessToken: '0' },
  });

  const watcher = createMinecraftProcessWatcher(proc);
  watcher.on('error', (e) => console.error('[smoke] error:', e));
  watcher.on('minecraft-window-ready', () => console.log('[smoke] window ready'));
  watcher.on('minecraft-exit', ({ code }) => {
    console.log('[smoke] minecraft exited code', code);
    process.exit(code ?? 0);
  });
}

main().catch((e) => {
  console.error('[smoke] failed:', e);
  process.exit(1);
});
