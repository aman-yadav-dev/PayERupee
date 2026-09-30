"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, UserCircle, Briefcase, CheckCircle2 } from "lucide-react";
import { KycShell, AnimatedField } from "@/components/merchant/kyc/KycShell";
import { LogoBlock } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { ChangeMerchantTypeDialog } from "@/components/merchant/kyc/ChangeMerchantTypeDialog";

export default function StartKycClient({ hasApplication, currentMerchantType }: { hasApplication: boolean, currentMerchantType?: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [merchantType, setMerchantType] = useState<string>(currentMerchantType || "INDIVIDUAL");
  const [showChangeDialog, setShowChangeDialog] = useState(false);

  const handleStart = async () => {
    setIsLoading(true);
    try {
      if (!hasApplication) {
        const res = await fetch("/api/v1/merchant/kyc/application", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ merchantType })
        });
        
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to initialize application");
        }
      }
      
      router.refresh();
      router.push("/kyc/form");
    } catch (e: any) {
      toast.error(e.message);
      setIsLoading(false);
    }
  };

  const showTypeSelection = !hasApplication;

  return (
    <KycShell maxWidth="max-w-[420px] text-center">
      <AnimatedField className="mb-8 flex justify-center">
        <LogoBlock />
      </AnimatedField>

      <AnimatedField className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-[0_4px_20px_rgba(79,70,229,0.15)]">
        <Building2 className="h-8 w-8" />
      </AnimatedField>

      <AnimatedField className="mb-4">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
          Verify your business
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {hasApplication 
            ? "You have a draft application. Resume below to finish your verification."
            : "Before you can access the merchant dashboard and accept payments, we need to verify your business details."}
        </p>
      </AnimatedField>

      {showTypeSelection && (
        <AnimatedField className="mt-6 text-left">
          <div className="mb-3 text-[13.5px] font-medium text-foreground">Select Business Type</div>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setMerchantType("INDIVIDUAL")}
              disabled={isLoading}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                merchantType === "INDIVIDUAL"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
                  : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <UserCircle className="h-5 w-5 opacity-70 flex-shrink-0" />
              <div className="grid gap-0.5 flex-1">
                <p className="text-[14px] font-semibold">Individual / Proprietorship</p>
                <p className="text-[12.5px] font-normal opacity-70">I operate as an individual</p>
              </div>
              {merchantType === "INDIVIDUAL" && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
            </button>
            <button
              type="button"
              onClick={() => setMerchantType("COMPANY")}
              disabled={isLoading}
              className={`flex items-center gap-3 rounded-xl border p-4 transition-all text-left w-full outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 ${
                merchantType === "COMPANY"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100"
                  : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              <Briefcase className="h-5 w-5 opacity-70 flex-shrink-0" />
              <div className="grid gap-0.5 flex-1">
                <p className="text-[14px] font-semibold">Registered Company</p>
                <p className="text-[12.5px] font-normal opacity-70">Private Limited, LLP, etc.</p>
              </div>
              {merchantType === "COMPANY" && <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
            </button>
          </div>
        </AnimatedField>
      )}

      {hasApplication && (
        <AnimatedField className="mt-4 text-[13.5px]">
          <span className="text-muted-foreground">Current type: </span>
          <span className="font-medium text-foreground">{currentMerchantType === 'COMPANY' ? 'Registered Company' : currentMerchantType === 'LLP' ? 'LLP' : 'Individual / Proprietorship'}</span>
        </AnimatedField>
      )}

      <AnimatedField className="mt-8">
        <Button
          onClick={handleStart}
          disabled={isLoading}
          className="h-[44px] w-full rounded-xl bg-indigo-600 text-[14px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition-all hover:bg-indigo-700 hover:shadow-[0_4px_12px_rgba(79,70,229,0.25)] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            hasApplication ? "Resume Application" : "Start Application"
          )}
        </Button>
      </AnimatedField>
    </KycShell>
  );
}
