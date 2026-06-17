// scripts/build-manifest.ts
// Scan a Minecraft instance and emit manifest.json + content-addressed file staging.
//
//   npm run build:manifest -- --profile "<instanceDir>" --base-url "<releaseDownloadBase>" \
//       --pack-version 2026.06.17 [--mc 1.21.1] [--neoforge 21.1.233] \
//       [--out out/manifest-stage] [--manifest-only]
//
// Then create a GitHub release and upload everything in <out>/files/* as assets,
// where the release's download base equals --base-url. Point the launcher's
// MANIFEST_URL at the uploaded manifest.json.
import { readdir, stat, mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { sha1OfFile } from '../src/core/hash.js';
import { classifyFile, assetUrl } from '../src/core/manifest-build.js';
import { parseManifest } from '../src/core/manifest.js';
import type { Manifest, ManifestFile } from '../src/core/types.js';

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1]!;
  if (fallback !== undefined) return fallback;
  throw new Error(`missing required --${name}`);
}
const hasFlag = (name: string): boolean => process.argv.includes(`--${name}`);
const toPosix = (p: string): string => p.split(sep).join('/');

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(root, full, out);
    else if (e.isFile()) out.push(toPosix(relative(root, full)));
  }
}

async function main() {
  const profile = arg('profile');
  const baseUrl = arg('base-url');
  const packVersion = arg('pack-version');
  const minecraft = arg('mc', '1.21.1');
  const neoforge = arg('neoforge', '21.1.233');
  const outDir = arg('out', 'out/manifest-stage');
  const manifestOnly = hasFlag('manifest-only');

  const all: string[] = [];
  await walk(profile, profile, all);
  const managed = all.filter((p) => classifyFile(p).managed).sort();

  const filesDir = join(outDir, 'files');
  if (!manifestOnly) await mkdir(filesDir, { recursive: true });

  const files: ManifestFile[] = [];
  let staged = 0;
  for (const path of managed) {
    const abs = join(profile, path);
    const { size } = await stat(abs);
    const sha1 = await sha1OfFile(abs);
    const { force } = classifyFile(path);
    files.push({ path, sha1, size, url: assetUrl(baseUrl, sha1), force });
    if (!manifestOnly) {
      await copyFile(abs, join(filesDir, sha1)); // content-addressed; dedupes identical files
      staged += 1;
    }
  }

  const manifest: Manifest = { packVersion, minecraft, neoforge, files };
  parseManifest(manifest); // self-validate before writing

  await mkdir(outDir, { recursive: true });
  const manifestPath = join(outDir, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  const forced = files.filter((f) => f.force).length;
  const totalBytes = files.reduce((n, f) => n + f.size, 0);
  console.log(`[manifest] ${files.length} files (${forced} forced, ${files.length - forced} preserved)`);
  console.log(`[manifest] total ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`[manifest] wrote ${manifestPath}${manifestOnly ? ' (manifest only)' : `; staged ${staged} files in ${filesDir}`}`);
}

main().catch((e) => {
  console.error('[manifest] failed:', e);
  process.exit(1);
});
