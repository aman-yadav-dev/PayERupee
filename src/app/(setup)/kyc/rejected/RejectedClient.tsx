"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle, ArrowRight, Loader2 } from "lucide-react";
import { KycShell, AnimatedField } from "@/components/merchant/kyc/KycShell";
import { LogoBlock } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export default function RejectedClient({ 
  rejectionReason, 
  allowResubmission 
}: { 
  rejectionReason?: string | null;
  allowResubmission?: boolean;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleResubmit = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/merchant/kyc/application/resubmit", {
        method: "POST"
      });
      if (!res.ok) {
        setIsLoading(false);
        return;
      }
      
      // Force a hard navigation to completely bypass the Next.js client-side router cache
      window.location.assign("/kyc/form");
    } catch (e) {
      setIsLoading(false);
    }
  };

  return (
    <KycShell maxWidth="max-w-[460px]">
      <div className="w-full text-center">
        <AnimatedField className="mb-8 flex justify-center">
          <LogoBlock />
        </AnimatedField>

        {/* Status Icon */}
        <AnimatedField className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-[0_4px_20px_rgba(239,68,68,0.15)]">
          <XCircle className="h-8 w-8" />
        </AnimatedField>

        {/* Heading */}
        <AnimatedField className="mb-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
            Application Rejected
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground max-w-md mx-auto">
            Unfortunately, your KYC application has been rejected based on the information provided.
          </p>
        </AnimatedField>

        {/* Info Card */}
        <AnimatedField className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8 text-left space-y-6">
          <div>
            <h4 className="font-semibold text-[14px] text-foreground mb-3">Reason for rejection</h4>
            {rejectionReason ? (
              <div className="mb-6 rounded-lg bg-destructive/5 border border-destructive/20 p-4">
                <p className="text-[13.5px] text-foreground font-medium leading-relaxed">
                  {rejectionReason}
                </p>
              </div>
            ) : (
              <p className="text-[13.5px] text-muted-foreground leading-relaxed mb-5">
                This may be due to regulatory compliance policies, unverified identity details, or mismatched legal documents.
              </p>
            )}
            
            <div className="bg-muted/50 border border-border/50 rounded-lg p-4">
              <h4 className="font-semibold text-[13.5px] text-foreground mb-2">Next Steps</h4>
              <ul className="list-disc list-inside space-y-2 text-[13px] text-muted-foreground">
                <li>Review the compliance guidelines.</li>
                <li>Contact our merchant support team for details.</li>
                <li>Ensure all legal documents are valid and current.</li>
              </ul>
            </div>
          </div>
          
          {allowResubmission && (
            <div className="pt-4 border-t border-border">
              <Button 
                className="w-full h-11" 
                size="lg"
                onClick={handleResubmit}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Review & Resubmit
                {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          )}
        </AnimatedField>
      </div>
    </KycShell>
  );
}
