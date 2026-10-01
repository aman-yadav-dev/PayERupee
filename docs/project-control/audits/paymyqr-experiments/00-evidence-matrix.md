# PayMyQR Evidence Matrix

| Area | Assertion | Classification | Source |
| :--- | :--- | :--- | :--- |
| **Authentication** | Status API accepts `security_token` in JSON body. | **TEST-VERIFIED** | Non-financial Status ping |
| **Endpoint (Creation)** | `POST /transactions/batch` is the creation endpoint. | **DOCUMENTATION FACT** | Official PDFs |
| **Endpoint (Creation)** | `POST /transactions/batch` throws HTTP 405 Method Not Allowed. | **TEST-VERIFIED** | EXP-001 |
| **Endpoint (Creation)** | `GET /transactions/batch` is the actual functional creation endpoint. | **TEST-VERIFIED** | EXP-002, EXP-003, EXP-004 |
| **Parameter Placement** | Creation endpoint requires all parameters in URL Query String. | **TEST-VERIFIED** | EXP-002, EXP-003, EXP-004 |
| **Security** | IP Whitelisting is strictly enforced (fails on IPv6 defaults). | **TEST-VERIFIED** | EXP-003, EXP-004 |
| **Success Response** | Successful creation returns `HTTP 202 Accepted` (not 200). | **TEST-VERIFIED** | EXP-004 |
| **Identifiers** | Creation endpoint returns `transaction_id`, not `batch_transfer_id`. | **TEST-VERIFIED** | EXP-002, EXP-003, EXP-004 |
| **Identifiers** | Creation endpoint returns a `batch_id` field (nullable). | **TEST-VERIFIED** | EXP-004 |
| **Status API** | Returns `validation_failed` status if IP whitelist check fails. | **TEST-VERIFIED** | EXP-002, EXP-003 |
| **Status API** | Returns `processing` immediately after HTTP 202 acceptance. | **TEST-VERIFIED** | EXP-004 |
| **Status API** | Successful terminal state is `completed`. | **TEST-VERIFIED** | EXP-004 |
| **Status API** | `processed_at` populated with ISO 8601 timestamp upon completion. | **TEST-VERIFIED** | EXP-004 |
| **Idempotency** | `click_id` is a true idempotency key. | **TEST-VERIFIED** | EXP-005 |
| **Idempotency** | Duplicate `click_id` returns `HTTP 409 Conflict`. | **TEST-VERIFIED** | EXP-005 |
| **Retries** | Retrying a timeout/500 using the same `click_id` is safe from double-spends. | **TEST-VERIFIED** | EXP-005 |

