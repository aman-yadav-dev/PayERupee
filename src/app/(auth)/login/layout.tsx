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
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 p-6">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm max-w-md w-full border border-red-100">
          <h1 className="text-xl font-bold text-red-600 mb-2">Account Suspended</h1>
          <p className="text-sm text-zinc-600">Your merchant account is currently suspended or inactive. Please contact support for assistance.</p>
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
