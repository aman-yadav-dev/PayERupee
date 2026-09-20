"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  LogoBlock,
  InputField,
  SubmitButton,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";
import { CustomCheckbox } from "@/components/ui/checkbox";
import { completeMerchantOnboardingAction } from "@/actions/auth/onboarding";
import { authClient } from "@/modules/auth/infrastructure/auth-client";

interface OnboardingFormData {
  phone: string;
}

interface OnboardingErrors {
  phone?: string;
  terms?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { data: session } = authClient.useSession();

  const [formData, setFormData] = useState<OnboardingFormData>({
    phone: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<OnboardingErrors>({});
  const [shakeKey, setShakeKey] = useState(0);

  function validate(): OnboardingErrors {
    const e: OnboardingErrors = {};

    const cleanPhone = formData.phone.trim();
    if (!cleanPhone) {
      e.phone = "Phone number is required";
    } else if (!/^[6789]\d{9}$/.test(cleanPhone) || /^(\d)\1{9}$/.test(cleanPhone)) {
      e.phone = "Please enter a valid 10-digit phone number";
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
          phone: formData.phone.trim(),
          termsAccepted: agreed,
        });

        if (res.success) {
          toast.success("Profile initialized successfully!");
          window.location.assign("/auth-sync");
        } else {
          toast.error(res.message || "Failed to complete setup");
          setShakeKey((k) => k + 1);
          if (res.errors && typeof res.errors === "object") {
            const fieldErrors: OnboardingErrors = {};
            const apiErrors = res.errors as Record<string, string[]>;
            if (apiErrors.phone?.[0]) fieldErrors.phone = apiErrors.phone[0];
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      if (errors[field as keyof OnboardingErrors]) {
        setErrors((prev) => ({
          ...prev,
          [field]: undefined,
        }));
      }
    };

  return (
    <motion.div
      variants={stagger}
      initial="initial"
      animate="animate"
      className="w-full max-w-[400px]"
    >
      <motion.div variants={fieldFade} className="mb-10 flex justify-start">
        <LogoBlock />
      </motion.div>

      <motion.div variants={fieldFade} className="mb-8 text-left">
        <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">
          Complete your account
        </h1>
        <p className="mt-2 text-[14px] text-muted-foreground leading-relaxed">
          Provide your phone number to secure your account.
        </p>

        {session?.user && (
          <div className="mt-3 text-[13.5px] text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{session.user.name || "Authenticated User"}</span> ({session.user.email})
          </div>
        )}
      </motion.div>

      <AnimatePresence mode="wait">
        <form
          key={shakeKey}
          onSubmit={onSubmit}
          noValidate
          className="space-y-4"
        >
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

          <SubmitButton loading={isPending}>
            Continue
          </SubmitButton>
        </form>
      </AnimatePresence>

      <motion.div
        variants={fieldFade}
        className="mt-6 flex justify-start"
      >
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.push("/login");
          }}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
        >
          Cancel and sign out
        </button>
      </motion.div>
    </motion.div>
  );
}
