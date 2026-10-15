import { describe, it, expect } from 'vitest';
import { maskDestination } from '@/lib/masking';

describe('maskDestination', () => {
  it('masks numeric bank account keeping last 4', () => {
    expect(maskDestination('1234567890')).toBe('******7890');
  });
  it('masks short account', () => {
    expect(maskDestination('123')).toBe('******');
  });
  it('masks UPI ID', () => {
    expect(maskDestination('alice.smith@okicici')).toBe('a***@okicici');
    expect(maskDestination('bob@upi')).toBe('b***@upi');
    expect(maskDestination('ab@upi')).toBe('**@upi');
  });
  it('handles null', () => {
    expect(maskDestination(null)).toBeNull();
  });
});
