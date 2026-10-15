import { TransactionsDashboard } from "@/components/merchant/TransactionsDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transactions | PayERupee",
  description: "View and track your business transactions.",
};

export default function TransactionsPage() {
  return <TransactionsDashboard />;
}
