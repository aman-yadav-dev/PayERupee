import { redirect } from "next/navigation";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const destination = await getResolvedAuthDestination();
  
  if (destination === "/login?error=account_suspended") {
    return (
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl bg-card p-8 text-center shadow-sm w-full border border-destructive/20">
          <h1 className="text-xl font-bold text-destructive mb-2">Account Suspended</h1>
          <p className="text-sm text-muted-foreground">Your merchant account is currently suspended or inactive. Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  // The user is allowed to view the login form only if their resolved destination 
  // is exactly the login page.
  if (destination === "/login") {
    return <>{children}</>;
  }

  // Any other authenticated state (dashboard, kyc, onboarding) redirects away.
  redirect(destination);
}
