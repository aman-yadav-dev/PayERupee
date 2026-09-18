import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";
import { auth } from "@/modules/auth/infrastructure/auth";
import { Sidebar } from "@/components/merchant/sidebar";
import { TopNav } from "@/components/merchant/top-nav";

export default async function MerchantLayout({ children }: { children: React.ReactNode }) {
  const destination = await getResolvedAuthDestination();

  // Strict check: if the authoritative destination is not /dashboard, they are
  // not an ACTIVE approved merchant. Redirect them to their required state.
  if (destination !== "/dashboard") {
    redirect(destination);
  }

  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  return (
    <div className="flex min-h-[100dvh] bg-slate-50 font-sans">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        {session?.user && <TopNav user={session.user} />}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
