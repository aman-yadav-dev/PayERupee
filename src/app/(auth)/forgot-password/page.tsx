"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  FloatingFintechPanel,
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

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      <FloatingFintechPanel />

      <section className="flex flex-1 min-h-[100dvh] items-center justify-center overflow-y-auto bg-white px-6 py-12 sm:px-10 lg:px-14">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="w-full max-w-[400px]"
        >
          {/* Logo */}
          <motion.div variants={fieldFade} className="mb-10 flex justify-center">
            <LogoBlock />
          </motion.div>

          {/* Heading */}
          <motion.div variants={fieldFade} className="mb-8 text-center">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-zinc-900">
              Reset Password
            </h1>
            <p className="mt-2 text-[13.5px] text-zinc-400">
              Enter your email address to receive recovery instructions
            </p>
          </motion.div>

          {submitted ? (
            <motion.div
              variants={fieldFade}
              className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-6 text-center space-y-4"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-semibold text-zinc-900 text-base">Check your inbox</h3>
                <p className="mt-1 text-[13px] text-zinc-500">
                  If an account exists for <strong className="text-zinc-800">{email}</strong>, we have sent instructions to reset your password.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 pt-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Sign In
              </Link>
            </motion.div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-4">
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

              <div className="pt-4 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </motion.div>
      </section>
    </main>
  );
}
