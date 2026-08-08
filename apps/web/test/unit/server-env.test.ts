import { describe, it, expect } from 'vitest';
import { validateServerEnv } from '../../lib/env/server';

describe('Web Server Environment Guard', () => {
  it('allows ENABLE_FAUCET_CONTROL=true when APP_ENV=staging even if NODE_ENV=production', () => {
    const config = validateServerEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      ENABLE_FAUCET_CONTROL: 'true',
    });

    expect(config.APP_ENV).toBe('staging');
    expect(config.ENABLE_FAUCET_CONTROL).toBe(true);
  });

  it('rejects ENABLE_FAUCET_CONTROL=true when APP_ENV=production', () => {
    expect(() =>
      validateServerEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        ENABLE_FAUCET_CONTROL: 'true',
      })
    ).toThrowError(/ENABLE_FAUCET_CONTROL=true is rejected in production/);
  });

  it('rejects ENABLE_FAUCET_CONTROL=true when NODE_ENV=production and APP_ENV is unset', () => {
    expect(() =>
      validateServerEnv({
        NODE_ENV: 'production',
        ENABLE_FAUCET_CONTROL: 'true',
      })
    ).toThrowError(/ENABLE_FAUCET_CONTROL=true is rejected in production/);
  });

  it('defaults ENABLE_FAUCET_CONTROL to false when omitted', () => {
    const config = validateServerEnv({
      NODE_ENV: 'development',
      APP_ENV: 'development',
    });

    expect(config.ENABLE_FAUCET_CONTROL).toBe(false);
  });
});
