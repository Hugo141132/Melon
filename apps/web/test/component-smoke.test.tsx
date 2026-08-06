// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

function SampleStatusBadge({ status }: { status: 'ONLINE' | 'OFFLINE' }) {
  return (
    <div data-testid="status-badge" className={status === 'ONLINE' ? 'bg-green-500' : 'bg-red-500'}>
      <span>{status}</span>
    </div>
  );
}

describe('React Testing Library Setup', () => {
  it('renders React components using React Testing Library and jest-dom matchers', () => {
    render(<SampleStatusBadge status="ONLINE" />);
    const badge = screen.getByTestId('status-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('ONLINE');
    expect(badge).toHaveClass('bg-green-500');
  });
});
