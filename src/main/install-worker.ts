// src/main/install-worker.ts
// Forked with the SYSTEM node binary (not Electron's node): the NeoForge install
// hangs under Electron's Node, but completes in a normal Node process. Uses
// Node child-process IPC (process.send / process.on('message')).
import { installGame } from '../core/install-game.js';
import type { InstallGameResult } from '../core/install-game.js';

interface WorkerRequest {
  instanceRoot: string;
  minecraft: string;
  neoforge: string;
  runtimeDir: string;
  downloadConcurrency?: number;
}

const send = (msg: unknown): void => {
  process.send?.(msg);
};

process.on('message', (req: WorkerRequest) => {
  installGame({
    instanceRoot: req.instanceRoot,
    minecraft: req.minecraft,
    neoforge: req.neoforge,
    runtimeDir: req.runtimeDir,
    downloadConcurrency: req.downloadConcurrency,
    onPhase: (phase) => send({ type: 'phase', phase }),
    onProgress: (fraction, detail) => send({ type: 'progress', fraction, detail }),
  })
    .then((result: InstallGameResult) => {
      // Exit only AFTER the 'done' message has flushed to the parent.
      process.send?.({ type: 'done', result }, () => process.exit(0));
    })
    .catch((err: unknown) => {
      process.send?.(
        { type: 'error', message: err instanceof Error ? err.message : String(err) },
        () => process.exit(1),
      );
    });
});

// Signal readiness so the parent sends the request without a race.
send({ type: 'ready' });
