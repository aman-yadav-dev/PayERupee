# EXP-002 — GET Transaction Creation
**Date:** 2026-08-28
**Environment:** PRODUCTION

## Objective
Verify whether the documented Transfer API actually requires an HTTP `GET` request, matching the working PHP implementation, and record the exact response behaviors.

## Request Details
- **Method:** `GET`
- **URL Base:** `https://paymyqr.com/transactions/batch`
- **Parameters:** URL Query String (`vendor`, `transfer_mode`, `upi`, `amount`, `click_id`, `goal_id`, `remarks`, `security_token`)
- **Amount:** ₹1.00
- **Destination:** `yadavaman@upi`
- **click_id:** `exp002_1787898609273`

## Response
**HTTP Status:** `500 Internal Server Error`
**Headers:** `content-type: application/json`
**Body:**
```json
{"status":"error","message":"IP validation failed","transaction_id":"RA_6_TXN_0_26082806301154_e943"}
```

## Follow-up Status API Verification
Queried `POST /transaction/status` with `click_id`.
**HTTP Status:** `200 OK`
**Body:**
```json
{"status":"success","count":1,"data":[{"transaction_id":"RA_6_TXN_0_26082806301154_e943","click_id":"exp002_1787898609273","status":"validation_failed","amount":1,"upi_id":"yadavaman@upi","processed_at":null,"created_at":"2026-08-28T06:30:11.000000Z","user_message":"IP validation failed"}]}
```

## Identifiers
- `transaction_id`: `RA_6_TXN_0_26082806301154_e943`
- `batch_transfer_id`: None (Does not exist in response)
- `batch_id`: None
- `click_id`: `exp002_1787898609273`

## Financial Outcome
No funds were moved. The transaction was intercepted by PayMyQR security layer due to "IP validation failed", resulting in a terminal state of `validation_failed`.

## Classifications
- **TEST-VERIFIED:** The working HTTP method for `/transactions/batch` is `GET`. Sending a `GET` successfully parses the parameters and initiates transaction creation logic on the provider side.
- **TEST-VERIFIED:** PayMyQR enforces IP whitelisting for the creation endpoint. If the IP is not whitelisted, the transaction is created in the database but instantly transitions to `validation_failed`, returning HTTP 500.
- **TEST-VERIFIED:** The creation response returns `transaction_id`, contrary to the PDF which claimed it returned `batch_transfer_id`.
- **TEST-VERIFIED:** The Status API returns an array `data: [{...}]` when queried by `click_id`, and an object `data: {...}` when queried by `transaction_id`.
- **UNKNOWN:** Idempotency of `click_id` is still unproven, as we only sent it once.
- **UNKNOWN:** Retries are still unsafe, as we do not know if a 500 without a body or timeout creates a transaction.

