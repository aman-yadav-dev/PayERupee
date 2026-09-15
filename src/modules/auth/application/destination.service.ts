import { AccountStatus, KycStatus } from "@prisma/client";

export interface DestinationContext {
  session: {
    user: {
      id: string;
      emailVerified: boolean;
    };
  } | null;
  profile: {
    accountStatus: AccountStatus;
    kycApplication?: {
      status: KycStatus;
      allowResubmission: boolean;
    } | null;
  } | null;
}

/**
 * The exact route destinations currently supported by the application.
 */
export type AuthDestination = 
  | "/login" 
  | "/login?error=account_suspended"
  | "/onboarding"
  | "/kyc/start"
  | "/pending-approval"
  | "/dashboard";

/**
 * Deterministically resolves the correct route destination based on the authoritative
 * server-side authentication, merchant, and KYC state.
 * 
 * Note: Email verification is structurally accounted for but deliberately bypassed in this version,
 * as the /verify-email feature is not yet implemented.
 */
export function resolveAuthDestination(ctx: DestinationContext): AuthDestination {
  if (!ctx.session) {
    return "/login";
  }

  // Future feature: Email Verification.
  // if (!ctx.session.user.emailVerified) { return "/verify-email"; }

  if (!ctx.profile) {
    return "/onboarding";
  }

  const { accountStatus, kycApplication } = ctx.profile;

  if (accountStatus === "SUSPENDED" || accountStatus === "DELETED") {
    return "/login?error=account_suspended";
  }

  if (accountStatus === "PENDING") {
    if (!kycApplication) {
      return "/kyc/start";
    }
    
    // The following KYC states do not yet have dedicated routes (/kyc/form, /kyc/under-review, /kyc/rejected).
    // They safely fallback to the existing /pending-approval holding route.
    switch (kycApplication.status) {
      case "PENDING_SUBMISSION":
      case "UNDER_REVIEW":
      case "REJECTED":
        return "/pending-approval";
      case "APPROVED":
        // PENDING account but APPROVED KYC means it is awaiting Admin final approval.
        return "/pending-approval";
    }
  }

  if (accountStatus === "ACTIVE") {
    if (kycApplication?.status === "APPROVED") {
      return "/dashboard";
    }
    
    // ACTIVE account but KYC is missing or not approved (e.g. revoked/degraded).
    // This is an unsafe/inconsistent state that requires re-verification.
    return "/pending-approval";
  }

  // Fallback for any unknown or unsupported state
  return "/pending-approval";
}
