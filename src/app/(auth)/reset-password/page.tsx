"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Lock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  InputField,
  LogoBlock,
  PasswordField,
  SubmitButton,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { resetPasswordAction } from "@/actions/auth/reset-password";
import { ResetPasswordInput, resetPasswordSchema } from "@/modules/auth/schemas/auth.schema";

interface ResetPasswordErrors {
  password?: string;
  confirmPassword?: string;
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const errorParam = searchParams.get("error");
  const shouldReduceMotion = useReducedMotion();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [isPending, startTransition] = useTransition();

  // If there's an error from Better Auth intercept, or no token, show Error State
  if (errorParam === "INVALID_TOKEN" || !token) {
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

        <motion.div
          variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade}
          className="rounded-2xl border border-destructive/20 bg-destructive/10 p-6 text-center space-y-4 shadow-sm"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/20 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-semibold text-destructive text-base">Invalid or Expired Link</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
          </div>
          <Link
            href="/forgot-password"
            className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-primary transition-colors hover:text-primary/80 pt-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Request New Link
          </Link>
        </motion.div>
      </motion.div>
    );
  }

  function validate(): ResetPasswordErrors {
    const e: ResetPasswordErrors = {};

    // Use the schema for immediate client feedback without triggering the full refinement yet,
    // or just run safeParse.
    const result = resetPasswordSchema.safeParse({
      ...formData,
      token,
    });

    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      if (fieldErrors.password) e.password = fieldErrors.password[0];
      if (fieldErrors.confirmPassword) e.confirmPassword = fieldErrors.confirmPassword[0];
    }

    return e;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        const payload: ResetPasswordInput = {
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          token: token!,
        };

        const res = await resetPasswordAction(payload);

        if (res.success) {
          // Success: Strip token and redirect to login state
          router.replace("/login?reset=success");
        } else {
          toast.error(res.message);
          if (res.errors) {
            setErrors({
              password: res.errors.password?.[0],
              confirmPassword: res.errors.confirmPassword?.[0],
            });
          }
          // If the server explicitly says INVALID_TOKEN, redirect back to self with error
          if (res.message.includes("invalid or has expired")) {
             router.replace("/reset-password?error=INVALID_TOKEN");
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(msg);
      }
    });
  }

  const set = (field: keyof typeof formData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof ResetPasswordErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

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
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Create New Password
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Enter a strong password to secure your account
        </p>
      </motion.div>

      <motion.form variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} onSubmit={onSubmit} noValidate className="space-y-4">
        <PasswordField
          visible={passwordVisible}
          onToggle={() => setPasswordVisible((v) => !v)}
          autoComplete="new-password"
          placeholder="New Password"
          name="password"
          value={formData.password}
          onChange={set("password")}
          error={errors.password}
        />

        <InputField
          label=""
          icon={Lock}
          type={passwordVisible ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Confirm New Password"
          name="confirmPassword"
          value={formData.confirmPassword}
          onChange={set("confirmPassword")}
          error={errors.confirmPassword}
        />

        <SubmitButton loading={isPending}>Reset Password</SubmitButton>

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
    </motion.div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
