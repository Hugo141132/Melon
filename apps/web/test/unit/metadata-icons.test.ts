import { describe, it, expect } from 'vitest';
import { metadata } from '@/app/layout';

describe('Layout Metadata: Adaptive Favicon & Document Title', () => {
  it('enforces exact document title "Melon Governance"', () => {
    expect(metadata.title).toEqual({
      default: 'Melon Governance',
      template: '%s | Melon Governance',
    });
  });

  it('declares native dual-scheme favicon icons with light and dark media queries', () => {
    expect(metadata.icons).toBeDefined();
    const icons = metadata.icons as any;

    expect(Array.isArray(icons.icon)).toBe(true);
    expect(icons.icon).toHaveLength(2);

    const lightIcon = icons.icon.find((i: any) => i.media === '(prefers-color-scheme: light)');
    const darkIcon = icons.icon.find((i: any) => i.media === '(prefers-color-scheme: dark)');

    expect(lightIcon).toBeDefined();
    expect(lightIcon.url).toBe('/favicon-light.png');
    expect(lightIcon.type).toBe('image/png');

    expect(darkIcon).toBeDefined();
    expect(darkIcon.url).toBe('/favicon-dark.png');
    expect(darkIcon.type).toBe('image/png');

    expect(icons.shortcut).toBeUndefined();
    expect(icons.apple).toBeUndefined();
  });

  it('verifies physical existence and validity of root static favicon.ico asset', () => {
    const fs = require('fs');
    const path = require('path');
    const faviconPath =
      [
        path.join(process.cwd(), 'public', 'favicon.ico'),
        path.join(process.cwd(), 'apps', 'web', 'public', 'favicon.ico'),
        path.resolve(__dirname, '../../public/favicon.ico'),
      ].find((p) => fs.existsSync(p)) || path.resolve(__dirname, '../../public/favicon.ico');
    expect(fs.existsSync(faviconPath)).toBe(true);

    const buf = fs.readFileSync(faviconPath);
    expect(buf.length).toBeGreaterThan(100);
    // Verify ICO magic numbers: reserved 0, type 1 (ICO), count >= 1
    expect(buf.readUInt16LE(0)).toBe(0);
    expect(buf.readUInt16LE(2)).toBe(1);
    expect(buf.readUInt16LE(4)).toBeGreaterThanOrEqual(1);
  });
});
