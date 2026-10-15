"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Key, Plus, Trash2, ShieldAlert, CheckCircle2, XCircle } from "lucide-react";
import { ApiKeyModal } from "@/components/merchant/api-key-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatDateTimeIST } from "@/lib/date";

export function ApiKeysManagement() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [environment, setEnvironment] = useState<"LIVE" | "TEST">("TEST");
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [revokeKey, setRevokeKey] = useState<any | null>(null);
  const [revoking, setRevoking] = useState(false);
  
  const loadKeys = () => {
    setLoading(true);
    fetch("/api/v1/merchant/api-keys")
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setKeys(d.data);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadKeys();
  }, []);

  const handleRevoke = async () => {
    if (!revokeKey) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/v1/merchant/api-keys/${revokeKey.id}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("API key revoked successfully");
        setRevokeKey(null);
        loadKeys();
      } else {
        toast.error(data.error || "Failed to revoke key");
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
    } finally {
      setRevoking(false);
    }
  };

  const envKeys = keys.filter(k => k.environment === environment);
  const activeKeysCount = envKeys.filter(k => k.isActive).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-text-primary tracking-tight">API Keys</h2>
          <p className="text-sm text-text-muted mt-1">Manage your integration credentials</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} disabled={activeKeysCount >= 5} >
          <Plus className="w-4 h-4 mr-2" />
          Create API key
        </Button>
      </div>
      
      {/* Security Notice */}
      <div className="bg-surface-hover border border-line text-text-secondary text-sm p-4 rounded-xl flex items-start gap-3 shadow-[var(--shadow-card)]">
        <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-text-muted" />
        <div>
          <p className="font-medium text-text-primary">Keep your API keys private</p>
          <p className="mt-1 leading-relaxed">Your secret is shown only once when the key is created. Never commit API keys to source control or expose them in client-side applications.</p>
        </div>
      </div>

      {/* Environment Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
        <div className="flex items-center p-1 bg-canvas rounded-lg w-full sm:w-auto">
          <button
            onClick={() => setEnvironment("TEST")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${
              environment === "TEST" 
                ? "bg-surface text-text-primary shadow-[var(--shadow-card)] ring-1 ring-slate-200" 
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            TEST
          </button>
          <button
            onClick={() => setEnvironment("LIVE")}
            className={`flex-1 sm:flex-none px-6 py-2 text-sm font-medium rounded-md transition-all ${
              environment === "LIVE" 
                ? "bg-surface text-text-primary shadow-[var(--shadow-card)] ring-1 ring-slate-200" 
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            LIVE
          </button>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-text-muted bg-surface-hover px-3 py-1.5 rounded-full border border-line">
          <Key className="w-4 h-4" />
          <span className="font-medium text-text-secondary">{activeKeysCount} of 5</span> active keys
        </div>
      </div>

      {activeKeysCount >= 5 && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">Maximum active keys reached</p>
            <p className="mt-1 opacity-90">You have reached the limit of 5 active keys for the {environment} environment. You must revoke an existing active key before generating a new one.</p>
          </div>
        </div>
      )}

      {/* Keys Table */}
      <Card className="shadow-[var(--shadow-card)] border-line bg-surface overflow-hidden flex flex-col min-h-[300px] rounded-xl">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-text-muted">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-line border-t-blue-600 mb-4"></div>
            <p className="text-sm font-medium">Loading API keys...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-coral-500">
            <ShieldAlert className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">Failed to load API keys.</p>
            <Button variant="outline" className="mt-4" onClick={loadKeys}>Retry</Button>
          </div>
        ) : envKeys.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mb-4 border border-line shadow-[var(--shadow-card)]">
              <Key className="w-8 h-8 text-text-muted" />
            </div>
            <h3 className="text-lg font-medium text-text-primary">No {environment} API keys yet</h3>
            <p className="text-text-muted text-sm mt-2 max-w-sm">Create a key to connect your application to the PayERupee API in {environment.toLowerCase()} mode.</p>
            <Button className="mt-6 shadow-[var(--shadow-card)]" onClick={() => setCreateModalOpen(true)}>Create API key</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="w-full text-sm text-left hidden sm:table">
              <thead className="bg-surface-hover border-b border-line text-text-muted font-medium text-[13px] uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">API key</th>
                  <th className="px-6 py-4">Created</th>
                  <th className="px-6 py-4">Last used</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {envKeys.map(k => (
                  <tr key={k.id} className={`hover:bg-surface-hover/50 transition-colors ${!k.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium text-text-primary">{k.name}</span>
                        <span className="font-mono text-[13px] text-text-muted mt-0.5 tracking-wide">
                          {k.keyPrefix}••••••••••••{k.lastFour}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-text-muted whitespace-nowrap text-[13px]">
                      {formatDateTimeIST(k.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-text-muted whitespace-nowrap text-[13px]">
                      {k.lastUsedAt ? formatDateTimeIST(k.lastUsedAt) : "Never"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {k.isActive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-full bg-canvas text-text-secondary border border-line">
                          <XCircle className="w-3 h-3" />
                          REVOKED
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {k.isActive && (
                        <Button variant="ghost" size="sm" className="text-coral-500 dark:text-coral-400 hover:text-coral-600 dark:text-coral-500 hover:bg-coral-100 dark:bg-coral-500/10 h-8 px-3" onClick={() => setRevokeKey(k)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Revoke
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Mobile Cards */}
            <div className="sm:hidden flex flex-col divide-y divide-line">
              {envKeys.map(k => (
                <div key={k.id} className={`p-4 flex flex-col gap-3 ${!k.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium text-text-primary">{k.name}</h4>
                      <p className="font-mono text-[12px] text-text-muted mt-1 tracking-wide">
                        {k.keyPrefix}••••••••••••{k.lastFour}
                      </p>
                    </div>
                    {k.isActive ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-50 text-emerald-700 border border-emerald-200">ACTIVE</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded bg-canvas text-text-secondary border border-line">REVOKED</span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <p className="text-text-muted font-medium">Created</p>
                      <p className="text-text-secondary">{formatDateTimeIST(k.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted font-medium">Last used</p>
                      <p className="text-text-secondary">{k.lastUsedAt ? formatDateTimeIST(k.lastUsedAt) : "Never"}</p>
                    </div>
                  </div>
                  {k.isActive && (
                    <Button variant="outline" size="sm" className="w-full mt-2 text-coral-500 dark:text-coral-400 border-red-200 hover:bg-coral-100 dark:bg-coral-500/10 hover:text-coral-600 dark:text-coral-500" onClick={() => setRevokeKey(k)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <ApiKeyModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
        onSuccess={loadKeys} 
        defaultEnvironment={environment}
      />

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeKey} onOpenChange={(o) => !o && setRevokeKey(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Revoke API key?</DialogTitle>
            <DialogDescription className="pt-3 text-text-secondary">
              Are you sure you want to revoke <span className="font-medium text-text-primary">{revokeKey?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <div className="bg-coral-100 dark:bg-coral-500/10 border border-coral-500/20 p-3 rounded-lg flex items-start gap-3 my-2">
            <ShieldAlert className="w-5 h-5 text-coral-500 dark:text-coral-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800 leading-relaxed">
              Any application using this key will immediately lose API access. This action cannot be undone.
            </p>
          </div>
          <p className="text-xs font-mono text-text-muted bg-surface-hover p-2 rounded border border-line text-center tracking-wide">
            {revokeKey?.keyPrefix}••••••••••••{revokeKey?.lastFour}
          </p>
          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRevokeKey(null)} disabled={revoking} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking} className="w-full sm:w-auto bg-coral-600 dark:bg-coral-500 hover:bg-coral-700 dark:hover:bg-coral-600">
              {revoking ? "Revoking..." : "Revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
