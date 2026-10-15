"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Zap,
  ArrowRight,
  Code2,
  Copy,
  CheckCircle2,
  Lock,
  Landmark,
  Smartphone,
  ShieldCheck,
  Check,
  ChevronLeft,
  Terminal,
  Menu,
  X,
  Sparkles,
} from "lucide-react";

export default function DocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeLang, setActiveLang] = useState<"cURL" | "Node.js" | "Python">("cURL");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const bankCurl = `curl -X POST https://payerupee.in/api/v1/payouts \\
  -H "Authorization: Bearer sk_test_your_api_key_here" \\
  -H "Idempotency-Key: \$(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "1500.00",
    "paymentMode": "IMPS",
    "accountNumber": "987654321012",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Rahul Sharma",
    "beneficiaryPhone": "9876543210"
  }'`;

  const bankNode = `const response = await fetch("https://payerupee.in/api/v1/payouts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_test_your_api_key_here",
    "Idempotency-Key": crypto.randomUUID(),
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    amount: "1500.00",
    paymentMode: "IMPS",
    accountNumber: "987654321012",
    ifscCode: "HDFC0001234",
    accountHolderName: "Rahul Sharma",
    beneficiaryPhone: "9876543210"
  })
});

const data = await response.json();
console.log(data);`;

  const bankPython = `import requests
import uuid

url = "https://payerupee.in/api/v1/payouts"
headers = {
    "Authorization": "Bearer sk_test_your_api_key_here",
    "Idempotency-Key": str(uuid.uuid4()),
    "Content-Type": "application/json"
}
payload = {
    "amount": "1500.00",
    "paymentMode": "IMPS",
    "accountNumber": "987654321012",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Rahul Sharma",
    "beneficiaryPhone": "9876543210"
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())`;

  const upiCurl = `curl -X POST https://payerupee.in/api/v1/payouts \\
  -H "Authorization: Bearer sk_test_your_api_key_here" \\
  -H "Idempotency-Key: \$(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": "500.00",
    "paymentMode": "UPI",
    "vpa": "rahul@upi",
    "accountHolderName": "Rahul Sharma"
  }'`;

  const successResponse = `{
  "success": true,
  "payout": {
    "id": "cmv9y0ogp0022w456sjrqm896",
    "idempotencyKey": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "amount": "1500.00",
    "fee": "5.00",
    "tax": "0.90",
    "totalDebitAmount": "1505.90",
    "status": "SUCCESS",
    "paymentMode": "IMPS",
    "merchantReference": null,
    "failureReason": null,
    "processedAt": "2026-10-16T01:10:00.000Z",
    "createdAt": "2026-10-16T01:10:00.000Z",
    "accountNumber": "987654321012",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Rahul Sharma",
    "vpa": null
  }
}`;

  const getActiveCode = () => {
    if (activeLang === "cURL") return bankCurl;
    if (activeLang === "Node.js") return bankNode;
    return bankPython;
  };

  const navItems = [
    { href: "#quickstart", label: "Quickstart" },
    { href: "#sandbox-vs-live", label: "Sandbox vs Live" },
    { href: "#api-reference", label: "API Reference" },
    { href: "#bank-transfer", label: "Bank IMPS/NEFT" },
    { href: "#upi-transfer", label: "UPI Instant" },
    { href: "#responses", label: "Response Schemas" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* ---------------- NAVBAR ---------------- */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 shadow-md shadow-emerald-500/20">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-white" fill="white" />
              </div>
              <span className="text-base sm:text-lg font-bold tracking-tight text-slate-900 truncate">
                PayE<span className="text-emerald-600">Rupee</span>
              </span>
            </Link>
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 md:inline-flex shrink-0">
              <Code2 className="h-3.5 w-3.5 text-emerald-600" />
              Developer Docs
            </span>
          </div>

          {/* Desktop Right actions */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Home
            </Link>
            <Link
              href="/login"
              className="rounded-full px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-full bg-slate-900 px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800"
            >
              Get API Keys
            </Link>
          </div>

          {/* Mobile hamburger */}
          <div className="flex sm:hidden items-center gap-2">
            <Link
              href="/login"
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
            >
              Sign In
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 text-slate-700 rounded-lg hover:bg-slate-100"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
            <div className="flex flex-col gap-1 text-sm">
              <Link
                href="/"
                className="py-1.5 text-slate-700 font-medium hover:text-emerald-600"
                onClick={() => setMobileMenuOpen(false)}
              >
                ← Back to Home Page
              </Link>
              <Link
                href="/register"
                className="py-1.5 font-semibold text-emerald-600 hover:text-emerald-700"
                onClick={() => setMobileMenuOpen(false)}
              >
                Create Account &amp; Get API Keys
              </Link>
            </div>
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Jump to Section</p>
              <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600">
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 rounded-md hover:bg-slate-50 hover:text-slate-900"
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ---------------- HERO / BANNER ---------------- */}
      <div className="border-b border-slate-200/60 bg-gradient-to-b from-white to-slate-50/80 py-8 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-50 px-3 py-1 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-emerald-700">
            <Terminal className="h-3.5 w-3.5 shrink-0" />
            API v1 Integration Guide
          </div>
          <h1 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 break-words">
            PayERupee Payout Gateway Documentation
          </h1>
          <p className="mt-2.5 max-w-3xl text-sm sm:text-base leading-relaxed text-slate-600">
            Automate instant bank disbursements, vendor payouts, and UPI reward campaigns with guaranteed idempotency, double-entry financial ledgers, and multi-tier fraud protection.
          </p>

          {/* Quick jump pills on mobile/tablet */}
          <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar lg:hidden">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-xs hover:border-slate-300 hover:text-slate-900 shrink-0"
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------- MAIN CONTENT ---------------- */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Table of contents sidebar (desktop only) */}
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-24 space-y-6 text-sm">
              <div>
                <p className="font-semibold text-slate-900">On this page</p>
                <ul className="mt-3 space-y-2 border-l border-slate-200 pl-3 text-slate-600">
                  {navItems.map((item, idx) => (
                    <li key={item.href}>
                      <a href={item.href} className="hover:text-emerald-600 transition-colors">
                        {idx + 1}. {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  Instant Sandbox
                </div>
                <p className="mt-1.5 text-xs text-emerald-700 leading-normal">
                  Test API keys (<code className="font-mono text-[11px] font-bold">sk_test_...</code>) execute immediately with simulated success and zero real bank debits.
                </p>
              </div>
            </div>
          </aside>

          {/* Docs content */}
          <div className="min-w-0 max-w-full space-y-10 sm:space-y-12 lg:col-span-9">
            {/* Quickstart */}
            <section id="quickstart" className="scroll-mt-24 space-y-4">
              <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 shrink-0">
                  1
                </span>
                Quickstart &amp; Authentication
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                All requests to the PayERupee API are sent over HTTPS and authenticated using Bearer tokens. Include your secret API key in the <code className="rounded bg-slate-200/80 px-1.5 py-0.5 text-xs font-mono text-slate-800">Authorization</code> header:
              </p>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-900 p-3 sm:p-4 font-mono text-xs text-slate-200 break-all">
                <span className="text-emerald-400">Authorization:</span> Bearer sk_test_YOUR_API_KEY
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
                    <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
                    Idempotency-Key
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    Always pass a unique UUID in the <code className="font-mono">Idempotency-Key</code> header. Retrying the same key returns the existing payout state without duplicate wallet debits.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
                  <div className="flex items-center gap-2 font-semibold text-slate-900 text-xs sm:text-sm">
                    <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0" />
                    IP Whitelisting &amp; Bans
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    In Live mode, PayERupee checks IP allowlists and destination bans before disbursing funds, keeping your wallet protected against unauthorized transfers.
                  </p>
                </div>
              </div>
            </section>

            {/* Sandbox vs Live */}
            <section id="sandbox-vs-live" className="scroll-mt-24 space-y-4">
              <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 shrink-0">
                  2
                </span>
                Sandbox vs Live Mode
              </h2>
              
              {/* Responsive table wrapper */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full min-w-[540px] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50/75 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Environment</th>
                      <th className="px-4 py-3">Key Prefix</th>
                      <th className="px-4 py-3">Processing Behavior</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                    <tr>
                      <td className="px-4 py-3 font-semibold text-slate-900">Sandbox (Test)</td>
                      <td className="px-4 py-3 font-mono text-emerald-600 font-semibold">sk_test_...</td>
                      <td className="px-4 py-3">
                        Completes instantly with <code className="font-mono text-emerald-600">SUCCESS</code> status. Perfect for automated tests and sandbox verification.
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-slate-900">Live (Production)</td>
                      <td className="px-4 py-3 font-mono text-blue-600 font-semibold">sk_live_...</td>
                      <td className="px-4 py-3">
                        Dispatches immediately to banking switches (PayMyQR). Returns <code className="font-mono text-amber-600">PROCESSING</code> with upstream reference, settling upon interbank completion.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* API Reference */}
            <section id="api-reference" className="scroll-mt-24 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-lg bg-emerald-100 text-xs font-bold text-emerald-700 shrink-0">
                    3
                  </span>
                  Create Payout Endpoint
                </h2>
                <div className="inline-flex self-start sm:self-auto items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 shadow-xs">
                  {(["cURL", "Node.js", "Python"] as const).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => setActiveLang(lang)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all ${
                        activeLang === lang
                          ? "bg-slate-900 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              {/* Endpoint URL pill */}
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-mono text-slate-800 break-all">
                <span className="rounded bg-emerald-600 px-2 py-0.5 font-bold text-white uppercase text-[10px] tracking-wider shrink-0">
                  POST
                </span>
                <span className="select-all">https://payerupee.in/api/v1/payouts</span>
              </div>

              {/* Bank Transfer block */}
              <div id="bank-transfer" className="scroll-mt-24 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Landmark className="h-4 w-4 text-emerald-600 shrink-0" />
                    Bank Account Transfer (IMPS / NEFT)
                  </span>
                  <button
                    onClick={() => copyToClipboard(getActiveCode(), "bank")}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {copiedCode === "bank" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4 font-mono text-xs leading-relaxed text-slate-200">
                  <pre className="overflow-x-auto text-[11.5px] sm:text-xs">{getActiveCode()}</pre>
                </div>
              </div>

              {/* UPI Code block */}
              <div id="upi-transfer" className="scroll-mt-24 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Smartphone className="h-4 w-4 text-blue-600 shrink-0" />
                    UPI Instant Transfer (VPA)
                  </span>
                  <button
                    onClick={() => copyToClipboard(upiCurl, "upi")}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {copiedCode === "upi" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy cURL</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4 font-mono text-xs leading-relaxed text-slate-200">
                  <pre className="overflow-x-auto text-[11.5px] sm:text-xs">{upiCurl}</pre>
                </div>
              </div>

              {/* Response block */}
              <div id="responses" className="scroll-mt-24 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    Example 201 Created Response
                  </span>
                  <button
                    onClick={() => copyToClipboard(successResponse, "res")}
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    {copiedCode === "res" ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy JSON</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative min-w-0 max-w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 p-3 sm:p-4 font-mono text-xs leading-relaxed text-emerald-400">
                  <pre className="overflow-x-auto text-[11.5px] sm:text-xs">{successResponse}</pre>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="mt-16 sm:mt-20 border-t border-slate-200/80 bg-white py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} PayERupee Solutions Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
