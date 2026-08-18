import { describe, it, expect, vi } from 'vitest';
import LegacyAirPage from '../page';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
}));

describe('Legacy /air Route', () => {
  it('calls notFound() as it is a legacy route', () => {
    LegacyAirPage();
    expect(notFound).toHaveBeenCalled();
  });
});
