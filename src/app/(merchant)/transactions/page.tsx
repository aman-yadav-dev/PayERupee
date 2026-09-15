
"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, Receipt, ChevronLeft, ChevronRight, AlertCircle } from "lucide-react";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  const loadTransactions = (pageToLoad: number) => {
    setLoading(true);
    setError(false);
    fetch(`/api/v1/merchant/ledger?page=${pageToLoad}&limit=20`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setTransactions(d.data);
          setTotalPages(d.pagination.totalPages || 1);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTransactions(page);
  }, [page]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Transactions</h1>
        <p className="text-sm sm:text-base text-slate-500 mt-1">Full history of your wallet's credits and debits.</p>
      </div>
      
      <Card className="shadow-sm border-slate-200 bg-white overflow-hidden flex flex-col min-h-[400px]">
        {loading && transactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-slate-400">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
            <p className="text-sm font-medium">Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-red-500">
            <AlertCircle className="w-8 h-8 mb-3 opacity-50" />
            <p className="text-sm font-medium">Failed to load transactions. Please try again.</p>
            <Button variant="outline" className="mt-4" onClick={() => loadTransactions(page)}>Retry</Button>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-16">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 border border-slate-100">
              <Receipt className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-600 font-medium">No transactions found</p>
            <p className="text-slate-400 text-sm mt-1">Your ledger activity will appear here.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50/50 border-b border-slate-200 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4 font-medium whitespace-nowrap">Transaction details</th>
                    <th className="px-6 py-4 font-medium whitespace-nowrap">Reference ID</th>
                    <th className="px-6 py-4 font-medium whitespace-nowrap">Type</th>
                    <th className="px-6 py-4 font-medium whitespace-nowrap text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.map(t => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full shrink-0 ${t.direction === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                            {t.direction === 'CREDIT' ? <ArrowDownRight className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900">{t.purpose}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{t.description || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-500 align-middle">
                        {t.id}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-flex px-2 py-1 text-[10px] sm:text-xs font-semibold rounded-full border ${t.direction === 'CREDIT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {t.direction}
                        </span>
                      </td>
                      <td className={`px-6 py-4 text-right font-semibold whitespace-nowrap align-middle ${t.direction === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                        {t.direction === 'CREDIT' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="border-t border-slate-200 bg-white p-4 flex items-center justify-between sm:justify-end gap-4 mt-auto">
              <span className="text-sm text-slate-500 font-medium">Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1 || loading}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-10 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="sr-only">Previous Page</span>
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage(p => p + 1)}
                  className="w-10 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                  <span className="sr-only">Next Page</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
