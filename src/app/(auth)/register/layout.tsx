import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";

export default async function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const destination = await getResolvedAuthDestination();
  
  // If destination is /login or similar, they are not authenticated. Let them through.
  // Wait, if they are unauthenticated, destination is "/login".
  // Should they be allowed on /register if destination is /login?
  // Yes! Both /login and /register are valid for unauthenticated users.
  
  if (destination === "/login") {
    return <>{children}</>;
  }

  // If they have an active session but are suspended/deleted, the resolver returns "/login?error=account_suspended".
  // They shouldn't see the register form either. We redirect them to that exact login error path.
  // If they are valid users, they get redirected to /dashboard or /kyc/start.
  redirect(destination);
}
