"use client";

import { motion } from "framer-motion";
import { Clock, ShieldCheck, Mail } from "lucide-react";
import { fieldFade } from "@/components/auth/AuthShell";
import { KycShell } from "@/components/merchant/kyc/KycShell";

export default function PendingApprovalClient() {
  return (
    <KycShell maxWidth="max-w-[420px] text-center">
      {/* Status Icon */}
      <motion.div
        variants={fieldFade}
        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
      >
        <Clock className="h-8 w-8" />
      </motion.div>

      {/* Heading */}
      <motion.div variants={fieldFade} className="mb-4">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-foreground">
          Account Activation Pending
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          Your KYC has been approved! We are finalizing the setup of your merchant account.
        </p>
      </motion.div>

      {/* Info Card */}
      <motion.div
        variants={fieldFade}
        className="my-6 rounded-2xl border border-border bg-muted/50 p-5 text-left text-[13px] text-muted-foreground space-y-3"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Finalizing Setup</span>
            <p className="text-muted-foreground mt-0.5">Our team is provisioning your production credentials.</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground">Email Notification</span>
            <p className="text-muted-foreground mt-0.5">You will receive an activation email once your credentials are confirmed.</p>
          </div>
        </div>
      </motion.div>

    </KycShell>
  );
}

