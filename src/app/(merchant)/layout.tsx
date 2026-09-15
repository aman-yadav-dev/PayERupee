import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { Sidebar } from "@/components/merchant/sidebar";
import { TopNav } from "@/components/merchant/top-nav";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login");
  }

  const profile = await db.merchantProfile.findUnique({
    where: { userId: session.user.id },
    include: { kycApplication: true }
  });

  if (!profile) {
    redirect("/onboarding");
  }

  if (profile.accountStatus === "SUSPENDED" || profile.accountStatus === "DELETED") {
    redirect("/login?error=account_suspended");
  }

  // A1 Fix: Prevent false "Account Under Review" state.
  // We redirect PENDING merchants without a KycApplication to a placeholder 
  // /kyc/start page to prevent unauthorized dashboard access.
  if (profile.accountStatus === "PENDING" && !profile.kycApplication) {
    redirect("/kyc/start");
  } else if (profile.accountStatus !== "ACTIVE" || profile.kycApplication?.status !== "APPROVED") {
    redirect("/pending-approval");
  }

  return (
    <div className="flex min-h-[100dvh] bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        <TopNav user={session.user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
