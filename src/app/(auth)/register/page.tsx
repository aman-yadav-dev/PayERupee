"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  AuthDivider,
  FloatingFintechPanel,
  GoogleButton,
  InputField,
  LogoBlock,
  PasswordField,
  SubmitButton,
  TextareaField,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { CustomCheckbox } from "@/components/ui/checkbox";
import { registerMerchantAction } from "@/actions/auth/register";

interface RegisterFormData {
  fullName: string;
  businessName: string;
  email: string;
  phone: string;
  address: string;
  password: string;
  confirmPassword: string;
}

interface RegisterErrors {
  fullName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  address?: string;
  password?: string;
  confirmPassword?: string;
  terms?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [formData, setFormData] = useState<RegisterFormData>({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [shakeKey, setShakeKey] = useState(0);

  function validate(): RegisterErrors {
    const e: RegisterErrors = {};
    if (!formData.fullName.trim()) {
      e.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      e.fullName = "Full name must be at least 2 characters";
    }

    if (!formData.businessName.trim()) {
      e.businessName = "Business name is required";
    } else if (formData.businessName.trim().length < 2) {
      e.businessName = "Business name must be at least 2 characters";
    }

    if (!formData.email.trim()) {
      e.email = "Business email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      e.email = "Enter a valid email address";
    }

    if (!formData.phone.trim()) {
      e.phone = "Phone number is required";
    } else if (formData.phone.trim().length < 10) {
      e.phone = "Phone number must be at least 10 digits";
    }

    if (!formData.address.trim()) {
      e.address = "Business address is required";
    } else if (formData.address.trim().length < 5) {
      e.address = "Address must be at least 5 characters";
    }

    if (!formData.password) {
      e.password = "Password is required";
    } else if (formData.password.length < 8) {
      e.password = "Password must be at least 8 characters";
    }

    if (!formData.confirmPassword) {
      e.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }

    if (!agreed) {
      e.terms = "You must accept the terms to continue";
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
        const res = await registerMerchantAction({
          name: formData.fullName.trim(),
          businessName: formData.businessName.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          password: formData.password,
          termsAccepted: agreed,
        });

        if (res.success) {
          toast.success("Merchant account created successfully!");
          router.push("/pending-approval");
          router.refresh();
        } else {
          toast.error(res.message || "Failed to create account");
          setShakeKey((k) => k + 1);
          if (res.errors && typeof res.errors === "object") {
            const fieldErrors: RegisterErrors = {};
            const apiErrors = res.errors as Record<string, string[]>;
            if (apiErrors.name?.[0]) fieldErrors.fullName = apiErrors.name[0];
            if (apiErrors.businessName?.[0]) fieldErrors.businessName = apiErrors.businessName[0];
            if (apiErrors.email?.[0]) fieldErrors.email = apiErrors.email[0];
            if (apiErrors.phone?.[0]) fieldErrors.phone = apiErrors.phone[0];
            if (apiErrors.address?.[0]) fieldErrors.address = apiErrors.address[0];
            if (apiErrors.password?.[0]) fieldErrors.password = apiErrors.password[0];
            if (apiErrors.termsAccepted?.[0]) fieldErrors.terms = apiErrors.termsAccepted[0];
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

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      <FloatingFintechPanel />

      <section className="flex flex-1 min-h-[100dvh] justify-center overflow-y-auto bg-white px-6 py-8 sm:px-10 lg:items-start lg:px-14 lg:pt-10">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="w-full max-w-[420px] pb-12"
        >
          {/* Logo */}
          <motion.div variants={fieldFade} className="mb-6 flex justify-center">
            <LogoBlock />
          </motion.div>

          {/* Heading */}
          <motion.div variants={fieldFade} className="mb-6 text-center">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-zinc-900">
              Create merchant account
            </h1>
            <p className="mt-2 text-[13.5px] text-zinc-400">
              Set up your business workspace & disbursal engine
            </p>
          </motion.div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <form
              key={shakeKey}
              onSubmit={onSubmit}
              noValidate
              className="space-y-3.5"
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
                label="Business Name"
                icon={Building2}
                autoComplete="organization"
                placeholder="Acme Financial Services"
                name="businessName"
                value={formData.businessName}
                onChange={setField("businessName")}
                error={errors.businessName}
              />
              <InputField
                label="Business Email"
                icon={Mail}
                type="email"
                autoComplete="email"
                placeholder="finance@company.com"
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
              <TextareaField
                label="Registered Business Address"
                icon={MapPin}
                autoComplete="street-address"
                placeholder="Registered office address"
                name="address"
                value={formData.address}
                onChange={setField("address")}
                error={errors.address}
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

              {/* Terms & conditions */}
              <motion.div variants={fieldFade} className="pt-1">
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
                    className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 underline"
                  >
                    Privacy Policy
                  </Link>
                </CustomCheckbox>
                {errors.terms && (
                  <span className="mt-1 block text-[11.5px] text-red-500">
                    {errors.terms}
                  </span>
                )}
              </motion.div>

              <SubmitButton loading={isPending}>
                Create Merchant Account
              </SubmitButton>
            </form>
          </AnimatePresence>

          <AuthDivider />
          <GoogleButton />

          <motion.p
            variants={fieldFade}
            className="mt-8 text-center text-[13px] text-zinc-400"
          >
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
            >
              Sign in →
            </Link>
          </motion.p>
        </motion.div>
      </section>
    </main>
  );
}
