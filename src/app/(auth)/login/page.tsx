"use client";

import { useState, useTransition, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mail, CheckCircle2 } from "lucide-react";
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
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { getAuthDestinationAction } from "@/actions/auth/destination";

interface LoginFormData {
  email: string;
  password: string;
}

interface LoginErrors {
  email?: string;
  password?: string;
}

function ResetSuccessBanner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setShow(true);
      // Clean up the URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [searchParams]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-500"
    >
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="text-[13px] font-medium leading-relaxed">
        Password successfully updated. Please sign in with your new password.
      </div>
    </motion.div>
  );
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
        const res = await authClient.signIn.email({
          email: formData.email,
          password: formData.password,
        });

        if (!res.error) {
          toast.success("Welcome back! Redirecting...");
          const destRes = await getAuthDestinationAction();
          if (destRes.success && destRes.data?.destination) {
            router.push(destRes.data.destination);
          } else {
            router.push("/pending-approval");
          }
        } else {
          toast.error(res.error.message || "Failed to sign in");
          setShakeKey((k) => k + 1);
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
          Welcome back
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Sign in to your workspace
        </p>
      </motion.div>

      <Suspense fallback={null}>
        <ResetSuccessBanner />
      </Suspense>

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
            variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade}
            className="flex items-center justify-between pt-1"
          >
            <CustomCheckbox
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              label="Remember me"
            />
            <Link
              href="/forgot-password"
              className="text-[12.5px] font-medium text-primary transition-colors hover:text-primary/80"
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
        variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade}
        className="mt-8 text-left text-[13px] text-muted-foreground"
      >
        No account yet?{" "}
        <Link
          href="/register"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Create one →
        </Link>
      </motion.p>
    </motion.div>
  );
}