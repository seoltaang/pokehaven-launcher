// src/main/server-status.ts
import { status } from 'minecraft-server-util';
import type { ServerStatus } from '../shared/ipc.js';
import { SERVER, SERVER_MAX_PLAYERS } from './config.js';

/** Query the PokeHaven Frontier server via the Minecraft Server List Ping. */
export async function getServerStatus(): Promise<ServerStatus> {
  try {
    const res = await status(SERVER.ip, SERVER.port, { timeout: 5000 });
    return {
      online: true,
      players: res.players.online,
      maxPlayers: res.players.max || SERVER_MAX_PLAYERS,
    };
  } catch {
    return { online: false, players: 0, maxPlayers: SERVER_MAX_PLAYERS };
  }
}
