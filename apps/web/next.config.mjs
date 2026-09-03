import path from 'path';
import { fileURLToPath } from 'url';
import createNextIntlPlugin from 'next-intl/plugin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production';

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://lh3.googleusercontent.com https://i.pinimg.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self';",
  },
];

if (isProd) {
  securityHeaders.push({
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  });
}

const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['@node-rs/argon2'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'i.pinimg.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/settings',
        destination: '/setting',
        permanent: true,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const baseConfig = {
  ...nextConfig,
  turbopack: {
    resolveAlias: {
      'next-intl/config': './i18n/request.ts',
    },
  },
};

const finalConfig = withNextIntl(baseConfig);

if (finalConfig.experimental?.turbo) {
  delete finalConfig.experimental.turbo;
}

export default finalConfig;
