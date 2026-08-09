# Authentication vs Authorization Architecture

## Authentication (Better Auth)
- **Role:** Answers "Who is this user?"
- **Implementation:** Better Auth handles sessions, secure cookies (`HttpOnly`), Argon2 password hashing (internally), and OAuth providers (Google).
- **Boundary:** Better Auth ends at the creation and validation of the Session token.

## Authorization (Domain Services)
- **Role:** Answers "What is this user allowed to do?"
- **Implementation:** Evaluated entirely server-side inside `src/services/`. 
- **Rule:** We NEVER trust client-side claims or middleware for financial security. Middleware is only used to UX redirect users away from protected routes. The actual Service methods must re-verify `MerchantProfile.status === 'ACTIVE'` before executing any payout.

## Account Status vs KYC Status
- `Authentication`: Valid Session Token.
- `Account Status`: `PENDING`, `ACTIVE`, `SUSPENDED` (Controls system access).
- `KYC Status`: `PENDING`, `UNDER_REVIEW`, `APPROVED`, `REJECTED` (Controls verification progression).\n