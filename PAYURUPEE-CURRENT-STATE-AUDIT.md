# PayERupee Current-State Baseline Audit

**Audit date:** 2026-08-08  
**Repository inspected:** `C:\Users\asyad\Desktop\payerupee`  
**Branch / commit:** `main` / `0f02ec3a1b35878a0b1c72aa0a97c70dd8276293`  
**Scope:** Source, tracked configuration, Prisma schema, package metadata, documentation, routes, server actions, and the local environment *configuration shape* were inspected. No application source or configuration was changed by this audit. Uncommitted application changes appeared concurrently during the audit; they were reviewed and are included as the final observed worktree state. This report is the requested audit artifact.

## 1. Executive baseline

PayERupee is presently an early foundation/scaffold for a B2B payout product, not an operational payment or payout platform. The repository contains:

- A polished public landing page, terms/privacy pages, and five auth-facing pages.
- A PostgreSQL-oriented Prisma schema that models auth, wallet, ledger, payouts, fund requests, API keys, blacklists, support, settings, and audit logs.
- Better Auth configuration, its catch-all route, and four auth-related server actions; the concurrently added onboarding action is incompatible with the current Prisma schema and would fail type checking.
- No merchant dashboard, admin UI, KYC implementation, wallet operations, ledger posting service, payouts, API-key handling, external payment-provider integration, webhooks, authorization middleware, or tests.

The highest-risk verified issue is the use of `auth.api.signUpEmail()` and `auth.api.signInEmail()` from server actions without Better Auth's Next.js cookie bridge configured in [`src/lib/auth.ts`](src/lib/auth.ts). Better Auth's local installed implementation generates `Set-Cookie` headers during those calls; the configured auth object has no `nextCookies()` plugin, and the server actions do not copy the headers into Next.js cookies. Consequently, the UI can report success while no browser session is persisted. This must be verified in an integration test before the auth flow can be considered functional.

The second central conclusion is that documentation describes a future architecture rather than the current running application. Schema presence and installed packages must not be interpreted as implemented functionality.

## 2. Complete project inventory

### Root and source structure

```text
.
├── prisma/schema.prisma
├── src/
│   ├── actions/auth/{login,register}.ts
│   ├── app/(public)/page.tsx
│   ├── app/(auth)/{login,register,pending-approval,forgot-password}/page.tsx
│   ├── app/api/v1/auth/[...all]/route.ts
│   ├── components/auth/AuthShell.tsx
│   ├── components/ui/ (12 generated-style UI modules)
│   ├── config/env.ts
│   ├── lib/{auth,db,responses,utils}.ts
│   ├── schemas/auth.ts
│   └── types/api.ts
├── docs/ (architecture, API, DB, deployment, ERD, roadmap, release notes)
├── public/ (five default Next.js SVGs)
└── root configuration and package files
```

