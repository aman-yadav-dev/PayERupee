# PayERupee Gateway REST API Specification (v1)

**Base URL:** `https://api.payerupee.com/api/v1` (Production) / `http://localhost:3000/api/v1` (Development)  
**Standard Format:** JSON (`Content-Type: application/json`)  

---

## 1. Authentication & Headers

All external API calls must provide the Merchant API Key and appropriate operational headers.

| Header | Type | Description | Required |
| :--- | :--- | :--- | :--- |
| `X-API-KEY` | String | Live or Test Merchant API Key (`paye_live_...` / `paye_test_...`) | Yes |
| `Idempotency-Key` | String | Unique UUID string to prevent duplicate payouts on network retries | Yes (for mutations) |
| `Content-Type` | String | `application/json` | Yes |

---

## 2. Standardized Response Format

Every endpoint returns a consistent JSON payload:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {},
  "error": null,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

---

## 3. Endpoints

### A. Check Wallet Balance
Retrieves the real-time available balance for the authenticated merchant.

* **Method:** `GET`
* **Path:** `/api/v1/balance`
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Balance fetched successfully",
  "data": {
    "currency": "INR",
    "availableBalance": "125000.5000",
    "isActive": true
  },
  "error": null
}
```

---

### B. Create Single Payout
Initiates an outbound bank transfer or UPI payout.

* **Method:** `POST`
* **Path:** `/api/v1/payouts`
* **Headers:** `Idempotency-Key: <unique-uuid>`
* **Request Body:**
```json
{
  "amount": 5000.00,
  "paymentMode": "IMPS",
  "accountNumber": "98765432101234",
  "ifscCode": "HDFC0001234",
  "accountHolderName": "Ramesh Kumar",
  "beneficiaryPhone": "9876543210",
  "merchantReference": "ORDER_REF_99182",
  "notes": "March Vendor Payout"
}
```
* **Response (201 Created):**
```json
{
  "success": true,
  "message": "Payout initiated successfully",
  "data": {
    "id": "payout_cuid123456",
    "amount": "5000.0000",
    "fee": "5.0000",
    "tax": "0.9000",
    "netAmount": "5005.9000",
    "status": "PENDING",
    "paymentMode": "IMPS",
    "accountNumber": "98765432101234",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Ramesh Kumar",
    "createdAt": "2026-08-04T12:00:00.000Z"
  },
  "error": null
}
```

---

### C. Get Payout Status
Fetches the current state and bank reference of an existing payout.

* **Method:** `GET`
* **Path:** `/api/v1/payouts/{id}`
* **Response (200 OK):**
```json
{
  "success": true,
  "message": "Payout details retrieved",
  "data": {
    "id": "payout_cuid123456",
    "status": "SUCCESS",
    "bankReference": "UTR992817264",
    "processedAt": "2026-08-04T12:00:05.000Z"
  },
  "error": null
}
```

---

## 4. HTTP Status Codes

| Code | Status | Meaning |
| :--- | :--- | :--- |
| `200` | OK | Request processed successfully. |
| `201` | Created | Resource (e.g. Payout) initiated. |
| `400` | Bad Request | Validation failure or invalid parameters. |
| `401` | Unauthorized | Missing or invalid `X-API-KEY`. |
| `402` | Payment Required | Insufficient wallet balance for payout + fees. |
| `403` | Forbidden | Merchant account suspended or IP not whitelisted. |
| `409` | Conflict | Duplicate `Idempotency-Key` or resource conflict. |
| `429` | Too Many Requests | Rate limit exceeded. |
| `500` | Internal Error | Server error. |
