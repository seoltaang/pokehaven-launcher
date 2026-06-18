// Launches electron-vite with a clean environment.
//
// Some hosts (e.g. VS Code's extension host) export ELECTRON_RUN_AS_NODE=1.
// When that variable is merely *present* — even empty — the electron binary
// boots as plain Node instead of a GUI app (no window; `app` is undefined),
// and forcing it can crash with "Assertion failed: snapshot_data() != nullptr".
// It must be fully removed before launching, which `cross-env` cannot do, so
// we delete it here and spawn electron-vite with the cleaned environment.
import { spawn } from 'node:child_process';

delete process.env.ELECTRON_RUN_AS_NODE;

const sub = process.argv[2] ?? 'dev';
const child = spawn('electron-vite', [sub], {
  stdio: 'inherit',
  shell: true,
  env: process.env,
  windowsHide: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
