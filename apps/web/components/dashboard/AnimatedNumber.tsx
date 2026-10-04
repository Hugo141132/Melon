'use client';

import React, { useEffect, useRef } from 'react';

export interface AnimatedNumberProps {
  value: number | null | undefined;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  fallback?: string;
  className?: string;
  dataTestId?: string;
}

function formatValue(val: number, decimals: number, prefix: string, suffix: string): string {
  const formattedNum = decimals > 0 ? val.toFixed(decimals) : Math.round(val).toString();
  return `${prefix}${formattedNum}${suffix}`;
}

/**
 * AnimatedNumber
 *
 * Lightweight isolated number counter inspired by 21st.dev patterns.
 * - Performs direct DOM updates via requestAnimationFrame without triggering per-frame React re-renders.
 * - Animates only on initial entry or when numeric value genuinely changes; avoids replay on unrelated renders.
 * - Respects prefers-reduced-motion by rendering the target value immediately.
 * - Preserves decimals, units, zero values, and unavailable states.
 */
export default function AnimatedNumber({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  duration = 600,
  fallback = '--',
  className,
  dataTestId,
}: AnimatedNumberProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const prevValueRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    // Handle null, undefined, or NaN
    if (value === null || value === undefined || isNaN(value)) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      prevValueRef.current = null;
      el.textContent = `${prefix}${fallback}${suffix}`;
      return;
    }

    // Check prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    // When reduced motion is requested, render target value immediately without animation
    if (prefersReducedMotion) {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      el.textContent = formatValue(value, decimals, prefix, suffix);
      prevValueRef.current = value;
      return;
    }

    // If value hasn't changed, keep current display without replaying
    if (prevValueRef.current === value) {
      el.textContent = formatValue(value, decimals, prefix, suffix);
      return;
    }

    const startValue = prevValueRef.current ?? 0;
    const endValue = value;
    const startTime = performance.now();

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, Math.max(0, elapsed / duration));
      // Ease out cubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * ease;

      el.textContent = formatValue(current, decimals, prefix, suffix);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(tick);
      } else {
        el.textContent = formatValue(endValue, decimals, prefix, suffix);
        prevValueRef.current = endValue;
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [value, decimals, prefix, suffix, duration, fallback]);

  const initialDisplay =
    value === null || value === undefined || isNaN(value)
      ? `${prefix}${fallback}${suffix}`
      : formatValue(value, decimals, prefix, suffix);

  return (
    <span ref={spanRef} className={className} data-testid={dataTestId}>
      {initialDisplay}
    </span>
  );
}
