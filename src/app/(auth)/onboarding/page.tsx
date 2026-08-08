"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, MapPin, Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  FloatingFintechPanel,
  InputField,
  LogoBlock,
  SubmitButton,
  TextareaField,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { CustomCheckbox } from "@/components/ui/checkbox";
import { completeMerchantOnboardingAction } from "@/actions/auth/onboarding";

import { authClient } from "@/lib/auth-client";

interface OnboardingFormData {
  businessName: string;
  phone: string;
  address: string;
}

interface OnboardingErrors {
  businessName?: string;
  phone?: string;
  address?: string;
  terms?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { data: session } = authClient.useSession();

  const [formData, setFormData] = useState<OnboardingFormData>({
    businessName: "",
    phone: "",
    address: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [shakeKey, setShakeKey] = useState(0);

  function validate(): OnboardingErrors {
    const e: OnboardingErrors = {};

    if (!formData.businessName.trim()) {
      e.businessName = "Company name is required";
    } else if (formData.businessName.trim().length < 2) {
      e.businessName = "Company name must be at least 2 characters";
    }

    if (!formData.phone.trim()) {
      e.phone = "Phone number is required";
    } else if (formData.phone.trim().length < 10) {
      e.phone = "Phone number must be at least 10 digits";
    }

    if (!formData.address.trim()) {
      e.address = "Address is required";
    } else if (formData.address.trim().length < 5) {
      e.address = "Address must be at least 5 characters";
    }

    if (!agreed) {
      e.terms = "You must accept the Terms of Service & Privacy Policy to proceed";
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
        const res = await completeMerchantOnboardingAction({
          businessName: formData.businessName.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          termsAccepted: agreed,
        });

        if (res.success) {
          toast.success("Merchant profile created successfully!");
          router.push("/pending-approval");
          router.refresh();
        } else {
          toast.error(res.message || "Failed to complete setup");
          setShakeKey((k) => k + 1);
          if (res.errors && typeof res.errors === "object") {
            const fieldErrors: OnboardingErrors = {};
            const apiErrors = res.errors as Record<string, string[]>;
            if (apiErrors.businessName?.[0]) fieldErrors.businessName = apiErrors.businessName[0];
            if (apiErrors.phone?.[0]) fieldErrors.phone = apiErrors.phone[0];
            if (apiErrors.address?.[0]) fieldErrors.address = apiErrors.address[0];
            if (apiErrors.termsAccepted?.[0]) fieldErrors.terms = apiErrors.termsAccepted[0];
            setErrors(fieldErrors);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        toast.error(msg);
        setShakeKey((k) => k + 1);
      }
    });
  }

  const setField =
    (field: keyof OnboardingFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof OnboardingErrors]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    };

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      <FloatingFintechPanel />

      <section className="flex flex-1 min-h-[100dvh] justify-center overflow-y-auto bg-white px-6 py-8 sm:px-10 lg:items-start lg:px-14 lg:pt-12">
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
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Almost Done
            </div>
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-zinc-900">
              Complete Merchant Profile
            </h1>
            <p className="mt-2 text-[13.5px] text-zinc-400">
              Provide your business credentials to initialize your disbursal gateway
            </p>

            {session?.user && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-1.5 text-xs text-zinc-600">
                <span className="font-semibold text-zinc-900">{session.user.name || "Authenticated User"}</span>
                <span>•</span>
                <span className="text-zinc-500">{session.user.email}</span>
              </div>
            )}
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
                label="Company Name"
                icon={Building2}
                autoComplete="organization"
                placeholder="Acme Technologies Pvt Ltd"
                name="businessName"
                value={formData.businessName}
                onChange={setField("businessName")}
                error={errors.businessName}
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
                label="Address"
                icon={MapPin}
                autoComplete="street-address"
                placeholder="Plot 42, Cyber City, Gurugram, Haryana - 122002"
                name="address"
                value={formData.address}
                onChange={setField("address")}
                error={errors.address}
              />

              {/* Terms & conditions */}
              <motion.div variants={fieldFade} className="pt-2">
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
                    className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 underline"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="/privacy"
                    target="_blank"
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
                Complete Profile & Submit
              </SubmitButton>
            </form>
          </AnimatePresence>

          <motion.div
            variants={fieldFade}
            className="mt-8 text-center"
          >
            <Link
              href="/login"
              className="text-[13px] text-zinc-400 hover:text-zinc-600 transition-colors"
            >
              Cancel and sign out
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
