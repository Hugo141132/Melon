import { describe, it, expect } from 'vitest';
import { validateServerEnv } from '../../lib/env/server';

describe('Web Server Environment Guard', () => {
  it('allows ENABLE_FAUCET_CONTROL=true across development, staging, and production', () => {
    const configDev = validateServerEnv({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      ENABLE_FAUCET_CONTROL: 'true',
    });
    expect(configDev.ENABLE_FAUCET_CONTROL).toBe(true);

    const configStaging = validateServerEnv({
      NODE_ENV: 'production',
      APP_ENV: 'staging',
      ENABLE_FAUCET_CONTROL: 'true',
    });
    expect(configStaging.ENABLE_FAUCET_CONTROL).toBe(true);

    const configProd = validateServerEnv({
      NODE_ENV: 'production',
      APP_ENV: 'production',
      INTERNAL_GATEWAY_URL: 'https://gateway.internal:3001',
      INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
      APP_URL: 'https://melonmadura.my.id',
      ENABLE_FAUCET_CONTROL: 'true',
    });
    expect(configProd.ENABLE_FAUCET_CONTROL).toBe(true);
  });

  it('defaults ENABLE_FAUCET_CONTROL to true when omitted', () => {
    const config = validateServerEnv({
      NODE_ENV: 'development',
      APP_ENV: 'development',
    });

    expect(config.ENABLE_FAUCET_CONTROL).toBe(true);
  });

  it('respects explicit ENABLE_FAUCET_CONTROL=false if ever provided', () => {
    const config = validateServerEnv({
      NODE_ENV: 'development',
      APP_ENV: 'development',
      ENABLE_FAUCET_CONTROL: 'false',
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
        APP_URL: 'https://melon.example.com',
      });

      expect(config.INTERNAL_GATEWAY_URL).toBe('https://gateway.example.com');
      expect(config.INTERNAL_SERVICE_TOKEN).toBe('super_secret_token_12345');
      expect(config.INTERNAL_GATEWAY_TIMEOUT_MS).toBe(3000);
      expect(config.APP_URL).toBe('https://melon.example.com');
    });

    it('rejects missing APP_URL in strict production', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
          INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
        })
      ).toThrowError(/APP_URL is required in production/);
    });

    it('rejects non-HTTPS or localhost APP_URL in strict production', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
          INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
          APP_URL: 'http://localhost:3000',
        })
      ).toThrowError(/APP_URL must be an explicit trusted HTTPS URL/);
    });

    it('rejects default onboarding@resend.dev sender email in strict production when RESEND_API_KEY is configured', () => {
      expect(() =>
        validateServerEnv({
          NODE_ENV: 'production',
          APP_ENV: 'production',
          INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
          INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
          APP_URL: 'https://melon.example.com',
          RESEND_API_KEY: 're_test_12345678901234567890',
          RESEND_FROM_EMAIL: 'Kebun Melon <onboarding@resend.dev>',
        })
      ).toThrowError(/RESEND_FROM_EMAIL must use a verified sender domain in production/);
    });

    it('accepts valid production config with custom verified RESEND_FROM_EMAIL', () => {
      const config = validateServerEnv({
        NODE_ENV: 'production',
        APP_ENV: 'production',
        INTERNAL_GATEWAY_URL: 'https://gateway.example.com',
        INTERNAL_SERVICE_TOKEN: 'super_secret_token_12345',
        APP_URL: 'https://melon.example.com',
        RESEND_API_KEY: 're_test_12345678901234567890',
        RESEND_FROM_EMAIL: 'Kebun Melon <notifications@app.kebunmelon.id>',
      });

      expect(config.APP_URL).toBe('https://melon.example.com');
      expect(config.RESEND_FROM_EMAIL).toBe('Kebun Melon <notifications@app.kebunmelon.id>');
    });

    it('defaults RESEND_FROM_EMAIL to custom verified domain when omitted in non-production', () => {
      const config = validateServerEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
      });

      expect(config.RESEND_FROM_EMAIL).toBe('Melon Madura <noreply@melonmadura.my.id>');
    });

    it('defaults AUTH_RESET_TOKEN_EXPIRY_MINUTES and AUTH_VERIFY_TOKEN_EXPIRY_MINUTES to 1 (TASK-0218)', () => {
      const config = validateServerEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
      });

      expect(config.AUTH_RESET_TOKEN_EXPIRY_MINUTES).toBe(1);
      expect(config.AUTH_VERIFY_TOKEN_EXPIRY_MINUTES).toBe(1);
    });

    it('respects configured AUTH_RESET_TOKEN_EXPIRY_MINUTES and AUTH_VERIFY_TOKEN_EXPIRY_MINUTES', () => {
      const config = validateServerEnv({
        NODE_ENV: 'development',
        APP_ENV: 'development',
        AUTH_RESET_TOKEN_EXPIRY_MINUTES: '5',
        AUTH_VERIFY_TOKEN_EXPIRY_MINUTES: '3',
      });

      expect(config.AUTH_RESET_TOKEN_EXPIRY_MINUTES).toBe(5);
      expect(config.AUTH_VERIFY_TOKEN_EXPIRY_MINUTES).toBe(3);
    });
  });
});
