'use client';

import React, { useRef, useEffect, KeyboardEvent, ClipboardEvent, ChangeEvent } from 'react';
import { cn } from '@/lib/utils';

export interface OtpCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  hasError?: boolean;
  onComplete?: (code: string) => void;
  className?: string;
  idPrefix?: string;
}

/**
 * OtpCodeInput
 *
 * 6-digit verification code cells grouped 3–3 with a centered separator dash (-).
 * Styled using the project's canonical design color tokens (not external dark themes).
 * Supports keyboard arrow navigation, backspace rewinding, paste handling,
 * mobile numeric keypad (inputMode="numeric"), accessible digit aria-labels,
 * and high-contrast error states.
 */
export default function OtpCodeInput({
  value,
  onChange,
  disabled = false,
  autoFocus = true,
  hasError = false,
  onComplete,
  className,
  idPrefix = 'otp-cell',
}: OtpCodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Parse digits into 6 fixed slots
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled && inputRefs.current[0]) {
      // Focus first cell or first empty cell on mount
      const firstEmptyIndex = digits.findIndex((d) => !d);
      const targetIndex = firstEmptyIndex === -1 ? 0 : firstEmptyIndex;
      inputRefs.current[targetIndex]?.focus();
    }
  }, []); // Run once on mount

  const focusCell = (index: number) => {
    const clampedIndex = Math.max(0, Math.min(5, index));
    inputRefs.current[clampedIndex]?.focus();
    inputRefs.current[clampedIndex]?.select();
  };

  const handleCellChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
    const rawVal = e.target.value.replace(/\D/g, '');
    if (!rawVal) {
      // Cleared
      const newDigits = [...digits];
      newDigits[index] = '';
      const updatedCode = newDigits.join('').replace(/\s/g, '');
      onChange(updatedCode);
      return;
    }

    // Handle multi-digit entry (e.g. browser autofill or programmatic input)
    if (rawVal.length > 1) {
      const sliced = rawVal.slice(0, 6);
      onChange(sliced);
      const targetFocus = Math.min(sliced.length, 5);
      focusCell(targetFocus);
      if (sliced.length === 6 && onComplete) {
        onComplete(sliced);
      }
      return;
    }

    // Single digit entry
    const lastDigit = rawVal.slice(-1);
    const newDigits = [...digits];
    newDigits[index] = lastDigit;
    const updatedCode = newDigits.join('');
    onChange(updatedCode);

    if (index < 5 && lastDigit) {
      focusCell(index + 1);
    }

    if (updatedCode.length === 6 && onComplete) {
      onComplete(updatedCode);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!digits[index] && index > 0) {
        // Backspace on empty cell moves to and clears previous cell
        e.preventDefault();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        const updatedCode = newDigits.join('');
        onChange(updatedCode);
        focusCell(index - 1);
      }
    } else if (e.key === 'ArrowLeft') {
      if (index > 0) {
        e.preventDefault();
        focusCell(index - 1);
      }
    } else if (e.key === 'ArrowRight') {
      if (index < 5) {
        e.preventDefault();
        focusCell(index + 1);
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasteData) return;

    onChange(pasteData);

    // Focus cell after last pasted character or cell 5
    const targetFocus = Math.min(pasteData.length, 5);
    focusCell(targetFocus);

    if (pasteData.length === 6 && onComplete) {
      onComplete(pasteData);
    }
  };

  const renderCell = (index: number) => {
    const isFilled = Boolean(digits[index]);

    return (
      <input
        key={index}
        ref={(el) => {
          inputRefs.current[index] = el;
        }}
        id={`${idPrefix}-${index}`}
        type="text"
        inputMode="numeric"
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
        pattern="[0-9]*"
        maxLength={1}
        value={digits[index]}
        disabled={disabled}
        onChange={(e) => handleCellChange(e, index)}
        onKeyDown={(e) => handleKeyDown(e, index)}
        onPaste={handlePaste}
        aria-label={`Digit ${index + 1}`}
        className={cn(
          'w-11 h-13 sm:w-13 sm:h-15 text-center font-mono text-[22px] sm:text-[26px] font-bold rounded-xl transition-all outline-none',
          'bg-app-surface text-app-on-surface select-none',
          hasError
            ? 'border-2 border-error focus:border-error focus:ring-2 focus:ring-error/20 bg-error/5'
            : isFilled
              ? 'border-2 border-app-primary/80 focus:border-app-primary focus:ring-2 focus:ring-app-primary/15'
              : 'border-[1.5px] border-app-outline-variant/60 focus:border-app-primary focus:ring-2 focus:ring-app-primary/15',
          disabled && 'opacity-60 cursor-not-allowed bg-app-surface-container-low'
        )}
      />
    );
  };

  return (
    <div
      className={cn('flex items-center justify-center gap-1.5 sm:gap-2.5 my-2', className)}
      data-testid="otp-code-input"
    >
      {/* First 3-cell group */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {renderCell(0)}
        {renderCell(1)}
        {renderCell(2)}
      </div>

      {/* Centered separator dash */}
      <div
        className="flex items-center justify-center px-1 text-app-outline font-bold text-xl select-none"
        aria-hidden="true"
      >
        —
      </div>

      {/* Second 3-cell group */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {renderCell(3)}
        {renderCell(4)}
        {renderCell(5)}
      </div>
    </div>
  );
}
