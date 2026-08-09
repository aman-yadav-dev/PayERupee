# 4-Layer Service Architecture

PayERupee enforces strict separation of concerns to guarantee financial integrity:

1. **UI Layer (Next.js React Components)**
   - Renders data and captures user input. Must not execute database queries.

2. **Controller Layer (Server Actions / Route Handlers)**
   - The gatekeeper. Validates payloads using Zod. Triggers the appropriate Service method. No business logic.

3. **Service Layer (Domain Logic)**
   - The heart of the application (`src/services/`). Owns financial rules, state machine enforcement, and executes atomic Prisma transactions. Only layer allowed to mutate financial state.

4. **Data Access Layer (Prisma ORM)**
   - Maps database to strictly typed objects. Prisma serves directly as the Data Access layer.\n