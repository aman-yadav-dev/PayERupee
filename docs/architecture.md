# PayERupee Core Architecture

## The 4-Layer Service Architecture

PayERupee implements a strict separation of concerns to protect financial integrity. The current implementation violates this by using "Fat Actions", but the Target Architecture is as follows:

1. **UI Layer (Next.js React Components)**
   - Location: `src/app/` and `src/components/`
   - Responsible strictly for rendering data and capturing user input.
   - **Rule:** Never executes database queries directly.

2. **Controller Layer (Server Actions / Route Handlers)**
   - Location: `src/actions/` and `src/app/api/`
   - The gatekeeper between the internet and the domain.
   - Validates incoming payloads using Zod schemas (`src/schemas/`).
   - Triggers the appropriate Service method.
   - **Rule:** Contains NO complex business logic or database queries.

3. **Service Layer (Domain Logic)**
   - Location: `src/services/`
   - The heart of the application.
   - Contains all financial rules, state machine enforcement, authorization checks, and business validations.
   - Executes atomic transactions via Prisma.
   - **Rule:** Only Services are allowed to mutate financial state or orchestrate multi-table updates.

4. **Data Access Layer (Prisma ORM)**
   - Location: `prisma/schema.prisma`
   - Maps the database to strictly typed TypeScript objects.
   - We do not use a separate "Repository" pattern layer because Prisma effectively serves as the Repository.\n