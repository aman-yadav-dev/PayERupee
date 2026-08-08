"use client";

import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  Loader2,
  Mail,
  MapPin,
  Phone,
  UserRound,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// ─── Animation helpers ────────────────────────────────────────────────────────

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

export const stagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

export const fieldFade: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

// ─── Logo ─────────────────────────────────────────────────────────────────────

export function LogoBlock({ compact = false }: { compact?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as const }}
      className="flex items-center justify-center gap-2.5"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-[0_4px_14px_rgba(79,70,229,.35)]">
        <span className="text-[19px] font-bold leading-none">₹</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[18px] font-semibold tracking-[-0.04em] text-zinc-900">
          PayERupee
        </span>
        {!compact && (
          <span className="rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-600">
            Enterprise
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ─── Input Fields ─────────────────────────────────────────────────────────────

export function InputField({
  label,
  icon: Icon,
  type = "text",
  placeholder,
  autoComplete,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  icon: LucideIcon;
  type?: string;
  placeholder: string;
  autoComplete?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <motion.div
      variants={fieldFade}
      className={error ? "animate-field-shake" : ""}
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">
          {label}
        </span>
        <span className="group relative block">
          <Icon
            className={cn(
              "pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 transition-colors duration-150",
              error
                ? "text-red-400"
                : "text-zinc-400 group-focus-within:text-indigo-500",
            )}
          />
          <input
            type={type}
            name={name}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            placeholder={placeholder}
            className={cn(
              "h-11 w-full rounded-xl border bg-zinc-50/50 pl-10 pr-4 text-[13.5px] text-zinc-900 outline-none ring-0 transition-all duration-200 placeholder:text-zinc-400",
              error
                ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "border-zinc-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100",
            )}
          />
        </span>
        {error && (
          <span className="mt-1 block text-[11.5px] text-red-500">{error}</span>
        )}
      </label>
    </motion.div>
  );
}

export function TextareaField({
  label,
  icon: Icon,
  placeholder,
  autoComplete,
  name,
  value,
  onChange,
  error,
}: {
  label: string;
  icon: LucideIcon;
  placeholder: string;
  autoComplete?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  error?: string;
}) {
  return (
    <motion.div
      variants={fieldFade}
      className={error ? "animate-field-shake" : ""}
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">
          {label}
        </span>
        <span className="group relative block">
          <Icon
            className={cn(
              "pointer-events-none absolute left-3.5 top-3 h-[15px] w-[15px] transition-colors duration-150",
              error
                ? "text-red-400"
                : "text-zinc-400 group-focus-within:text-indigo-500",
            )}
          />
          <textarea
            name={name}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            placeholder={placeholder}
            rows={2}
            className={cn(
              "w-full resize-none rounded-xl border bg-zinc-50/50 py-3 pl-10 pr-4 text-[13.5px] text-zinc-900 outline-none transition-all duration-200 placeholder:text-zinc-400",
              error
                ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "border-zinc-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100",
            )}
          />
        </span>
        {error && (
          <span className="mt-1 block text-[11.5px] text-red-500">{error}</span>
        )}
      </label>
    </motion.div>
  );
}

export function PasswordField({
  label = "Password",
  visible,
  onToggle,
  autoComplete = "current-password",
  placeholder = "Enter your password",
  name,
  value,
  onChange,
  error,
}: {
  label?: string;
  visible: boolean;
  onToggle: () => void;
  autoComplete?: string;
  placeholder?: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <motion.div
      variants={fieldFade}
      className={error ? "animate-field-shake" : ""}
    >
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-medium text-zinc-600">
          {label}
        </span>
        <span className="group relative block">
          <LockKeyhole
            className={cn(
              "pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 transition-colors duration-150",
              error
                ? "text-red-400"
                : "text-zinc-400 group-focus-within:text-indigo-500",
            )}
          />
          <input
            type={visible ? "text" : "password"}
            name={name}
            value={value}
            onChange={onChange}
            autoComplete={autoComplete}
            placeholder={placeholder}
            className={cn(
              "h-11 w-full rounded-xl border bg-zinc-50/50 pl-10 pr-11 text-[13.5px] text-zinc-900 outline-none transition-all duration-200 placeholder:text-zinc-400",
              error
                ? "border-red-300 bg-red-50/30 focus:border-red-400 focus:ring-2 focus:ring-red-100"
                : "border-zinc-200 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100",
            )}
          />
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              visible
                ? `Hide ${label.toLowerCase()}`
                : `Show ${label.toLowerCase()}`
            }
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-zinc-400 transition-colors hover:text-zinc-600"
          >
            {visible ? (
              <EyeOff className="h-[15px] w-[15px]" />
            ) : (
              <Eye className="h-[15px] w-[15px]" />
            )}
          </button>
        </span>
        {error && (
          <span className="mt-1 block text-[11.5px] text-red-500">{error}</span>
        )}
      </label>
    </motion.div>
  );
}

// ─── Submit button (with loading spinner) ────────────────────────────────────

export function SubmitButton({
  children,
  loading = false,
}: {
  children: ReactNode;
  loading?: boolean;
}) {
  return (
    <motion.button
      variants={fieldFade}
      type="submit"
      disabled={loading}
      whileHover={
        loading ? {} : { y: -1, boxShadow: "0 10px 24px rgba(79,70,229,.28)" }
      }
      whileTap={loading ? {} : { y: 0, scale: 0.99 }}
      transition={{ duration: 0.15 }}
      className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-[13.5px] font-semibold text-white shadow-[0_4px_14px_rgba(79,70,229,.22)] transition-colors duration-150 hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-80"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          {children}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </>
      )}
    </motion.button>
  );
}

