// src/renderer/src/lib/format.ts
import type { LauncherStatus } from '../../../shared/ipc.js';

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = n / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function formatStatusLine(
  s: Pick<LauncherStatus, 'packVersion' | 'minecraft' | 'neoforge' | 'online'>,
): string {
  const parts = [
    `PACK ${s.packVersion}`,
    `MC ${s.minecraft}`,
    `NEOFORGE ${s.neoforge}`,
    s.online ? 'ONLINE' : 'OFFLINE',
  ];
  return parts.join('  ·  ');
}

export function formatProgress(fraction: number, currentFile: string): { percent: number; text: string } {
  const clamped = Math.min(1, Math.max(0, fraction));
  const percent = Math.round(clamped * 100);
  return { percent, text: `${percent}%  ${currentFile}` };
}
