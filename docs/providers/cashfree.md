# Cashfree Provider Implementation Status

## Status Classifications
* **[VERIFIED FROM CODE]**: Logically proven inside `src/modules/provider/adapters/cashfree.provider.ts`.
* **[VERIFIED FROM OFFICIAL PROVIDER DOCUMENTATION]**: None currently documented here.
* **[UNKNOWN]**: Lacks documentation or verified implementation.
* **[ASSUMPTION CURRENTLY PRESENT IN CODE]**: Logic written into the adapter that may be incorrect.
* **[UNSAFE]**: Exists in code but poses financial risk.
* **[BLOCKED BY EXTERNAL INFORMATION]**: Cannot proceed safely without external input.

---

## Provider Architecture Context

The Cashfree provider implements the `IPayoutProvider` interface. It is currently available locally (commit `c96d94b`) but is intentionally excluded from the safe GitHub `origin/main` branch due to the following unsafe assumptions.

### [UNSAFE] Current Implementation Status
The current Cashfree implementation is **NOT SAFE FOR PRODUCTION** based on the verified audit. It invents financial semantics to fill gaps in knowledge.

---

## Detailed Analysis

### 1. Webhook Signature Verification
* **[VERIFIED FROM CODE]**: The code correctly executes basic HMAC SHA256 signature verification using the `x-webhook-signature` header.
* **[MISSING]**: Code fails to extract or validate the `x-webhook-timestamp` to enforce a 5-minute freshness window, leaving the system vulnerable to infinite webhook replay attacks.

### 2. Network Dispatch and Error Handling
* **[ASSUMPTION CURRENTLY PRESENT IN CODE]**: The code assumes that if the Cashfree API returns an HTTP 400 or 404, it is a definitive terminal rejection, immediately translating this to a `FAILED` state and triggering a refund.
* **[UNSAFE]**: If Cashfree occasionally returns 400 for a transient retryable error (e.g., rate limit or bad proxy), the system will permanently fail and refund the payout, leading to a race condition if Cashfree later processes the request.
* **[UNKNOWN]**: The exact JSON body returned when a duplicate idempotency key is submitted is unknown, making duplicate handling unverified.

### 3. Settlement Finality
* **[ASSUMPTION CURRENTLY PRESENT IN CODE]**: The adapter treats the `TRANSFER_SUCCESS` webhook event as absolute finality.
* **[UNKNOWN]**: It is unknown if `TRANSFER_SUCCESS` is truly irreversible, or if it represents an intermediate banking acknowledgment that could later result in a `TRANSFER_REVERSED` event.

### 4. Environments
* **[ASSUMPTION CURRENTLY PRESENT IN CODE]**: Assumes the V2 endpoint is `api.cashfree.com/payout/transfers`.
* **[UNKNOWN]**: Exact endpoint domains for sandbox vs production environments.

---

## Required Resolutions

The Cashfree provider is **[BLOCKED BY EXTERNAL INFORMATION]**. It cannot be pushed to production until official Cashfree contractual documentation is reviewed to confirm:
1. Exact HTTP code behaviors for duplicates.
2. Definitive list of terminal webhook states.
3. Official cryptographic timestamp validation requirements.
