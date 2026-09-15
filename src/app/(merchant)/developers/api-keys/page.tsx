
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code2, Plus, Trash2, ShieldAlert } from "lucide-react";
import { ApiKeyModal } from "@/components/merchant/api-key-modal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [createModalOpen, setCreateModalOpen] = useState(false);
  
  const [revokeId, setRevokeId] = useState<string | null>(null);
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
    if (!revokeId) return;
    setRevoking(true);
    try {
      const res = await fetch(`/api/v1/merchant/api-keys/${revokeId}`, {
        method: "DELETE"
      });
      const data = await res.json();
      if (data.success) {
        toast.success("API key revoked successfully");
        setRevokeId(null);
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

  const activeKeys = keys.filter(k => k.isActive);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">API Keys</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">Manage integration keys for the PayERupee APIs.</p>
        </div>
        <Button onClick={() => setCreateModalOpen(true)} disabled={activeKeys.length >= 5}>
          <Plus className="w-4 h-4 mr-2" />
          Create new key
        </Button>
      </div>
      
      {activeKeys.length >= 5 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm p-4 rounded-lg flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-semibold">Maximum active keys reached</p>
            <p className="mt-1 opacity-90">You have reached the limit of 5 active keys. You must revoke an existing active key before generating a new one.</p>
          </div>
        </div>
      )}

      <Card className="shadow-sm border-slate-200 bg-white overflow-hidden flex flex-col min-h-[300px]">
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-sm font-medium">Loading API keys...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-red-500">
            <ShieldAlert className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">Failed to load API keys.</p>
            <Button variant="outline" className="mt-4" onClick={loadKeys}>Retry</Button>
          </div>
        ) : keys.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
              <Code2 className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-600 font-medium">No API keys generated</p>
            <p className="text-slate-400 text-sm mt-1 max-w-sm text-center">Create a key to authenticate your server-side requests to the PayERupee API.</p>
            <Button className="mt-6" onClick={() => setCreateModalOpen(true)}>Create your first key</Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                <tr>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Name</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Secret Key</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Environment</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap">Created</th>
                  <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {keys.map(k => (
                  <tr key={k.id} className={`hover:bg-slate-50 transition-colors ${!k.isActive ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{k.name}</td>
                    <td className="px-6 py-4 font-mono text-slate-500 whitespace-nowrap">
                      {k.keyPrefix}••••••••{k.lastFour}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-[10px] font-semibold rounded border ${k.environment === 'LIVE' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {k.environment}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold rounded-full border ${k.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${k.isActive ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        {k.isActive ? 'ACTIVE' : 'REVOKED'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      {k.isActive && (
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-3" onClick={() => setRevokeId(k.id)}>
                          <Trash2 className="w-4 h-4 sm:mr-2" />
                          <span className="hidden sm:inline">Revoke</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ApiKeyModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
        onSuccess={loadKeys} 
      />

      {/* Revoke Confirmation Dialog */}
      <Dialog open={!!revokeId} onOpenChange={(o) => !o && setRevokeId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
            <DialogDescription>
              Are you absolutely sure you want to revoke this API key? This action is irreversible and any integrations using this key will immediately fail.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setRevokeId(null)} disabled={revoking}>Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} disabled={revoking}>
              {revoking ? "Revoking..." : "Yes, revoke key"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
