
import { NoticeBanner } from "@/components/dashboard/NoticeBanner";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { ChartCard } from "@/components/dashboard/ChartCard";
import { TransactionTrendsChart } from "@/components/dashboard/TransactionTrendsChart";
import { StatusDonut } from "@/components/dashboard/StatusDonut";
import { HourlyDistributionChart } from "@/components/dashboard/HourlyDistributionChart";
import { SuccessRateChart } from "@/components/dashboard/SuccessRateChart";
import { RecentTransactionsTable } from "@/components/dashboard/RecentTransactionsTable";
import { CommonErrorsPanel } from "@/components/dashboard/CommonErrorsPanel";

export default function DashboardPage() {
  return (
    <>
      <main className="px-4 sm:px-5 lg:px-8 py-6 space-y-5 max-w-[1440px]">
        <div className="animate-fade-up [animation-delay:500ms]">
          <NoticeBanner />
        </div>
        <div className="animate-fade-up [animation-delay:550ms]">
          <FilterBar />
        </div>

        <KpiCards />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <ChartCard
            title="Transaction trends"
            subtitle="Volume, success and settled amount over 30 days"
            className="lg:col-span-2"
            delayMs={800}
          >
            <TransactionTrendsChart />
          </ChartCard>

          <ChartCard
            title="Status distribution"
            subtitle="Share of all transactions"
            delayMs={830}
          >
            <StatusDonut />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ChartCard
            title="Hourly distribution"
            subtitle="When your customers are paying"
            delayMs={860}
          >
            <HourlyDistributionChart />
          </ChartCard>

          <ChartCard
            title="Success rate trend"
            subtitle="Daily completion rate, 30 days"
            delayMs={890}
          >
            <SuccessRateChart />
          </ChartCard>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pb-8">
          <div className="lg:col-span-2 animate-fade-up [animation-delay:920ms]">
            <RecentTransactionsTable />
          </div>
          <div className="animate-fade-up [animation-delay:950ms]">
            <CommonErrorsPanel />
          </div>
        </div>
      </main>
    </>
  );
}