// ─── Divider & Google button ──────────────────────────────────────────────────

export function AuthDivider() {
  return (
    <motion.div
      variants={fieldFade}
      className="my-5 flex items-center gap-3 text-[11px] font-medium text-zinc-400"
    >
      <div className="h-px flex-1 bg-zinc-200" />
      <span>or continue with</span>
      <div className="h-px flex-1 bg-zinc-200" />
    </motion.div>
  );
}

export function GoogleButton() {
  return (
    <motion.button
      variants={fieldFade}
      type="button"
      disabled
      whileHover={{ y: -1 }}
      className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-3 rounded-xl border border-zinc-200 bg-white text-[13.5px] font-medium text-zinc-600 opacity-50 transition-all"
    >
      <svg aria-hidden="true" className="h-[17px] w-[17px]" viewBox="0 0 24 24">
        <path
          fill="#4285F4"
          d="M21.35 12.23c0-.71-.06-1.4-.18-2.05H12v3.88h5.22a4.46 4.46 0 0 1-1.94 2.93v2.43h3.14c1.84-1.69 2.93-4.18 2.93-7.19Z"
        />
        <path
          fill="#34A853"
          d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.5A9.75 9.75 0 0 0 12 21.75Z"
        />
        <path
          fill="#FBBC05"
          d="M6.54 13.85a5.86 5.86 0 0 1 0-3.7v-2.5H3.3a9.75 9.75 0 0 0 0 8.7l3.24-2.5Z"
        />
        <path
          fill="#EA4335"
          d="M12 6.12c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.2 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.4l3.24 2.5c.77-2.31 2.92-4.03 5.46-4.03Z"
        />
      </svg>
      Continue with Google
    </motion.button>
  );
}

// ─── Left hero panel ──────────────────────────────────────────────────────────

