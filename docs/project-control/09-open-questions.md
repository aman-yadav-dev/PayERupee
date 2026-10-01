# Open Questions
**Date:** 2026-08-28

## Phase 4 Blocker Questions (Required from PayMyQR)
A. Current production transfer creation endpoint and HTTP method.
B. Exact required headers and request body.
C. Whether click_id is a true idempotency key.
D. Exact behavior when the same click_id is submitted twice.
E. Whether duplicate financial transfers are possible.
F. Safe retry behavior after HTTP 500, timeout, connection reset, and unknown response.
G. Exact meaning of can_retry.
H. Relationship between click_id, batch_transfer_id, transaction_id, and batch_id.
I. Exact meaning and finality of RECEIVED/pending/processing/completed/failed/cancelled.
J. Meaning and consistency of HTTP 404 from status API.
K. Whether webhooks exist and their delivery/authentication semantics.
L. Whether a sandbox/test environment exists.

