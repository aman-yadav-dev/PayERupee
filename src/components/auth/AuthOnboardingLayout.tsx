import { ReactNode } from "react";
import { FloatingFintechPanel } from "./AuthShell";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthOnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground relative">
      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-10 z-50" />

      {/* Left Promotional Panel - Hidden on Mobile */}
      <FloatingFintechPanel />

      {/* Right Content Area */}
      <div className="flex flex-1 flex-col px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div className="my-auto flex w-full flex-col items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
