// src/core/java.test.ts
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { javaExecutablePath } from './java.js';

describe('javaExecutablePath', () => {
  it('windows uses bin/java.exe', () => {
    expect(javaExecutablePath('C:/rt/delta', 'windows')).toBe(join('C:/rt/delta', 'bin', 'java.exe'));
  });
  it('linux uses bin/java', () => {
    expect(javaExecutablePath('/rt/delta', 'linux')).toBe(join('/rt/delta', 'bin', 'java'));
  });
  it('macOS uses the jre.bundle layout', () => {
    expect(javaExecutablePath('/rt/delta', 'osx')).toBe(join('/rt/delta', 'jre.bundle', 'Contents', 'Home', 'bin', 'java'));
  });
});
