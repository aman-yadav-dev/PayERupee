"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  UserCircle2, 
  Mail, 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  CreditCard, 
  Lock, 
  Eye, 
  EyeOff 
} from "lucide-react";
import { authClient } from "@/modules/auth/infrastructure/auth-client";
import { formatINR } from "@/lib/utils";

interface ProfileClientProps {
  user: { name: string; email: string; createdAt: string } | null;
  profile: { phone: string | null; address: string | null; accountStatus: string } | null;
  walletBalance: string | null;
  lastLogin: string | null;
}

export function ProfileClient({ user, profile, walletBalance, lastLogin }: ProfileClientProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter a new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { data, error } = await authClient.changePassword({
        newPassword,
        currentPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        toast.error(error.message || "Failed to change password");
      } else {
        toast.success("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-blue-100 text-blue-700 border-blue-100";
      case "PENDING":
        return "bg-amber-100 text-amber-600 border-amber-100";
      case "SUSPENDED":
      case "DELETED":
        return "bg-coral-100 text-coral-600 border-coral-100";
      default:
        return "bg-neutral-chip text-neutral-500 border-neutral-chip";
    }
  };

  return (
    <div className="px-4 sm:px-5 lg:px-8 py-6 w-full max-w-[1440px] mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-text-primary tracking-tight">Profile</h1>
        <p className="text-[14px] text-text-muted mt-1">Manage your account details and password.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          
          {/* PROFILE HEADER CARD */}
          <Card className="p-6 border-line bg-surface flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <div className="h-20 w-20 rounded-full bg-primary/10 text-primary flex items-center justify-center text-2xl font-semibold shrink-0">
              {user ? getInitials(user.name) : <UserCircle2 className="w-10 h-10" />}
            </div>
            <div className="text-center sm:text-left mt-2 sm:mt-0 flex-1">
              <h2 className="text-xl font-semibold text-text-primary">{user?.name || "Unknown User"}</h2>
              <p className="text-[15px] text-text-muted mt-0.5">{user?.email || "No email available"}</p>
              
              <div className="mt-4 pt-4 border-t border-line flex flex-wrap justify-center sm:justify-start gap-3">
                <Badge variant="outline" className={getStatusColor(profile?.accountStatus || "UNKNOWN")}>
                  {profile?.accountStatus || "UNKNOWN"}
                </Badge>
                {profile?.accountStatus === "ACTIVE" && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified Merchant
                  </Badge>
                )}
              </div>
            </div>
          </Card>

          {/* PROFILE DETAILS CARD */}
          <Card className="overflow-hidden border-line bg-surface">
            <div className="px-6 py-5 border-b border-line bg-canvas/30">
              <h3 className="text-[16px] font-semibold text-text-primary">Profile Details</h3>
            </div>
            <div className="p-0">
              <dl className="divide-y divide-line">
                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-surface-hover transition-colors">
                  <dt className="flex items-center gap-2 text-[14px] font-medium text-text-muted sm:w-1/3">
                    <Mail className="w-4 h-4" />
                    Email Address
                  </dt>
                  <dd className="text-[14px] text-text-primary sm:w-2/3">{user?.email || "N/A"}</dd>
                </div>
                
                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-surface-hover transition-colors">
                  <dt className="flex items-center gap-2 text-[14px] font-medium text-text-muted sm:w-1/3">
                    <Phone className="w-4 h-4" />
                    Phone Number
                  </dt>
                  <dd className="text-[14px] text-text-primary sm:w-2/3">{profile?.phone || "Not provided"}</dd>
                </div>

                

                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-surface-hover transition-colors">
                  <dt className="flex items-center gap-2 text-[14px] font-medium text-text-muted sm:w-1/3">
                    <Calendar className="w-4 h-4" />
                    Member Since
                  </dt>
                  <dd className="text-[14px] text-text-primary sm:w-2/3">
                    {user?.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "N/A"}
                  </dd>
                </div>

                <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 hover:bg-surface-hover transition-colors">
                  <dt className="flex items-center gap-2 text-[14px] font-medium text-text-muted sm:w-1/3">
                    <Clock className="w-4 h-4" />
                    Last Login
                  </dt>
                  <dd className="text-[14px] text-text-primary sm:w-2/3">
                    {lastLogin ? format(new Date(lastLogin), "MMM d, yyyy 'at' h:mm a") : "Not available"}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          
          {/* BALANCE INFORMATION */}
          <Card className="overflow-hidden border-line bg-surface">
            <div className="px-6 py-5 border-b border-line bg-canvas/30">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text-primary">
                <CreditCard className="w-5 h-5 text-primary" />
                Balance Information
              </h3>
            </div>
            <div className="p-6">
              <p className="text-[13px] text-text-muted mb-2 uppercase tracking-wide font-medium">Available Balance</p>
              <div className="text-3xl font-display font-semibold tracking-tight text-text-primary mb-3">
                {walletBalance !== null ? formatINR(Number(walletBalance)) : "₹0.00"}
              </div>
              <p className="text-[13px] text-text-muted border-t border-line pt-4">
                Available balance represents funds that can be withdrawn immediately.
              </p>
            </div>
          </Card>

          {/* CHANGE PASSWORD */}
          <Card className="overflow-hidden border-line bg-surface">
            <div className="px-6 py-5 border-b border-line bg-canvas/30">
              <h3 className="flex items-center gap-2 text-[16px] font-semibold text-text-primary">
                <Lock className="w-5 h-5 text-primary" />
                Change Password
              </h3>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-[14px] font-medium text-text-primary" htmlFor="current-password">
                  Current Password
                </label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="pr-10 bg-canvas border-line text-text-primary"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={showCurrent ? "Hide current password" : "Show current password"}
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-medium text-text-primary" htmlFor="new-password">
                  New Password
                </label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-10 bg-canvas border-line text-text-primary"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={showNew ? "Hide new password" : "Show new password"}
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[14px] font-medium text-text-primary" htmlFor="confirm-password">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    className="pr-10 bg-canvas border-line text-text-primary"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
                    aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full" disabled={isChangingPassword}>
                  {isChangingPassword ? "Updating Password..." : "Update Password"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
