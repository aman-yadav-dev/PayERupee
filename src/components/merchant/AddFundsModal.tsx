import { useState, FormEvent } from "react";
import { X, Loader2, Banknote } from "lucide-react";

type PaymentMode = "UPI" | "IMPS" | "NEFT" | "RTGS";

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  minAmount: number;
}

export function AddFundsModal({ isOpen, onClose, onSuccess, minAmount }: AddFundsModalProps) {
  const [amount, setAmount] = useState<string>("");
  const [utrNumber, setUtrNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < minAmount) {
      setError(`Minimum amount is ₹${minAmount}`);
      return;
    }
    if (!utrNumber || utrNumber.length < 5) {
      setError("Please enter a valid UTR or reference number");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/merchant/fund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numAmount,
          utrNumber,
          paymentMode
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setAmount("");
      setUtrNumber("");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-line">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary font-display">Add Funds</h2>
              <p className="text-sm text-text-muted">Request to add money to your wallet</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-hover text-text-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="p-3 text-sm text-coral-600 bg-coral-100 border border-coral-500/20 rounded-lg">
              {error}
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-medium">₹</span>
              <input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={`Min ${minAmount}`}
                className="w-full pl-8 pr-4 py-2.5 bg-canvas border border-line rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                required
                min={minAmount}
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">Payment Mode</label>
            <select 
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
              className="w-full px-4 py-2.5 bg-canvas border border-line rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none"
            >
              <option value="UPI">UPI</option>
              <option value="IMPS">IMPS</option>
              <option value="NEFT">NEFT</option>
              <option value="RTGS">RTGS</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-primary">UTR / Reference Number</label>
            <input 
              type="text" 
              value={utrNumber}
              onChange={(e) => setUtrNumber(e.target.value)}
              placeholder="e.g. 123456789012"
              className="w-full px-4 py-2.5 bg-canvas border border-line rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono uppercase"
              required
              minLength={5}
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isLoading ? "Submitting..." : "Submit Request"}
            </button>
            <p className="text-center text-xs text-text-muted mt-4">
              Your request will be verified by our team before funds are credited.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
