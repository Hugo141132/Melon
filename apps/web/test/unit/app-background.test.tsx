import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import AppBackground from '@/components/layout/AppBackground';

describe('AppBackground Component', () => {
  it('renders decorative background with aria-hidden="true" and pointer-events-none', () => {
    const { container } = render(<AppBackground />);
    const rootEl = container.firstElementChild as HTMLElement;

    expect(rootEl).not.toBeNull();
    expect(rootEl.getAttribute('aria-hidden')).toBe('true');
    expect(rootEl.className).toContain('pointer-events-none');
    expect(rootEl.className).toContain('fixed');
    expect(rootEl.className).toContain('inset-0');
    expect(rootEl.className).toContain('-z-10');
  });

  it('renders the inlined SVG vector element with correct viewBox and aspect ratio', () => {
    const { container } = render(<AppBackground />);
    const svgEl = container.querySelector('svg');

    expect(svgEl).not.toBeNull();
    expect(svgEl?.getAttribute('viewBox')).toBe('0 0 1440 900');
    expect(svgEl?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
  });

  it('applies custom className and variant props correctly', () => {
    const { container, rerender } = render(
      <AppBackground className="custom-test-layer" variant="subtle" />
    );
    expect(container.firstElementChild?.className).toContain('custom-test-layer');

    const subtleWash = container.querySelector('.bg-white\\/40');
    expect(subtleWash).not.toBeNull();

    rerender(<AppBackground variant="vibrant" />);
    const vibrantWash = container.querySelector('.bg-transparent');
    expect(vibrantWash).not.toBeNull();
  });
});
