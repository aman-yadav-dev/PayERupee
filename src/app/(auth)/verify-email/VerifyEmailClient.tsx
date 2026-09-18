"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, RefreshCw, LogOut, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { authClient, useSession } from "@/modules/auth/infrastructure/auth-client";
import { useRouter } from "next/navigation";
import { getAuthDestinationAction } from "@/actions/auth/destination";
import { LogoBlock, SubmitButton, fieldFade, stagger } from "@/components/auth/AuthShell";
import { useResendCooldown } from "@/hooks/useResendCooldown";

interface VerifyEmailClientProps {
  serverExpiresAt: string | null;
}

export function VerifyEmailClient({ serverExpiresAt }: VerifyEmailClientProps) {
  const [loading, setLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const isSubmittingRef = useRef(false);
  const isCheckingRef = useRef(false);
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const { data: session } = useSession();
  const userId = session?.user?.id || null;
  const { cooldownRemaining, isCooldownActive, startCooldown } = useResendCooldown(userId, serverExpiresAt);

  const checkVerification = useCallback(async (manual = false) => {
    if (isCheckingRef.current) return;
    try {
      if (manual) setIsChecking(true);
      isCheckingRef.current = true;

      const currentSession = await authClient.getSession();
      if (currentSession?.data?.user?.emailVerified) {
        const destRes = await getAuthDestinationAction();
        if (destRes.success && destRes.data?.destination) {
          router.push(destRes.data.destination);
        } else {
          router.push("/");
        }
      } else {
        if (manual) toast.info("Email is not verified yet. Please check your inbox.");
      }
    } catch (err) {
      if (manual) toast.error("Failed to check verification status");
    } finally {
      isCheckingRef.current = false;
      if (manual) setIsChecking(false);
    }
  }, [router]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkVerification(false);
      }
    };

    const handlePageShow = () => {
      checkVerification(false);
    };

    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pageshow", handlePageShow);
    const interval = setInterval(() => checkVerification(false), 10000);

    // Initial check just in case
    checkVerification(false);

    return () => {
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pageshow", handlePageShow);
      clearInterval(interval);
    };
  }, [checkVerification]);

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingRef.current || isCooldownActive) return;

    try {
      isSubmittingRef.current = true;
      setLoading(true);
      const session = await authClient.getSession();
      if (!session?.data?.user?.email) {
        toast.error("You must be logged in to resend the verification email.");
        router.push("/login");
        return;
      }

      const { resendVerificationEmailAction } = await import("@/actions/auth/resend");
      const res = await resendVerificationEmailAction(`${window.location.origin}/verify-result?success=true`);

      if (!res.success) {
        toast.error(res.error || "Failed to resend verification email");
      } else {
        toast.success("Verification email sent! Check your inbox.");
        // We pass the new server expiration strictly to startCooldown if it exists
        startCooldown(res.expiresAt || undefined);
      }
    } catch (err: unknown) {
      toast.error("An unexpected error occurred");
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  async function handleSignOut() {
    await authClient.signOut();
    router.push("/login");
  }

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : stagger}
      initial="initial"
      animate="animate"
      className="w-full max-w-[400px]"
    >
      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-10 flex justify-start">
        <LogoBlock />
      </motion.div>

      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-8 text-left">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
          <Mail className="h-6 w-6" />
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Verify your email
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
          We sent a verification link to your email address. Please click the link to activate your account.
        </p>
      </motion.div>

      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="space-y-4">

        <button
          onClick={() => checkVerification(true)}
          disabled={isChecking || loading}
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {isChecking ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Checking status...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              I have verified my email
            </>
          )}
        </button>

        <form onSubmit={handleResend} className="w-full">
          <button
            type="submit"
            disabled={isCooldownActive || loading || isChecking}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              {isCooldownActive ? `Resend available in ${cooldownRemaining}s` : "Resend verification email"}
            </span>
          </button>
        </form>

        <button
          onClick={handleSignOut}
          type="button"
          disabled={loading || isChecking}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </motion.div>
    </motion.div>
  );
}
