import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session?.user) {
    redirect("/login");
  }

  const profile = await db.merchantProfile.findUnique({
    where: { userId: session.user.id },
  });

  if (!profile) {
    // If no profile, they aren't even a PENDING merchant yet.
    // They should go through standard registration.
    redirect("/onboarding");
  }

  if (profile.accountStatus === "SUSPENDED" || profile.accountStatus === "DELETED") {
    redirect("/login?error=account_suspended");
  }

  return (
    <div className="flex min-h-[100dvh] bg-slate-50 font-sans">
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh]">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
