# Authentication Architecture

## Better Auth Configuration
- **Provider:** Better Auth with `prismaAdapter`.
- **Enabled Modules:** `emailAndPassword`, `socialProviders` (Google OAuth).
- **Session Strategy:** Database-backed sessions utilizing secure, HttpOnly, SameSite cookies.
- **Hashing:** Handled natively by Better Auth (currently configured securely by the library).

## Auth vs. Authorization
- Authentication simply answers: *Is this person who they say they are?*
- Better Auth handles authentication. It does NOT handle business-level authorization (like verifying if a merchant has passed KYC before allowing a payout).\n