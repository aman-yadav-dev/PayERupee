"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import {
  AuthDivider,
  FloatingFintechPanel,
  GoogleButton,
  InputField,
  LogoBlock,
  PasswordField,
  SubmitButton,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { CustomCheckbox } from "@/components/ui/checkbox";
import { loginAction } from "@/actions/auth/login";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });
  const [remember, setRemember] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errors, setErrors] = useState<LoginErrors>({});
  const [shakeKey, setShakeKey] = useState(0);

  function validate(): LoginErrors {
    const e: LoginErrors = {};
    if (!formData.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = "Enter a valid email address";
    }
    if (!formData.password) {
      e.password = "Password is required";
    } else if (formData.password.length < 6) {
      e.password = "Password must be at least 6 characters";
    }
    return e;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setShakeKey((k) => k + 1);
      return;
    }

    setErrors({});

    startTransition(async () => {
      try {
        const res = await loginAction({
          email: formData.email,
          password: formData.password,
        });

        if (res.success) {
          toast.success("Welcome back! Redirecting to dashboard...");
          router.push("/dashboard");
          router.refresh();
        } else {
          toast.error(res.message || "Failed to sign in");
          setShakeKey((k) => k + 1);
          if (res.errors && typeof res.errors === "object") {
            const fieldErrors: LoginErrors = {};
            const apiErrors = res.errors as Record<string, string[]>;
            if (apiErrors.email?.[0]) fieldErrors.email = apiErrors.email[0];
            if (apiErrors.password?.[0]) fieldErrors.password = apiErrors.password[0];
            setErrors(fieldErrors);
          }
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(errorMsg);
        setShakeKey((k) => k + 1);
      }
    });
  }

  const set = (field: keyof LoginFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };

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
              Welcome back
            </h1>
            <p className="mt-2 text-[13.5px] text-zinc-400">
              Sign in to your workspace
            </p>
          </motion.div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <form
              key={shakeKey}
              onSubmit={onSubmit}
              noValidate
              className="space-y-4"
            >
              <InputField
                label="Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                name="email"
                value={formData.email}
                onChange={set("email")}
                error={errors.email}
              />

              <PasswordField
                visible={passwordVisible}
                onToggle={() => setPasswordVisible((v) => !v)}
                autoComplete="current-password"
                placeholder="Enter your password"
                name="password"
                value={formData.password}
                onChange={set("password")}
                error={errors.password}
              />

              {/* Remember me + Forgot password */}
              <motion.div
                variants={fieldFade}
                className="flex items-center justify-between pt-1"
              >
                <CustomCheckbox
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  label="Remember me"
                />
                <Link
                  href="/forgot-password"
                  className="text-[12.5px] font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                >
                  Forgot password?
                </Link>
              </motion.div>

              <SubmitButton loading={isPending}>Sign In</SubmitButton>
            </form>
          </AnimatePresence>

          <AuthDivider />
          <GoogleButton />

          <motion.p
            variants={fieldFade}
            className="mt-8 text-center text-[13px] text-zinc-400"
          >
            No account yet?{" "}
            <Link
              href="/register"
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Create one →
            </Link>
          </motion.p>
        </motion.div>
      </section>
    </main>
  );
}