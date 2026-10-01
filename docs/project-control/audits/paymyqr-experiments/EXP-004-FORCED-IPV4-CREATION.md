# EXP-004 — Forced IPv4 GET Transaction Creation
**Date:** 2026-08-28
**Environment:** PRODUCTION

## Objective
Execute a single ₹1 `GET` creation request while explicitly forcing the Node.js TLS socket to route over IPv4 (`family: 4`) to bypass the IPv6 default routing mismatch, ensuring the request hits the provider from the whitelisted `106.192.117.149` IP.

## Request Details
- **Method:** `GET`
- **Forced Routing:** IPv4 Only
- **URL Base:** `https://paymyqr.com/transactions/batch`
- **Parameters:** URL Query String (`vendor`, `transfer_mode`, `upi`, `amount`, `click_id`, `goal_id`, `remarks`, `security_token`)
- **Amount:** ₹1.00
- **Destination:** `yadavaman@upi`
- **click_id:** `exp004_1787899535861`

## Socket Verification
- `socket.remoteFamily`: `IPv4`
- `socket.remoteAddress`: `172.67.128.81`
- `socket.localAddress`: `10.98.125.111` (NAT internal IP bound to `106.192.117.149`)

## Response
**HTTP Status:** `202 Accepted`
**Body:**
```json
{"status":"success","message":"Transaction queued for processing","transaction_id":"RA_6_TXN_0_26082806453795_986d","batch_id":null}
```

## Follow-up Status API Verification (Initial)
Queried `POST /transaction/status` (forced IPv4) with `transaction_id`.
**HTTP Status:** `200 OK`
**Body:**
```json
{"status":"success","data":{"transaction_id":"RA_6_TXN_0_26082806453795_986d","click_id":"exp004_1787899535861","status":"processing","amount":1,"upi_id":"yadavaman@upi","processed_at":null,"created_at":"2026-08-28T06:45:37.000000Z","user_message":null}}
```

## Status Polling (Reconciliation)
A delayed read-only poll was executed at 12:20 IST.
**Transition Observed:** `processing` -> `completed`
**Terminal State:**
- `status`: `completed`
- `processed_at`: `2026-08-28T06:45:41.000000Z`
- `amount`: `1` (Confirmed)
- `upi_id`: `yadavaman@upi` (Confirmed)
- `user_message`: `Transaction completed successfully`

## Identifiers
- `transaction_id`: `RA_6_TXN_0_26082806453795_986d`
- `batch_transfer_id`: None
- `batch_id`: `null` (Returned in creation response)
- `click_id`: `exp004_1787899535861`

## Financial Outcome
The transaction successfully bypassed the IP firewall, was accepted for processing, and completed. Funds were successfully processed exactly 4 seconds after creation (`06:45:37` -> `06:45:41` UTC).

## Classifications
- **TEST-VERIFIED:** The official production API contract for PayMyQR transfers is fundamentally different from the PDF documentation. It requires `GET` with URL-encoded query parameters.
- **TEST-VERIFIED:** A successful creation returns `HTTP 202 Accepted` with `transaction_id` at the JSON root.
- **TEST-VERIFIED:** The transaction transitions from `processing` to `completed` upon success.
- **TEST-VERIFIED:** `processed_at` is populated with an ISO-8601 timestamp upon completion.
- **INFERENCE:** The `batch_transfer_id` property from the PDF appears entirely deprecated in favor of `transaction_id` and `batch_id`.
- **UNKNOWN:** Whether `click_id` is truly idempotent. (We did not submit duplicates).
- **UNKNOWN:** Whether retries are safe after an HTTP 500, timeout, or connection reset.

