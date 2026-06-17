// src/core/launch-game.test.ts
import { describe, it, expect } from 'vitest';
import { buildLaunchOption } from './launch-game.js';

const base = {
  instanceRoot: '/inst',
  versionId: 'neoforge-21.1.233',
  javaPath: '/jre/bin/java',
  maxMemoryMB: 6144,
  account: { name: 'Trainer_Red', uuid: 'uuid-1', accessToken: 'tok' },
};

describe('buildLaunchOption', () => {
  it('maps instance/java/version/memory/account', () => {
    const o = buildLaunchOption(base);
    expect(o.gamePath).toBe('/inst');
    expect(o.resourcePath).toBe('/inst');
    expect(o.javaPath).toBe('/jre/bin/java');
    expect(o.version).toBe('neoforge-21.1.233');
    expect(o.maxMemory).toBe(6144);
    expect(o.gameProfile).toEqual({ name: 'Trainer_Red', id: 'uuid-1' });
    expect(o.accessToken).toBe('tok');
    expect(o.userType).toBe('mojang');
  });

  it('omits quickPlay when no server is given', () => {
    expect(buildLaunchOption(base).quickPlayMultiplayer).toBeUndefined();
  });

  it('sets quickPlayMultiplayer to ip:port when a server is given', () => {
    expect(buildLaunchOption({ ...base, server: { ip: 'play.phf.gg', port: 25577 } }).quickPlayMultiplayer)
      .toBe('play.phf.gg:25577');
  });

  it('defaults the server port to 25565', () => {
    expect(buildLaunchOption({ ...base, server: { ip: 'play.phf.gg' } }).quickPlayMultiplayer)
      .toBe('play.phf.gg:25565');
  });
});
