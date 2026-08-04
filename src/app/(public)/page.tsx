"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import {
  Zap,
  ShieldCheck,
  Gift,
  Send,
  Wallet,
  Link2,
  ArrowRight,
  Code2,
  CheckCircle2,
  Sparkles,
  Menu,
  X,
  Briefcase,
  Rocket,
  Clock,
  TrendingUp,
  Lock,
  IndianRupee,
  Building2,
  Network,
} from "lucide-react";

// ---------- Motion presets ----------
const EASE = [0.21, 0.47, 0.32, 0.98] as const;

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE },
  },
};

// ---------- Reusable scroll-reveal wrapper ----------
const FadeIn = ({
  children,
  delay = 0,
  y = 24,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7, delay, ease: EASE }}
    className={className}
  >
    {children}
  </motion.div>
);

// ---------- 3D Tilt wrapper (magnetic hover) ----------
const TiltCard = ({
  children,
  className = "",
  intensity = 8,
}: {
  children: React.ReactNode;
  className?: string;
  intensity?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);

  const rotateX = useSpring(useTransform(py, [0, 1], [intensity, -intensity]), {
    stiffness: 180,
    damping: 22,
  });
  const rotateY = useSpring(useTransform(px, [0, 1], [-intensity, intensity]), {
    stiffness: 180,
    damping: 22,
  });

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        px.set((e.clientX - rect.left) / rect.width);
        py.set((e.clientY - rect.top) / rect.height);
      }}
      onMouseLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
        transformStyle: "preserve-3d",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ---------- Gradient hairline border wrapper ----------
const GradientBorder = ({
  children,
  className = "",
  from = "from-slate-200/90",
  to = "to-slate-200/30",
}: {
  children: React.ReactNode;
  className?: string;
  from?: string;
  to?: string;
}) => (
  <div
    className={`rounded-2xl bg-gradient-to-b ${from} ${to} p-px ${className}`}
  >
    {children}
  </div>
);

// ---------- Ambient drifting glow blob ----------
const GlowBlob = ({
  className = "",
  duration = 18,
  drift = 50,
}: {
  className?: string;
  duration?: number;
  drift?: number;
}) => (
  <motion.div
    aria-hidden
    animate={{
      x: [0, drift, -drift * 0.4, 0],
      y: [0, -drift * 0.6, drift * 0.5, 0],
      scale: [1, 1.15, 0.95, 1],
    }}
    transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
  />
);

const Badge = ({
  icon: Icon,
  text,
}: {
  icon: React.ElementType;
  text: string;
}) => (
  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-gradient-to-r from-emerald-50 to-teal-50/50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-sm">
    <Icon className="h-3.5 w-3.5" />
    {text}
  </div>
);

// ---------- Static content ----------
const navLinks = [
  { label: "Product", href: "#features" },
  { label: "Services", href: "#services" },
  { label: "How it Works", href: "#how-it-works" },
  { label: "Roadmap", href: "#roadmap" },
];

const features = [
  {
    icon: Zap,
    title: "Lightning Fast Payouts",
    desc: "Push funds to any UPI ID or bank account in seconds, not days. Our infrastructure is built for high-throughput, low-latency disbursals at scale.",
  },
  {
    icon: ShieldCheck,
    title: "Bank-Grade Security",
    desc: "Every transaction is ACID-compliant, encrypted end-to-end, and reconciled in real time — so funds never go missing and money never moves twice.",
  },
  {
    icon: Gift,
    title: "Campaign & Cashback Management",
    desc: "Design reward rules once and let PayERupee automate cashback, referral bonuses, and incentive payouts across thousands of users at once.",
  },
];

const services = [
  {
    icon: Send,
    tag: "Live",
    tagColor: "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30",
    title: "Payout Gateway",
    desc: "A single API to disburse to UPI, IMPS, and NEFT — with campaign automation, cashback logic, and real-time tracking built in.",
  },
  {
    icon: Code2,
    tag: "Available",
    tagColor: "bg-blue-400/15 text-blue-300 ring-1 ring-blue-400/30",
    title: "Software Development",
    desc: "Our engineering team builds custom fintech infrastructure, internal tools, and integrations for businesses that need more than off-the-shelf software.",
  },
  {
    icon: Briefcase,
    tag: "Available",
    tagColor: "bg-indigo-400/15 text-indigo-300 ring-1 ring-indigo-400/30",
    title: "Business Enablement",
    desc: "From compliance guidance to reconciliation workflows, we help growing businesses put the right financial operations in place from day one.",
  },
];

