// Bundle a Node binary with the app so the install/launch worker can be forked
// on machines without Node installed. The packaged worker hangs under Electron's
// own Node, so we ship a real Node and fork that.
//
// We simply copy the Node binary currently running this script (process.execPath).
// Locally that's the dev machine's Node; in CI each runner copies its own
// platform/arch Node (win-x64 on windows-latest, darwin-arm64 on macos-14).
import { copyFileSync, mkdirSync, chmodSync, statSync } from 'node:fs';
import { join } from 'node:path';

const outDir = join(process.cwd(), 'build', 'node');
mkdirSync(outDir, { recursive: true });

const name = process.platform === 'win32' ? 'node.exe' : 'node';
const dest = join(outDir, name);
copyFileSync(process.execPath, dest);
if (process.platform !== 'win32') chmodSync(dest, 0o755); // preserve executable bit

const mb = (statSync(dest).size / 1e6).toFixed(0);
console.log(`bundled node: ${process.execPath} (${process.version}) -> ${dest} [${mb} MB]`);
