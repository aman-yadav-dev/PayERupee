"use client";

import { useState, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle, RefreshCw, LogIn, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { LogoBlock, SubmitButton, fieldFade, stagger } from "@/components/auth/AuthShell";
import { getAuthDestinationAction } from "@/actions/auth/destination";
import Link from "next/link";
import { useResendCooldown } from "@/hooks/useResendCooldown";

export function VerifyResultClient({ isError, isAlreadyVerified, userEmail, userId, serverExpiresAt }: { isError: boolean, isAlreadyVerified?: boolean, userEmail: string | null, userId: string | null, serverExpiresAt?: string | null }) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const { cooldownRemaining, isCooldownActive, startCooldown } = useResendCooldown(userId, serverExpiresAt);

  async function handleContinue() {
    if (isSubmittingRef.current) return;
    try {
      isSubmittingRef.current = true;
      setLoading(true);
      const res = await getAuthDestinationAction();
      if (res.success && res.data?.destination) {
        router.push(res.data.destination);
      } else {
        router.push("/");
      }
    } catch (err: unknown) {
      toast.error("Failed to route to destination.");
      setLoading(false);
    }
  }

  async function handleResend(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmittingRef.current || isCooldownActive) return;

    try {
      isSubmittingRef.current = true;
      setLoading(true);

      const targetEmail = userEmail || (await authClient.getSession())?.data?.user?.email;
      if (!targetEmail) {
        toast.error("You must be logged in to resend verification. Please sign in.");
        router.push("/login");
        return;
      }

      const { resendVerificationEmailAction } = await import("@/actions/auth/resend");
      const res = await resendVerificationEmailAction(`${window.location.origin}/verify-result?success=true`);

      if (!res.success) {
        toast.error(res.error || "Failed to resend verification email");
      } else {
        toast.success("Verification email sent! Check your inbox.");
        startCooldown(res.expiresAt || undefined);
      }
    } catch (err: unknown) {
      toast.error("An unexpected error occurred");
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  }

  if (isAlreadyVerified) {
    return (
      <motion.div variants={shouldReduceMotion ? {} : stagger} initial="initial" animate="animate" className="w-full max-w-[400px]">
        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-10 flex justify-start">
          <LogoBlock />
        </motion.div>

        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-8 text-left">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
            Email already verified
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
            This verification link has already been used. Your email address is already verified and you can securely continue.
          </p>
        </motion.div>

        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="space-y-4">
          <button
            onClick={handleContinue}
            disabled={loading}
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                Continue to PayERupee
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </button>
        </motion.div>
      </motion.div>
    );
  }

  if (isError) {
    return (
      <motion.div variants={shouldReduceMotion ? {} : stagger} initial="initial" animate="animate" className="w-full max-w-[400px]">
        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-10 flex justify-start">
          <LogoBlock />
        </motion.div>

        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-8 text-left">
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-600 dark:text-red-400">
            <XCircle className="h-6 w-6" />
          </div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
            Verification link unavailable
          </h1>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
            This verification link is invalid or has expired. Please request a new verification email to continue.
          </p>
        </motion.div>

        <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="space-y-4">
          <form onSubmit={handleResend} className="w-full">
            <SubmitButton loading={loading} disabled={isCooldownActive}>
              <span className="flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4" />
                {isCooldownActive ? `Resend available in ${cooldownRemaining}s` : "Resend verification email"}
              </span>
            </SubmitButton>
          </form>

          <Link
            href="/login"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogIn className="h-4 w-4" />
            Back to Login
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={shouldReduceMotion ? {} : stagger} initial="initial" animate="animate" className="w-full max-w-[400px]">
      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-10 flex justify-start">
        <LogoBlock />
      </motion.div>

      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-8 text-left">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-green-500/10 text-green-600 dark:text-green-400">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Email verified successfully
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
          Your PayERupee email address has been verified. You can now securely continue to your account.
        </p>
      </motion.div>

      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="space-y-4">
        <button
          onClick={handleContinue}
          disabled={loading}
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-[13.5px] font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Processing...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              Continue to PayERupee
              <ArrowRight className="h-4 w-4" />
            </span>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}
