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

  describe('Internal Gateway & Readiness Environment Configuration', () => {
    it('defaults INTERNAL_GATEWAY_URL to localhost in dev/test and timeout to 2000ms', () => {
      const config = validateServerEnv({
        NODE_ENV: 'test',
        APP_ENV: 'test',
      });

      expect(config.INTERNAL_GATEWAY_URL).toBe('http://127.0.0.1:3001');
      expect(config.INTERNAL_GATEWAY_TIMEOUT_MS).toBe(2000);
    });

    it('rejects missing INTERNAL_GATEWAY_URL in strict production', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
        })
      ).toThrowError(/INTERNAL_GATEWAY_URL is required in production/);
    });

    it('rejects localhost/127.0.0.1 INTERNAL_GATEWAY_URL in strict production', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_GATEWAY_URL: 'http://127.0.0.1:3001',
          INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
        })
      ).toThrowError(/INTERNAL_GATEWAY_URL cannot use localhost/);
    });

    it('rejects missing INTERNAL_SERVICE_TOKEN in strict production', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
        })
      ).toThrowError(/INTERNAL_SERVICE_TOKEN is required in production/);
    });

    it('accepts valid production configuration with remote gateway and token', () => {
      const config = validateServerEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
        INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
        INTERNAL_GATEWAY_TIMEOUT_MS: '3000',
      });

      expect(config.INTERNAL_GATEWAY_URL).toBe('https://gateway.example.com');
      expect(config.INTERNAL_SERVICE_TOKEN).toBe('super_secret_token_12345');
      expect(config.INTERNAL_GATEWAY_TIMEOUT_MS).toBe(3000);
    });
  });
});
