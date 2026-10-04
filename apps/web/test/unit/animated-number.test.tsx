import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AnimatedNumber from '@/components/dashboard/AnimatedNumber';

describe('AnimatedNumber Component Lifecycle & Lifecycle Verification', () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    vi.restoreAllMocks();
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('renders integer without decimals correctly', () => {
    render(<AnimatedNumber value={12} dataTestId="test-int" />);
    expect(screen.getByTestId('test-int')).toHaveTextContent('12');
  });

  it('preserves specified decimals and formats with suffix', () => {
    render(<AnimatedNumber value={29.4} decimals={1} suffix="°C" dataTestId="test-temp" />);
    expect(screen.getByTestId('test-temp')).toHaveTextContent('29.4°C');
  });

  it('renders zero properly without falling back to unavailable state', () => {
    render(<AnimatedNumber value={0} dataTestId="test-zero" />);
    expect(screen.getByTestId('test-zero')).toHaveTextContent('0');
  });

  it('renders fallback when value is null, undefined, or NaN', () => {
    const { rerender } = render(<AnimatedNumber value={null} dataTestId="test-fallback" />);
    expect(screen.getByTestId('test-fallback')).toHaveTextContent('--');

    rerender(<AnimatedNumber value={undefined} fallback="N/A" dataTestId="test-fallback" />);
    expect(screen.getByTestId('test-fallback')).toHaveTextContent('N/A');

    rerender(<AnimatedNumber value={NaN} fallback="--" dataTestId="test-fallback" />);
    expect(screen.getByTestId('test-fallback')).toHaveTextContent('--');
  });

  it('formats with prefix and suffix correctly', () => {
    render(
      <AnimatedNumber
        value={32.1}
        decimals={1}
        prefix="Terasa seperti "
        suffix="°C"
        dataTestId="test-feels"
      />
    );
    expect(screen.getByTestId('test-feels')).toHaveTextContent('Terasa seperti 32.1°C');
  });

  it('respects prefers-reduced-motion by rendering target value immediately without RAF animation', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<AnimatedNumber value={85} dataTestId="test-reduced" />);
    expect(screen.getByTestId('test-reduced')).toHaveTextContent('85');
    expect(rafSpy).not.toHaveBeenCalled();
  });

  it('progresses smoothly through controlled requestAnimationFrame ticks', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    let currentCallback: FrameRequestCallback | null = null;
    let nextRafId = 1;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      currentCallback = cb;
      return nextRafId++;
    });

    render(<AnimatedNumber value={100} duration={1000} dataTestId="test-raf" />);

    // Initial frame callback registered
    expect(currentCallback).not.toBeNull();

    // Advance 500ms (50% progress, easeOutCubic: 1 - (1 - 0.5)^3 = 0.875)
    now = 1500;
    act(() => {
      currentCallback!(now);
    });

    // 0 + 100 * 0.875 = 87.5 -> rounded to 88
    expect(screen.getByTestId('test-raf')).toHaveTextContent('88');

    // Complete animation at 1000ms
    now = 2000;
    act(() => {
      currentCallback!(now);
    });
    expect(screen.getByTestId('test-raf')).toHaveTextContent('100');
  });

  it('cancels previous RAF when new target value arrives or component unmounts', () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    let rafCounter = 100;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => rafCounter++);

    const { rerender, unmount } = render(
      <AnimatedNumber value={50} duration={1000} dataTestId="test-cancel" />
    );

    // Update to new target value before old animation finishes
    rerender(<AnimatedNumber value={80} duration={1000} dataTestId="test-cancel" />);
    expect(cancelSpy).toHaveBeenCalled();

    // Unmount cancels active RAF
    cancelSpy.mockClear();
    unmount();
    expect(cancelSpy).toHaveBeenCalled();
  });

  it('does not replay animation when re-rendered with identical numeric value', () => {
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    const { rerender } = render(
      <AnimatedNumber value={42} decimals={0} dataTestId="test-identical" />
    );
    const initialCalls = rafSpy.mock.calls.length;

    // Rerender with identical value
    rerender(<AnimatedNumber value={42} decimals={0} dataTestId="test-identical" />);
    expect(rafSpy.mock.calls.length).toBe(initialCalls);
  });
});
