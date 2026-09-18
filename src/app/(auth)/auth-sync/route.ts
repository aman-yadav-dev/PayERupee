import { NextResponse } from "next/server";
import { getResolvedAuthDestination } from "@/modules/auth/application/destination-loader.service";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Authoritatively resolve destination based on server DB state
    const destination = await getResolvedAuthDestination();
    
    // Security: Disallow query string 'redirect' or 'next' parameters to prevent Open Redirects.
    // The server is the absolute authority on where the user should go post-authentication.
    return NextResponse.redirect(new URL(destination, req.url));
  } catch (error) {
    console.error("[Auth Sync] Dispatch error:", error);
    return NextResponse.redirect(new URL("/login?error=dispatch_failed", req.url));
  }
}
