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
});
