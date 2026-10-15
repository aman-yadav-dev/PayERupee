import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getISTDateBoundaries } from '@/lib/date';

describe('Date Boundaries (IST)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // System time mocked to 2026-10-05T13:10:00.000Z
    // In IST (+05:30), this is 2026-10-05 18:40:00
    vi.setSystemTime(new Date('2026-10-05T13:10:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Last 30 days endDate is the end of the current IST day, NOT the page-load millisecond', () => {
    const { endDate } = getISTDateBoundaries("Last 30 days");
    
    // The end of 2026-10-05 in IST is 2026-10-05T23:59:59.999+05:30
    // In UTC, this is 2026-10-05T18:29:59.999Z
    expect(endDate).toBe('2026-10-05T18:29:59.999Z');
    expect(endDate).not.toBe('2026-10-05T13:10:00.000Z');
  });

  it('A transaction created later on the same day is <= endDate', () => {
    const { endDate } = getISTDateBoundaries("Last 30 days");
    
    // Simulating a transaction created 25 seconds later
    const transactionTime = new Date('2026-10-05T13:10:25.000Z').getTime();
    const endBoundaryTime = new Date(endDate as string).getTime();
    
    expect(transactionTime).toBeLessThanOrEqual(endBoundaryTime);
  });

  it('startDate for Last 7 days represents 00:00:00.000 IST on the correct starting date', () => {
    const { startDate } = getISTDateBoundaries("Last 7 days");
    
    // 7 calendar days before Oct 5 is Sept 28
    // 2026-09-28T00:00:00.000+05:30 in UTC is 2026-09-27T18:30:00.000Z
    expect(startDate).toBe('2026-09-27T18:30:00.000Z');
  });

  it('startDate for Last 30 days represents 00:00:00.000 IST on the correct starting date', () => {
    const { startDate } = getISTDateBoundaries("Last 30 days");
    
    // 30 calendar days before Oct 5 is Sept 5
    // 2026-09-05T00:00:00.000+05:30 in UTC is 2026-09-04T18:30:00.000Z
    expect(startDate).toBe('2026-09-04T18:30:00.000Z');
  });

  it('startDate for This month represents 00:00:00.000 IST on the correct starting date', () => {
    const { startDate } = getISTDateBoundaries("This month");
    
    // 1st of Oct 2026
    // 2026-10-01T00:00:00.000+05:30 in UTC is 2026-09-30T18:30:00.000Z
    expect(startDate).toBe('2026-09-30T18:30:00.000Z');
  });
});