| Area | Exists? | Files | Status | Notes |
|---|---|---|---|---|
| Next.js app | Yes | `src/app/layout.tsx`, public/auth pages listed above | Partial | Only public and auth-facing routes exist. |
| API routes | Yes | `src/app/api/v1/auth/[...all]/route.ts` | Partial | Better Auth route only; no business API endpoints. |
| Server actions | Yes | `src/actions/auth/{register,login,forgot-password,onboarding}.ts` | Partial / broken | Input validation exists; session persistence/lifecycle checks are incomplete; onboarding has Prisma field mismatches. |
| Components | Yes | `src/components/auth/AuthShell.tsx`, `src/components/ui/*` | Partial | Auth shell and UI primitives exist; no domain UI. |
| Hooks | No | No `src/hooks` directory | Not implemented | Alias is configured in `components.json` only. |
| Library utilities | Yes | `auth.ts`, `db.ts`, `responses.ts`, `utils.ts` | Partial | No logging, authorization, ledger, crypto, rate-limit, or provider utilities. |
| Configuration | Yes | `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `prisma.config.ts` | Partial | Basic setup; production hardening/deployment config absent. |
| Prisma | Yes | `prisma/schema.prisma`, `prisma.config.ts` | Schema only | No `prisma/migrations` directory. Database state was not verified. |
| Public assets | Yes | `public/{file,globe,next,vercel,window}.svg` | Scaffolded | Default Next.js assets; app uses icon components rather than product artwork. |
| Documentation | Yes | `README.md`, `CHANGELOG.md`, `docs/*` | Present but substantially aspirational | Multiple current-code contradictions. |
| Tests | No | No test files or test configuration found | Not implemented | No test script in `package.json`. |
| CI/CD | No | No `.github`, pipeline, or workflow files found | Not implemented | No verified automation. |
| Deployment config | No | No Dockerfile, compose file, Vercel/Railway/Render config | Not implemented | `docs/deployment.md` contains an uncommitted example only. |
| Environment config | Yes | `.env.example`, `src/config/env.ts` | Partial | Required values exist locally without exposing them; runtime policy is incomplete. |
| Middleware / proxy | No | No `src/middleware.ts` or `src/proxy.ts` | Not implemented | No route enforcement. |
| Authentication | Yes | `src/lib/auth.ts`, auth API route, actions | Partial / broken | Email/password setup only; see Sections 4–6. |
| Authorization | No | No guard, role helper, or status guard | Not implemented | Enums alone do not enforce permissions. |

The repository commit inspected is clean at `0f02ec3…`, but the final observed worktree contains separate uncommitted auth/onboarding/legal-page changes in addition to this report. They were not authored by this audit and were preserved. `.env` and `dev.db` are ignored and not tracked. No actual secret value is reproduced in this report.

## 3. Current development status

### A. Complete (verified within the limited scope)

- **Basic Next.js/TypeScript/Tailwind project scaffolding:** App Router source exists; `tsconfig.json` enables strict mode; `src/app/globals.css` imports Tailwind v4 and shadcn CSS.
- **Public landing-page implementation:** [`src/app/(public)/page.tsx`](src/app/(public)/page.tsx) is a substantial client-rendered landing page with responsive navigation and Framer Motion animation.
- **Auth page visual implementation:** `/register`, `/login`, `/pending-approval`, and `/forgot-password` render implemented client components sharing [`src/components/auth/AuthShell.tsx`](src/components/auth/AuthShell.tsx).
- **Legal page visual implementation:** `/terms` and `/privacy` now render static document-style pages; their legal/security claims are not backed by the application code.
- **Authentication schema types and server-side Zod validation:** [`src/schemas/auth.ts`](src/schemas/auth.ts) defines `loginSchema` and `registerSchema`; both server actions call `safeParse`.
- **Basic standardized action payload shape:** [`src/lib/responses.ts`](src/lib/responses.ts) returns the `ApiResponse` shape defined in [`src/types/api.ts`](src/types/api.ts).

### B. Partially complete

| Capability | Why it is partial |
|---|---|
| Prisma/PostgreSQL configuration | [`src/lib/db.ts`](src/lib/db.ts) constructs Prisma 7 with `@prisma/adapter-pg`, and `prisma.config.ts` points to PostgreSQL URLs. There are no migrations and no connection/schema deployment proof. |
| Better Auth | [`src/lib/auth.ts`](src/lib/auth.ts) configures the Prisma adapter and enables email/password; handler route is wired. Cookie propagation, email verification, password reset, lifecycle authorization, logout/session use, and integration tests are absent. |
| Google OAuth | Concurrent work conditionally adds the Google provider and an auth client/button. The local environment has neither Google credential variable, `auth-client.ts` points at the app root rather than the configured `/api/v1/auth` base, and the provider flow has no tests. |
| Registration | The action validates, creates an auth identity, updates selected merchant fields, and creates a wallet. Identity creation is outside the later transaction, error handling leaks messages, and the browser session bridge is absent. |
| Login | The action validates input and calls Better Auth. It normalizes known credential errors but does not apply status/role/deletion rules, pass “Remember me,” or establish a verified session bridge. It redirects to a missing route. |
| Wallet / ledger database design | `Wallet` and `WalletTransaction` models exist with decimals, a balance snapshot, and a wallet version. There is no financial posting code, state machine, or database-enforced immutable/double-entry design. |
| KYC signal | `User.status` and `kycApprovedAt` exist and the pending page mentions KYC. There is no KYC model, document collection, reviewer flow, policy, or status enforcement. |
| UI system | shadcn-compatible files, Sonner, Lucide, and shared auth UI exist. Application forms use local React state rather than React Hook Form/Zod resolver, and no domain interface exists. |
| Documentation | Documentation covers the target vision and schema. It is not an accurate current-state operations guide. |

### C. Scaffolded only

- Financial models: `ApiKey`, `Wallet`, `WalletTransaction`, `FundRequest`, `Payout`, `Blacklist`, `SupportTicket`, `SupportMessage`, `SystemSetting`, and `AuditLog` in [`prisma/schema.prisma`](prisma/schema.prisma) have no calling code.
- Forgot password: [`src/app/(auth)/forgot-password/page.tsx`](src/app/(auth)/forgot-password/page.tsx) now calls `forgotPasswordAction`, but that action only queries `User` and returns success; it does not generate a Better Auth reset token or send email.
- Pending approval: [`src/app/(auth)/pending-approval/page.tsx`](src/app/(auth)/pending-approval/page.tsx) is display-only.
- Google sign-in button: `GoogleButton` in [`src/components/auth/AuthShell.tsx`](src/components/auth/AuthShell.tsx) now invokes a client SDK, but the OAuth provider is enabled only if two absent local variables are present and the client base URL is misaligned with the handler route.
- Onboarding: [`src/app/(auth)/onboarding/page.tsx`](src/app/(auth)/onboarding/page.tsx) and [`src/actions/auth/onboarding.ts`](src/actions/auth/onboarding.ts) were added, but the action uses nonexistent Prisma fields and cannot perform the claimed update.
- “Remember me”: state is captured in [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx) but is never passed to `loginAction` or Better Auth.
- A number of UI primitives are present but unconsumed outside their own internal imports; only `CustomCheckbox` is consumed by the auth pages.

### D. Not implemented

Merchant profile management; structured merchant address; phone verification; logout; session retrieval/validation helpers; role/status authorization; route protection; dashboards; wallet reads; fund requests; ledger posting; payouts; payout-provider integration; idempotency request handling; API key lifecycle; KYC; admin panel/workflows; blacklist enforcement; support; notifications/email; webhooks; rate limiting; audit logging; monitoring; CI/CD; database migrations; and tests.

### E. Broken / needs fixing

- Auth UI redirects successful login to `/dashboard`, but no `/dashboard` page exists.
- Documentation and project metadata repeatedly state Next.js 15, while [`package.json`](package.json) and the installed tree use **Next.js 16.2.11**.
- The “forgot password” page claims an email was sent when none is sent.
- `completeMerchantOnboardingAction` uses `Wallet.userId`/`AuditLog.entity`, `userId`, and `details`; current generated Prisma types only expose `Wallet.merchantId` and `AuditLog.entityType`, `adminId`, and `metadata`. This source will fail type checking.
- Google OAuth is only conditionally configured; the current local environment lacks `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and `src/lib/auth-client.ts` does not use the auth route base URL.
- The project documents production REST endpoints that do not exist.
- The cookie-session bridge issue makes successful server-action sign-up/sign-in unreliable/nonfunctional from a browser perspective.
- Registration can leave a suspended auth user and a session after downstream merchant setup fails; it does not remove/compensate atomically.

### F. Unknown / cannot verify

- Live PostgreSQL connectivity, deployed schema, and data contents.
- Whether an external database already has an equivalent manually applied schema; no migration history is in the repository.
- Production host configuration, TLS termination, network policy, secrets manager, and deployment platform settings.
- Dependency vulnerabilities: `npm audit` could not contact the npm advisory endpoint in this environment. No clean audit result exists.
- Lint health: `npm run lint` did not return a result within 60 seconds. Its timed-out output contained no diagnostics, but this is not a passing result.

## 4. Authentication audit

### Verified configuration

[`src/lib/auth.ts`](src/lib/auth.ts) configures:

- `better-auth` **1.6.25** (installed version).
- `prismaAdapter(db, { provider: "postgresql" })` using the `PrismaClient` from [`src/lib/db.ts`](src/lib/db.ts).
- `emailAndPassword.enabled: true` and `autoSignIn: true`.
- `secret: env.BETTER_AUTH_SECRET` and `baseURL: ${env.BETTER_AUTH_URL}/api/v1/auth`.
- A catch-all handler only at [`src/app/api/v1/auth/[...all]/route.ts`](src/app/api/v1/auth/[...all]/route.ts), exporting `GET` and `POST` through `toNextJsHandler(auth.handler)`.

The database factory uses `DATABASE_URL` and a `pg` `Pool`; `prisma.config.ts` uses `DIRECT_URL` for Prisma CLI migrations with a fallback to `DATABASE_URL`. The local `.env` has all six documented variable names present; the secret has a non-empty 64-character value. The concurrently added optional Google variables are absent locally and absent from `.env.example`. Values are deliberately not disclosed.

### Better Auth schema compatibility

The models `User`, `Session`, `Account`, and `Verification` in [`prisma/schema.prisma`](prisma/schema.prisma) have the core field names Better Auth expects and map to plural table names. The installed Prisma adapter looks up model field names through the standard schema; the current default model names therefore align.

There are nevertheless material gaps:

- `Account` has no `@@unique([providerId, accountId])` constraint. Better Auth's normal email flow creates one credential account, but the schema alone permits duplicates for a provider/account pair.
- `Verification.createdAt` and `Verification.updatedAt` are nullable. This may work for the current config because no verification flow is enabled, but it has not been integration-tested with Better Auth token flows.
- No migration establishes any of these tables.

### Custom user fields: exact distinction

| Field | Exists in Prisma `User`? | Accepted/written by Better Auth configuration? | Written by application? | Conclusion |
|---|---|---|---|---|
| `businessName` | Yes, nullable | No `user.additionalFields` is configured in `src/lib/auth.ts`; Better Auth filters unconfigured additional input fields. | Yes, explicitly in `registerMerchantAction` after sign-up. | Persisted only if the downstream action transaction succeeds. |
| `address` | Yes, nullable | Same as above. | Yes, explicitly in registration action. | Plain text; not a structured address model. |
| `phone` | Yes, nullable and unique | Same as above. | Yes, explicitly in registration action. | No format normalization beyond trim/min/max; no verification. |
| `role` | Yes, default `MERCHANT` | Not exposed as a configured Better Auth input field. | Yes, action explicitly writes `MERCHANT`. | Server-controlled in this action; no authorization uses it. |
| `status` | Yes, default `PENDING` | Not exposed as a configured Better Auth input field. | Yes, action explicitly writes `PENDING`; cleanup can set `SUSPENDED`. | No login/session/route enforcement uses it. |
| `deletedAt` | Yes, nullable | Not configured as a Better Auth field. | No source code writes it. | Soft-delete is schema-only. |

This is a positive mass-assignment property for the direct Better Auth endpoint: the installed `signUpEmail` parses extra input through configured additional fields, and none are configured. It is not a finished user-profile architecture because the action separately writes the fields after identity creation.

### Session/cookie assessment

The installed Better Auth code sets an HTTP-only, `SameSite=Lax`, path `/` session cookie by default, secure only when its base URL is HTTPS/production. The repository does not explicitly configure cookie attributes, session lifetime, cookie cache, trusted origins, or advanced security options.

The crucial integration defect is that `auth.api.signUpEmail()` and `auth.api.signInEmail()` set cookies on Better Auth's response context. [`src/lib/auth.ts`](src/lib/auth.ts) does **not** include the `nextCookies()` integration from `better-auth/next-js`, and neither server action calls Next.js `cookies().set()` or forwards Better Auth `Set-Cookie` headers. The handler adapter in the route file is only used when the request is made to `/api/v1/auth/*`; it does not make direct server-action calls persist response cookies. This is a **verified configuration mismatch**; end-to-end confirmation is still required.

### Missing auth functionality

- [`src/lib/auth-client.ts`](src/lib/auth-client.ts) now creates a Better Auth React client and exports `signIn`, `signUp`, `useSession`, and `signOut`, but its base URL is `NEXT_PUBLIC_APP_URL`/`http://localhost:3000`, not the configured `${BETTER_AUTH_URL}/api/v1/auth` handler base. No other page uses `useSession` or `signOut`.
- No server helper invokes `auth.api.getSession` / validates sessions.
- No logout invocation or route.
- `forgotPasswordAction` exists but only performs a user lookup and returns a message. There is still no Better Auth password-reset request, token, email sender, reset-confirmation route, or `emailVerification` configuration.
- Email/password creation delegates hashing to Better Auth; `bcryptjs` is not imported by application source despite documentation claiming bcrypt handling.
- No pending/suspended/deleted checks after credentials validate. The installed Better Auth email sign-in path checks credentials and optional email verification only; the application adds no lifecycle hook/check.

## 5. Registration-flow audit

### Actual flow

```text
Register page local React state + handwritten client validation
  -> registerMerchantAction(data)
  -> registerSchema.safeParse(data)
  -> auth.api.signUpEmail({ email, password, name })
  -> Better Auth creates User, credential Account, and (autoSignIn) Session
  -> db.$transaction([user.update(custom fields), wallet.create])
  -> ApiResponse success
  -> client toast + /pending-approval redirect
```

Evidence: [`src/app/(auth)/register/page.tsx`](src/app/(auth)/register/page.tsx), [`src/actions/auth/register.ts`](src/actions/auth/register.ts), and [`src/schemas/auth.ts`](src/schemas/auth.ts).

### Fields, validation, and persistence

- UI collects `fullName`, `businessName`, `email`, `phone`, `address`, `password`, `confirmPassword`, and terms acceptance.
- The UI validates manually; it does **not** use React Hook Form or `@hookform/resolvers`.
- `confirmPassword` is checked only by client code; it is deliberately not part of the server schema. A caller can submit a valid password without a confirmation field, which is acceptable only if confirmation is treated as a UX control.
- The server schema validates name (2–100), business name (2–150), address (5–255), phone (10–15 characters), lowercased email, password (8–128), and `termsAccepted === true`.
- Server-side normalization is trimming strings and lowercasing email. It does not canonicalize Indian phone numbers, preserve a consent timestamp/version, validate address jurisdiction, or verify ownership.
- The action destructures an allowlist of fields and writes a fixed `role: "MERCHANT"` and `status: "PENDING"`. Its direct input handling is not mass-assignable.
- Wallet creation is attempted with `merchantId: userId`; `Wallet.merchantId` is unique, so duplicates are prevented at the database level if the schema is deployed.

### Transaction and failure behavior

`auth.api.signUpEmail()` occurs **before** `db.$transaction([...])`. Better Auth internally groups its own user/account/session work, but that is a different operation from merchant extension/wallet initialization. If the latter fails, the action attempts only to update the user to `SUSPENDED`; it does not delete the user/account/session and does not guarantee cleanup if the update fails. Current potential outcomes include:

- an auth identity with no wallet or merchant profile fields;
- an automatically created session for a suspended/partially initialized user;
- a user whose sign-up error is returned verbatim to the browser;
- a duplicate retry that hits the existing email but cannot repair the partial onboarding state.

The action maps Prisma `P2002` to an email-or-phone duplicate message. Other Better Auth errors are returned using `error.message`, which can expose internal operational detail. Duplicate email detection may also be observable through the action's user-facing message, though Better Auth itself includes more generic duplicate behavior only when email verification is required or auto-sign-in is disabled; neither is configured.

The code attempts to pass `headers()` into Better Auth, which allows request context/CSRF processing, but it does not establish verified browser cookie persistence as discussed in Section 4.

## 6. Login-flow audit

### Actual flow

```text
Login page local React state + handwritten validation
  -> loginAction(data)
  -> loginSchema.safeParse(data)
  -> auth.api.signInEmail({ email, password })
  -> ApiResponse success
  -> client toast + router.push('/dashboard')
```

Evidence: [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx), [`src/actions/auth/login.ts`](src/actions/auth/login.ts), and [`src/schemas/auth.ts`](src/schemas/auth.ts).

- The server schema trims/lowercases email and accepts a 6–128-character password; registration requires at least 8 characters. This inconsistency does not weaken an existing stored password but produces inconsistent validation policy.
- Known error-message fragments are collapsed to “Invalid email or password,” reducing ordinary credential enumeration. The generic catch otherwise returns a generic internal-error message.
- `remember` is not sent to `loginAction`, so it has no effect. Better Auth receives no `rememberMe` override and uses its default persistent-session behavior.
- `loginAction` does not inspect user `role`, `status`, or `deletedAt`; pending, suspended, and soft-deleted users are not rejected by any local code. Admins and merchants receive exactly the same path.
- There is no protected-route implementation. Even if a session cookie were persisted, no merchant/admin guard consumes it.
- The success redirect targets `/dashboard`, which has no corresponding route. The observed current browser result after reported success is therefore a 404 route (independent of the cookie issue).

### Concurrently added onboarding and recovery flows

[`src/actions/auth/forgot-password.ts`](src/actions/auth/forgot-password.ts) validates email and queries the user table. For both existing and absent users it returns a success-shaped response, which avoids a direct response-based enumeration signal; however, it sends no reset instruction and its catch block logs the raw error with `console.error`.

[`src/actions/auth/onboarding.ts`](src/actions/auth/onboarding.ts) calls `auth.api.getSession` and validates company/phone/address, then intends to update a user, create a wallet, and add an audit log. It cannot execute against the current schema: its wallet operations use `userId` where `WalletWhereUniqueInput`/`WalletUncheckedCreateInput` require `merchantId`; its audit insert uses `entity`, `userId`, and `details` where `AuditLogCreateInput` requires `entityType`, `adminId`, and `metadata`. The generated Prisma client in `node_modules/.prisma/client/index.d.ts` confirms those fields. It also changes any authenticated caller's role to `MERCHANT`/status to `PENDING` and records the caller as an audit administrator without role verification. This is broken, not a verified onboarding implementation.

The new client SDK and Google button are likewise only an unverified scaffold. [`src/lib/auth.ts`](src/lib/auth.ts) conditionally defines a provider only if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist; they are absent in the local environment and `.env.example`. [`src/lib/auth-client.ts`](src/lib/auth-client.ts) configures the client with the app root rather than the server auth base (`/api/v1/auth`), so its request target must be corrected/verified before enabling the UI.

## 7. Database / Prisma audit

### General database state

The only schema source is [`prisma/schema.prisma`](prisma/schema.prisma). It declares `provider = "postgresql"` and the `prisma-client-js` generator. There is no `prisma/migrations` directory, seed script, migration script, or confirmed database schema. A `dev.db` file exists locally but is ignored and conflicts with the PostgreSQL-oriented source configuration; it is not evidence of an applied production schema.

`prisma validate` was attempted as a read-only check but did not complete within the time limit, so no Prisma CLI validation success is claimed.

### Models

| Model | Purpose and key design | Integrity / concerns |
|---|---|---|
| `User` | Better Auth identity plus merchant fields, role/status, KYC timestamp, soft-delete timestamp. CUID PK; unique email and phone; index on `deletedAt`. | `businessName`/address/phone are direct nullable columns, not a separate merchant/profile/address design. No constraints enforce lifecycle behavior. |
| `Session` | Better Auth sessions. CUID PK; unique token; indexed `userId`; cascades when user is deleted. | Session management is not used by application code. |
| `Account` | Better Auth credentials/OAuth accounts. CUID PK; relation to user with cascade. | Missing unique `providerId + accountId`; credential password hash is nullable and held by Better Auth. |
| `Verification` | Better Auth verification tokens. CUID PK; unique `(identifier, value)`. | Timestamps nullable; no email/password-reset feature uses the model. |
| `ApiKey` | Intended merchant API credential metadata: hash, prefix, last four, live/test state, revocation/expiry. | Schema-only; no generation, hashing, authentication, rotation, or revoke logic. `keyHash` unique; soft delete is not enforced globally by queries. |
| `Wallet` | Per-merchant cached balance with INR enum, decimal(18,4), active flag, `version`. Unique merchant ID. | No posting code increments `version` or atomically changes balance. “Source of truth” comment is unenforced. |
| `WalletTransaction` | Intended append-only wallet ledger with type/category, amount/fee/tax/balance-after, reference, external reference. | No database trigger/privilege policy blocks update/delete; no unique reference/idempotency key; no counterpart account/entry, so not double-entry. |
| `FundRequest` | Merchant top-up request with unique UTR, amount/status/mode, reviewer pointers, timestamps/soft delete. | No UTR verification, approval workflow, ledger credit, or transition logic. `approvedById` is optional but delete relation is `Restrict`. |
| `Payout` | Intended outgoing payout with merchant composite idempotency key, decimals, state/mode/provider, beneficiary data, references. | Beneficiary bank data are stored as plaintext; no transition guard or provider interaction. `bankReference` unique nullable. |
| `Blacklist` | Global or merchant scoped beneficiary value blocklist. | `value` is globally unique, which prevents the same value being recorded separately across scopes/types. No check is implemented. |
| `SupportTicket` | Intended merchant support case. | Schema-only; merchant cascade deletes tickets. |
| `SupportMessage` | Ticket messages with sender/isAdmin marker. | Schema-only; `isAdmin` not structurally verified against sender role. |
| `SystemSetting` | Singleton-intended global fees/tax/min/max. Default ID `GLOBAL_SETTINGS`. | No seed/upsert/service enforces singleton use or applies fees. |
| `AuditLog` | Administrative audit entries with entity/action metadata. | Schema-only; no application write path; `adminId` is required but database does not ensure the user is an ADMIN role. |

### Enums and financial precision

The schema defines `UserRole`, `UserStatus`, `Currency` (INR only), payment/provider enums, transaction/fund/payout statuses, audit enums, blacklist and support enums. Money fields use `Decimal(18,4)` rather than float, which is an appropriate storage choice for INR and fees. No source code performs money arithmetic or serializes decimals, so runtime rounding/scale policy is unverified.

All listed foreign keys are explicit Prisma relations. Most financial relationships use `onDelete: Restrict`; user sessions/accounts cascade. The only soft-delete fields are on `User`, `ApiKey`, `FundRequest`, and `Payout`; no code filters them, so soft deletion has no effective application behavior. `Wallet.version` is the only optimistic-locking field, but it is not used.

## 8. Financial data-safety audit

### Critical

- **No financial operation is implemented.** There is no service that atomically debits/credits wallets, creates ledger records, calculates fees/tax, validates balance, records idempotency, or calls a payout provider. The app must not be used to move money.
- **The claimed double-entry ledger does not exist.** [`prisma/schema.prisma`](prisma/schema.prisma) has only `WalletTransaction` rows attached to one merchant wallet. There are no debit/credit account pairs, journal headers/lines, chart of accounts, balancing invariant, or reconciliation implementation. Comments and documentation calling it “double-entry” are inaccurate.

### High

- **No database-enforced immutability.** `WalletTransaction` omits `updatedAt`, but an ORM client or database user can still update/delete rows. No trigger, restricted DB role, append-only ledger API, or audit mechanism is present.
- **No concurrency implementation.** `Wallet.version` exists but no update uses a version predicate/increment. Concurrent future debits could overspend if implemented naively.
- **No payout transition guard or provider idempotency.** `PayoutStatus` is an enum only. There is no allowed-transition enforcement, claim/lock, retry policy, reconciliation, duplicate provider-call prevention, or webhook replay protection.
- **Sensitive beneficiary data are plaintext schema columns.** `Payout.accountNumber`, `ifscCode`, `accountHolderName`, and phone are not encrypted/tokenized/masked by any repository code.
- **No wallet/fund lifecycle implementation.** No wallet activation/freeze rules, top-up verification, balance check, debit/credit coupling, or compensation behavior exists.

### Medium

- Decimal columns are safe for storage, but scale/rounding/tax semantics, negative amount constraints, nonzero constraints, currency conversion policy, and maximum precision policy are not encoded.
- `WalletTransaction.referenceId` is nullable and non-unique; it cannot by itself prevent duplicate financial entries.
- `Blacklist.value` globally unique is likely too broad for the intended global-versus-merchant scoping model.
- Schema comments say wallet balance is cached and ledger is authoritative, but no reconciliation job/check can detect drift.

### Low

- INR-only `Currency` is clear for an India-first MVP but inconsistent with public/docs copy promising multi-currency later; that is a roadmap concern rather than a present financial defect.

## 9. Security audit

| Area | Verified condition | Assessment |
|---|---|---|
| Authentication | Better Auth with Prisma adapter and email/password is configured. | Partial; browser session handoff must be repaired/verified. |
| Passwords | Better Auth receives the password and hashes it internally; application does not log passwords. | Better than manual plaintext handling; policy has no explicit complexity/breach protection or reset flow. |
| Authorization/RBAC | `role`/`status` enums exist only. | Not implemented; no route, action, or API guard. |
| Session security | Better Auth defaults can produce HTTP-only/Lax cookies. | No explicit secure cookie policy, trusted origins, lifetime, revocation, session validation, logout, or tests. |
| OAuth | Google provider/client code was added conditionally. | Not operable locally (credentials absent); client targets the wrong base URL; onboarding is broken; no tested callback/allowlist policy. |
| CSRF | Better Auth endpoints include its built-in form CSRF middleware. | The server actions have no separate project-level CSRF design; direct use must be integration-tested. |
| Input validation | Zod validates server action inputs; action destructuring prevents mass assignment. | Partial; phone/address/domain-specific validation and all other domain inputs are absent. |
| Error leakage | Registration returns arbitrary `Error.message` to the client. | Unsafe; may disclose DB/auth details. |
| Rate limiting/brute force | `ioredis` and `REDIS_URL` are configured only as dependencies/env. | Not implemented; login/sign-up/API endpoints lack a visible rate limiter. |
| Enumeration | Login normalizes common credential errors. Registration gives an account-exists message; Better Auth duplicate behavior is not configured for generic responses. | Partial. |
| SQL injection | Prisma is used; no raw query was found. | No current raw SQL injection surface. This does not protect future APIs. |
| XSS | React JSX escapes interpolated form values by default; no dangerous HTML API was found. | No specific current XSS sink found. |
| IDOR | No protected resource endpoints exist. | Cannot assess operationally; authorization framework is absent. |
| Secrets | `.env` is ignored; `.env.example` contains placeholders. | No tracked secret was found. `BETTER_AUTH_SECRET` runtime minimum is only 16 in `env.ts`, while its own example asks for 32+. |
| Logging/audit | `pino` installed; logger imports commented out. `AuditLog` schema-only; new recovery/onboarding actions use raw `console.error`. | Not implemented and risks logging unredacted error detail. |
| Webhooks/files | No endpoint or upload implementation exists. | Not implemented; no signature/replay/upload controls exist. |
| Dependencies | Lockfile exists. | Advisory check could not reach npm; no vulnerability conclusion possible. |

## 10. API and server-action audit

| Endpoint/Action | Purpose | Auth required | Validation | DB access | Error handling | Status |
|---|---|---|---|---|---|---|
| `POST/GET /api/v1/auth/[...all]` | Better Auth protocol route | Protocol-dependent | Better Auth internal schemas | Prisma adapter | Better Auth handler | Partial; only auth protocol route exists. |
| `registerMerchantAction` | Create email/password identity, enrich merchant fields, create wallet | Public | `registerSchema.safeParse` | Better Auth + `db.user.update` + `db.wallet.create` | `ApiResponse`; P2002 message; otherwise leaks raw error message | Partial / unsafe transaction boundary. |
| `loginAction` | Credential sign-in | Public | `loginSchema.safeParse` | Better Auth session read/write | `ApiResponse`; collapses common credentials errors | Partial / no lifecycle or cookie-bridge verification. |
| `forgotPasswordAction` | Intended password recovery request | Public | `forgotPasswordSchema.safeParse` | `db.user.findUnique` | Generic-ish result, but logs raw error to server console | Scaffold only; no token or email is sent. |
| `completeMerchantOnboardingAction` | Intended social-account profile completion | Session intended | `onboardingSchema.safeParse` | Better Auth session + Prisma transaction | Generic client error; logs raw error | Broken: uses fields not present in current Prisma schema/client. |

There are no routes for `/api/v1/balance`, `/api/v1/payouts`, `/api/v1/payouts/{id}`, `/api/v1/webhooks`, API keys, health checks, or external API authentication despite [`docs/api.md`](docs/api.md) and [`docs/architecture.md`](docs/architecture.md) describing them.

`successResponse` and `errorResponse` are used by both server actions and are internally consistent with `ApiResponse`, but they are not HTTP responses: they have no status code, correlation ID, error code, metadata, or redaction policy. `errorResponse` types `errorDetails` as `any`; when it is a non-array object it is assumed to be field errors. No route handler uses this abstraction, so the documented API response with `meta` is not implemented.

## 11. Frontend audit

### Implemented UI

- Landing page at `/` with navigation and responsive mobile menu: [`src/app/(public)/page.tsx`](src/app/(public)/page.tsx).
- Login and registration screens with loading states via `useTransition`, client validation, password visibility toggles, autocomplete attributes, Sonner toasts, and accessible labels: [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx), [`src/app/(auth)/register/page.tsx`](src/app/(auth)/register/page.tsx), [`src/components/auth/AuthShell.tsx`](src/components/auth/AuthShell.tsx).
- Static pending-approval display.
- Static terms and privacy pages, plus a newly added onboarding page whose server action is currently invalid against Prisma.
- UI primitives/configuration compatible with shadcn/Tailwind.

### Placeholder UI

- Forgot password now calls a server action but still reports recovery success without creating a token or sending any email.
- Pending approval is not tied to the current session or user status.
- Google sign-in is visible but has no usable local provider credentials and an unverified/misaligned client base URL.
- Landing-page claims such as live payouts, real-time dashboard, 99.99% uptime, processed volume, enterprise count, compliance certification, and settlement times have no code evidence and should be treated as marketing placeholders/unsupported claims.

### Missing UI

All merchant, admin, KYC, wallet, ledger, payout, developer/API-key, support, settings, blacklist, profile, legal terms, privacy, and logout interfaces are missing. `/terms` and `/privacy` links in the registration page also have no pages.

Accessibility is partially positive (semantic labels, button labels for password visibility), but there is no automated accessibility testing, error-summary/focus management, no verified keyboard/mobile test, and some animated, client-only complex pages need visual QA. The actual auth pages do not use React Hook Form or Zod Resolver, despite dependencies and requested stack expectations.

## 12. Routing and authorization audit

### Existing routes

| Class | Routes | Enforcement |
|---|---|---|
| Public | `/` | No auth needed. |
| Auth UI | `/login`, `/register`, `/forgot-password`, `/pending-approval`, `/onboarding` | No redirect rules for already-authenticated users; onboarding action is broken. |
| Legal/public | `/terms`, `/privacy` | Static content only; claims are not implementation evidence. |
| Auth protocol API | `/api/v1/auth/[...all]` | Better Auth handler only. |
| Merchant | None | Not implemented. |
| Admin | None | Not implemented. |
| KYC/payment | None | Not implemented. |
| Business APIs | None | Not implemented. |

No middleware/proxy file exists. There is no verified enforcement for authenticated users, merchant role, admin role, pending/active/suspended/deleted statuses, or ownership. `router.push('/dashboard')` references a missing, unprotected route.

## 13. Documentation audit

| Classification | Evidence |
|---|---|
| Documented and implemented | Basic Next/TypeScript/Tailwind scaffold; a Prisma schema; Better Auth route/config; landing page; two auth actions; standard action response payload. |
| Documented but not implemented | Merchant/admin portals, wallet workflows, fund approvals, API keys, payout REST APIs, idempotency headers, webhook endpoint, provider integrations, Redis caching/rate limiting, blacklist enforcement, support, reports, CSV/PDF exports, audit logging, middleware RBAC, KYC. See [`docs/architecture.md`](docs/architecture.md), [`docs/api.md`](docs/api.md), and [`README.md`](README.md). |
| Implemented but not fully documented | Actual login/register/pending/forgot-password UI pages and their current routing defects are not accurately described by the roadmap/release notes. |
| Outdated documentation | `README.md`, `CHANGELOG.md`, `docs/architecture.md`, and `docs/release-notes.md` say Next.js 15, while `package.json` pins Next 16.2.11. `docs/roadmap.md` leaves login/register enhancement, pending page, and forgot-password page unchecked even though their UI exists. |
| Contradictions | README calls the ledger “immutable double-entry,” but schema/code only provide single-wallet transaction records and no immutable enforcement. Docs claim working `/api/v1/payouts`, `/balance`, and webhook endpoints that are absent. Docs say optimistic locking prevents races; no query uses `Wallet.version`. Release notes claim defensive recovery prevents zombie accounts; registration only suspends an already-created user and can leave partial records. Deployment docs suggest `prisma db push` rather than versioned production migrations. The newly added legal pages claim active encrypted storage, TLS 1.3, payment routing, AML/blacklist controls, and compliance operations that the audited code does not implement. |

`CLAUDE.md` only refers to `AGENTS.md`. `AGENTS.md` requires consulting the installed Next.js documentation before writing Next code; no implementation changes were made in this audit. No `api.md` implementation evidence exists beyond the Better Auth route.

## 14. Dependency and configuration audit

### Installed runtime stack

- Next.js **16.2.11**, React/React DOM **19.2.4**, TypeScript **5.9.3**.
- Prisma **7.9.1** with `@prisma/adapter-pg` **7.9.0**, `pg` **8.22.0**.
- Better Auth **1.6.25**, Zod **4.4.3**, React Hook Form **7.84.0**, `@hookform/resolvers` **5.7.1**.
- Tailwind **4.3.3**, shadcn **4.16.1**, Sonner, Framer Motion, Lucide.
- Planned-but-unintegrated tooling includes `ioredis`, `pino`, `decimal.js`, CSV parsers, `file-saver`, `nanoid`, TanStack Table, Recharts, and bcryptjs.

`package.json` has only `dev`, `build`, `start`, and `lint` scripts. No test, migration, seed, check, format, typecheck, or CI scripts exist. Lockfile is npm `package-lock.json`; no obvious version conflict was found in `npm ls --depth=0` output.

The following are installed but have no visible use in tracked application behavior: Redis, logging, CSV/file export, payout arithmetic helper, API-key helper, data-table/chart tooling, and a direct bcrypt import. React Hook Form is referenced by generated `components/ui/form.tsx`, but neither auth page uses that component or `useForm`. These may be future planned dependencies rather than necessarily removable packages.

### Environment/configuration

Required variables in [`src/config/env.ts`](src/config/env.ts) and `.env.example` are `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `REDIS_URL`, and `NODE_ENV`. `env.ts` also now recognizes optional `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, but `.env.example` does not document them and they are absent locally. The actual local environment has each original required name populated; no value was printed.

Issues:

- `env.ts` requires a 16-character secret, while `.env.example` says at least 32. Enforce one policy, preferably the stricter documented policy.
- Redis is mandatory at startup even though no source consumes it; this adds deployment friction without a demonstrated feature.
- `next.config.ts` has no security headers, image/domain policy, logging, instrumentation, or deployment setting.
- No Prettier config exists though Prettier is installed.
- No deployment/IaC configuration exists. The Dockerfile in `docs/deployment.md` is an example only and should not be treated as an artifact.
- `dev.db` is ignored and the schema is PostgreSQL; source of truth must be the migration history, which is absent.

## 15. Testing audit

No unit, integration, E2E, auth, database, ledger, payout, security, or accessibility tests were found. No test framework configuration or test script exists. Coverage cannot be determined and is not estimated.

The read-only `npm run lint` command exceeded the 60-second audit limit before producing a result; do not record lint as passing. The dependency advisory query could not reach npm, so do not record it as passing or failing either.

## 16. Production-readiness assessment

Scores are based on current executable repository evidence, not design intent.

| Area | Score (0–10) | Rationale |
|---|---:|---|
| Architecture | 2 | A useful target schema/docs exist, but feature modules described by the architecture do not exist. |
| Security | 1 | Basic library choices and Zod exist; critical access-control, rate limiting, lifecycle checks, logging, and webhook controls do not. |
| Authentication | 2 | Better Auth is configured, but server-action cookie persistence is likely broken and lifecycle flows are absent. |
| Authorization | 0 | No guards or policy enforcement. |
| Database | 3 | Reasonable PostgreSQL/Prisma model starting point; no migration history or deployment verification. |
| Financial safety | 1 | Decimal columns and an idempotency constraint are positive schema choices, but no financial engine or double-entry design is implemented. |
| API | 1 | Better Auth handler only; documented business API is absent. |
| Frontend | 4 | Attractive public/auth visuals, but core product UI is absent and some auth views are placeholders. |
| Testing | 0 | No tests or usable coverage evidence. |
| Observability | 0 | No logger integration, audit writer, metrics, tracing, alerts, or health checks. |
| Documentation | 3 | Broad and readable, but substantially ahead of code and contains material inaccuracies. |
| Deployment | 1 | Environment template and prose exist; no migrations, CI, deployment artifact, or production proof. |

**Overall: 1.5 / 10 — pre-MVP foundation.** It is not production-ready, particularly not for financial operations.

## 17. Prioritized findings

### P0 — blocker

1. **Direct server-action authentication does not configure Better Auth's Next.js cookie bridge.**  
   **Evidence:** [`src/lib/auth.ts`](src/lib/auth.ts) lacks `nextCookies()`; [`src/actions/auth/register.ts`](src/actions/auth/register.ts) and [`src/actions/auth/login.ts`](src/actions/auth/login.ts) call `auth.api.*` directly; the only `toNextJsHandler` use is [`src/app/api/v1/auth/[...all]/route.ts`](src/app/api/v1/auth/[...all]/route.ts).  
   **Current behavior/risk:** Better Auth creates a session and emits cookies in its internal response context, but these actions do not propagate them into Next's response cookie store. Users can receive success messages without a durable HTTP-only browser session.  
   **Next step:** Establish one supported auth interaction pattern, add the required Next cookie integration/response propagation, and prove sign-up, sign-in, refresh, and sign-out through integration tests before any dependent work.

2. **No executable payout, wallet, ledger, or authorization implementation exists.**  
   **Evidence:** Only `schema.prisma` references `WalletTransaction`, `Payout`, `FundRequest`, `ApiKey`, and `AuditLog`; no source calls these models. No merchant/admin/business API routes exist.  
   **Current behavior/risk:** The product cannot safely operate as a payment/payout platform. Documentation and marketing imply functionality that code does not provide.  
   **Next step:** Do not accept or move funds. Complete authentication/authorization and a formally designed financial posting subsystem before exposing payout features.

2a. **The concurrently added onboarding action is incompatible with the current Prisma client.**  
   **Evidence:** [`src/actions/auth/onboarding.ts`](src/actions/auth/onboarding.ts) uses `Wallet.userId` and `AuditLog.entity`, `userId`, and `details`; generated Prisma types expose `merchantId`, `entityType`, `adminId`, and `metadata`.  
   **Current behavior/risk:** The project cannot type-check/build with this action as written, and the intended workflow would incorrectly demote any signed-in user to a pending merchant.  
   **Next step:** Reconcile the action with the actual schema and authorization model before attempting onboarding.

### P1 — critical

3. **No role/status/deletion enforcement exists.**  
   **Evidence:** `UserRole`/`UserStatus` are in [`prisma/schema.prisma`](prisma/schema.prisma); `loginAction` only calls `auth.api.signInEmail`; no middleware/proxy or session helper exists.  
   **Risk:** Pending, suspended, deleted, and admin accounts are not differentiated at login or routes. Future resources would be vulnerable to privilege escalation/unauthorized access.  
   **Next step:** Define a canonical authenticated principal and enforce user status/role on every protected route/action/API.

4. **Registration is not atomic across identity and merchant setup.**  
   **Evidence:** [`src/actions/auth/register.ts`](src/actions/auth/register.ts) calls `signUpEmail` before its later `db.$transaction` for `user.update` and `wallet.create`. Cleanup only updates status to `SUSPENDED`.  
   **Risk:** Orphan/partial identities, sessions, and unrecoverable retry states.  
   **Next step:** Design a transaction-compatible onboarding workflow with deterministic recovery and tested duplicate/partial-state behavior.

5. **No migration history; deployment docs recommend schema push.**  
   **Evidence:** `prisma/migrations` is absent; [`docs/deployment.md`](docs/deployment.md) instructs `prisma db push`.  
   **Risk:** No auditable, repeatable production schema lifecycle; financial schema drift is unacceptable.  
   **Next step:** Establish reviewed versioned migrations, migration deployment procedure, backup/rollback policy, and a database compatibility check.

6. **The stated ledger guarantees are unsupported and unsafe.**  
   **Evidence:** `WalletTransaction` is a single-wallet table; no account pair, posting service, trigger, version-check query, or reconciliation code exists.  
   **Risk:** Future balance drift, double-spend, unbalanced journal records, and inability to reconcile money movement.  
   **Next step:** Define the actual accounting model and invariants before implementing any financial mutation.

7. **Payout beneficiary data design stores sensitive bank data in plaintext.**  
   **Evidence:** `Payout.accountNumber`, `ifscCode`, `accountHolderName`, and `beneficiaryPhone` in [`prisma/schema.prisma`](prisma/schema.prisma); no encryption/tokenization code exists.  
   **Risk:** Exposure of sensitive financial PII in a database breach, logs, backups, or future UI/API output.  
   **Next step:** Define data classification, field-level protection/tokenization/masking, access policy, retention, and audit requirements before implementing writes.

### P2 — high

8. **Login redirects to a missing dashboard and “forgot password” is a fake success flow.**  
   **Evidence:** `router.push('/dashboard')` in [`src/app/(auth)/login/page.tsx`](src/app/(auth)/login/page.tsx); no dashboard route; `setTimeout` success in [`forgot-password/page.tsx`](src/app/(auth)/forgot-password/page.tsx).  
   **Risk:** Broken user journey and false security communication.  
   **Next step:** Do not present reset success without dispatching a reset request; route post-login based on verified user state.

9. **No rate limiting, brute-force defense, audit log writes, or operational logging.**  
   **Evidence:** No references to Redis or pino outside packages/config; logger imports are commented out in auth actions; `AuditLog` is unused.  
   **Risk:** Credential stuffing, lack of forensic evidence, and poor incident response.  
   **Next step:** Implement a reviewed rate-limit policy, structured/redacted logs, audit events, and monitoring after the core auth fix.

10. **Raw server error messages can be returned on registration.**  
   **Evidence:** [`src/actions/auth/register.ts`](src/actions/auth/register.ts) derives `message` from `error.message` and passes it to `errorResponse`.  
   **Risk:** Internal auth/database details can leak to attackers.  
   **Next step:** Return stable public error codes/messages and log redacted internal causality server-side.

11. **No email verification, password reset, logout, session retrieval, or session lifecycle tests.**  
   **Evidence:** `src/lib/auth.ts` has no `emailVerification` config, and source has no sign-out/get-session/reset calls.  
   **Risk:** Incomplete account lifecycle and no proof of session safety.  
   **Next step:** Complete and test all identity lifecycle flows before onboarding real merchants.

12. **Documentation materially overstates implementation and is version-stale.**  
   **Evidence:** docs/README advertise routes/features absent from `src/app`; they say Next.js 15 while `package.json` is Next 16.2.11.  
   **Risk:** Engineers and stakeholders will make invalid deployment/security assumptions.  
   **Next step:** Correct current-state docs as part of Phase 0; retain target architecture separately from verified availability.

### P3 — medium

13. **Schema-level soft deletion and optimistic locking are not implemented by application queries.**  
   **Evidence:** `deletedAt` and `Wallet.version` exist only in schema; no source query references either.  
   **Risk:** Unexpected exposure of soft-deleted records and future lost-update/race conditions.  
   **Next step:** Centralize query scopes and mutation rules once domain services are introduced.

14. **Validation policies are inconsistent/incomplete.**  
   **Evidence:** Registration password minimum is 8; login minimum is 6. Phone accepts any 10–15 characters after trim.  
   **Risk:** Confusing UX and insufficient normalization.  
   **Next step:** Establish a server-side shared policy, preferably with verified country/format requirements.

15. **API response design is action-only and lacks HTTP semantics.**  
   **Evidence:** `ApiResponse` has no status/error code/meta; no business route handler uses it.  
   **Risk:** Future external APIs cannot meet the documented response/status contract without new work.  
   **Next step:** Define external API error/status/idempotency conventions before creating routes.

### P4 — low

16. **Unused/future dependencies and generated UI files obscure the actual implementation surface.**  
   **Evidence:** Redis, pino, CSV/export, decimal, tables/charts, and API-key helpers have no tracked application behavior; many UI primitives are unconsumed.  
   **Risk:** Minor maintenance/supply-chain surface and inaccurate assumptions.  
   **Next step:** Keep only intentionally planned dependencies or track them as reserved architecture choices; do not remove them blindly during the baseline phase.

## 18. What has been done so far

### DONE

- Initialized a strict TypeScript Next.js App Router project with Tailwind/shadcn-oriented setup.
- Added a PostgreSQL-oriented Prisma 7 schema containing Better Auth models and a broad fintech target data model.
- Configured Prisma 7 runtime access through `@prisma/adapter-pg` and `pg` in [`src/lib/db.ts`](src/lib/db.ts).
- Configured Better Auth email/password and exposed its catch-all route at `/api/v1/auth/[...all]`.
- Added server-side Zod schemas for login and merchant registration.
- Added server actions for credential registration and login.
- Added a registration page that collects name, business name, email, phone, address, password, confirmation, and terms consent.
- Added login, pending-approval, and presentation-only forgot-password pages.
- Added terms/privacy pages and a Google/onboarding scaffold in concurrent uncommitted work; neither constitutes verified compliant/legal/OAuth/onboarding functionality.
- Added a full public marketing landing page and shared auth-page UI.
- Added a basic action response helper and an environment variable schema.
- Wrote architecture, API, database, deployment, roadmap, ERD, changelog, and release-note documents.

### PARTIAL

- Registration persists custom identity fields and creates a wallet **only after** Better Auth identity creation; atomicity/recovery is incomplete.
- Email/password auth calls Better Auth, but cookie/session handoff through the server actions is not correctly demonstrated/configured.
- Wallet/ledger, payouts, KYC, admin, API key, blacklist, support, and audit concepts are modeled in Prisma but have no implemented feature behavior.
- Route/pages visually exist for pending approval, reset, onboarding, terms, and privacy, but they are not connected to complete lifecycle functionality. The onboarding action currently conflicts with the Prisma schema.
- The response abstraction exists for server actions but not a complete HTTP API contract.

### NOT DONE

- Protected routes, session retrieval, logout, roles/status enforcement.
- Email verification, actual password reset/email delivery, notifications, and a working Google OAuth/onboarding flow.
- Merchant/admin dashboard and onboarding/KYC workflow.
- Financial posting engine, reconciliation, fund requests, payout engine/provider/webhooks, API key auth, idempotency handling.
- Rate limiting, logging/audit writes, monitoring, CI/CD, migrations, test suite, deployment artifacts.

## 19. Development roadmap from the actual current state

### Phase 0 — Correct the baseline

- Resolve the Next.js version documentation mismatch and replace feature claims with current availability.
- Reconcile or remove the uncommitted onboarding action's invalid Prisma field references before any build/deploy attempt.
- Correct the auth-client endpoint and either complete Google OAuth configuration/tests or disable the visible control; qualify legal/marketing claims that code cannot substantiate.
- Establish versioned Prisma migrations and verify the database schema without relying on `db push` for production.
- Repair/choose the supported Better Auth server-action/route cookie pattern and add integration proof.
- Remove false UI promises (or label them unavailable) for password reset, dashboard, terms, privacy, and claimed live capabilities.
- Define error redaction and public error code policy.

### Phase 1 — Complete authentication and authorization

- Implement and test sign-up, sign-in, persisted session retrieval/refresh, sign-out, password reset, and email verification.
- Define a canonical user lifecycle and enforce `PENDING`, `ACTIVE`, `SUSPENDED`, and `DELETED` states at sign-in and protected entry points.
- Add server-side role/ownership guard helpers and route protection before adding dashboards.
- Decide whether merchant profile fields remain in `User` or are moved into a controlled profile/onboarding model; preserve anti-mass-assignment rules.
- Implement rate limits and credential abuse controls.

### Phase 2 — Merchant onboarding

- Create real pending/onboarding/status pages backed by session and data.
- Define required merchant entity/profile/address/phone verification data, terms-version evidence, retention, and admin approval transitions.
- Add an admin-only merchant review workflow and audit events.

### Phase 3 — KYC and compliance

- Design KYC case/document/provider models, storage security, review transitions, reviewer permissions, and audit records.
- Do not use the existing `kycApprovedAt` alone as a KYC system; define evidence and failure/retry paths.

### Phase 4 — Wallet and ledger

- Decide and document the accounting system (true double-entry journals/accounts vs explicitly single-wallet operational ledger).
- Implement one transactional posting service with Decimal policy, balance invariants, version/lock strategy, immutable write access, idempotency, and reconciliation checks.
- Add fund-request creation and admin approval only after the posting service exists.
- Build exhaustive concurrent/duplicate/failure tests before exposing balances.

### Phase 5 — Payouts

- Define beneficiary-data protection and masking before persistence.
- Implement provider abstraction, payout validation, allowed state transitions, per-merchant idempotency, provider idempotency, retries, compensation/reversal, and reconciliation.
- Add signed/replay-safe webhook processing and asynchronous provider updates.
- Only then expose correctly authenticated/versioned payout and balance APIs.

### Phase 6 — Admin

- Build role-protected admin dashboard, merchant approval/suspension, fund review, blacklist, settings, and audit search features on top of established guards/services.
- Verify every action for ownership and lifecycle status.

### Phase 7 — Security and observability

- Add structured redacted logs, audit writer, metrics, tracing, alerting, health checks, secret management, security headers, backup/recovery and incident procedures.
- Conduct dependency, threat-model, authorization/IDOR, webhook, and data-protection reviews.

### Phase 8 — Testing

- Add unit tests for schemas/domain policies; integration tests for auth/session/migrations/postings; concurrency/idempotency tests; E2E tests for auth/onboarding/authorization; and security regression tests.
- Add lint/typecheck/test/coverage scripts and CI gates.

### Phase 9 — Production deployment

- Produce deployment/IaC configuration, migration deployment gate, environment parity, database backup/restore exercises, least-privilege DB roles, monitoring dashboards, alerting, runbooks, and release checklist.

## 20. File-by-file important findings

### FILE: `src/lib/auth.ts`

**Status:** Partial / critical integration gap  
**Purpose:** Better Auth configuration.  
**Important findings:** Uses Prisma PostgreSQL adapter, email/password, secret, and API base URL. Does not configure additional user fields, lifecycle hooks, email verification, cookie/session policy, trusted origins, or Next cookie bridge.  
**Risks:** Direct actions likely do not persist browser sessions; role/status absent from auth behavior.  
**Next action:** Complete the supported Next/Better Auth integration and tests.

### FILE: `src/lib/db.ts`

**Status:** Implemented connection factory, unverified at runtime  
**Purpose:** Prisma 7 client with `pg` driver adapter.  
**Important findings:** Uses `DATABASE_URL`, a pool, and non-production singleton reuse.  
**Risks:** No startup connectivity evidence, pool lifecycle policy, database migrations, or DB observability.  
**Next action:** Validate deployed database/migrations and resource behavior.

### FILE: `src/actions/auth/register.ts`

**Status:** Partial / unsafe failure handling  
**Purpose:** Merchant registration action.  
**Important findings:** Server Zod validation, explicit role/status, custom field update and wallet creation transaction.  
**Risks:** Cross-boundary partial onboarding, suspended orphan identity/session, raw error leakage.  
**Next action:** Redesign recovery/transaction boundary after auth pattern is settled.

### FILE: `src/actions/auth/login.ts`

**Status:** Partial  
**Purpose:** Email/password sign-in action.  
**Important findings:** Validation and generic credential error handling.  
**Risks:** No role/status/deletion checks; Remember me unused; session bridge unverified.  
**Next action:** Enforce lifecycle/authorization and test cookie-backed sign-in.

### FILE: `src/schemas/auth.ts`

**Status:** Implemented validation foundation  
**Purpose:** Login/register input schemas.  
**Important findings:** Email trim/lowercase, password bounds, server terms check.  
**Risks:** Phone is not canonicalized; login/registration password minima differ.  
**Next action:** Consolidate policy and add domain-specific normalization.

### FILE: `prisma/schema.prisma`

**Status:** Broad schema design only  
**Purpose:** Auth and intended fintech persistence model.  
**Important findings:** Proper decimal fields and useful initial constraints; many future models.  
**Risks:** No migrations, no enforcement logic, no true double-entry, plaintext payout PII, missing Account composite unique.  
**Next action:** Establish migration history and financial/security invariants before implementing writes.

### FILE: `src/app/api/v1/auth/[...all]/route.ts`

**Status:** Implemented Better Auth handler only  
**Purpose:** Routes Better Auth HTTP lifecycle endpoints.  
**Important findings:** Correctly delegates GET/POST to `toNextJsHandler`.  
**Risks:** Does not implement the documented business REST API.  
**Next action:** Keep separate from future API-key business routes.

### FILE: `src/app/(auth)/register/page.tsx`

**Status:** Implemented UI with partial backend  
**Purpose:** Merchant sign-up.  
**Important findings:** Good UX details; handwritten validation; redirects to pending page.  
**Risks:** No React Hook Form, no real consent evidence beyond boolean, relies on broken/unverified session action.  
**Next action:** Connect to tested auth/onboarding flow.

### FILE: `src/app/(auth)/login/page.tsx`

**Status:** Implemented UI with broken destination  
**Purpose:** Sign-in.  
**Important findings:** Password toggle/loading/toasts; Remember me state unused.  
**Risks:** Redirects to missing `/dashboard`; status ignored.  
**Next action:** Route based on verified principal/status.

### FILE: `src/app/(auth)/forgot-password/page.tsx`

**Status:** Partial placeholder  
**Purpose:** Password recovery UX.  
**Important findings:** Now calls `forgotPasswordAction`; that action only looks up the user and returns a message.  
**Risks:** Still falsely implies email delivery; raw caught errors are logged.  
**Next action:** Keep unavailable or implement full signed reset/email flow.

### FILE: `src/actions/auth/onboarding.ts`

**Status:** Broken uncommitted addition  
**Purpose:** Intended authenticated merchant-profile completion.  
**Important findings:** Retrieves a session and validates input, but its wallet/audit fields do not exist in the current schema/generated client.  
**Risks:** Type-check/build failure; incorrectly assigns `MERCHANT`/`PENDING` to any session user; no role check.  
**Next action:** Reconcile it with `Wallet.merchantId` and `AuditLog` fields and the authorization model before enabling the page.

### FILE: `src/lib/auth-client.ts`

**Status:** Partial uncommitted addition  
**Purpose:** Better Auth React client for Google UI and future session/logout use.  
**Important findings:** Uses app-root URL/default localhost instead of the configured auth handler base.  
**Risks:** Client calls will not necessarily reach `/api/v1/auth`; no OAuth credentials are present locally.  
**Next action:** Align the base URL and test the complete OAuth callback/session flow.

### FILES: `src/app/(public)/terms/page.tsx`, `src/app/(public)/privacy/page.tsx`

**Status:** Static legal UI, uncommitted additions  
**Purpose:** Present legal/privacy content.  
**Important findings:** Routes now exist and registration links open them.  
**Risks:** They state operational encryption, payout, AML, compliance, and retention facts that cannot be verified from this codebase.  
**Next action:** Obtain legal/compliance review and align text to deployed controls.

### FILE: `src/app/(public)/page.tsx`

**Status:** Implemented marketing UI  
**Purpose:** Product landing page.  
**Important findings:** Largest source file, responsive Framer Motion page.  
**Risks:** Contains unsupported live-product/compliance/volume claims.  
**Next action:** Align claims with verified capability/legal approval.

### FILES: `README.md`, `docs/architecture.md`, `docs/api.md`, `docs/database.md`, `docs/deployment.md`, `docs/roadmap.md`, `docs/release-notes.md`, `docs/ER_DIAGRAM.md`

**Status:** Architecture/product documentation  
**Purpose:** Describe intended system and setup.  
**Important findings:** Comprehensive target vision.  
**Risks:** Treat future claims as current implementation; Next 15 and working API/ledger assertions conflict with source.  
**Next action:** Split current-state/implemented documentation from target architecture.

### FILES: `package.json`, `next.config.ts`, `prisma.config.ts`, `.env.example`, `src/config/env.ts`

**Status:** Basic project configuration  
**Purpose:** Dependencies, runtime, Prisma CLI, environment validation.  
**Important findings:** Actual Next is 16.2.11; Prisma config expects migrations path; required env values are present locally.  
**Risks:** No migration/test scripts; 16 vs 32 secret-minimum mismatch; Redis required but unused; empty Next config.  
**Next action:** Add verified operational scripts/configuration only after Phase 0 decisions.

## 21. Final project snapshot

**Project:** PayERupee  
**Current stack:** Next.js 16.2.11, React 19.2.4, TypeScript 5.9.3, Tailwind 4.3.3, Prisma 7.9.1/PostgreSQL driver adapter, Better Auth 1.6.25, Zod 4.4.3, shadcn-compatible components.  
**Current phase:** Early foundation / pre-MVP authentication and schema scaffolding, with uncommitted auth/legal additions currently under development.  
**Estimated implementation state:** Approximately 10–15% of the documented product scope, justified by the small executable surface (landing/auth UI, two actions, one auth route) versus absent merchant/admin/financial/API/operational modules.  
**Completed:** Project UI foundation, initial auth configuration, Zod schemas/actions, broad schema draft, docs, and static legal routes.  
**Partially completed:** Registration/login, DB integration configuration, auth UI, wallet initialization schema/action, reset/OAuth/onboarding scaffolds.  
**Not implemented:** Secure session lifecycle, authorization, actual reset email, working OAuth onboarding, KYC, real wallet/ledger, payout engine, admin, API layer, webhooks, notifications, monitoring, tests, CI/CD, migrations.  
**Critical blockers:** Current onboarding action type/schema mismatch; server-action session cookie handoff; no authorization; no versioned database migrations; no financial posting/ledger engine; no tests.  
**Highest-priority next task:** Repair and integration-test the Better Auth sign-up/sign-in session handoff, then build status/role-enforced route protection before adding merchant features.

**Do not change unnecessarily:** Retain the existing baseline schema, visual auth/landing work, and response/input abstractions as starting points, but do not rely on their comments/doc claims as evidence of financial, security, or authorization correctness. Make Phase 0 fixes and establish tested invariants before expanding the feature surface.

BASELINE AUDIT COMPLETE

Inspected branch/commit: `main` / `0f02ec3a1b35878a0b1c72aa0a97c70dd8276293`
