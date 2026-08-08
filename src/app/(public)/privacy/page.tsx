import Link from "next/link";
import { ArrowLeft, Lock, Shield, FileCheck2 } from "lucide-react";

export const metadata = {
  title: "Privacy Policy - PayERupee",
  description: "Official Privacy Policy and Data Protection Standards for PayERupee.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-[0_4px_14px_rgba(79,70,229,.35)]"
            >
              ₹
            </Link>
            <span className="font-bold tracking-tight text-lg text-zinc-900">PayERupee</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-semibold text-zinc-600">
              Privacy
            </span>
          </div>

          <Link
            href="/register"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 py-1.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registration
          </Link>
        </div>
      </header>

      {/* Hero Header */}
      <section className="border-b border-zinc-200 bg-white py-12 px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-4">
            <Lock className="h-3.5 w-3.5" />
            Last Updated: March 1, 2026
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-zinc-900">
            Privacy Policy & Data Security
          </h1>
          <p className="mt-3 text-[15px] text-zinc-500 max-w-2xl mx-auto">
            How PayERupee collects, secures, encrypts, and processes personal and financial data across our B2B fintech gateway.
          </p>
        </div>
      </section>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="space-y-10 rounded-2xl border border-zinc-200 bg-white p-8 sm:p-12 shadow-sm leading-relaxed text-[14.5px] text-zinc-700">
          
          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">1</span>
              Information We Collect
            </h2>
            <p>
              When you register as a merchant, sign in using Google OAuth, or utilize our payment routing system, we collect:
            </p>
            <ul className="mt-2.5 space-y-2 pl-4 list-disc text-[14px]">
              <li><strong>Merchant Details:</strong> Full Name, Email, Phone Number, Company Name, and Registered Address.</li>
              <li><strong>Authentication Data:</strong> OAuth tokens, password hashes (argon2 / scrypt via Better Auth), session tokens, and IP addresses.</li>
              <li><strong>Beneficiary & Transaction Details:</strong> Beneficiary bank account numbers, IFSC codes, UPI VPAs, payout amounts, and UTR numbers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">2</span>
              How We Use Your Data
            </h2>
            <p>
              We process information strictly for operational, legal, and security requirements:
            </p>
            <ul className="mt-2.5 space-y-2 pl-4 list-disc text-[14px]">
              <li>Processing real-time bank payouts via IMPS, NEFT, RTGS, and UPI.</li>
              <li>Conducting automated fraud prevention, blacklist checks, and AML compliance scoring.</li>
              <li>Providing transaction webhooks, status notifications, and real-time reconciliation reports.</li>
              <li>Complying with regulatory obligations mandated by the Reserve Bank of India and law enforcement agencies.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">3</span>
              Data Protection & Cryptography Standards
            </h2>
            <p>
              PayERupee implements bank-grade cryptographic security across all layers:
            </p>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm mb-1">
                  <Shield className="h-4 w-4 text-indigo-600" />
                  AES-256 GCM at Rest
                </div>
                <p className="text-xs text-zinc-500">
                  All sensitive database credentials, API secrets, and beneficiary accounts are encrypted at rest using AES-256.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center gap-2 font-bold text-zinc-900 text-sm mb-1">
                  <FileCheck2 className="h-4 w-4 text-indigo-600" />
                  TLS 1.3 in Transit
                </div>
                <p className="text-xs text-zinc-500">
                  All web traffic, API calls, and webhook events are strictly transmitted over encrypted TLS 1.3 channels.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">4</span>
              Third-Party Integrations & Google OAuth
            </h2>
            <p>
              When you choose to sign in or register using Google, Google transmits your name, email address, and profile picture. We only use this data to initialize your merchant profile. We never share your banking or disbursal data with third-party advertising networks.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-zinc-900 mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 text-xs font-bold">5</span>
              Data Retention
            </h2>
            <p>
              In accordance with financial compliance mandates in India, payout logs, audit trails, and KYC records are securely archived for a minimum statutory retention period of 7 years.
            </p>
          </section>

          <section className="pt-6 border-t border-zinc-200">
            <h2 className="text-base font-bold text-zinc-900 mb-2">Data Protection Officer</h2>
            <p className="text-[13.5px] text-zinc-500">
              For any privacy concerns, data deletion requests, or compliance inquiries, please contact our Data Protection Officer at{" "}
              <a href="mailto:privacy@payerupee.com" className="font-semibold text-emerald-600 hover:underline">
                privacy@payerupee.com
              </a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