const steps = [
  {
    icon: Link2,
    title: "Connect Account",
    desc: "Sign up and link your business bank account or generate API keys in minutes — no lengthy onboarding queues.",
  },
  {
    icon: Wallet,
    title: "Fund Wallet",
    desc: "Load your PayERupee wallet via NEFT, RTGS, or UPI. Balances reflect instantly and are fully auditable.",
  },
  {
    icon: Send,
    title: "Execute Mass Payouts",
    desc: "Trigger single or bulk payouts via API or dashboard, and watch each transaction settle with live status tracking.",
  },
];

const roadmap = [
  {
    icon: CheckCircle2,
    status: "Now",
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
    glow: "hover:shadow-emerald-500/10",
    items: [
      "UPI & Bank Payouts API",
      "Campaign & Cashback Automation",
      "Real-time Transaction Dashboard",
    ],
  },
  {
    icon: Rocket,
    status: "Next",
    color: "text-blue-600 bg-blue-50 border-blue-200",
    glow: "hover:shadow-blue-500/10",
    items: [
      "Payment Acceptance (UPI, Cards, NetBanking)",
      "Multi-currency Wallet Support",
      "Advanced Fraud Detection",
    ],
  },
  {
    icon: Clock,
    status: "Later",
    color: "text-slate-600 bg-slate-100 border-slate-200",
    glow: "hover:shadow-slate-500/10",
    items: [
      "Full-stack Software Development Suite",
      "Embedded Finance for Partners",
      "Expanded Business Advisory",
    ],
  },
];

const stats = [
  { label: "Processed Volume", value: "₹500Cr+" },
  { label: "Daily Payouts", value: "50,000+" },
  { label: "Platform Uptime", value: "99.99%" },
  { label: "Avg. Payout Time", value: "<2s" },
];

const networks = [
  { name: "UPI", highlight: false },
  { name: "NEFT", highlight: false },
  { name: "IMPS", highlight: false },
  { name: "RTGS", highlight: false },
  { name: "Next.js", highlight: false },
  { name: "Kamai Hub", highlight: true },
];

