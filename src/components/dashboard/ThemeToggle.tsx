"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme-provider";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  // Prevent hydration mismatch by rendering a generic button or the correct state after mount
  if (!mounted) {
    return (
      <button
        type="button"
        aria-label="Toggle theme"
        className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-line bg-surface text-text-secondary hover:text-text-primary hover:border-blue-500/30 transition-colors press-feedback overflow-hidden opacity-0"
      >
        <Sun className="h-[16px] w-[16px]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="relative h-9 w-9 flex items-center justify-center rounded-lg border border-line bg-surface text-text-secondary hover:text-text-primary hover:border-blue-500/30 transition-colors press-feedback overflow-hidden"
    >
      <Sun
        className={cn(
          "h-[16px] w-[16px] absolute transition-all duration-300 ease-out",
          resolvedTheme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50"
        )}
        strokeWidth={1.9}
      />
      <Moon
        className={cn(
          "h-[16px] w-[16px] absolute transition-all duration-300 ease-out",
          resolvedTheme === "dark" ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100"
        )}
        strokeWidth={1.9}
      />
    </button>
  );
}
