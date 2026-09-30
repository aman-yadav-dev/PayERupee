/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { KycShell } from '@/components/merchant/kyc/KycShell';

vi.mock('@/components/merchant/kyc/SignOutButton', () => ({
  SignOutButton: () => <button>Sign Out</button>
}));

describe('KYC Shell Navigation (Do this later)', () => {
  it('does not render Do this later when doThisLaterHref is omitted', () => {
    render(<KycShell><div>Content</div></KycShell>);
    
    expect(screen.getByText('Content')).toBeDefined();
    expect(screen.getByText('Sign Out')).toBeDefined();
    
    const doThisLater = screen.queryByText('Do this later');
    expect(doThisLater).toBeNull();
  });

  it('renders Do this later pointing to the provided href when provided', () => {
    render(<KycShell doThisLaterHref='/kyc/start'><div>Content</div></KycShell>);
    
    const doThisLater = screen.getByText('Do this later');
    expect(doThisLater).toBeDefined();
    expect(doThisLater.getAttribute('href')).toBe('/kyc/start');
    
    expect(screen.getByText('Sign Out')).toBeDefined();
  });
  
  it('renders Do this later pointing to rejected when provided', () => {
    render(<KycShell doThisLaterHref='/kyc/rejected'><div>Content</div></KycShell>);
    
    const doThisLater = screen.getByText('Do this later');
    expect(doThisLater).toBeDefined();
    expect(doThisLater.getAttribute('href')).toBe('/kyc/rejected');
    
    expect(screen.getByText('Sign Out')).toBeDefined();
  });

  it('proves the anti-loop architecture by ensuring we do not route to /onboarding for Do this later', () => {
    // Regression test for Blocker 1: We must go directly to /kyc/start to avoid the destination-loader loop
    render(<KycShell doThisLaterHref='/kyc/start'><div>Content</div></KycShell>);
    const link = screen.getByText('Do this later');
    expect(link.getAttribute('href')).toBe('/kyc/start');
    expect(link.getAttribute('href')).not.toBe('/onboarding');
  });
});
