# State Machines

## KYC Status (`KycApplication`)
`PENDING_SUBMISSION` ➔ `UNDER_REVIEW` ➔ `APPROVED` | `REJECTED`

## Account Status (`MerchantProfile`)
`PENDING` (Can log in, cannot transact) ➔ `ACTIVE` (Full access) ➔ `SUSPENDED` (Locked out)

## Payout Status
`PENDING` ➔ `PROCESSING` ➔ `SUCCESS` | `FAILED` | `REVERSED`\n