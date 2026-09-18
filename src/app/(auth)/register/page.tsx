"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Mail, Phone, UserRound } from "lucide-react";
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
import { registerMerchantAction } from "@/actions/auth/register";
import { getAuthDestinationAction } from "@/actions/auth/destination";
import { authClient } from "@/modules/auth/infrastructure/auth-client";

interface RegisterFormData {
  fullName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

interface RegisterErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [shakeKey, setShakeKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): RegisterErrors {
    const e: RegisterErrors = {};
    if (!formData.fullName.trim()) {
      e.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      e.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      e.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = "Enter a valid email address";
    }

    if (!formData.phone.trim()) {
      e.phone = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phone.trim())) {
      e.phone = "Please enter a valid 10-digit phone number";
    }

    if (!formData.password) {
      e.password = "Password is required";
    } else if (formData.password.length < 8) {
      e.password = "Password must be at least 8 characters";
    } else if (!/[A-Z]/.test(formData.password)) {
      e.password = "Password must contain at least one uppercase letter";
    } else if (!/[a-z]/.test(formData.password)) {
      e.password = "Password must contain at least one lowercase letter";
    } else if (!/[0-9]/.test(formData.password)) {
      e.password = "Password must contain at least one number";
    } else if (!/[^A-Za-z0-9]/.test(formData.password)) {
      e.password = "Password must contain at least one special character";
    }

    if (formData.password !== formData.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    if (!agreed) {
      e.terms = "You must agree to the Terms of Service & Privacy Policy";
    }

    return e;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isSubmitting || isPending) return;

    const validationErrors = validate();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setShakeKey((k) => k + 1);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    startTransition(async () => {
      try {
        const res = await registerMerchantAction({
          name: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
          termsAccepted: agreed,
        });

        if (res.success) {
          toast.success("Merchant account created successfully!");

          const destRes = await getAuthDestinationAction();
          if (destRes.success && destRes.data?.destination) {
            router.push(destRes.data.destination);
          } else {
            router.push("/kyc/start");
          }
        } else {
          toast.error(res.message || "Failed to create account");
          setShakeKey((k) => k + 1);
          if (res.errors && typeof res.errors === "object") {
            const fieldErrors: RegisterErrors = {};
            const apiErrors = res.errors as Record<string, string[]>;
            if (apiErrors.name?.[0]) fieldErrors.fullName = apiErrors.name[0];
            if (apiErrors.email?.[0]) fieldErrors.email = apiErrors.email[0];
            if (apiErrors.phone?.[0]) fieldErrors.phone = apiErrors.phone[0];
            if (apiErrors.password?.[0]) fieldErrors.password = apiErrors.password[0];
            if (apiErrors.termsAccepted?.[0]) fieldErrors.terms = apiErrors.termsAccepted[0];
            setErrors(fieldErrors);
          }
          setIsSubmitting(false);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(errorMsg);
        setShakeKey((k) => k + 1);
        setIsSubmitting(false);
      }
    });
  }

  const setField =
    (field: keyof RegisterFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof RegisterErrors]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    };

  const shouldReduceMotion = useReducedMotion();

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
          Create merchant account
        </h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          Set up your business workspace & disbursal engine
        </p>
      </motion.div>

      <AnimatePresence mode="wait">
        <form
          key={shakeKey}
          onSubmit={onSubmit}
          noValidate
          className="space-y-4"
        >
          <InputField
            label="Full Name"
            icon={UserRound}
            autoComplete="name"
            placeholder="Aarav Mehta"
            name="fullName"
            value={formData.fullName}
            onChange={setField("fullName")}
            error={errors.fullName}
          />
          <InputField
            label="Email"
            icon={Mail}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            name="email"
            value={formData.email}
            onChange={setField("email")}
            error={errors.email}
          />
          <InputField
            label="Phone Number"
            icon={Phone}
            type="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            name="phone"
            value={formData.phone}
            onChange={setField("phone")}
            error={errors.phone}
          />
          <PasswordField
            label="Password"
            visible={passwordVisible}
            onToggle={() => setPasswordVisible((v) => !v)}
            autoComplete="new-password"
            placeholder="Create a strong password"
            name="password"
            value={formData.password}
            onChange={setField("password")}
            error={errors.password}
          />
          <PasswordField
            label="Confirm Password"
            visible={confirmVisible}
            onToggle={() => setConfirmVisible((v) => !v)}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={setField("confirmPassword")}
            error={errors.confirmPassword}
          />

          <motion.div variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade} className="pt-1">
            <CustomCheckbox
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (errors.terms)
                  setErrors((prev) => ({ ...prev, terms: undefined }));
              }}
            >
              I agree to the{" "}
              <Link
                href="/terms"
                target="_blank"
                className="font-medium text-primary transition-colors hover:text-primary/80 underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                target="_blank"
                className="font-medium text-primary transition-colors hover:text-primary/80 underline"
              >
                Privacy Policy
              </Link>
            </CustomCheckbox>
            {errors.terms && (
              <span className="mt-1 block text-[11.5px] text-destructive">
                {errors.terms}
              </span>
            )}
          </motion.div>

          <SubmitButton loading={isPending || isSubmitting}>
            Create Merchant Account
          </SubmitButton>
        </form>
      </AnimatePresence>

      <AuthDivider />
      <GoogleButton />

      <motion.p
        variants={shouldReduceMotion ? { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: 0.2 } } } : fieldFade}
        className="mt-8 text-left text-[13px] text-muted-foreground"
      >
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-semibold text-primary transition-colors hover:text-primary/80"
        >
          Sign in &rarr;
        </Link>
      </motion.p>
    </motion.div>
  );
}
