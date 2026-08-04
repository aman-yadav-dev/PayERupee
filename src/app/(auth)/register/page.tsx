"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Zap, ArrowRight } from "lucide-react";
import Link from "next/link";

import { registerSchema, type RegisterInput } from "@/schemas/auth";
import { registerMerchantAction } from "@/actions/auth/register";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      businessName: "",
      email: "",
      phone: "",
      password: "",
      address: "",
    },
  });

  async function onSubmit(data: RegisterInput) {
    setIsPending(true);
    const response = await registerMerchantAction(data);
    setIsPending(false);

    if (!response.success) {
      toast.error(response.error || "Registration failed");
      return;
    }

    toast.success("Account created successfully!");
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 w-full">
      {/* Left Branding / Stitch AI Pane */}
      <div className="hidden lg:flex flex-col justify-between bg-zinc-950 p-10 text-white relative overflow-hidden">
        {/* Subtle background glow effect */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-2 z-10">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white">
            P
          </div>
          <span className="text-xl font-semibold tracking-tight">
            PayERupee
          </span>
        </div>

        <div className="space-y-6 z-10 my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-primary-foreground backdrop-blur-md">
            <Zap className="h-3.5 w-3.5 text-primary" /> Next-Gen Payout
            Infrastructure
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight leading-tight">
            Scale your business payouts with total confidence.
          </h1>
          <p className="text-zinc-400 max-w-md text-sm leading-relaxed">
            Automate bank transfers, manage multi-currency ledgers, and
            experience lightning-fast reconciliation built for modern Indian
            enterprises.
          </p>

          <div className="pt-4 grid grid-cols-2 gap-4 text-xs text-zinc-400 border-t border-zinc-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Bank-grade
              AES Encryption
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" /> Real-time
              Ledger Sync
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-500 z-10">
          &copy; {new Date().getFullYear()} PayERupee Technologies Inc. All
          rights reserved.
        </div>
      </div>

      {/* Right Form Pane */}
      <div className="flex items-center justify-center p-8 bg-zinc-50/50">
        <div className="w-full max-w-md space-y-6 py-6">
          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
              Create Merchant Account
            </h2>
            <p className="text-sm text-zinc-500">
              Fill in your enterprise details to instantly provision your
              ledger.
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Aarav Sharma"
                          disabled={isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Work Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="aarav@company.com"
                          type="email"
                          disabled={isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="businessName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Business Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Acme Logistics Pvt Ltd"
                          disabled={isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="9876543210"
                          disabled={isPending}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registered Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="123 Financial District, Mumbai, MH"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="••••••••"
                        type="password"
                        disabled={isPending}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-11 text-base group"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Provisioning Account...
                  </>
                ) : (
                  <>
                    Get Started{" "}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          </Form>

          <div className="text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-primary hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
