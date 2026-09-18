// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useResendCooldown, getResendCooldownKey } from "@/hooks/useResendCooldown";

describe("useResendCooldown Hook", () => {


  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("A. initial state -> Resend enabled", () => {
    const { result } = renderHook(() => useResendCooldown("user_123"));
    expect(result.current.isCooldownActive).toBe(false);
    expect(result.current.cooldownRemaining).toBe(0);
  });

  it("B/C/E. successful resend -> 30-second cooldown starts, decreases, and expires", () => {
    const { result } = renderHook(() => useResendCooldown("user_A"));

    // B. starts active
    act(() => {
      result.current.startCooldown();
    });
    expect(result.current.isCooldownActive).toBe(true);
    expect(result.current.cooldownRemaining).toBe(30);

    // C. stored timestamp is correctly set ~30s in future
    const key = getResendCooldownKey("user_A");
    const stored = localStorage.getItem(key);
    expect(stored).toBeTruthy();
    const expiresAt = Date.now() + 30000;
    expect(parseInt(stored!, 10)).toBeCloseTo(expiresAt, -2);

    // E. countdown decreases
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.cooldownRemaining).toBe(29);

    act(() => {
      vi.advanceTimersByTime(29000);
    });

    // E. hits zero -> inactive
    expect(result.current.cooldownRemaining).toBe(0);
    expect(result.current.isCooldownActive).toBe(false);
  });

  it("User A starts cooldown -> User B does NOT inherit it (cross-account leakage protection)", () => {
    const { result: userA } = renderHook(() => useResendCooldown("user_A"));
    act(() => {
      userA.current.startCooldown();
    });
    expect(userA.current.cooldownRemaining).toBe(30);

    const { result: userB } = renderHook(() => useResendCooldown("user_B"));
    expect(userB.current.cooldownRemaining).toBe(0);
    expect(userB.current.isCooldownActive).toBe(false);
  });

  it("F. refresh/remount with active timestamp -> cooldown restored", () => {
    const key = getResendCooldownKey("user_A");
    localStorage.setItem(key, (Date.now() + 30000).toString());

    const { result } = renderHook(() => useResendCooldown("user_A"));

    expect(result.current.isCooldownActive).toBe(true);
    expect(result.current.cooldownRemaining).toBe(30);
  });

  it("I. client respects server-authoritative initial timestamp", () => {
    const key = getResendCooldownKey("user_A");
    localStorage.setItem(key, (Date.now() + 10000).toString()); // Client thinks 10s left

    const serverExp = new Date(Date.now() + 30000).toISOString();

    const { result } = renderHook(() => useResendCooldown("user_A", serverExp));

    // Server is 30s, strictly greater than local 10s, so it overrides it!
    expect(result.current.isCooldownActive).toBe(true);
    expect(result.current.cooldownRemaining).toBe(30);

    const stored = localStorage.getItem(key);
    expect(parseInt(stored!, 10)).toBeCloseTo(Date.now() + 30000, -2);
  });

  it("G. expired timestamp -> Resend enabled and stale storage cleared", () => {
    const expiresAt = Date.now() - 10000; // Expired 10 seconds ago
    localStorage.setItem(getResendCooldownKey("user_123"), expiresAt.toString());

    const { result } = renderHook(() => useResendCooldown("user_123"));

    expect(result.current.isCooldownActive).toBe(false);
    expect(result.current.cooldownRemaining).toBe(0);
    expect(localStorage.getItem(getResendCooldownKey("user_123"))).toBeNull();
  });

  it("H. malformed localStorage -> safely handled", () => {
    localStorage.setItem(getResendCooldownKey("user_123"), "invalid-timestamp");

    const { result } = renderHook(() => useResendCooldown("user_123"));

    expect(result.current.isCooldownActive).toBe(false);
    expect(result.current.cooldownRemaining).toBe(0);
    expect(localStorage.getItem(getResendCooldownKey("user_123"))).toBeNull();
  });

  it("I. storage event from another tab -> current tab updates", () => {
    const { result } = renderHook(() => useResendCooldown("user_123"));
    expect(result.current.isCooldownActive).toBe(false);

    const expiresAt = Date.now() + 30000;
    localStorage.setItem(getResendCooldownKey("user_123"), expiresAt.toString());

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: getResendCooldownKey("user_123") }));
    });

    expect(result.current.isCooldownActive).toBe(true);
    expect(result.current.cooldownRemaining).toBe(30);
  });

  it("J. server explicitly says null -> overrides malicious future localStorage", () => {
    const key = getResendCooldownKey("user_123");
    // Malicious user extends localStorage 1 hour into the future
    localStorage.setItem(key, (Date.now() + 3600000).toString());

    // But server explicitely says there is no active lease
    const { result } = renderHook(() => useResendCooldown("user_123", null));

    // The hook MUST enforce server authority and clean up the malicious storage
    expect(result.current.isCooldownActive).toBe(false);
    expect(result.current.cooldownRemaining).toBe(0);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
