# EXP-001 — Basic Transaction Creation

## Objective
Determine the actual creation response for a ₹1 controlled transaction. Record returned identifiers and initial status.

## Date
2026-08-28

## Environment
PRODUCTION

## Safety Approval
Explicitly approved by user on 2026-08-28 for exactly ₹1 to `yadavaman@upi`.

## Financial Amount
₹1.00

## Destination
`yadavaman@upi`

## API Endpoint
`POST https://paymyqr.com/transactions/batch?vendor=[REDACTED]`

## Request
```json
{
  "security_token": "[REDACTED]",
  "transfer_mode": "upi",
  "upi": "yadavaman@upi",
  "amount": 1.00,
  "click_id": "exp001_1787896389878",
  "goal_id": "test_exp",
  "remarks": "EXP-001"
}
```

## Response
**HTTP Status:** `405 Method Not Allowed`
**Response Body:** An HTML error page indicating "The server returned a 405 Method Not Allowed".

## Observed Identifiers
None. 

## Status History
N/A

## Financial Outcome
No transaction was created and no funds moved.

## Classification
**TEST-VERIFIED:** 
"The documented POST creation endpoint returned HTTP 405 in the current production environment."

**UNKNOWN / NOT PROVEN:**
- Why the documented endpoint returns 405.
- Whether PayMyQR has changed the endpoint.
- Whether account/vendor configuration affects availability.
- Whether another official creation endpoint exists outside the provided documentation.
- Whether click_id is idempotent.
- What happens when the same click_id is submitted twice.
- Whether retries after timeout/500/connection reset are safe.
- What can_retry means.
- Whether 404 is strongly consistent.
- Whether webhooks exist.
- The relationship between batch_transfer_id and transaction_id.

## Final Conclusion
1. The provided PayMyQR PDFs document: `POST https://paymyqr.com/transactions/batch?vendor=xyz`
2. Our configured `PAYMYQR_BASE_URL` is correctly: `https://paymyqr.com`
3. The constructed URL matched the documented endpoint.
4. A live POST to that exact documented endpoint returned HTTP 405 Method Not Allowed.
5. No transaction was created and no funds moved.
6. No alternative creation endpoint or HTTP method was found in the provided PDFs.

