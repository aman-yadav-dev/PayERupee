// Deterministic mock data for the dashboard demo.

export type TrendPoint = {
  date: string;
  total: number;
  successful: number;
  amount: number;
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rand = seededRandom(42);

export const trendData: TrendPoint[] = Array.from({ length: 30 }).map((_, i) => {
  const d = new Date(2026, 7, 21 + i);
  const label = d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
  const base = 140 + Math.sin(i / 3.2) * 55 + rand() * 40;
  const successful = base * (0.72 + rand() * 0.2);
  const amount = base * (620 + rand() * 380);
  return {
    date: label,
    total: Math.round(base),
    successful: Math.round(successful),
    amount: Math.round(amount),
  };
});

export const hourlyDistribution = [
  { hour: "00", count: 42 }, { hour: "01", count: 24 }, { hour: "02", count: 15 },
  { hour: "03", count: 9 }, { hour: "04", count: 8 }, { hour: "05", count: 14 },
  { hour: "06", count: 38 }, { hour: "07", count: 71 }, { hour: "08", count: 118 },
  { hour: "09", count: 164 }, { hour: "10", count: 201 }, { hour: "11", count: 238 },
  { hour: "12", count: 256 }, { hour: "13", count: 219 }, { hour: "14", count: 187 },
  { hour: "15", count: 176 }, { hour: "16", count: 233 }, { hour: "17", count: 268 },
  { hour: "18", count: 244 }, { hour: "19", count: 198 }, { hour: "20", count: 151 },
  { hour: "21", count: 112 }, { hour: "22", count: 84 }, { hour: "23", count: 58 },
];

export const successRateTrend = trendData.map((p) => ({
  date: p.date,
  rate: Math.min(99.2, Math.max(78, 84 + Math.sin(p.total / 20) * 9 + (p.successful % 7))),
}));

export const statusDistribution = [
  { name: "Completed", value: 2481, color: "var(--blue-600)" },
  { name: "Pending", value: 96, color: "var(--amber-500)" },
  { name: "Validation failed", value: 143, color: "var(--neutral-500)" },
  { name: "Failed", value: 61, color: "var(--coral-500)" },
];

export type Transaction = {
  id: string;
  vendor: string;
  upi: string;
  amount: number;
  charges: number;
  status: "completed" | "pending" | "failed" | "validation_failed";
  timestamp: string;
};

export const recentTransactions: Transaction[] = [
  { id: "RA_6_TXN_0_260911061550_a1ca", vendor: "Kaveri Textiles", upi: "kaveri.textiles@okhdfc", amount: 4280, charges: 42.8, status: "completed", timestamp: "Sep 19, 17:49" },
  { id: "RA_6_TXN_0_260911061138_9fe2", vendor: "Northgate Traders", upi: "northgate@ibl", amount: 12650, charges: 126.5, status: "completed", timestamp: "Sep 19, 16:19" },
  { id: "RA_6_TXN_0_260911060942_7b31", vendor: "Ferro Hardware", upi: "ferro.hw@okaxis", amount: 890, charges: 8.9, status: "pending", timestamp: "Sep 19, 16:18" },
  { id: "RA_6_TXN_0_260911060811_d40c", vendor: "Meridian Foods", upi: "meridian@ybl", amount: 3140, charges: 31.4, status: "validation_failed", timestamp: "Sep 19, 15:28" },
  { id: "RA_6_TXN_0_260911060502_2ae9", vendor: "Sundar Auto Parts", upi: "sundar.auto@okicici", amount: 21900, charges: 219, status: "completed", timestamp: "Sep 19, 15:28" },
  { id: "RA_6_TXN_0_260911060118_ba07", vendor: "Vantage Electricals", upi: "vantage@okhdfc", amount: 640, charges: 6.4, status: "failed", timestamp: "Sep 19, 14:52" },
  { id: "RA_6_TXN_0_260910235504_11c5", vendor: "Kaveri Textiles", upi: "kaveri.textiles@okhdfc", amount: 5320, charges: 53.2, status: "completed", timestamp: "Sep 19, 14:11" },
];

export const commonErrors = [
  { code: "400", message: "Insufficient balance for requested amount plus applicable charges", occurrences: 23, percentage: 34 },
  { code: "412", message: "UPI ID could not be validated with the issuing bank", occurrences: 18, percentage: 26 },
  { code: "504", message: "Upstream payment gateway timed out before confirmation", occurrences: 11, percentage: 16 },
  { code: "409", message: "Duplicate transaction reference within the settlement window", occurrences: 7, percentage: 10 },
];

export const kpis = {
  availableBalance: 184320.5,
  monthSpend: 960680,
  monthSpendDelta: 12.4,
  successRate: 92.4,
  successRateDelta: 1.8,
  pendingCount: 6,
  pendingAmount: 42300,
};
