// src/main/auth.ts
import { Auth, tokenUtils } from 'msmc';
import type { Account } from '../shared/ipc.js';

type Minecraft = Awaited<ReturnType<Awaited<ReturnType<Auth['launch']>>['getMinecraft']>>;
import type { GameAccount } from '../core/launch-game.js';
import { toAccount } from '../core/account.js';
import { saveToken, loadToken, clearToken } from './token-store.js';

/** The live Minecraft session, held in main only. */
let current: Minecraft | null = null;

/** Open the Microsoft login window, persist the session, return safe account info. */
export async function login(): Promise<Account> {
  try {
    console.log('[auth] launching Microsoft login window…');
    const auth = new Auth('select_account');
    const xbox = await auth.launch('electron', { width: 520, height: 680 });
    console.log('[auth] xbox token acquired; fetching Minecraft profile…');
    const mc = await xbox.getMinecraft();
    current = mc;
    await saveToken(mc.getToken(true));
    console.log('[auth] login OK:', mc.profile?.name);
    return toAccount({ id: mc.profile?.id ?? '', name: mc.profile?.name ?? '' });
  } catch (e) {
    console.error('[auth] login failed:', e);
    throw new Error(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));
  }
}

/** Restore a saved session on startup (refreshing it). Returns null if none/invalid. */
export async function restore(): Promise<Account | null> {
  const token = await loadToken();
  if (!token) return null;
  try {
    const mc = await tokenUtils.fromToken(new Auth(), token, true);
    current = mc;
    await saveToken(mc.getToken(true)); // persist the refreshed token
    return toAccount({ id: mc.profile?.id ?? '', name: mc.profile?.name ?? '' });
  } catch {
    await clearToken();
    current = null;
    return null;
  }
}

/** Forget the session. */
export async function logout(): Promise<void> {
  current = null;
  await clearToken();
}

/** Renderer-safe account, or a logged-out placeholder. */
export function getCurrentAccount(): Account {
  if (!current) return { username: '', uuid: '', loggedIn: false };
  return toAccount({ id: current.profile?.id ?? '', name: current.profile?.name ?? '' });
}

/** Full account incl. access token — MAIN ONLY, for the launch engine (Plan 4). */
export function getGameAccount(): GameAccount | null {
  if (!current) return null;
  return {
    name: current.profile?.name ?? '',
    uuid: current.profile?.id ?? '',
    accessToken: current.mcToken,
  };
}
