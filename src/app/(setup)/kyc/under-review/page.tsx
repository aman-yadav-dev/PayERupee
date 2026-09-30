import React from 'react';
import { redirect } from 'next/navigation';
import { getResolvedAuthDestination } from '@/modules/auth/application/destination-loader.service';
import { Clock, ShieldCheck, Mail } from 'lucide-react';
import { KycShell, AnimatedField } from '@/components/merchant/kyc/KycShell';
import { LogoBlock } from '@/components/auth/AuthShell';
import { UnderReviewPoller } from './UnderReviewPoller';

export default async function KycUnderReviewPage() {
  const destination = await getResolvedAuthDestination();
  
  if (destination !== '/kyc/under-review') {
    redirect(destination);
  }

  return (
    <KycShell maxWidth="max-w-[460px]">
      <UnderReviewPoller />
      <div className="w-full text-center">
        <AnimatedField className="mb-8 flex justify-center">
          <LogoBlock />
        </AnimatedField>

        {/* Status Icon */}
        <AnimatedField className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
          <Clock className="h-8 w-8" />
        </AnimatedField>

        {/* Heading */}
        <AnimatedField className="mb-8">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
            Account Under Review
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground max-w-md mx-auto">
            Your merchant application has been submitted successfully and is currently under KYC review by our compliance team.
          </p>
        </AnimatedField>

        {/* Info Card */}
        <AnimatedField className="rounded-2xl border border-border bg-card shadow-sm p-6 sm:p-8 text-left space-y-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5 rounded-full bg-indigo-500/10 p-2 border border-indigo-500/20">
              <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <span className="font-semibold text-[14px] text-foreground">Verification Process</span>
              <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">Our team verifies your business details and identity documents for regulatory compliance.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-0.5 rounded-full bg-indigo-500/10 p-2 border border-indigo-500/20">
              <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <span className="font-semibold text-[14px] text-foreground">Next Steps</span>
              <p className="text-[13.5px] text-muted-foreground mt-1 leading-relaxed">You will receive an email notification once your account status is updated.</p>
            </div>
          </div>
        </AnimatedField>
      </div>
    </KycShell>
  );
}
