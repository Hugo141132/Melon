// @vitest-environment jsdom
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import UserAvatar from '@/components/auth/UserAvatar';

describe('UserAvatar Component', () => {
  it('renders initial uppercase letter from name', () => {
    render(<UserAvatar name="Wahyu" size="sm" />);
    const initialEl = screen.getByTestId('user-avatar-initial');
    expect(initialEl).toBeInTheDocument();
    expect(initialEl.textContent).toBe('W');
  });

  it('renders initial uppercase letter from lowercase email when name is email', () => {
    render(<UserAvatar name="admin@melonmadura.my.id" size="md" />);
    const initialEl = screen.getByTestId('user-avatar-initial');
    expect(initialEl).toBeInTheDocument();
    expect(initialEl.textContent).toBe('A');
  });

  it('renders fallback User icon when name is empty or undefined', () => {
    const { container } = render(<UserAvatar name="" size="sm" />);
    expect(screen.queryByTestId('user-avatar-initial')).not.toBeInTheDocument();
    const svgIcon = container.querySelector('svg');
    expect(svgIcon).toBeInTheDocument();
  });

  it('applies correct responsive and size classes for sm, md, and lg', () => {
    const { rerender } = render(<UserAvatar name="Test" size="sm" />);
    let avatar = screen.getByTestId('user-avatar');
    expect(avatar.className).toContain('w-8 h-8');
    expect(avatar.className).toContain('text-xs');

    rerender(<UserAvatar name="Test" size="md" />);
    avatar = screen.getByTestId('user-avatar');
    expect(avatar.className).toContain('w-16 h-16');
    expect(avatar.className).toContain('text-xl');

    rerender(<UserAvatar name="Test" size="lg" />);
    avatar = screen.getByTestId('user-avatar');
    expect(avatar.className).toContain('w-28 h-28');
    expect(avatar.className).toContain('text-4xl');
  });

  it('renders image when src is valid, and falls back to monogram on error', () => {
    render(<UserAvatar name="John Doe" src="https://example.com/valid-photo.png" size="md" />);

    const img = screen.getByRole('img');
    expect(img).toBeInTheDocument();

    // Trigger image error
    fireEvent.error(img);

    // Fallback monogram should now be rendered
    expect(screen.getByTestId('user-avatar-initial')).toHaveTextContent('J');
  });
});
