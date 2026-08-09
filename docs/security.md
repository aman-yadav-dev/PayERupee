# Security Architecture

- **Defense in Depth:** Input validated at the Controller (Zod). Authorization verified at the Service.
- **No Trust in Clients/Middleware:** Middleware serves only for UX (routing). Real authorization (`accountStatus === 'ACTIVE'`) is asserted strictly server-side inside the Service layer.
- **Webhooks & External APIs:** Secured via HMAC SHA-256 signatures and API Keys (not session cookies).\n