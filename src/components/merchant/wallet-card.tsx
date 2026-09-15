
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, AlertCircle } from "lucide-react";

export function WalletCard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/v1/merchant/wallet")
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          setBalance(Number(d.data.balance));
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="shadow-sm border-slate-200 bg-white">
      <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
          <Wallet className="w-4 h-4 text-indigo-500" />
          Available Balance
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {loading ? (
          <div className="space-y-2">
            <div className="animate-pulse h-10 w-32 bg-slate-100 rounded"></div>
            <div className="animate-pulse h-4 w-24 bg-slate-100 rounded"></div>
          </div>
        ) : error || balance === null ? (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
             <AlertCircle className="w-4 h-4 shrink-0" />
             <span className="font-medium">Failed to load balance.</span>
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold tracking-tight text-slate-900">
              ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-slate-500 mt-1 font-medium">Ready for payout</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
