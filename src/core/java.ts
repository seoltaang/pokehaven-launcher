// src/core/java.ts
import { join } from 'node:path';
import {
  fetchJavaRuntimeManifest,
  installJavaRuntimeTask,
  resolveJava,
  scanLocalJava,
  getPotentialJavaLocations,
} from '@xmcl/installer';
import { getPlatform } from '@xmcl/core';

/** Path to the java executable inside a Mojang runtime install `home`. */
export function javaExecutablePath(home: string, platformName: string): string {
  if (platformName === 'windows') return join(home, 'bin', 'java.exe');
  if (platformName === 'osx') return join(home, 'jre.bundle', 'Contents', 'Home', 'bin', 'java');
  return join(home, 'bin', 'java');
}

/** Find an already-installed JDK/JRE on this machine matching the major version. */
export async function findLocalJava(majorVersion: number): Promise<string | undefined> {
  const locations = await getPotentialJavaLocations();
  const javas = await scanLocalJava(locations);
  return javas.find((j) => j.majorVersion === majorVersion)?.path;
}

/**
 * Ensure a Java executable for the given runtime component is available, returning
 * its path. Order: a previously-downloaded runtime → a matching system Java →
 * download Mojang's runtime for this component.
 */
export async function ensureJava(component: string, majorVersion: number, runtimeDir: string): Promise<string> {
  const platform = getPlatform();
  const dest = join(runtimeDir, component);

  const previously = javaExecutablePath(dest, platform.name);
  if (await resolveJava(previously)) return previously;

  const local = await findLocalJava(majorVersion);
  if (local) return local;

  const manifest = await fetchJavaRuntimeManifest({ target: component });
  await installJavaRuntimeTask({ destination: dest, manifest, lzma: false }).startAndWait();

  const installed = javaExecutablePath(dest, platform.name);
  if (!(await resolveJava(installed))) {
    throw new Error(`java install did not produce a runnable executable at ${installed}`);
  }
  return installed;
}
