"use client";
import { redirect } from "next/navigation";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { Info, Bell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils/utils";

function Switch({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-indigo-600" : "bg-surface dark:bg-surface"
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-sm ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  redirect("/settings/profile");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preferences, setPreferences] = useState({
    loginEmailsEnabled: true,
    kycEmailsEnabled: true,
  });
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({});

  const fetchPreferences = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/v1/merchant/settings/notifications");
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
      } else {
        setError(true);
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPreferences();
  }, []);

  const handleToggle = async (key: "loginEmailsEnabled" | "kycEmailsEnabled", newValue: boolean) => {
    if (updating[key]) return;

    const previousValue = preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: newValue }));
    setUpdating((prev) => ({ ...prev, [key]: true }));

    try {
      const res = await fetch("/api/v1/merchant/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Preferences updated successfully");
        setPreferences((prev) => ({ ...prev, [key]: data.data[key] }));
      } else {
        throw new Error(data.error || "Failed to update preference");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
      setPreferences((prev) => ({ ...prev, [key]: previousValue }));
    } finally {
      setUpdating((prev) => ({ ...prev, [key]: false }));
    }
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <div className="h-8 w-32 bg-surface dark:bg-surface rounded animate-pulse mb-2"></div>
          <div className="h-4 w-48 bg-surface dark:bg-surface rounded animate-pulse"></div>
        </div>
        <Card className="p-6">
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-sm font-medium">Loading settings...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-muted">Settings</h1>
          <p className="text-text-muted dark:text-text-muted">Manage your notification preferences.</p>
        </div>
        <Card className="p-12 flex flex-col items-center justify-center text-center border-coral-500/20 bg-coral-100/50 dark:bg-red-950/20 dark:border-red-900/50">
          <p className="text-coral-600 dark:text-red-400 mb-4 font-medium">Unable to load notification settings.</p>
          <Button onClick={fetchPreferences} variant="outline" className="border-red-200 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900">
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary dark:text-text-muted">Settings</h1>
        <div className="flex items-center gap-2 text-text-muted dark:text-text-muted mt-1">
          <Bell className="w-4 h-4" />
          <p>Notifications</p>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg p-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium">Mandatory Security Emails</p>
          <p className="mt-1">Email verification and password reset emails cannot be disabled.</p>
        </div>
      </div>

      <Card className="divide-y divide-border">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 pr-8">
            <h3 className="font-medium text-text-primary dark:text-text-muted">Login Notifications</h3>
            <p className="text-sm text-text-muted dark:text-text-muted">
              Receive an email when your account is successfully signed in.
            </p>
          </div>
          <Switch
            checked={preferences.loginEmailsEnabled}
            onChange={(checked) => handleToggle("loginEmailsEnabled", checked)}
            disabled={updating.loginEmailsEnabled}
            aria-label="Toggle login notifications"
          />
        </div>

        <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 pr-8">
            <h3 className="font-medium text-text-primary dark:text-text-muted">KYC Notifications</h3>
            <p className="text-sm text-text-muted dark:text-text-muted">
              Receive email updates when your KYC application is submitted, resubmitted, rejected, or approved.
            </p>
          </div>
          <Switch
            checked={preferences.kycEmailsEnabled}
            onChange={(checked) => handleToggle("kycEmailsEnabled", checked)}
            disabled={updating.kycEmailsEnabled}
            aria-label="Toggle KYC notifications"
          />
        </div>
      </Card>
    </div>
  );
}
