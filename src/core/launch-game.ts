// src/core/launch-game.ts
import type { ChildProcess } from 'node:child_process';
import { launch, createMinecraftProcessWatcher } from '@xmcl/core';
import type { LaunchOption } from '@xmcl/core';

export interface GameAccount {
  name: string;
  uuid: string;
  accessToken: string;
}

export interface LaunchParams {
  /** Instance dir (used as both gamePath and resourcePath). */
  instanceRoot: string;
  /** Launchable version id from installGame. */
  versionId: string;
  /** Java executable path. */
  javaPath: string;
  /** Max heap in MB (-Xmx). */
  maxMemoryMB: number;
  account: GameAccount;
  /** Optional direct-connect target. */
  server?: { ip: string; port?: number };
}

/** Pure mapping from our params to @xmcl's LaunchOption. */
export function buildLaunchOption(p: LaunchParams): LaunchOption {
  const option: LaunchOption = {
    gamePath: p.instanceRoot,
    resourcePath: p.instanceRoot,
    javaPath: p.javaPath,
    version: p.versionId,
    maxMemory: p.maxMemoryMB,
    gameProfile: { name: p.account.name, id: p.account.uuid },
    accessToken: p.account.accessToken,
    userType: 'mojang',
    // Hide the java console window on Windows.
    extraExecOption: { windowsHide: true },
  };
  if (p.server) {
    option.quickPlayMultiplayer = `${p.server.ip}:${p.server.port ?? 25565}`;
  }
  return option;
}

/** Launch Minecraft and return the child process. */
export function launchGame(p: LaunchParams): Promise<ChildProcess> {
  return launch(buildLaunchOption(p));
}

export { createMinecraftProcessWatcher };
