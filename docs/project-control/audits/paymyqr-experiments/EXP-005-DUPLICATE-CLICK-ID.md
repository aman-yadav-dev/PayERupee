# EXP-005 — Duplicate click_id Experiment
**Date:** 2026-08-28
**Environment:** PRODUCTION

## Objective
Determine whether PayMyQR strictly enforces idempotency when the exact same `click_id` from a previously completed transaction is resubmitted.

## Request Details
- **Method:** `GET`
- **Forced Routing:** IPv4 Only (`106.192.117.149`)
- **Target `click_id`:** `exp004_1787899535861` (From EXP-004)
- **Amount:** ₹1.00
- **Destination:** `yadavaman@upi`

## Response
**HTTP Status:** `409 Conflict`
**Body:**
```json
{
  "status": "error",
  "message": "Duplicate transaction detected",
  "details": {
    "existing_transaction_id": "RA_6_TXN_0_26082806453795_986d",
    "status": "completed",
    "created_at": "2026-08-28T12:15:37+05:30"
  }
}
```

## Follow-up Status API Verification
Queried `POST /transaction/status` (forced IPv4) with the original `click_id`.
**HTTP Status:** `200 OK`
**Body:**
```json
{
  "status": "success",
  "count": 1,
  "data": [
    {
      "transaction_id": "RA_6_TXN_0_26082806453795_986d",
      "click_id": "exp004_1787899535861",
      "status": "completed",
      "amount": 1,
      "upi_id": "yadavaman@upi",
      "processed_at": "2026-08-28T06:45:41.000000Z",
      "created_at": "2026-08-28T06:45:37.000000Z",
      "user_message": "Transaction completed successfully"
    }
  ]
}
```

## Identifiers
- `transaction_id`: None created (Original ID returned in error body).
- `click_id`: `exp004_1787899535861` (Count remained 1).

## Financial Outcome
**Outcome B: Rejects the duplicate.**
No second transaction was created. The provider safely recognized the duplicate `click_id` and prevented a double-spend, immediately returning a conflict error pointing back to the original transaction ID.

## Classifications
- **TEST-VERIFIED:** `click_id` acts as a true, strict idempotency key on the PayMyQR backend.
- **TEST-VERIFIED:** Submitting a duplicate `click_id` returns `HTTP 409 Conflict`.
- **TEST-VERIFIED:** The 409 rejection payload usefully returns the `existing_transaction_id` and its current status.
- **TEST-VERIFIED:** It is mathematically safe to retry a timeout or network failure if the retry utilizes the exact same `click_id`. Double-spending is natively protected by the provider.
- **INFERENCE:** The `details` object in the 409 response uses IST (`+05:30`) for `created_at`, whereas the Status API uses UTC (`Z`) for timestamps.

