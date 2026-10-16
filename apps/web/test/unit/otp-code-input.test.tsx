import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OtpCodeInput from '@/components/auth/OtpCodeInput';

describe('OtpCodeInput Component', () => {
  it('renders 6 individual digit cells grouped 3-3 with a separator dash', () => {
    const handleChange = vi.fn();
    render(<OtpCodeInput value="" onChange={handleChange} />);

    // 6 input cells with accessible labels
    for (let i = 1; i <= 6; i++) {
      expect(screen.getByLabelText(`Digit ${i}`)).toBeInTheDocument();
    }

    // Separator dash is present
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('handles typing and propagates character updates', () => {
    const handleChange = vi.fn();
    render(<OtpCodeInput value="" onChange={handleChange} />);

    const firstCell = screen.getByLabelText('Digit 1');
    fireEvent.change(firstCell, { target: { value: '5' } });

    expect(handleChange).toHaveBeenCalledWith('5');
  });

  it('supports pasting a 6-digit code and calls onComplete', () => {
    const handleChange = vi.fn();
    const handleComplete = vi.fn();
    render(<OtpCodeInput value="" onChange={handleChange} onComplete={handleComplete} />);

    const firstCell = screen.getByLabelText('Digit 1');
    fireEvent.paste(firstCell, {
      clipboardData: {
        getData: () => '123456',
      },
    });

    expect(handleChange).toHaveBeenCalledWith('123456');
    expect(handleComplete).toHaveBeenCalledWith('123456');
  });

  it('renders error state border styling when hasError is true', () => {
    render(<OtpCodeInput value="12" onChange={vi.fn()} hasError={true} />);

    const firstCell = screen.getByLabelText('Digit 1');
    expect(firstCell.className).toContain('border-error');
  });

  it('handles backspace navigation when current cell is empty', () => {
    const handleChange = vi.fn();
    render(<OtpCodeInput value="12" onChange={handleChange} />);

    const thirdCell = screen.getByLabelText('Digit 3');
    fireEvent.keyDown(thirdCell, { key: 'Backspace' });

    // Should clear second digit
    expect(handleChange).toHaveBeenCalledWith('1');
  });
});
