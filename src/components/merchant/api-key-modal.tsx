
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface ApiKeyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ApiKeyModal({ open, onOpenChange, onSuccess }: ApiKeyModalProps) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState("TEST");
  const [loading, setLoading] = useState(false);
  const [rawSecret, setRawSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const resetState = () => {
    setName("");
    setEnvironment("TEST");
    setRawSecret(null);
    setCopied(false);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
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
      <DialogContent className="sm:max-w-[425px]">
        {!rawSecret ? (
          <>
            <DialogHeader>
              <DialogTitle>Generate New API Key</DialogTitle>
              <DialogDescription>
                Create a new API key for integrating with our payout services.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Key Name</Label>
                <Input 
                  id="name" 
                  placeholder="e.g. Production Server, Staging" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="environment">Environment</Label>
                <Select disabled={loading} value={environment} onValueChange={(val) => val && setEnvironment(val)}>
                  <SelectTrigger id="environment">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TEST">TEST</SelectItem>
                    <SelectItem value="LIVE">LIVE</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">
                  Note: TEST keys cannot move real funds, but allow testing integration logic.
                </p>
              </div>
              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Generating..." : "Generate Key"}
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-emerald-700 flex items-center gap-2">
                <Check className="w-5 h-5" /> Key Generated
              </DialogTitle>
              <DialogDescription className="text-slate-900 font-medium pt-2">
                Please copy your new API key now.
              </DialogDescription>
            </DialogHeader>
            
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg flex items-start gap-3 my-4">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <p>For your security, <strong>this is the only time the full secret will be shown.</strong> If you lose this key, you will need to generate a new one.</p>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <Input readOnly value={rawSecret} className="font-mono text-sm bg-slate-50" />
              <Button size="icon" variant="outline" onClick={copyToClipboard} className="shrink-0 w-10">
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="sr-only">Copy key</span>
              </Button>
            </div>

            <DialogFooter className="pt-6">
              <Button type="button" onClick={() => handleOpenChange(false)} className="w-full">
                I have safely stored this key
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
