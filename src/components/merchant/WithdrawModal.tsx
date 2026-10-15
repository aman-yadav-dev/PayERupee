"use client";

import React, { useState, useEffect } from "react";
import { X, Loader2, ArrowDownToLine, Plus, Building } from "lucide-react";

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  minAmount: number;
  maxAmount: number;
}

export function WithdrawModal({ isOpen, onClose, onSuccess, minAmount, maxAmount }: WithdrawModalProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [banks, setBanks] = useState<any[]>([]);
  const [loadingBanks, setLoadingBanks] = useState(true);
  const [selectedBankId, setSelectedBankId] = useState("");
  
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [newBank, setNewBank] = useState({ accountHolderName: "", accountNumber: "", ifscCode: "" });

  useEffect(() => {
    if (isOpen) {
      fetchBanks();
      setAmount("");
      setError(null);
      setIsAddingBank(false);
    }
  }, [isOpen]);

  const fetchBanks = async () => {
    setLoadingBanks(true);
    try {
      const res = await fetch("/api/v1/merchant/banks");
      const json = await res.json();
      if (json.success) {
        setBanks(json.data);
        if (json.data.length > 0 && !selectedBankId) {
          setSelectedBankId(json.data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBanks(false);
    }
  };

  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/merchant/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newBank)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Failed to add bank");
      }
      await fetchBanks();
      setSelectedBankId(json.data.id);
      setIsAddingBank(false);
      setNewBank({ accountHolderName: "", accountNumber: "", ifscCode: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }
    if (val < minAmount) {
      setError(`Minimum withdrawal amount is ₹${minAmount}`);
      setLoading(false);
      return;
    }
    if (val > maxAmount) {
      setError(`Insufficient balance.`);
      setLoading(false);
      return;
    }
    if (!selectedBankId) {
      setError("Please select a bank account");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/merchant/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: val,
          merchantBankId: selectedBankId,
          idempotencyKey: crypto.randomUUID()
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit withdrawal request");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-surface border border-line rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <ArrowDownToLine strokeWidth={2.5} className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-text-primary">Withdraw Funds</h2>
              <p className="text-sm text-text-muted">Transfer money to your bank account</p>
            </div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors p-1" disabled={loading}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-coral-100 border border-coral-500/20 text-coral-600 text-[13px] font-medium flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <p>{error}</p>
            </div>
          )}

          {isAddingBank ? (
            <form onSubmit={handleAddBank} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">Account Holder Name</label>
                <input
                  type="text"
                  required
                  value={newBank.accountHolderName}
                  onChange={e => setNewBank({ ...newBank, accountHolderName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="John Doe"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">Account Number</label>
                <input
                  type="text"
                  required
                  value={newBank.accountNumber}
                  onChange={e => setNewBank({ ...newBank, accountNumber: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="XXXXXXXXXX"
                  disabled={loading}
                />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">IFSC Code</label>
                <input
                  type="text"
                  required
                  value={newBank.ifscCode}
                  onChange={e => setNewBank({ ...newBank, ifscCode: e.target.value })}
                  className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder="ABCD0001234"
                  disabled={loading}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddingBank(false)} className="flex-1 px-4 py-2.5 border border-line rounded-xl text-sm font-medium text-text-secondary hover:bg-surface">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors py-2.5 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Bank"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-medium text-text-primary">Select Bank Account</label>
                  {banks.length > 0 && (
                    <button type="button" onClick={() => setIsAddingBank(true)} className="text-[12px] text-blue-600 font-medium hover:underline flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add New
                    </button>
                  )}
                </div>
                {loadingBanks ? (
                  <div className="w-full px-4 py-3 bg-surface border border-line rounded-xl flex items-center justify-center">
                    <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                  </div>
                ) : banks.length === 0 ? (
                  <button type="button" onClick={() => setIsAddingBank(true)} className="w-full px-4 py-4 bg-surface border border-line rounded-xl border-dashed hover:border-blue-500 hover:bg-blue-50/50 transition-colors flex flex-col items-center justify-center gap-2 group">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-medium text-text-primary">Add a Bank Account</span>
                  </button>
                ) : (
                  <select
                    value={selectedBankId}
                    onChange={e => setSelectedBankId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface border border-line rounded-xl text-sm focus:outline-none focus:border-blue-500 transition-colors"
                  >
                    {banks.map(bank => (
                      <option key={bank.id} value={bank.id}>
                        {bank.accountHolderName} - {bank.accountNumber.slice(-4).padStart(bank.accountNumber.length, '*')}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {banks.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[13px] font-medium text-text-primary">Amount to Withdraw</label>
                    <span className="text-[12px] text-text-muted">Max: ₹{maxAmount}</span>
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₹</div>
                    <input
                      type="number"
                      step="0.01"
                      min={minAmount}
                      max={maxAmount}
                      required
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-3 bg-surface border border-line rounded-xl text-base focus:outline-none focus:border-blue-500 transition-colors"
                      disabled={loading}
                    />
                  </div>
                </div>
              )}

              {banks.length > 0 && (
                <button
                  type="submit"
                  disabled={loading || !amount || parseFloat(amount) <= 0}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-[15px] transition-colors py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Withdraw Funds</span>
                  )}
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
