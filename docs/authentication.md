# Authentication Architecture

- **Responsibility:** "Who is this user?"
- **Provider:** Managed by **Better Auth**.
- **Boundaries:** Handles credentials, password hashing, Google OAuth, and secure session cookies (`HttpOnly`). It is separate from Authorization.\n