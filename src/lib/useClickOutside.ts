"use client";

import { useEffect, type RefObject } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void
) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onOutside();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [ref, onOutside]);
}
