# Phase 4 Blocker Report: PayMyQR Implementation Readiness
**Date:** 2026-08-28

## Proven Facts
- The configured `PAYMYQR_BASE_URL` is: `https://paymyqr.com`
- Authentication/connectivity to the PayMyQR server is proven (the Status API successfully processes authentication).
- The provided PayMyQR PDFs document `POST https://paymyqr.com/transactions/batch?vendor=xyz`.
- No alternative creation endpoint or HTTP method was found in the provided PDFs.
- No transaction was created and no funds moved during the creation attempt.

## Test-Verified Facts
- The Status API connectivity/authentication check returned HTTP 404 with: `{"status":"error","message":"Transaction not found","error_code":"TRANSACTION_NOT_FOUND"}`.
- "The documented POST creation endpoint returned HTTP 405 in the current production environment."

## Unknowns
- Why the documented endpoint returns 405.
- Whether PayMyQR has changed the endpoint.
- Whether account/vendor configuration affects availability.
- Whether another official creation endpoint exists outside the provided documentation.
- Whether `click_id` is idempotent.
- What happens when the same `click_id` is submitted twice.
- Whether retries after timeout/500/connection reset are safe.
- What `can_retry` means.
- Whether 404 is strongly consistent.
- Whether webhooks exist.
- The relationship between `batch_transfer_id` and `transaction_id`.

## Safety Implications
PayMyQR integration cannot proceed because we lack a working transfer endpoint and have zero proof of provider idempotency. Attempting to design the outbox or retries without this knowledge carries massive double-spend risk. Strict AT-MOST-ONCE dispatch remains the TEMPORARY SAFETY POLICY. It is NOT the final architecture decision.

## Exact Information Required from PayMyQR Before Implementation
A. Current production transfer creation endpoint and HTTP method.
B. Exact required headers and request body.
C. Whether `click_id` is a true idempotency key.
D. Exact behavior when the same `click_id` is submitted twice.
E. Whether duplicate financial transfers are possible.
F. Safe retry behavior after HTTP 500, timeout, connection reset, and unknown response.
G. Exact meaning of `can_retry`.
H. Relationship between `click_id`, `batch_transfer_id`, `transaction_id`, and `batch_id`.
I. Exact meaning and finality of `RECEIVED`/`pending`/`processing`/`completed`/`failed`/`cancelled`.
J. Meaning and consistency of HTTP 404 from status API.
K. Whether webhooks exist and their delivery/authentication semantics.
L. Whether a sandbox/test environment exists.

## Independent PayERupee Work (Can Continue)
The following core infrastructure can be maintained/extended independently of the PayMyQR adapter:
- Prisma schema, OCC concurrency logic, and ledger math.
- The cron polling reconciler logic (using MOCK adapter).
- The outbox background worker scaffolding.
- Cashfree remains DEFERRED / REFERENCE ONLY.

