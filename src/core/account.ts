// src/core/account.ts
import type { Account } from '../shared/ipc.js';

/** Map a Minecraft profile (from msmc) to the renderer-safe Account (no token). */
export function toAccount(profile: { id: string; name: string }): Account {
  return { username: profile.name, uuid: profile.id, loggedIn: true };
}

/**
 * Whether a session is expired. `expSeconds` is epoch seconds (msmc `exp`),
 * `nowMs` is epoch milliseconds. `skewSeconds` refreshes slightly early.
 */
export function isExpired(expSeconds: number, nowMs: number, skewSeconds = 0): boolean {
  return nowMs + skewSeconds * 1000 >= expSeconds * 1000;
}
