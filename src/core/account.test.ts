import { describe, it, expect } from 'vitest';
import { toAccount, isExpired } from './account.js';

describe('toAccount', () => {
  it('maps a Minecraft profile to a renderer-safe Account (no token)', () => {
    expect(toAccount({ id: 'uuid-1', name: 'Trainer_Red' })).toEqual({
      username: 'Trainer_Red',
      uuid: 'uuid-1',
      loggedIn: true,
    });
  });
});

describe('isExpired', () => {
  it('is false well before expiry', () => {
    // exp is epoch SECONDS; now is ms
    expect(isExpired(2_000, 1_000_000)).toBe(false); // exp=2000s=2_000_000ms > 1_000_000ms
  });
  it('is true at/after expiry', () => {
    expect(isExpired(1_000, 1_000_000)).toBe(true); // exp=1000s=1_000_000ms <= now
  });
  it('treats a 60s skew window as expired early', () => {
    // exp 1_000_000ms, now 950_000ms, skew 60s → 950_000 + 60_000 = 1_010_000 >= 1_000_000 → expired
    expect(isExpired(1_000, 950_000, 60)).toBe(true);
  });
});
