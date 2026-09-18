import Link from "next/link";
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2 } from "lucide-react";
import { LogoBlock } from "@/components/auth/AuthShell";
import { ThemeToggle } from "@/components/theme-toggle";

export const metadata = {
  title: "Terms of Service - PayERupee",
  description: "Official Terms of Service and Merchant Agreement for PayERupee B2B Payout Infrastructure.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-[100dvh] relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-indigo-100/60 dark:from-zinc-950 dark:via-background dark:to-indigo-950/20 text-foreground">
      {/* Backdrop orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-indigo-400/[0.10] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[520px] w-[520px] rounded-full bg-violet-400/[0.08] blur-[80px]" />
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.02]" style={{ backgroundImage: "radial-gradient(circle, #4f46e5 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      <div className="relative z-10">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-white/5 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-[0_4px_14px_rgba(79,70,229,.35)]"
            >
              ₹
            </Link>
            <span className="font-bold tracking-tight text-lg text-zinc-900 dark:text-zinc-50">PayERupee</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
              Legal
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/5 px-3.5 py-1.5 text-[13px] font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-white/10 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline-block">Back to Registration</span><span className="sm:hidden">Back</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-zinc-200 dark:border-white/5 bg-transparent py-10 sm:py-12 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600/10 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-4">
            <FileText className="h-3.5 w-3.5" />
            Effective Date: March 1, 2026
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-zinc-900 dark:text-zinc-50 dark:text-zinc-50">
            Terms of Service & Merchant Agreement
          </h1>
          <p className="mt-3 text-sm sm:text-[15px] text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 max-w-2xl mx-auto">
            Please read these terms carefully before accessing or using PayERupee payout infrastructure, developer APIs, or merchant management portal.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="space-y-8 sm:space-y-10 rounded-2xl border border-zinc-200 dark:border-white/5 bg-white/90 dark:bg-zinc-950/60 backdrop-blur-md p-6 sm:p-8 md:p-12 shadow-sm leading-relaxed text-[14px] sm:text-[14.5px] text-zinc-700 dark:text-zinc-300">

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">1</span>
              Acceptance of Terms
            </h2>
            <p>
              By creating an account, signing in via Google, or utilizing the PayERupee APIs, you (“Merchant”, “User”, or “You”) agree to be bound by this Merchant Agreement and Terms of Service. If you are registering on behalf of a company, corporate entity, or partnership, you represent and warrant that you have the requisite legal authority to bind said entity.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">2</span>
              Services & Disbursal Infrastructure
            </h2>
            <p>
              PayERupee provides high-throughput programmatic payout routing, automated batch transfers (via IMPS, NEFT, RTGS, and UPI), wallet management, and webhook notifications. PayERupee operates in strict alignment with Reserve Bank of India (RBI) guidelines, NPCI standards, and partner banking network protocols.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">3</span>
              Merchant Onboarding & Mandatory KYC
            </h2>
            <p>
              All merchant accounts require successful Know Your Customer (KYC) verification and business underwriting before live disbursal operations can commence. You agree to provide accurate and verifiable company documentation (including Certificate of Incorporation, GSTIN, PAN, and registered business address).
            </p>
            <div className="mt-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 text-[13px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
              <span>
                Failure to provide valid KYC documentation or providing fraudulent identifiers will result in immediate suspension and blacklisting across the platform.
              </span>
            </div>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">4</span>
              Pre-funded Wallets & Disbursal Balances
            </h2>
            <p>
              Payouts can only be executed against cleared and available balances in the merchant’s dedicated virtual wallet. Fund addition requests are subject to admin verification and UTR confirmation. PayERupee does not extend credit lines or process transactions with insufficient wallet balances.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">5</span>
              Prohibited Activities & Anti-Money Laundering (AML)
            </h2>
            <p>You strictly agree not to use PayERupee infrastructure for:</p>
            <ul className="mt-3 space-y-2 list-none pl-1 sm:pl-2">
              {[
                "Unlicensed gambling, betting, or speculative gaming services",
                "Transactions involving sanctioned individuals, countries, or blacklisted VPA/bank accounts",
                "Ponzi schemes, multi-level marketing (MLM), or illegal financial syndicates",
                "Money laundering, terrorist financing, or circumvention of tax liabilities",
              ].map((item, idx) => (
                <li key={idx} className="flex items-center gap-2 text-[13.5px] items-start">
                  <CheckCircle2 className="h-4 w-4 text-destructive shrink-0 mt-0.5 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">6</span>
              API Security & Secret Credentials
            </h2>
            <p>
              Merchants are solely responsible for safeguarding their API Keys, Webhook Secrets, and access credentials. Any API transaction signed with a valid merchant API key is deemed authorized by the merchant.
            </p>
          </section>

          <section>
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-50 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold">7</span>
              Governing Law & Jurisdiction
            </h2>
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any disputes arising out of or in connection with these terms shall be subject to the exclusive jurisdiction of the courts of New Delhi / Gurugram, India.
            </p>
          </section>

          <section className="pt-6 border-t border-zinc-200">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 mb-2">Questions & Support</h2>
            <p className="text-[13.5px] text-zinc-500 dark:text-zinc-400">
              For any legal or compliance queries, please reach out to our team at{" "}
              <a href="mailto:compliance@payerupee.com" className="font-semibold text-indigo-600 hover:underline">
                compliance@payerupee.com
              </a>.
            </p>
          </section>
        </div>
      </main>
      </div>
    </div>
  );
}