const footerLinks = {
  Product: ["Payout Gateway", "Documentation", "API Reference", "Pricing"],
  Company: [
    "About Us",
    "Software Development",
    "Business Enablement",
    "Careers",
  ],
  Legal: ["Terms of Service", "Privacy Policy", "Compliance"],
};

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased [background-image:radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(16,185,129,0.08),transparent),radial-gradient(ellipse_60%_40%_at_10%_110%,rgba(79,70,229,0.06),transparent)]">
      {/* ---------------- NAVBAR ---------------- */}
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="absolute inset-0 border-b border-slate-200/50 bg-white/60 backdrop-blur-xl [mask-image:linear-gradient(to_bottom,black,black)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
        <nav className="relative mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ rotate: 8, scale: 1.05 }}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 shadow-lg shadow-emerald-500/30 ring-1 ring-white/40"
            >
              <Zap className="h-5 w-5 text-white" fill="white" />
            </motion.div>
            <span className="text-lg font-bold tracking-tight text-slate-900">
              PayE<span className="text-emerald-600">Rupee</span>
            </span>
          </div>

          <div className="hidden items-center gap-1 rounded-full border border-slate-200/60 bg-white/50 px-2 py-1 backdrop-blur-md lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-slate-600 transition-all hover:bg-slate-900/5 hover:text-slate-900"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="group relative flex items-center gap-1.5 overflow-hidden rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:shadow-xl hover:shadow-emerald-500/30"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              <span className="relative">Get Started</span>
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 lg:hidden"
          >
            {menuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="relative overflow-hidden border-t border-slate-200/60 bg-white/90 px-6 backdrop-blur-xl lg:hidden"
            >
              <div className="flex flex-col gap-4 py-4">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className="text-sm font-medium text-slate-600"
                  >
                    {link.label}
                  </a>
                ))}
                <hr className="border-slate-200" />
                <Link
                  href="/login"
                  className="rounded-full border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Get Started
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden pt-40 pb-24 lg:pt-48 lg:pb-32">
        {/* Ambient drifting glow field */}
        <GlowBlob
          className="-top-40 -right-40 h-[32rem] w-[32rem] bg-emerald-300/30"
          duration={20}
        />
        <GlowBlob
          className="-bottom-32 -left-32 h-[32rem] w-[32rem] bg-indigo-300/30"
          duration={24}
          drift={70}
        />
        <GlowBlob
          className="top-1/3 left-1/2 h-72 w-72 bg-blue-300/20"
          duration={16}
          drift={40}
        />
        {/* Subtle dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(15,23,42,0.06)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_30%,black,transparent)]"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-2 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={staggerItem}>
              <Badge icon={Sparkles} text="PayERupee Solutions · Payout API" />
            </motion.div>

            <motion.h1
              variants={staggerItem}
              className="mt-6 text-5xl font-extrabold leading-[1.02] tracking-tighter text-slate-950 sm:text-6xl lg:text-7xl"
            >
              Frictionless payouts,{" "}
              <span className="relative inline-block">
                <span className="bg-gradient-to-r from-indigo-600 via-blue-500 to-emerald-400 bg-clip-text text-transparent [text-shadow:none]">
                  built for scale.
                </span>
                <span
                  aria-hidden
                  className="absolute -inset-x-4 -inset-y-2 -z-10 bg-gradient-to-r from-indigo-500/15 via-blue-500/10 to-emerald-400/15 blur-2xl"
                />
              </span>
            </motion.h1>

            <motion.p
              variants={staggerItem}
              className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600"
            >
              PayERupee handles seamless UPI &amp; bank transactions, manages
              incentive campaigns securely, and tracks every cashback payout
              with absolute precision — so your business can move money without
              moving mountains.
            </motion.p>

            <motion.div
              variants={staggerItem}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/register"
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-blue-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-all hover:shadow-xl hover:shadow-emerald-500/40"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">Create Free Account</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <button className="flex items-center justify-center gap-2 rounded-full border border-slate-300/80 bg-white/60 px-7 py-3.5 text-sm font-semibold text-slate-700 backdrop-blur-sm transition-all hover:border-slate-400 hover:bg-white hover:shadow-md">
                <Code2 className="h-4 w-4" />
                View Documentation
              </button>
            </motion.div>

            <motion.div
              variants={staggerItem}
              className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500"
            >
              {["No setup fees", "PCI-DSS aligned", "99.99% uptime"].map(
                (t) => (
                  <span key={t} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {t}
                  </span>
                ),
              )}
            </motion.div>
          </motion.div>

          {/* Floating dashboard mock — 3D tilt + glass */}
          <div className="relative mx-auto w-full max-w-md lg:mx-0">
            <motion.div
              animate={{ y: [0, -12, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <TiltCard intensity={7}>
                <GradientBorder
                  from="from-white/90"
                  to="to-slate-200/40"
                  className="shadow-2xl shadow-indigo-900/10"
                >
                  <div className="relative z-10 rounded-[15px] bg-white/80 p-6 backdrop-blur-xl">
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-[15px] bg-gradient-to-br from-emerald-50/50 via-transparent to-indigo-50/50"
                    />
                    <div className="relative">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                          Wallet Balance
                        </span>
                        <Wallet className="h-5 w-5 text-slate-400" />
                      </div>
                      <div className="mt-2 flex items-center gap-1 text-3xl font-bold tracking-tight text-slate-900">
                        <IndianRupee className="h-6 w-6" />
                        12,45,890
                      </div>
                      <div className="mt-1 flex items-center gap-1 text-sm font-medium text-emerald-600">
                        <TrendingUp className="h-4 w-4" />
                        +18.2% this month
                      </div>

                      <hr className="my-5 border-slate-200/60" />

                      <motion.div
                        variants={staggerContainer}
                        initial="hidden"
                        animate="show"
                        className="space-y-3"
                      >
                        {[
                          { name: "Rahul K.", amount: "₹25,000", mode: "UPI" },
                          {
                            name: "Cashback Batch #204",
                            amount: "₹8,450",
                            mode: "Bulk",
                          },
                          { name: "Priya S.", amount: "₹12,300", mode: "IMPS" },
                        ].map((tx) => (
                          <motion.div
                            key={tx.name}
                            variants={staggerItem}
                            className="flex items-center justify-between rounded-lg px-2 py-1 transition-colors hover:bg-emerald-50/60"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-50 to-emerald-100 ring-1 ring-emerald-200/60">
                                <Send className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-slate-800">
                                  {tx.name}
                                </p>
                                <p className="text-xs text-slate-400">
                                  {tx.mode}
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                              {tx.amount}
                            </span>
                          </motion.div>
                        ))}
                      </motion.div>
                    </div>
                  </div>
                </GradientBorder>
              </TiltCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1, y: [0, -6, 0] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: 0.5,
              }}
              className="absolute -bottom-6 -left-6 z-20 flex items-center gap-2 rounded-xl border border-white/60 bg-white/80 px-4 py-3 shadow-xl shadow-emerald-900/10 backdrop-blur-xl"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/40">
                <CheckCircle2 className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Payout Successful
                </p>
                <p className="text-[11px] text-slate-500">Settled in 1.8s</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ---------------- STATS ---------------- */}
      <section className="relative border-y border-slate-200/70 bg-gradient-to-b from-slate-50 to-white py-14">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-7xl grid-cols-2 gap-8 px-6 lg:grid-cols-4 lg:px-8"
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={staggerItem}
              className="text-center"
            >
              <p className="bg-gradient-to-b from-slate-900 to-slate-600 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-sm text-slate-500">{s.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section
        id="features"
        className="relative overflow-hidden py-24 lg:py-32"
      >
        <GlowBlob
          className="top-20 right-0 h-80 w-80 bg-emerald-200/25"
          duration={22}
          drift={40}
        />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge icon={Zap} text="Payout Gateway" />
            <h2 className="mt-5 text-4xl font-bold tracking-tighter text-slate-950 sm:text-5xl">
              Everything a payout needs, nothing it doesn&apos;t.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              A single, reliable rail for every rupee your business sends out.
            </p>
          </FadeIn>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-8 md:grid-cols-3"
          >
            {features.map((f) => (
              <motion.div key={f.title} variants={staggerItem}>
                <TiltCard intensity={5} className="h-full">
                  <GradientBorder
                    from="from-slate-200/90"
                    to="to-slate-100/40"
                    className="group h-full transition-all duration-300 hover:from-emerald-300/70 hover:to-blue-300/40 hover:shadow-2xl hover:shadow-emerald-500/15"
                  >
                    <div className="relative h-full overflow-hidden rounded-[15px] bg-white/80 p-8 backdrop-blur-xl">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-24 -right-24 h-48 w-48 rounded-full bg-emerald-400/0 blur-3xl transition-all duration-500 group-hover:bg-emerald-400/15"
                      />
                      <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-lg shadow-emerald-500/25 ring-1 ring-white/30 transition-transform duration-300 group-hover:scale-110">
                        <f.icon className="h-6 w-6" />
                      </div>
                      <h3 className="relative mt-6 text-xl font-bold tracking-tight text-slate-900">
                        {f.title}
                      </h3>
                      <p className="relative mt-3 leading-relaxed text-slate-600">
                        {f.desc}
                      </p>
                    </div>
                  </GradientBorder>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- SERVICES (PayERupee Solutions) ---------------- */}
      <section
        id="services"
        className="relative overflow-hidden py-24 text-white lg:py-32 [background:radial-gradient(ellipse_100%_80%_at_50%_0%,#1e293b,#0f172a_60%)]"
      >
        <GlowBlob
          className="-top-20 left-1/4 h-96 w-96 bg-emerald-600/15"
          duration={20}
        />
        <GlowBlob
          className="bottom-0 right-1/4 h-80 w-80 bg-indigo-600/15"
          duration={25}
          drift={60}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:28px_28px]"
        />

        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 backdrop-blur-sm">
              <Building2 className="h-3.5 w-3.5" />
              PayERupee Solutions
            </div>
            <h2 className="mt-5 text-4xl font-bold tracking-tighter sm:text-5xl">
              More than a gateway —{" "}
              <span className="bg-gradient-to-r from-emerald-300 to-blue-400 bg-clip-text text-transparent">
                a technology partner.
              </span>
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              We started with payouts, but PayERupee Solutions builds the
              infrastructure and expertise growing businesses need across
              finance and software.
            </p>
          </FadeIn>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-6 md:grid-cols-3"
          >
            {services.map((s) => (
              <motion.div key={s.title} variants={staggerItem}>
                <TiltCard intensity={5} className="h-full">
                  <div className="group relative h-full overflow-hidden rounded-2xl bg-gradient-to-b from-white/15 to-white/[0.03] p-px transition-all duration-300 hover:from-emerald-400/40 hover:to-blue-500/10">
                    <div className="relative h-full rounded-[15px] bg-slate-900/70 p-8 backdrop-blur-xl">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-20 right-0 h-40 w-40 rounded-full bg-emerald-500/0 blur-3xl transition-all duration-500 group-hover:bg-emerald-500/15"
                      />
                      <div className="relative flex items-center justify-between">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
                          <s.icon className="h-6 w-6 text-emerald-400" />
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${s.tagColor}`}
                        >
                          {s.tag}
                        </span>
                      </div>
                      <h3 className="relative mt-6 text-xl font-bold tracking-tight">
                        {s.title}
                      </h3>
                      <p className="relative mt-3 leading-relaxed text-slate-300">
                        {s.desc}
                      </p>
                    </div>
                  </div>
                </TiltCard>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section
        id="how-it-works"
        className="relative overflow-hidden py-24 lg:py-32"
      >
        <GlowBlob
          className="top-1/3 -left-20 h-72 w-72 bg-blue-200/25"
          duration={19}
          drift={35}
        />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge icon={Lock} text="Simple Onboarding" />
            <h2 className="mt-5 text-4xl font-bold tracking-tighter text-slate-950 sm:text-5xl">
              Live in three steps.
            </h2>
          </FadeIn>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="relative mt-20 grid gap-12 md:grid-cols-3 md:gap-8"
          >
            <motion.div
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: EASE, delay: 0.3 }}
              className="absolute top-8 left-[16%] right-[16%] hidden h-0.5 origin-left bg-gradient-to-r from-emerald-400 via-blue-400 to-indigo-400 md:block"
            />
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                variants={staggerItem}
                className="relative text-center"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-gradient-to-br from-emerald-500 to-blue-600 text-white shadow-xl shadow-emerald-500/30 ring-1 ring-emerald-200/50"
                >
                  <step.icon className="h-6 w-6" />
                </motion.div>
                <span className="mt-4 block text-sm font-semibold text-emerald-600">
                  Step {i + 1}
                </span>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
                  {step.title}
                </h3>
                <p className="mx-auto mt-2 max-w-xs text-slate-600">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- ROADMAP ---------------- */}
      <section
        id="roadmap"
        className="relative overflow-hidden py-24 lg:py-32 [background:radial-gradient(ellipse_80%_60%_at_50%_0%,#f8fafc,#ffffff)]"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <FadeIn className="mx-auto max-w-2xl text-center">
            <Badge icon={Rocket} text="Product Roadmap" />
            <h2 className="mt-5 text-4xl font-bold tracking-tighter text-slate-950 sm:text-5xl">
              Built for today, engineered for tomorrow.
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Payouts are just the beginning — accepting payments and beyond are
              already on the way.
            </p>
          </FadeIn>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-16 grid gap-6 md:grid-cols-3"
          >
            {roadmap.map((r) => (
              <motion.div key={r.status} variants={staggerItem}>
                <div
                  className={`h-full rounded-2xl border border-slate-200/80 bg-white/70 p-8 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${r.glow}`}
                >
                  <div
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide ${r.color}`}
                  >
                    <r.icon className="h-3.5 w-3.5" />
                    {r.status}
                  </div>
                  <ul className="mt-6 space-y-4">
                    {r.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2.5 text-slate-700"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500/70" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ---------------- ECOSYSTEM MARQUEE ---------------- */}
      <section className="relative py-20">
        <FadeIn className="text-center">
          <div className="mb-3 flex justify-center">
            <Badge icon={Network} text="Ecosystem" />
          </div>
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Integrated with modern financial networks
          </p>
        </FadeIn>

        <div className="relative mt-10 overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-white to-transparent" />
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="flex w-max items-center gap-14 whitespace-nowrap"
          >
            {[...networks, ...networks].map((n, i) =>
              n.highlight ? (
                <span
                  key={i}
                  className="flex items-center gap-3 rounded-full border border-emerald-300/50 bg-gradient-to-r from-emerald-50 to-blue-50 px-6 py-2.5 shadow-md shadow-emerald-500/10"
                >
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  </span>
                  <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                    {n.name}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    Powering live campaigns
                  </span>
                </span>
              ) : (
                <span
                  key={i}
                  className="text-2xl font-bold tracking-wide text-slate-300 transition-colors hover:text-slate-500"
                >
                  {n.name}
                </span>
              ),
            )}
          </motion.div>
        </div>
      </section>

      {/* ---------------- FINAL CTA ---------------- */}
      <section className="px-6 pb-24 lg:px-8">
        <FadeIn className="mx-auto max-w-6xl">
          <div className="relative overflow-hidden rounded-3xl px-8 py-16 text-center shadow-2xl shadow-slate-900/30 ring-1 ring-white/10 sm:px-16 [background:radial-gradient(ellipse_100%_100%_at_50%_0%,#134e4a,#0f172a_70%)]">
            <GlowBlob
              className="-top-20 -right-20 h-72 w-72 bg-emerald-500/25"
              duration={15}
              drift={30}
            />
            <GlowBlob
              className="-bottom-24 -left-16 h-64 w-64 bg-blue-500/20"
              duration={18}
              drift={35}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"
            />
            <h2 className="relative text-3xl font-bold tracking-tighter text-white sm:text-4xl">
              Ready to simplify your payouts?
            </h2>
            <p className="relative mx-auto mt-4 max-w-xl text-slate-300">
              Join businesses using PayERupee to move money faster, safer, and
              smarter.
            </p>
            <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="group relative flex items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/40 transition-all hover:shadow-xl hover:shadow-emerald-400/50"
              >
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">Create Free Account</span>
                <ArrowRight className="relative h-4 w-4" />
              </Link>
              <button className="rounded-full border border-white/20 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:border-white/40 hover:bg-white/10">
                Talk to Sales
              </button>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="border-t border-slate-200/70 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-500 shadow-md shadow-emerald-500/20">
                  <Zap className="h-5 w-5 text-white" fill="white" />
                </div>
                <span className="text-lg font-bold text-slate-900">
                  PayE<span className="text-emerald-600">Rupee</span>
                </span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-500">
                PayERupee Solutions builds secure financial infrastructure —
                starting with instant payouts, and expanding into software
                development and business enablement for growing companies.
              </p>
              <div className="mt-6 flex gap-4">
                {[Code2, Link2, Sparkles].map((Icon, i) => (
                  <a
                    key={i}
                    href="#"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/60 text-slate-500 backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:text-emerald-600 hover:shadow-md hover:shadow-emerald-500/10"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {Object.entries(footerLinks).map(([title, links]) => (
              <div key={title}>
                <h4 className="text-sm font-semibold text-slate-900">
                  {title}
                </h4>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link}>
                      <a
                        href="#"
                        className="text-sm text-slate-500 transition-colors hover:text-emerald-600"
                      >
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} PayERupee Solutions. All rights
              reserved.
            </p>
            <div className="flex gap-6 text-sm text-slate-500">
              <a href="#" className="hover:text-slate-900">
                Terms
              </a>
              <a href="#" className="hover:text-slate-900">
                Privacy
              </a>
              <a href="#" className="hover:text-slate-900">
                Security
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
