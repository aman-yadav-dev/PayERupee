"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import {
  FloatingFintechPanel,
  LogoBlock,
  fieldFade,
  stagger,
} from "@/components/auth/AuthShell";

export default function PendingApprovalPage() {
  return (
    <main className="flex min-h-[100dvh] flex-col bg-white lg:flex-row">
      <FloatingFintechPanel />

      <section className="flex flex-1 min-h-[100dvh] items-center justify-center overflow-y-auto bg-white px-6 py-12 sm:px-10 lg:px-14">
        <motion.div
          variants={stagger}
          initial="initial"
          animate="animate"
          className="w-full max-w-[420px] text-center"
        >
          {/* Logo */}
          <motion.div variants={fieldFade} className="mb-8 flex justify-center">
            <LogoBlock />
          </motion.div>

          {/* Status Icon */}
          <motion.div
            variants={fieldFade}
            className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
          >
            <Clock className="h-8 w-8" />
          </motion.div>

          {/* Heading */}
          <motion.div variants={fieldFade} className="mb-4">
            <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.04em] text-zinc-900">
              Account Under Review
            </h1>
            <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">
              Your merchant application has been submitted successfully and is currently under KYC review by our compliance team.
            </p>
          </motion.div>

          {/* Info Card */}
          <motion.div
            variants={fieldFade}
            className="my-6 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-5 text-left text-[13px] text-zinc-600 space-y-3"
          >
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-900">Verification Timeline</span>
                <p className="text-zinc-500 mt-0.5">Reviews are usually completed within 2 to 4 business hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-zinc-900">Email Notification</span>
                <p className="text-zinc-500 mt-0.5">You will receive an activation email once your credentials are confirmed.</p>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div variants={fieldFade} className="space-y-3">
            <Link
              href="/login"
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,.22)] transition-colors hover:bg-indigo-700"
            >
              Go to Sign In
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="flex h-11 w-full items-center justify-center rounded-xl border border-zinc-200 bg-white text-[13.5px] font-medium text-zinc-600 hover:bg-zinc-50 transition-colors"
            >
              Back to Home
            </Link>
          </motion.div>
        </motion.div>
      </section>
    </main>
  );
}
