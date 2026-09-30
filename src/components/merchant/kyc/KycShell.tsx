"use client";

import { motion } from "framer-motion";
import { stagger, fieldFade } from "@/components/auth/AuthShell";
import { SignOutButton } from "./SignOutButton";
import Link from "next/link";

export function KycShell({ children, maxWidth = "max-w-[420px]", doThisLaterHref }: { children: React.ReactNode, maxWidth?: string, doThisLaterHref?: string }) {
  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className={`w-full ${maxWidth}`}
    >
      {children}

      <motion.div variants={fieldFade} className="mt-10 flex flex-col items-center justify-center pt-6">
        <div className="flex items-center gap-6">
          {doThisLaterHref && (
            <>
              <Link href={doThisLaterHref} className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                Do this later
              </Link>
              <div className="h-3 w-px bg-border/50" />
            </>
          )}
          <SignOutButton />
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AnimatedField({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={fieldFade} className={className}>
      {children}
    </motion.div>
  );
}
