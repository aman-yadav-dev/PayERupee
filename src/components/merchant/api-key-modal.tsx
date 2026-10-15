"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, AlertTriangle, ShieldCheck, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultEnvironment?: "TEST" | "LIVE";
}

export function ApiKeyModal({ open, onOpenChange, onSuccess, defaultEnvironment = "TEST" }: ApiKeyModalProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"TEST" | "LIVE">(defaultEnvironment);
  const [loading, setLoading] = useState(false);
  const [rawSecret, setRawSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open && !rawSecret) {
      setEnvironment(defaultEnvironment);
    }
  }, [open, defaultEnvironment, rawSecret]);

  const resetState = () => {
    setName("");
    setEnvironment(defaultEnvironment);
    setRawSecret(null);
    setCopied(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      resetState();
    }
    // Only allow manual close if not currently viewing secret, or force them to click the safe button
    if (rawSecret && !isOpen) {
      // let them close it, but reset state
      resetState();
    }
    onOpenChange(isOpen);
  };

  const copyToClipboard = async () => {
    if (!rawSecret) return;
    try {
      await navigator.clipboard.writeText(rawSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("API Key copied to clipboard");
    } catch (e) {
      toast.error("Failed to copy API key");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Key name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/v1/merchant/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, environment })
      });
      const data = await res.json();
      
      if (data.success) {
        setRawSecret(data.rawSecret);
        onSuccess();
        toast.success("API key generated successfully");
      } else {
        toast.error(data.error || "Failed to generate API key");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        {!rawSecret ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Create API key</DialogTitle>
              <DialogDescription className="text-slate-500 pt-2">
                Generate a new key to authenticate requests to the PayERupee API.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 py-4">
              <div className="space-y-3">
                <Label htmlFor="name" className="text-slate-700">Key Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Production Server, Staging" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="bg-slate-50 focus-visible:ring-indigo-500"
                  maxLength={50}
                  autoFocus
                />
                <p className="text-xs text-slate-500">A memorable name to identify this key in your dashboard.</p>
              </div>
              <div className="space-y-3">
                <Label className="text-slate-700 block">Environment</Label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
                  <button
                    type="button"
                    onClick={() => setEnvironment('TEST')}
                    disabled={loading}
                    className={cn(
                      "relative flex flex-col items-start p-3.5 border rounded-lg text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      environment === 'TEST' 
                        ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 dark:border-blue-500 dark:bg-blue-900/20 dark:ring-blue-500 z-10" 
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={cn(
                        "font-semibold text-sm tracking-tight",
                        environment === 'TEST' ? "text-blue-700 dark:text-blue-400" : "text-slate-900 dark:text-slate-100"
                      )}>
                        TEST
                      </span>
                      {environment === 'TEST' && <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-500 shrink-0" />}
                    </div>
                    <span className="text-[13px] text-slate-500 dark:text-slate-400 leading-snug">
                      Safe for development
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEnvironment('LIVE')}
                    disabled={loading}
                    className={cn(
                      "relative flex flex-col items-start p-3.5 border rounded-lg text-left transition-all outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                      environment === 'LIVE' 
                        ? "border-amber-600 bg-amber-50/50 ring-1 ring-amber-600 dark:border-amber-500 dark:bg-amber-900/20 dark:ring-amber-500 z-10" 
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700",
                      loading && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className={cn(
                        "font-semibold text-sm tracking-tight",
                        environment === 'LIVE' ? "text-amber-700 dark:text-amber-500" : "text-slate-900 dark:text-slate-100"
                      )}>
                        LIVE
                      </span>
                      {environment === 'LIVE' && <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-500 shrink-0" />}
                    </div>
                    <span className="text-[13px] text-slate-500 dark:text-slate-400 leading-snug">
                      Production credentials
                    </span>
                  </button>
                </div>
                
                {environment === "TEST" ? (
                  <div className="flex items-start gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">TEST keys allow you to test integration logic safely. They cannot move real funds.</p>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-lg border border-amber-200 mt-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">LIVE keys move real money. Keep them secure and never expose them in client-side code.</p>
                  </div>
                )}
              </div>
              <DialogFooter className="pt-4 gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading} className="w-full sm:w-auto">
                  Cancel
                </Button>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white">
                  {loading ? "Creating API key..." : "Create API key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl">API key created</DialogTitle>
                  <DialogDescription className="text-slate-500 mt-1">
                    This secret will only be shown once. Store it somewhere secure before closing.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="py-6">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg blur opacity-20 group-hover:opacity-30 transition duration-500"></div>
                <div className="relative flex items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-3 sm:p-4 shadow-sm">
                  <span className="font-mono text-sm sm:text-base text-slate-800 break-all select-all tracking-tight">
                    {rawSecret}
                  </span>
                  <Button 
                    size="sm" 
                    variant={copied ? "default" : "secondary"}
                    onClick={copyToClipboard} 
                    className={`shrink-0 h-9 transition-colors ${copied ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex items-start gap-3 mt-6">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 leading-relaxed font-medium">
                  After closing this window, you won't be able to view this secret again. If you lose it, you'll need to generate a new key.
                </p>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" onClick={() => handleOpenChange(false)} className="w-full bg-slate-900 hover:bg-slate-800 text-white h-11 text-base">
                I've saved my API key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
