# Security & Threat Model

## Currently Implemented Defenses

1. **IDOR Prevention:** The API exclusively pulls `merchantProfileId` from the authenticated Token/API Key. It is impossible for a user to specify `"merchantProfileId": "other_guy"` in the JSON body.
2. **Double Refund Prevention:** Natively blocked by strict Prisma transaction queries containing `{ where: { status: "PROCESSING" } }`.
3. **Webhook Duplicate Delivery:** Trapped by `IllegalStateTransitionError` and returns `200 OK` idempotently without crashing or executing duplicate math.
4. **API Key Hashing:** API keys are hashed via SHA-256 before DB lookup. If the database leaks, the keys remain secure.
5. **No Secret Leakage:** Provider and Webhook secrets live in Node.js environment variables. They are never written to disk, databases, or logs.

## Future Hardening (Phase 5)

1. **Webhook Raw-Body Cryptography:** Next.js currently consumes the raw body into JSON. This will be updated to buffer the raw stream for perfect HMAC cryptographic verification.
2. **API Rate Limiting:** Introduce an Upstash Redis or local rate-limiting middleware on all public endpoints.
3. **Key Expiration:** Update `src/lib/api-auth.ts` to assert `apiKey.expiresAt < new Date()`.
4. **Webhook Replay Protection:** A fast-cache system (Redis) to reject previously seen Webhook `Event ID`s before they hit the DB state machine.
