// src/main/install-worker.ts
// Forked with the SYSTEM node binary (not Electron's node): both the NeoForge
// install AND the game launch (natives extraction) hang under Electron's Node,
// but complete in a normal Node process. Uses Node child-process IPC.
import { installGame } from '../core/install-game.js';
import type { InstallGameResult } from '../core/install-game.js';
import { launchGame, createMinecraftProcessWatcher } from '../core/launch-game.js';
import type { GameAccount } from '../core/launch-game.js';

interface InstallReq {
  command: 'install';
  instanceRoot: string;
  minecraft: string;
  neoforge: string;
  runtimeDir: string;
  downloadConcurrency?: number;
}
interface LaunchReq {
  command: 'launch';
  instanceRoot: string;
  versionId: string;
  runtimeDir: string;
  maxMemoryMB: number;
  account: GameAccount;
  server?: { ip: string; port?: number };
}
type Req = InstallReq | LaunchReq;

const send = (msg: unknown): void => {
  process.send?.(msg);
};
const sendExit = (msg: unknown, code: number): void => {
  process.send?.(msg, () => process.exit(code));
};
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function runInstall(req: InstallReq): void {
  installGame({
    instanceRoot: req.instanceRoot,
    minecraft: req.minecraft,
    neoforge: req.neoforge,
    runtimeDir: req.runtimeDir,
    downloadConcurrency: req.downloadConcurrency,
    onPhase: (phase) => send({ type: 'phase', phase }),
    onProgress: (fraction, detail) => send({ type: 'progress', fraction, detail }),
  })
    .then((result: InstallGameResult) => sendExit({ type: 'done', result }, 0))
    .catch((err: unknown) => sendExit({ type: 'error', message: errMsg(err) }, 1));
}

async function runLaunch(req: LaunchReq): Promise<void> {
  const { Version } = await import('@xmcl/core');
  const { ensureJava } = await import('../core/java.js');
  const resolved = await Version.parse(req.instanceRoot, req.versionId);
  const javaPath = await ensureJava(
    resolved.javaVersion.component,
    resolved.javaVersion.majorVersion,
    req.runtimeDir,
  );
  const proc = await launchGame({
    instanceRoot: req.instanceRoot,
    versionId: req.versionId,
    javaPath,
    maxMemoryMB: req.maxMemoryMB,
    account: req.account,
    server: req.server,
  });
  send({ type: 'launch-spawned', pid: proc.pid });
  const watcher = createMinecraftProcessWatcher(proc);
  watcher.on('minecraft-window-ready', () => send({ type: 'launch-window' }));
  watcher.on('minecraft-exit', (ev) => sendExit({ type: 'launch-exit', code: ev.code }, 0));
  watcher.on('error', (e) => sendExit({ type: 'launch-error', message: errMsg(e) }, 1));
}

process.on('message', (req: Req) => {
  if (req.command === 'install') {
    runInstall(req);
  } else if (req.command === 'launch') {
    runLaunch(req).catch((err: unknown) => sendExit({ type: 'launch-error', message: errMsg(err) }, 1));
  }
});

// Signal readiness so the parent sends the request without a race.
send({ type: 'ready' });
