// src/main/token-store.ts
import { createRequire } from 'node:module';
import { readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { types as MsmcTypes } from 'msmc';

const require = createRequire(import.meta.url);
const { app, safeStorage } = require('electron') as typeof import('electron');

type MCToken = MsmcTypes.MCToken;

function tokenFile(): string {
  return join(app.getPath('userData'), 'auth', 'session.bin');
}

/** Encrypt and persist the Minecraft session token. */
export async function saveToken(token: MCToken): Promise<void> {
  const file = tokenFile();
  await mkdir(dirname(file), { recursive: true });
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS encryption (safeStorage) is unavailable; refusing to store token in plaintext');
  }
  const encrypted = safeStorage.encryptString(JSON.stringify(token));
  await writeFile(file, encrypted);
}

/** Load and decrypt the saved token, or null if none / unreadable. */
export async function loadToken(): Promise<MCToken | null> {
  try {
    const buf = await readFile(tokenFile());
    if (!safeStorage.isEncryptionAvailable()) return null;
    return JSON.parse(safeStorage.decryptString(buf)) as MCToken;
  } catch {
    return null;
  }
}

/** Remove the persisted token. */
export async function clearToken(): Promise<void> {
  await rm(tokenFile(), { force: true });
}