export function FloatingFintechPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-indigo-100/60 lg:sticky lg:top-0 lg:h-[100dvh] lg:flex lg:w-[44%] lg:flex-col lg:items-center lg:justify-center lg:shrink-0">
      {/* Backdrop orbs */}
      <div className="pointer-events-none absolute -left-32 -top-32 h-[480px] w-[480px] rounded-full bg-indigo-400/[0.10] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-[520px] w-[520px] rounded-full bg-violet-400/[0.08] blur-[80px]" />

      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #4f46e5 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Top tagline */}
      <motion.p
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
        className="absolute top-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-400/80"
      >
        Trusted by 500+ enterprises
      </motion.p>

      {/* Central stats card */}
      <motion.div
        animate={{ y: [-5, 5, -5] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-[260px] rounded-2xl border border-white/90 bg-white/75 p-6 shadow-[0_24px_60px_rgba(79,70,229,.13)] backdrop-blur-xl"
      >
        <div className="mb-5 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-[0_4px_10px_rgba(79,70,229,.3)]">
            <span className="text-base font-bold leading-none">₹</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold tracking-tight text-zinc-900">
              PayERupee
            </p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-indigo-500">
              Enterprise
            </p>
          </div>
        </div>

        <div className="mb-5 h-px bg-gradient-to-r from-indigo-100 via-indigo-200 to-transparent" />

        <div className="grid grid-cols-2 gap-x-5 gap-y-4">
          {[
            ["₹2.4B+", "Moved annually"],
            ["500+", "Enterprises"],
            ["99.99%", "Uptime SLA"],
            ["<100ms", "Settlement"],
          ].map(([value, label]) => (
            <div key={label}>
              <p className="text-[20px] font-bold leading-none tracking-[-0.04em] text-indigo-700">
                {value}
              </p>
              <p className="mt-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-zinc-400">
                {label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Floating card — top-left */}
      <motion.div
        animate={{ y: [-3, 4, -3] }}
        transition={{
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.4,
        }}
        className="absolute left-[7%] top-[18%] w-[195px] -rotate-[3deg] rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-[0_8px_24px_rgba(79,70,229,.09)] backdrop-blur-sm"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[14px] font-bold text-zinc-800">₹1,24,500</p>
            <p className="mt-0.5 text-[9px] text-zinc-400">
              Acme Corp → 248 accounts
            </p>
          </div>
          <span className="mt-0.5 rounded-full bg-indigo-50 px-2 py-0.5 text-[8.5px] font-semibold text-indigo-600">
            Bulk
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span className="text-[9px] font-semibold text-emerald-600">
            Approved
          </span>
        </div>
      </motion.div>

      {/* Floating card — bottom-right */}
      <motion.div
        animate={{ y: [4, -4, 4] }}
        transition={{
          duration: 5.2,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.8,
        }}
        className="absolute bottom-[18%] right-[6%] w-[178px] rotate-[2.5deg] rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-[0_8px_24px_rgba(79,70,229,.09)] backdrop-blur-sm"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-600">
            R
          </span>
          <span className="text-[10px] font-semibold text-zinc-700">
            Razorpay Ltd
          </span>
          <span className="ml-auto text-[10.5px] font-bold text-zinc-800">
            ₹45,200
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-[9px] font-semibold text-emerald-600">
            Settled
          </span>
          <span className="ml-auto text-[9px] text-zinc-400">Real-time</span>
        </div>
      </motion.div>

      {/* Floating card — approval, bottom-left */}
      <motion.div
        animate={{ y: [-4, 3, -4] }}
        transition={{
          duration: 4.8,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1.2,
        }}
        className="absolute bottom-[32%] left-[6%] w-[168px] -rotate-[2deg] rounded-2xl border border-white/80 bg-white/90 px-3.5 py-3 shadow-[0_8px_24px_rgba(79,70,229,.09)] backdrop-blur-sm"
      >
        <div className="flex items-center gap-1.5">
          {["bg-emerald-500", "bg-indigo-400", "bg-zinc-200"].map((c, i) => (
            <span
              key={i}
              className={`flex h-5 w-5 items-center justify-center rounded-full ${c} text-[9px] text-white`}
            >
              {i < 2 ? "✓" : "·"}
            </span>
          ))}
          <span className="ml-0.5 text-[10px] font-semibold text-zinc-700">
            2 / 3
          </span>
        </div>
        <p className="mt-2 text-[9px] text-zinc-400">Multi-level approval</p>
      </motion.div>

      {/* Bottom tagline */}
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const }}
        className="absolute bottom-10 text-[11px] text-zinc-400/70"
      >
        ISO 27001 · PCI-DSS · SOC 2 Type II
      </motion.p>
    </aside>
  );
}

export { UserRound, Building2, Mail, Phone, MapPin };
