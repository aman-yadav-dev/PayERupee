"use client";

import { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  FloatingFintechPanel,
  InputField,
  LogoBlock,
  PasswordField,
  SubmitButton,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { ThemeToggle } from "@/components/theme-toggle";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { verifyAdminRoleAction } from "@/actions/auth/admin-login";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/admin/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Both administrative email and password are required.");
      return;
    }

    startTransition(async () => {
      try {
        // 1. Authenticate credentials via Better Auth
        const res = await authClient.signIn.email({
          email: email.trim(),
          password,
        });

        if (res.error) {
          setErrorMessage(res.error.message || "Invalid administrative credentials.");
          toast.error("Authentication failed");
          return;
        }

        // 2. Authoritative database role verification & non-admin session revocation
        const roleRes = await verifyAdminRoleAction();

        if (!roleRes.success) {
          await authClient.signOut();
          setErrorMessage(roleRes.message || "Access Denied: Your account does not have administrative privileges.");
          toast.error("Access Denied");
          return;
        }

        toast.success(`Welcome back, ${roleRes.user?.name || "Administrator"}!`);
        router.push(callbackUrl);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "A secure connection error occurred.";
        setErrorMessage(message);
        toast.error("An error occurred");
      }
    });
  };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="w-full max-w-[400px]"
    >
      {/* Brand & Console Title */}
      <motion.div variants={fieldFade} className="mb-8 flex flex-col items-start gap-3">
        <div className="flex items-center gap-2">
          <LogoBlock compact />
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40">
            Admin Console
          </span>
        </div>
        <div className="mt-2 text-left">
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground font-display">
            Administrative Sign In
          </h1>
          <p className="mt-2 text-[13.5px] text-muted-foreground">
            Restricted access for platform administrators and compliance officers.
          </p>
        </div>
      </motion.div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="leading-relaxed font-medium">{errorMessage}</div>
        </motion.div>
      )}

      {/* Login Form */}
      <AnimatePresence mode="wait">
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <InputField
            label="Administrative Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="admin@payerupee.in"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <PasswordField
            label="Password"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
            autoComplete="current-password"
            placeholder="Enter administrative password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="pt-2">
            <SubmitButton loading={isPending}>
              <span>{isPending ? "Verifying Credentials..." : "Sign In to Console"}</span>
            </SubmitButton>
          </div>
        </form>
      </AnimatePresence>

      {/* Security Notice */}
      <motion.div variants={fieldFade} className="mt-8 text-center">
        <p className="text-[11.5px] text-muted-foreground flex items-center justify-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Protected by Hardware Isolation & Dual-Key Cryptography</span>
        </p>
      </motion.div>
    </motion.div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-[100dvh] w-full bg-background text-foreground relative">
      <ThemeToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-10 z-50" />

      {/* Left Promotional / Brand Panel - Hidden on Mobile */}
      <FloatingFintechPanel />

      {/* Right Content Area */}
      <div className="flex flex-1 flex-col px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div className="my-auto flex w-full flex-col items-center">
          <Suspense fallback={<div className="text-muted-foreground text-xs font-mono">Loading console authentication...</div>}>
            <AdminLoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
