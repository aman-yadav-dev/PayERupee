import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/modules/auth/infrastructure/auth";
import { db } from "@/infrastructure/database/db";
import { AdminShell } from "@/components/admin/AdminShell";

import "@/components/dashboard/dashboard.css";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  // 1. Enforce active session
  if (!session?.user) {
    redirect("/admin/login");
  }

  // 2. Authoritative database role verification
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    redirect("/admin/login?error=unauthorized_role");
  }

  return (
    <div className="dashboard-theme flex-1 flex flex-col min-w-0 min-h-[100dvh]">
      <AdminShell
        user={{
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role as "ADMIN" | "SUPER_ADMIN",
        }}
      >
        {children}
      </AdminShell>
    </div>
  );
}
