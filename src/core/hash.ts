// src/core/hash.ts
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** Streaming SHA-1 of a file, returned as lowercase hex. Rejects on read error. */
export function sha1OfFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha1');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
