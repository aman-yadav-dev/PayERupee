"use client";

import React, { useState, useEffect } from "react";
import { Shield, Activity, Mail, Plus, Trash2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/shared/utils/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Switch({
  checked,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  id
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
  id?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-line-soft"
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

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEmptyWhitelistModal, setShowEmptyWhitelistModal] = useState(false);
  
  const [loginEmailsEnabled, setLoginEmailsEnabled] = useState(true);
  const [settings, setSettings] = useState({
    ipWhitelistEnabled: false,
    allowedIps: [] as string[],
    maxApiPayoutEnabled: false,
    maxApiPayoutAmount: 0,
    suspiciousAlertsEnabled: false,
    suspiciousThreshold: 10,
    suspiciousWindowSeconds: 60,
    suspiciousIpEnabled: true,
    suspiciousUpiEnabled: true,
    suspiciousBankAccountEnabled: true,
    suspiciousEmailEnabled: true
  });

  const [newIp, setNewIp] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchActivity(page);
  }, [page]);

  const fetchSettings = async () => {
    try {
      const [secRes, prefRes] = await Promise.all([
        fetch("/api/v1/merchant/settings/security"),
        fetch("/api/v1/merchant/settings/notifications")
      ]);

      if (secRes.ok) {
        const json = await secRes.json();
        if (json.success && json.settings) {
          setSettings(json.settings);
        }
      }

      if (prefRes.ok) {
        const json = await prefRes.json();
        if (json.success && json.data) {
          setLoginEmailsEnabled(json.data.loginEmailsEnabled);
        }
      }
    } catch (e) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async (currentPage = 1) => {
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/v1/merchant/settings/security/activity?page=${currentPage}&limit=20`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setEvents(json.data);
          if (json.pagination) {
            setTotalPages(json.pagination.totalPages || 1);
          }
        }
      }
    } catch (e) {
        console.error(e);
      } finally {
        setActivityLoading(false);
      }
  };

  // True partial updates
  const handleSave = async (updates: Partial<typeof settings>, revertState?: Partial<typeof settings>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/merchant/settings/security", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
      });
      const json = await res.json();
      if (json.success && json.settings) {
        toast.success("Security settings updated");
        setSettings(json.settings);
      } else {
        toast.error(json.error || "Failed to update settings");
        if (revertState) {
          setSettings(prev => ({ ...prev, ...revertState }));
        }
      }
    } catch (e) {
      toast.error("An error occurred. Please try again.");
      if (revertState) {
        setSettings(prev => ({ ...prev, ...revertState }));
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleLoginEmailsEnabled = async () => {
    if (saving) return;
    setSaving(true);
    const newValue = !loginEmailsEnabled;
    setLoginEmailsEnabled(newValue);
    
    try {
      const res = await fetch("/api/v1/merchant/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginEmailsEnabled: newValue })
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to update preference");
      }
      toast.success("Login notifications updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update setting");
      setLoginEmailsEnabled(!newValue); // Revert
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: keyof typeof settings, overrideCheck = false) => {
    if (saving) return; // Block double clicks

    const currentValue = settings[key] as boolean;
    
    if (key === "ipWhitelistEnabled" && !currentValue && settings.allowedIps.length === 0 && !overrideCheck) {
      setShowEmptyWhitelistModal(true);
      return;
    }

    const newValue = !currentValue;

    // Optimistic update
    setSettings(prev => ({ ...prev, [key]: newValue }));

    // Send only the toggled key
    handleSave({ [key]: newValue }, { [key]: currentValue });
  };

  const confirmEmptyWhitelist = () => {
    setShowEmptyWhitelistModal(false);
    toggleSetting("ipWhitelistEnabled", true);
  };

  const addIp = () => {
    if (!newIp || saving) return;
    const currentList = [...settings.allowedIps];
    const updatedList = [...currentList, newIp];
    setNewIp("");
    
    setSettings(prev => ({ ...prev, allowedIps: updatedList }));
    handleSave({ allowedIps: updatedList }, { allowedIps: currentList });
  };

  const removeIp = (ip: string) => {
    if (saving) return;
    const currentList = [...settings.allowedIps];
    const updatedList = currentList.filter((i) => i !== ip);
    
    setSettings(prev => ({ ...prev, allowedIps: updatedList }));
    handleSave({ allowedIps: updatedList }, { allowedIps: currentList });
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-5 lg:px-8 py-6 space-y-6 w-full max-w-[1440px] mx-auto">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-line-soft rounded mb-2"></div>
          <div className="h-4 w-96 bg-line-soft rounded"></div>
        </div>
        <Card className="p-6 sm:p-12 flex flex-col items-center justify-center border-line bg-surface">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-[13px] font-medium text-text-muted">Loading security settings...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-5 lg:px-8 py-6 space-y-6 w-full max-w-[1440px] mx-auto animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-semibold text-text-primary tracking-tight">Security</h1>
        <p className="text-[14px] text-text-muted mt-1">Protect your account, API access, and payout activity.</p>
      </div>

      <div className="space-y-6">
        
        {/* IP Whitelist Card */}
        <Card className="divide-y divide-line overflow-hidden border-line bg-surface">
          <label 
            htmlFor="toggle-ip-whitelist"
            className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer hover:bg-canvas/40 transition-colors"
          >
            <div className="flex gap-4">
              <div className="mt-1">
                <Shield className="w-5 h-5 text-text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-medium text-text-primary">IP Whitelist</h3>
                <p className="text-[13px] text-text-muted max-w-xl">
                  Restrict API access strictly to trusted IP addresses and CIDR ranges. 
                  When enabled, requests from unauthorized IPs will be immediately rejected.
                </p>
              </div>
            </div>
            <Switch
              id="toggle-ip-whitelist"
              checked={settings.ipWhitelistEnabled}
              disabled={saving}
              onChange={() => toggleSetting("ipWhitelistEnabled")}
            />
          </label>

          {settings.ipWhitelistEnabled && (
            <div className="p-6 bg-canvas/30 space-y-4 animate-fade-in">
              <div>
                <h4 className="text-[13px] font-medium text-text-primary mb-3">Allowed IP addresses</h4>
                
                {settings.allowedIps.length > 0 ? (
                  <ul className="space-y-2 mb-4 max-w-xl">
                    {settings.allowedIps.map((ip) => (
                      <li key={ip} className="flex justify-between items-center bg-surface border border-line rounded-lg px-4 py-2 text-[13px] text-text-primary group hover:border-line-soft transition-colors">
                        <span className="font-mono">{ip}</span>
                        <button
                          onClick={(e) => { e.preventDefault(); removeIp(ip); }}
                          disabled={saving}
                          className="text-text-muted hover:text-coral-500 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
                          aria-label="Remove IP"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[13px] text-text-muted italic mb-4">No IP addresses added yet. API requests will be completely blocked.</p>
                )}

                <form 
                  onSubmit={(e) => { e.preventDefault(); addIp(); }}
                  className="flex flex-col sm:flex-row gap-3 sm:items-center w-full max-w-sm"
                >
                  <Input
                    placeholder="e.g. 192.168.1.1 or 2001:db8::/32"
                    value={newIp}
                    onChange={(e) => setNewIp(e.target.value)}
                    disabled={saving}
                    className="h-9 text-[13px]"
                  />
                  <Button type="submit" disabled={!newIp || saving} variant="outline" className="h-9 whitespace-nowrap">
                    <Plus className="w-4 h-4 mr-2" /> Add IP
                  </Button>
                </form>
              </div>
            </div>
          )}
        </Card>

        {/* Max Payout Limit Card */}
        <Card className="divide-y divide-line overflow-hidden border-line bg-surface">
          <label 
            htmlFor="toggle-max-payout"
            className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer hover:bg-canvas/40 transition-colors"
          >
            <div className="flex gap-4">
              <div className="mt-1">
                <ShieldAlert className="w-5 h-5 text-text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-medium text-text-primary">Maximum API Payout</h3>
                <p className="text-[13px] text-text-muted max-w-xl">
                  Set the absolute maximum amount allowed for a single API payout request. 
                  Requests above this amount will be rejected before any ledger changes occur.
                </p>
              </div>
            </div>
            <Switch
              id="toggle-max-payout"
              checked={settings.maxApiPayoutEnabled}
              disabled={saving}
              onChange={() => toggleSetting("maxApiPayoutEnabled")}
            />
          </label>

          {settings.maxApiPayoutEnabled && (
            <div className="p-6 bg-canvas/30 space-y-4 animate-fade-in">
              <div className="max-w-sm">
                <label className="block text-[13px] font-medium text-text-primary mb-2">Maximum payout amount (₹)</label>
                <div className="flex gap-3">
                  <Input 
                    type="number" 
                    value={settings.maxApiPayoutAmount}
                    onChange={e => setSettings(prev => ({ ...prev, maxApiPayoutAmount: Number(e.target.value) }))}
                    className="h-9 text-[13px]"
                    disabled={saving}
                  />
                  <Button 
                    onClick={() => handleSave({ maxApiPayoutAmount: settings.maxApiPayoutAmount })} 
                    disabled={saving} 
                    variant="outline" 
                    className="h-9"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Suspicious Activity Alerts Card */}
        <Card className="divide-y divide-line overflow-hidden border-line bg-surface">
          <label 
            htmlFor="toggle-suspicious-activity"
            className="p-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer hover:bg-canvas/40 transition-colors"
          >
            <div className="flex gap-4">
              <div className="mt-1">
                <Activity className="w-5 h-5 text-text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-medium text-text-primary">Suspicious Activity Alerts</h3>
                <p className="text-[13px] text-text-muted max-w-xl">
                  Get notified when unusually high activity or velocity patterns are detected in your API usage.
                </p>
              </div>
            </div>
            <Switch
              id="toggle-suspicious-activity"
              checked={settings.suspiciousAlertsEnabled}
              disabled={saving}
              onChange={() => toggleSetting("suspiciousAlertsEnabled")}
            />
          </label>

          {settings.suspiciousAlertsEnabled && (
            <div className="p-6 bg-canvas/30 space-y-5 animate-fade-in">
              
              <div className="flex flex-wrap items-center gap-3 text-[13px] text-text-primary">
                <span>Alert me when</span>
                <Input 
                  type="number" 
                  value={settings.suspiciousThreshold}
                  onChange={e => setSettings(prev => ({ ...prev, suspiciousThreshold: Number(e.target.value) }))}
                  className="w-20 h-8 text-center"
                  disabled={saving}
                />
                <span>requests occur within</span>
                <select 
                  value={settings.suspiciousWindowSeconds}
                  onChange={e => setSettings(prev => ({ ...prev, suspiciousWindowSeconds: Number(e.target.value) }))}
                  disabled={saving}
                  className="h-8 bg-surface border border-line rounded-md px-3 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-[13px] disabled:opacity-50"
                >
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                  <option value={900}>15 minutes</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <p className="text-[13px] font-medium text-text-primary">Monitor identifiers:</p>
                <div className="flex flex-col sm:flex-row gap-6">
                  <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer hover:text-primary transition-colors">
                    <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer disabled:opacity-50" disabled={saving} checked={settings.suspiciousIpEnabled} onChange={() => setSettings(prev => ({ ...prev, suspiciousIpEnabled: !prev.suspiciousIpEnabled }))} />
                    Same IP address
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer hover:text-primary transition-colors">
                    <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer disabled:opacity-50" disabled={saving} checked={settings.suspiciousUpiEnabled} onChange={() => setSettings(prev => ({ ...prev, suspiciousUpiEnabled: !prev.suspiciousUpiEnabled }))} />
                    Same UPI ID
                  </label>
                  <label className="flex items-center gap-2 text-[13px] text-text-primary cursor-pointer hover:text-primary transition-colors">
                    <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer disabled:opacity-50" disabled={saving} checked={settings.suspiciousBankAccountEnabled} onChange={() => setSettings(prev => ({ ...prev, suspiciousBankAccountEnabled: !prev.suspiciousBankAccountEnabled }))} />
                    Same Bank Account
                  </label>
                </div>
              </div>

              <div className="pt-5 border-t border-line/60">
                <label className="flex items-center gap-2 text-[13px] font-medium text-text-primary cursor-pointer hover:text-primary transition-colors mb-4">
                  <input type="checkbox" className="rounded border-line text-primary focus:ring-primary/20 cursor-pointer disabled:opacity-50" disabled={saving} checked={settings.suspiciousEmailEnabled} onChange={() => setSettings(prev => ({ ...prev, suspiciousEmailEnabled: !prev.suspiciousEmailEnabled }))} />
                  Send email alerts to account owner
                </label>
                <Button 
                  onClick={() => handleSave({ 
                    suspiciousThreshold: settings.suspiciousThreshold,
                    suspiciousWindowSeconds: settings.suspiciousWindowSeconds,
                    suspiciousIpEnabled: settings.suspiciousIpEnabled,
                    suspiciousUpiEnabled: settings.suspiciousUpiEnabled,
                    suspiciousBankAccountEnabled: settings.suspiciousBankAccountEnabled,
                    suspiciousEmailEnabled: settings.suspiciousEmailEnabled
                  })} 
                  disabled={saving} 
                  variant="outline" 
                  className="h-9"
                >
                  Save Alert Settings
                </Button>
              </div>
            </div>
          )}
        </Card>

        
        {/* Login Notifications Card */}
        <Card className="overflow-hidden border-line bg-surface">
          <label 
            htmlFor="toggle-login-notifications"
            className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-canvas/40 transition-colors"
          >
            <div className="flex gap-4">
              <div className="mt-1">
                <Mail className="w-5 h-5 text-text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[15px] font-medium text-text-primary">Login Notifications</h3>
                <p className="text-[13px] text-text-muted max-w-xl">
                  Receive an email when someone signs in to your account.
                </p>
              </div>
            </div>
            <Switch
              id="toggle-login-notifications"
              checked={loginEmailsEnabled}
              disabled={saving}
              onChange={toggleLoginEmailsEnabled}
            />
          </label>
        </Card>


        {/* Security Activity Table */}
        <div className="pt-6">
          <h2 className="text-[16px] font-semibold text-text-primary mb-4 tracking-tight">Security Activity</h2>
          
          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto min-h-[300px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line-soft bg-canvas/40">
                    <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider whitespace-nowrap">Time</th>
                    <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Event</th>
                    <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Severity</th>
                    <th className="px-5 py-3 text-[12px] font-medium text-text-muted uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-surface">
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-[13px] text-text-muted">
                        <div className="flex flex-col items-center justify-center space-y-3">
                          <Shield className="w-8 h-8 text-line-soft" />
                          <p>No recent security events found.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    events.map((e, i) => (
                      <tr 
                        key={e.id} 
                        className="border-b border-line-soft last:border-0 hover:bg-canvas/60 transition-colors animate-fade-in"
                        style={{ animationDelay: String(100 + i * 45) + 'ms' }}
                      >
                        <td className="px-5 py-3 whitespace-nowrap text-[13px] text-text-muted font-mono">
                          {format(new Date(e.createdAt), "MMM d, yyyy HH:mm")}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="text-[12.5px] font-medium text-text-primary">
                            {e.eventType.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={cn(
                            "text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full inline-block",
                            e.severity === "CRITICAL" || e.severity === "HIGH" ? "bg-coral-100 text-coral-600 border border-coral-100" :
                            e.severity === "MEDIUM" ? "bg-amber-100 text-amber-600 border border-amber-100" :
                            "bg-blue-100 text-blue-600 border border-blue-100"
                          )}>
                            {e.severity}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[13px] text-text-primary">
                          <div>{e.description}</div>
                          <div className="flex items-center gap-3 mt-1">
                            {e.ipAddress && <span className="text-[11.5px] text-text-muted font-mono bg-canvas/50 px-1.5 py-0.5 rounded border border-line-soft">IP: {e.ipAddress}</span>}
                            {e.fingerprint && <span className="text-[11.5px] text-text-muted font-mono bg-canvas/50 px-1.5 py-0.5 rounded border border-line-soft">ID: {e.fingerprint}</span>}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-4 border-t border-line-soft bg-canvas/20">
                <span className="text-[13px] text-text-muted">
                  Page <span className="font-medium text-text-primary">{page}</span> of <span className="font-medium text-text-primary">{totalPages}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1 || activityLoading}
                    className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-line bg-surface text-text-primary hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages || activityLoading}
                    className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-line bg-surface text-text-primary hover:bg-canvas disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showEmptyWhitelistModal} onOpenChange={setShowEmptyWhitelistModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Empty Whitelist Warning</DialogTitle>
            <DialogDescription>
              Your IP whitelist is empty. Enabling this will immediately block all API requests, including from your current IP. 
              Are you sure you want to lock down the API?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowEmptyWhitelistModal(false)}>
              Cancel
            </Button>
            <Button variant="default" className="bg-coral-600 hover:bg-coral-500 text-white border-0" onClick={confirmEmptyWhitelist}>
              Enable anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
