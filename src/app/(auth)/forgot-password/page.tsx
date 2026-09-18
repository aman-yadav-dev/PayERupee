"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  InputField,
  LogoBlock,
  SubmitButton,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { forgotPasswordAction } from "@/actions/auth/forgot-password";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(undefined);

    startTransition(async () => {
      try {
        const res = await forgotPasswordAction({ email: email.trim().toLowerCase() });
        if (res.success) {
          setSubmitted(true);
          toast.success("Password reset instructions sent!");
        } else {
          toast.error(res.message || "Failed to send reset link");
          setError(res.message);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(msg);
        setError(msg);
      }
    });
  }

  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      variants={shouldReduceMotion ? {} : stagger}
      initial="initial"
      animate="animate"
      className="w-full max-w-[400px]"
    >
      {/* Logo */}
      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-10 flex justify-start">
        <LogoBlock />
      </motion.div>

      {/* Heading */}
      <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="mb-8 text-left">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Reset Password
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Enter your email address to receive recovery instructions
        </p>
      </motion.div>

      {submitted ? (
        <motion.div
          variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade}
          className="rounded-2xl border border-border bg-card p-6 text-center space-y-4 shadow-sm"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-500">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-base">Check your inbox</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              If an account exists for <strong className="text-foreground">{email}</strong>, we have sent instructions to reset your password.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary/80 pt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Sign In
          </Link>
        </motion.div>
      ) : (
        <motion.form variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} onSubmit={onSubmit} noValidate className="space-y-4">
          <InputField
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            name="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError(undefined);
            }}
            error={error}
          />

          <SubmitButton loading={isPending}>Send Reset Instructions</SubmitButton>

          <div className="pt-4 text-left">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Sign In
            </Link>
          </div>
        </motion.form>
      )}
    </motion.div>
  );
}
