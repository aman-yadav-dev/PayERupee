# PayERupee Master Roadmap

## PHASE 1–4
**Financial Engine & Authentication**
*COMPLETED*

## PHASE 5
**Provider-Neutral Production Hardening**
*COMPLETED*

Includes:
- API key expiration
- raw-body webhook verification boundary
- provider-neutral outcome taxonomy
- provider configuration boundary
- conceptual logging boundary
- conceptual rate-limit boundary

**IMPORTANT LIMITATIONS (End of Phase 5):**
1. Rate limiting is currently architectural only and is NOT production enforcement.
2. Webhook replay protection currently relies on payout state-machine idempotency.
3. Cryptographic/provider-event replay protection will be introduced when the real provider webhook contract is implemented.
4. No real Razorpay/Cashfree provider currently exists.
5. No reconciliation worker currently exists.
6. No funding/UTR flow currently exists.
7. No merchant/admin UI currently exists.

## PHASE 6
**First Real Provider Integration**
*FUTURE*

This phase will implement the first actual provider only after provider credentials/API access are available.
Potential providers: Razorpay, Cashfree, or another approved provider.
The provider implementation MUST implement the existing provider-neutral interface and MUST NOT modify wallet/ledger financial primitives.

## PHASE 7
**Provider Reconciliation**
*FUTURE*
Build reconciliation for ambiguous PROCESSING payouts using provider status APIs.

## PHASE 8
**Merchant Funding / UTR Top-Up**
*FUTURE*

## PHASE 9
**Merchant Portal**
*FUTURE*

## PHASE 10
**Admin Portal**
*FUTURE*

## PHASE 11
**Developer Platform / API Documentation**
*FUTURE*

## PHASE 12
**Production Observability**
*FUTURE*

## PHASE 13
**Security / Penetration Testing**
*FUTURE*

## PHASE 14
**Scale / Multi-Provider Routing**
*FUTURE*