# OGFI Inventory

Backend scaffold for the OGFI centralized inventory and costing system.

Implementation progress is tracked in [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md).

## What is included

- NestJS API workspace at `apps/api`
- Next.js UI workspace at `apps/web`
- Prisma schema for inventory ledger, costing inputs, purchasing, transfers, branch operations, reports, audit logs, and offline sync
- REST route stubs matching the UI/API blueprint
- UI shell, design tokens, exact lucide icon registry, and module screen scaffolds
- PostgreSQL and Redis services in `docker-compose.yml`
- Environment template at `apps/api/.env.example`

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the API environment file:

   ```bash
   cp apps/api/.env.example apps/api/.env
   ```

3. Start infrastructure:

   ```bash
   docker compose up -d
   ```

4. Generate Prisma client and run migrations:

   ```bash
   npm run api:prisma:generate
   npm run api:prisma:migrate
   ```

5. Start the API:

   ```bash
   npm run api:dev
   ```

Swagger will be available at `http://localhost:3000/api/docs`.

6. Start the UI:

   ```bash
   npm run web:dev
   ```

The UI will be available at `http://localhost:3001`.

## Next backend step

Replace route placeholders with DTOs, guards, and transactional service-layer implementations, starting with auth/RBAC and the immutable ledger posting engine.
