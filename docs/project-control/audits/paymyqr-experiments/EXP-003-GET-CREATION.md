# EXP-003 — Whitelisted GET Transaction Creation
**Date:** 2026-08-28
**Environment:** PRODUCTION

## Objective
Execute a single ₹1 `GET` creation request after confirming the environment IP (`106.192.117.149`) was whitelisted by the user in the PayMyQR dashboard.

## Request Details
- **Method:** `GET`
- **URL Base:** `https://paymyqr.com/transactions/batch`
- **Parameters:** URL Query String (`vendor`, `transfer_mode`, `upi`, `amount`, `click_id`, `goal_id`, `remarks`, `security_token`)
- **Amount:** ₹1.00
- **Destination:** `yadavaman@upi`
- **click_id:** `exp003_1787899142127`

## Response
**HTTP Status:** `500 Internal Server Error`
**Headers:** `content-type: application/json`, `server: cloudflare`
**Body:**
```json
{"status":"error","message":"IP validation failed","transaction_id":"RA_6_TXN_0_26082806390439_7a44"}
```

## Follow-up Status API Verification
Queried `POST /transaction/status` with `transaction_id`.
**HTTP Status:** `200 OK`
**Body:**
```json
{"status":"success","data":{"transaction_id":"RA_6_TXN_0_26082806390439_7a44","click_id":"exp003_1787899142127","status":"validation_failed","amount":1,"upi_id":"yadavaman@upi","processed_at":null,"created_at":"2026-08-28T06:39:04.000000Z","user_message":"IP validation failed"}}
```

## Identifiers
- `transaction_id`: `RA_6_TXN_0_26082806390439_7a44`
- `batch_transfer_id`: None
- `batch_id`: None
- `click_id`: `exp003_1787899142127`

## Financial Outcome
No funds were moved. Despite the user whitelisting the IP, the transaction was rejected by PayMyQR security logic due to "IP validation failed", resulting in a terminal state of `validation_failed`.

## Classifications
- **TEST-VERIFIED:** The IP whitelisting rules at PayMyQR did not successfully propagate or recognize the outbound IP (`106.192.117.149`) for this transaction.
- **TEST-VERIFIED:** The transaction is persistently assigned `validation_failed` status by the provider when IP validation fails.
- **UNKNOWN:** Why PayMyQR rejected the request after the IP was whitelisted (e.g., propagation delay, proxy discrepancy, subnet mismatch, or account mismatch).
- **UNKNOWN:** Financial success mapping (since the transaction did not reach the financial execution layer).

