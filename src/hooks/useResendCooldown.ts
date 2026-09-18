"use client";

import { useState, useEffect, useCallback } from "react";

const COOLDOWN_SECONDS = 30;

export function getResendCooldownKey(userId: string) {
  return `payerupee_resend_cooldown_${userId}`;
}

export function useResendCooldown(userId: string | null, serverExpiresAt?: string | null) {
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const getStorageKey = useCallback(() => {
    return userId ? getResendCooldownKey(userId) : null;
  }, [userId]);

  const calculateRemaining = useCallback(() => {
    try {
      const key = getStorageKey();
      if (!key) return 0;

      const stored = localStorage.getItem(key);
      let localExp = stored ? parseInt(stored, 10) : 0;

      if (isNaN(localExp) || localExp === 0) {
        localStorage.removeItem(key);
        return 0;
      }

      const now = Date.now();
      if (now >= localExp) {
        localStorage.removeItem(key);
        return 0;
      }

      return Math.ceil((localExp - now) / 1000);
    } catch {
      return 0;
    }
  }, [getStorageKey]);

  const updateCooldown = useCallback(() => {
    setCooldownRemaining(calculateRemaining());
  }, [calculateRemaining]);

  // Force server authority on mount or prop change
  useEffect(() => {
    const key = userId ? getResendCooldownKey(userId) : null;
    if (key && serverExpiresAt !== undefined) {
      if (serverExpiresAt === null) {
        // Server explicitly says NO active cooldown.
        // Clean up any stale or malicious local timestamp to enforce server authority.
        localStorage.removeItem(key);
      } else {
        const serverExp = new Date(serverExpiresAt).getTime();
        if (!isNaN(serverExp)) {
          localStorage.setItem(key, serverExp.toString());
        }
      }
      updateCooldown();
    }
  }, [userId, serverExpiresAt, updateCooldown]);

  useEffect(() => {
    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);

    const handleStorage = (e: StorageEvent) => {
      const key = getStorageKey();
      if (key && e.key === key) {
        updateCooldown();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorage);
    };
  }, [updateCooldown, getStorageKey]);

  const startCooldown = useCallback((newExpiresAt?: string) => {
    const key = getStorageKey();
    if (!key) return;

    // Use provided server expiration, otherwise fallback to local calculation
    const expiresAt = newExpiresAt ? new Date(newExpiresAt).getTime() : Date.now() + COOLDOWN_SECONDS * 1000;

    try {
      localStorage.setItem(key, expiresAt.toString());
    } catch {
      // Ignore localStorage errors
    }
    updateCooldown();
  }, [updateCooldown, getStorageKey]);

  return {
    cooldownRemaining,
    isCooldownActive: cooldownRemaining > 0,
    startCooldown
  };
}
