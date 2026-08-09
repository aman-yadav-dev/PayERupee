# Authorization Architecture

- **Responsibility:** "What is this user allowed to do?"
- **Implementation:** Evaluated entirely server-side inside `src/services/`.
- **Role-Based:** `User.role` (ADMIN, MERCHANT).
- **Status-Based:** `MerchantProfile.accountStatus` (ACTIVE, PENDING) controls ability to access financial endpoints.\n