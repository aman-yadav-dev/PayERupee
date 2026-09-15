
"use client";

import { useEffect, useState } from "react";
import { WalletCard } from "@/components/merchant/wallet-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, Activity, Receipt } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  useEffect(() => {
    fetch("/api/v1/merchant/ledger?limit=5")
      .then(r => r.json())
      .then(d => {
        if (d.success) setTransactions(d.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Overview of your account and recent activity.</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <WalletCard />
        
        <Card className="lg:col-span-2 shadow-sm border-slate-200 bg-white flex flex-col">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 shrink-0">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-700">
               <Activity className="w-4 h-4 text-slate-500" />
               Analytics
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-[160px] flex flex-col items-center justify-center text-slate-400 p-6 text-center">
             <Activity className="w-8 h-8 mb-3 opacity-20" />
             <p className="text-sm font-medium text-slate-500">Analytics arriving in a future update.</p>
             <p className="text-xs text-slate-400 mt-1">We're building aggregation tools to help you track volume.</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200 bg-white">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-700">Recent Transactions</CardTitle>
          <Link href="/transactions" className="text-sm text-indigo-600 font-medium hover:text-indigo-700 transition-colors">
            View all
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
             <div className="p-8 flex justify-center">
               <div className="animate-pulse flex space-x-4">
                 <div className="rounded-full bg-slate-200 h-10 w-10"></div>
                 <div className="flex-1 space-y-3 py-1">
                   <div className="h-2 bg-slate-200 rounded w-3/4"></div>
                   <div className="h-2 bg-slate-200 rounded w-1/2"></div>
                 </div>
               </div>
             </div>
          ) : error ? (
             <div className="p-8 text-center text-red-500 text-sm font-medium">Failed to load transactions.</div>
          ) : transactions.length === 0 ? (
             <div className="p-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <Receipt className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm font-medium">No transactions yet.</p>
             </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map(t => (
                <div key={t.id} className="p-4 sm:px-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`p-2.5 rounded-full shrink-0 ${t.direction === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                      {t.direction === 'CREDIT' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{t.purpose}</p>
                      <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate font-mono">Ref: {t.id}</p>
                    </div>
                  </div>
                  <div className={`font-semibold text-sm sm:text-base whitespace-nowrap ${t.direction === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {t.direction === 'CREDIT' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
