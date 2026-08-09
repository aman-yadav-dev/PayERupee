# PayERupee Core Architecture

## The 4-Layer Service Architecture

PayERupee implements a strict separation of concerns to protect financial integrity:

1. **UI Layer (Next.js React Components)**
   - Responsible strictly for rendering data and capturing user input.
   - **Rule:** Never executes database queries directly.

2. **Controller Layer (Server Actions / Route Handlers)**
   - The gatekeeper between the internet and the domain.
   - Validates incoming payloads using Zod schemas.
   - Triggers the appropriate Service method.
   - **Rule:** Contains NO complex business logic or database queries.

3. **Service Layer (Domain Logic)**
   - The heart of the application (`src/services`).
   - Contains all financial rules, state machine enforcement, and business validations.
   - Executes atomic transactions via Prisma.
   - **Rule:** Only Services are allowed to mutate financial state.

4. **Data Access Layer (Prisma ORM)**
   - Maps the database to strictly typed TypeScript objects.
   - We do not use a separate "Repository" pattern layer because Prisma effectively serves as the Repository. Adding an abstraction over Prisma in Next.js adds unnecessary complexity.\n