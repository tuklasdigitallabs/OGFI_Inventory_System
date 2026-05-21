# OGFI Inventory Implementation Guide

This is the living handoff and progress tracker for implementing the OGFI centralized inventory and costing system.

## Operating Rule

- Do not mark a phase as completed until the developer confirms it has been tested and completed.
- Do not move to the next phase until the current phase has user sign-off.
- Each phase must include implementation notes, test evidence, known issues, and the sign-off date before its status changes to `Completed`.
- Every guide update must include significant implementation notes when applicable, especially major code changes, feature additions, feature removals, schema/migration changes, dependency changes, API contract changes, UI behavior changes, and known risks.
- If a phase is partially implemented but not verified, its status remains `In Progress`.
- If work is paused, update the current phase notes before stopping.

## Status Legend

- `Not Started`: No implementation work has begun.
- `In Progress`: Implementation work has started, but testing/sign-off is not complete.
- `Blocked`: Work cannot continue without a decision, tool fix, dependency, or external input.
- `Ready For Test`: Implementation is complete enough for verification, but user sign-off is pending.
- `Completed`: Tested, accepted, and explicitly approved by the developer.

## Current Phase

Admin Settings Catch-Up

Current status: `Ready For Test`

Next action: validate user creation, role permission updates, user deactivation, and audit-log visibility before continuing Phase 12 work.

## Phase Checklist

| Phase | Name                                             | Status         | User Sign-Off |
| ----- | ------------------------------------------------ | -------------- | ------------- |
| 0     | Environment, Dependency, and Baseline Validation | Completed      | 2026-05-05    |
| 1     | Database Migration and Seed Foundation           | Completed      | 2026-05-05    |
| 2     | Auth, RBAC, and Location Access                  | Completed      | 2026-05-05    |
| 3     | Immutable Ledger Engine                          | Completed      | 2026-05-05    |
| 4     | Stock On Hand and Moving Average Costing         | Completed      | 2026-05-05    |
| 5     | Inventory UI Wired to Real Data                  | Completed      | 2026-05-05    |
| 6     | Master Data CRUD                                 | Completed      | 2026-05-05    |
| 7     | Purchasing and Supplier Receiving                | Completed      | 2026-05-07    |
| 8     | Transfers and Variance Workflow                  | Completed      | 2026-05-09    |
| 9     | Branch Operations                                | In Progress    | Pending       |
| 10    | Reports and Exports                              | Ready For Test | Pending       |
| 11    | Offline PWA Sync                                 | In Progress    | Pending       |
| Admin | Admin Settings Catch-Up                          | Ready For Test | Pending       |
| 12    | Deployment Hardening and Production Readiness    | Not Started    | Pending       |

## Phase 0: Environment, Dependency, and Baseline Validation

Status: `Completed`

Goal: establish a working local development baseline for API, web, Prisma, and database services.

Implementation checklist:

- [x] Confirm Node/npm can run from the chosen terminal environment.
- [x] Run `npm install`.
- [x] Confirm workspace scripts are available.
- [x] Start PostgreSQL and Redis using `docker compose up -d`.
- [x] Validate Prisma schema using `npm run api:prisma:generate`.
- [x] Build API using `npm run api:build`.
- [x] Build UI using `npm run web:build`.
- [x] Confirm API dev server can start.
- [x] Confirm web dev server can start.

Acceptance criteria:

- API build passes.
- Web build passes.
- Prisma client generation passes.
- PostgreSQL and Redis are reachable.
- No unresolved scaffold/config blockers remain.

Implementation notes:

- 2026-05-05: Root workspace scripts are present for API dev/build, Prisma generate/migrate, web dev/build, and web lint.
- 2026-05-05: `node_modules` and `package-lock.json` exist, so dependencies appear to have been installed previously, but npm cannot currently run from this terminal to verify or refresh them.
- 2026-05-05: API and web scaffolds exist. API modules and controllers are present, but service implementations still return placeholder responses. The web shell and screens exist, but inventory/dashboard data is static mock data.
- 2026-05-05: Docker compose defines PostgreSQL 16 and Redis 7 services, but Docker is not reachable from the current WSL shell.
- 2026-05-05: Phase 0 validation succeeded by running the Windows Node/npm toolchain through `cmd.exe` and Docker Desktop through `docker.exe`. Plain WSL `node`, `npm`, and `docker` commands still are not the runnable path in this shell.
- 2026-05-05: Created ignored local file `apps/api/.env` from `apps/api/.env.example` for development server validation.
- 2026-05-05: API and web dev servers both started successfully and were stopped after validation. API Swagger responded from Windows curl at `http://localhost:3000/api/docs`; web responded from Windows curl at `http://localhost:3001`.
- 2026-05-05: `npm install` reported 29 audit findings: 4 low, 16 moderate, and 9 high. No dependency changes were made during Phase 0.

Test evidence:

- Commands run:
  - `node --version`
  - `npm --version`
  - `npm run`
  - `docker compose ps`
  - `/mnt/c/nvm4w/nodejs/node.exe --version`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\node.exe --version"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd --version"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd install"`
  - `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -Command "Start-Process -FilePath 'C:\Program Files\Docker\Docker\Docker Desktop.exe'"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe version`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe compose up -d`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe compose ps`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:dev"`
  - `/mnt/c/Windows/System32/cmd.exe /C "curl -I http://localhost:3000/api/docs"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:dev"`
  - `/mnt/c/Windows/System32/cmd.exe /C "curl -I http://localhost:3001"`
- Results:
  - `node --version` failed because `node` is not found in the current shell.
  - `npm --version` and `npm run` failed with `WSL 1 is not supported. Please upgrade to WSL 2 or above. Could not determine Node.js install directory`.
  - `docker compose ps` failed because Docker is not available in this WSL distro.
  - `/mnt/c/nvm4w/nodejs/node.exe --version` failed from WSL with `UtilBindVsockAnyPort` socket error, even though `node.exe`, `npm`, and `npm.cmd` exist under `/mnt/c/nvm4w/nodejs`.
  - Windows Node via `cmd.exe` returned `v20.20.1`.
  - Windows npm via `cmd.exe` returned `10.8.2`.
  - Workspace scripts listed successfully.
  - `npm install` completed successfully; dependency tree was already up to date.
  - Docker Desktop started successfully.
  - Docker Engine responded successfully: Docker Desktop 4.62.0, engine 29.2.1.
  - Docker Compose started PostgreSQL and Redis successfully.
  - `docker.exe compose ps` showed PostgreSQL `healthy` and Redis `Up`.
  - Prisma Client generated successfully.
  - API build passed.
  - Web build passed and generated static routes.
  - API dev server started successfully; Windows curl returned `HTTP/1.1 200 OK` for `/api/docs`.
  - Web dev server started successfully; Windows curl returned `HTTP/1.1 200 OK` for `/`.
- Issues found:
  - Plain WSL commands `node`, `npm`, and `docker` remain unavailable or misrouted in this shell; use the validated Windows command paths until WSL-native tooling is installed/configured.
  - WSL curl could not reach Windows-bound dev servers via `localhost`; Windows curl validated them successfully.
  - `npm install` reported dependency audit findings that should be reviewed before production hardening.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 1: Database Migration and Seed Foundation

Status: `Completed`

Goal: create the first database migration and seed enough baseline data for auth, master data, and inventory testing.

Implementation checklist:

- [x] Validate and adjust `apps/api/prisma/schema.prisma` if needed.
- [x] Create initial Prisma migration.
- [x] Add seed script for roles.
- [x] Add seed script for permissions.
- [x] Add seed script for admin user.
- [x] Add seed script for sample locations.
- [x] Add seed script for UOMs and conversions.
- [x] Add seed script for sample categories/items.
- [x] Add seed script for reason codes.
- [x] Document seed credentials in a safe local-only way.

Acceptance criteria:

- `prisma migrate dev` succeeds on a clean database.
- Seed script succeeds on a clean database.
- Seed script is idempotent or safely repeatable.
- Baseline data supports the first ledger and inventory UI tests.

Implementation notes:

- 2026-05-05: Validated `apps/api/prisma/schema.prisma` by generating Prisma Client successfully before migration work.
- 2026-05-05: Created and applied initial migration at `apps/api/prisma/migrations/20260504193938_init/migration.sql`. PostgreSQL was empty before migration creation.
- 2026-05-05: Added root script `npm run api:prisma:seed`, API script `npm run prisma:seed`, and Prisma seed command `ts-node prisma/seed.ts`.
- 2026-05-05: Added idempotent seed data for 7 roles, 42 permissions, role-permission mappings, 1 admin user, 4 locations, 7 UOMs, 4 UOM conversions, 5 categories, 6 sample items, and 9 reason codes.
- 2026-05-05: Seed admin email and username defaults are documented in `apps/api/.env.example`; the actual local development password is stored only in ignored `apps/api/.env` as `SEED_ADMIN_PASSWORD`.
- 2026-05-05: The seed script requires `SEED_ADMIN_PASSWORD`; it does not commit a real fallback password.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma migrate status"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe exec ogfi-inventory-postgres psql -U ogfi -d ogfi_inventory -c "\dt"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma migrate dev --name init"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:seed"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:seed"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma migrate status"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe exec ogfi-inventory-postgres psql -U ogfi -d ogfi_inventory -c "select (select count(*) from roles) as roles, (select count(*) from permissions) as permissions, (select count(*) from users) as users, (select count(*) from locations) as locations, (select count(*) from uoms) as uoms, (select count(*) from uom_conversions) as uom_conversions, (select count(*) from categories) as categories, (select count(*) from items) as items, (select count(*) from reason_codes) as reason_codes;"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe exec ogfi-inventory-postgres psql -U ogfi -d ogfi_inventory -c "select r.code, count(rp.\"permissionId\") as permissions from roles r left join role_permissions rp on rp.\"roleId\" = r.id group by r.code order by r.code;"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe exec ogfi-inventory-postgres psql -U ogfi -d ogfi_inventory -c "select u.email, u.username, r.code as role, count(ula.\"locationId\") as locations from users u join roles r on r.id = u.\"roleId\" left join user_location_access ula on ula.\"userId\" = u.id group by u.email, u.username, r.code;"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
- Results:
  - Initial `prisma migrate status` confirmed no migrations existed and the database was not yet managed by Prisma Migrate.
  - PostgreSQL table check returned `Did not find any relations`, confirming the local database was clean before the initial migration.
  - `prisma migrate dev --name init` created `20260504193938_init` and applied it successfully.
  - Prisma Client generation ran successfully as part of migration application.
  - Seed command succeeded on the migrated database.
  - Seed command succeeded again on rerun, confirming repeatability.
  - Final `prisma migrate status` reported 1 migration found and `Database schema is up to date!`.
  - Seed counts returned: 7 roles, 42 permissions, 1 user, 4 locations, 7 UOMs, 4 UOM conversions, 5 categories, 6 items, and 9 reason codes.
  - Admin user check returned `admin@ogfi.local`, username `admin`, role `ADMIN`, and access to 4 locations.
  - Role-permission counts returned: ADMIN 42, WAREHOUSE_MANAGER 14, PURCHASING 10, BRANCH_MANAGER 15, BRANCH_ENCODER 7, AUDITOR 13, VIEWER 6.
  - API build passed after migration and seed changes.
- Issues found:
  - Plain WSL `node`, `npm`, and `docker` commands remain unavailable or unreliable from this shell; Phase 1 used the Phase 0 validated Windows Node/npm and Docker Desktop command paths.
  - Plain WSL tooling remains a local environment limitation, but it does not block Phase 1 acceptance when using the validated Windows command paths.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 2: Auth, RBAC, and Location Access

Status: `Completed`

Goal: implement login, JWT auth, current user lookup, role permissions, and location access checks.

Implementation checklist:

- [x] Add auth DTOs.
- [x] Implement password hashing and login.
- [x] Implement JWT access token issuing.
- [x] Implement refresh token path or explicitly defer it with a tracked note.
- [x] Add current user endpoint.
- [x] Add auth guard.
- [x] Add permission guard.
- [x] Add location access guard.
- [x] Add audit logs for sensitive auth/admin actions.
- [x] Wire UI login state or temporary dev session strategy.

Acceptance criteria:

- Valid users can log in.
- Invalid credentials fail safely.
- Protected API routes reject unauthenticated requests.
- Role permission checks work.
- Location-scoped users cannot access unauthorized locations.

Implementation notes:

- 2026-05-05: Replaced auth placeholder behavior with validated login DTOs, bcrypt password verification, JWT access token issuing, and `GET /api/auth/me` current-user lookup.
- 2026-05-05: Added global JWT auth guard with `@Public()` support. Auth login and password reset placeholder endpoints are public; existing API routes are protected by default.
- 2026-05-05: Added permission metadata and global permission guard. Existing route stubs now declare their required permissions so scaffold endpoints enforce RBAC before later business logic is implemented.
- 2026-05-05: Added location access metadata and guard for location-scoped query/body fields, including stock, movement, ledger post, purchasing, transfers, branch, sales, and sync routes.
- 2026-05-05: Added real audit-log persistence through `AuditService`; login success/failure and logout actions are written to `audit_logs`.
- 2026-05-05: Refresh token rotation is explicitly deferred. `POST /api/auth/refresh` returns a tracked deferred response until persistent refresh-token storage is added.
- 2026-05-05: Added a client-side web auth gate that logs in against the API, stores the JWT in local storage, validates the session with `/api/auth/me`, and renders the existing UI shell after login.
- 2026-05-05: Follow-up fix after Phase 3 testing: Swagger now declares a global JWT bearer security requirement so authorized Swagger requests send the `Authorization` header.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:dev"`
  - `/mnt/c/Windows/System32/cmd.exe /C "curl -s -i http://localhost:3000/api/auth/me"`
  - Windows PowerShell `Invoke-RestMethod` login check for seeded admin user `admin`.
  - Windows PowerShell protected endpoint checks for `/api/auth/me`, `/api/admin/users`, and `/api/inventory/stock-on-hand?locationId=00000000-0000-0000-0000-000000000000`.
  - Windows PowerShell invalid password check for seeded admin user.
  - Temporary local PostgreSQL viewer-user insertion, viewer login, `/api/admin/users` RBAC denial check, and cleanup.
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe exec ogfi-inventory-postgres psql -U ogfi -d ogfi_inventory -c "select module, action, count(*) from audit_logs where module = 'auth' group by module, action order by action;"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `git diff --check`
- Results:
  - API build passed after auth/RBAC implementation.
  - API dev server started successfully and mapped `/api/auth/login`, `/api/auth/me`, and the protected route set.
  - Anonymous `GET /api/auth/me` returned `401 Unauthorized`.
  - Valid seeded admin login returned `200` with a bearer access token, current user details, 42 permissions, and 4 location IDs.
  - Invalid admin password returned `401`.
  - Authenticated admin `GET /api/auth/me` returned `200`.
  - Authenticated admin `GET /api/admin/users` returned `200`, proving permitted RBAC access.
  - Authenticated admin request with an unauthorized fake location ID returned `403`, proving location access enforcement.
  - Temporary `VIEWER` user login succeeded, but `GET /api/admin/users` returned `403`, proving permission denial. Temporary user, location access, and audit rows were removed after the check.
  - Auth audit query returned login success and failure rows.
  - Web build passed after adding the login gate.
  - Developer retest confirmed Swagger authorization now sends the bearer token correctly; `GET /api/auth/me` returned the authenticated admin user from Swagger.
  - `git diff --check` passed.
- Issues found:
  - Refresh token rotation is intentionally deferred until persistent refresh-token storage is designed.
  - Business service implementations remain scaffolded; Phase 2 only enforces auth/RBAC/location access before those handlers.
  - Plain WSL `node`, `npm`, and `docker` remain unavailable or unreliable from this shell; Phase 2 used the validated Windows Node/npm, PowerShell, and Docker Desktop command paths.
  - Plain WSL tooling remains a local environment limitation, but it does not block Phase 2 acceptance when using the validated Windows command paths.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 3: Immutable Ledger Engine

Status: `Completed`

Goal: implement the core service for posting immutable inventory ledger events.

Implementation checklist:

- [x] Add ledger event DTOs.
- [x] Implement transaction-safe ledger posting.
- [x] Enforce idempotent event UUIDs.
- [x] Enforce valid `qtyIn`/`qtyOut` rules.
- [x] Prevent direct balance edits.
- [x] Implement reversal support for corrections.
- [x] Add reference type and reference ID validation hooks.
- [x] Add audit logging for ledger posts.
- [x] Add unit tests for allowed transaction types.

Acceptance criteria:

- Ledger events are immutable after posting.
- Duplicate UUIDs do not create duplicate events.
- Invalid quantities are rejected.
- Ledger posting runs inside a database transaction.
- All ledger posts create audit logs.

Implementation notes:

- 2026-05-05: Added typed ledger posting and reversal DTOs for `POST /api/ledger/events` and `POST /api/ledger/events/:id/reversal`.
- 2026-05-05: Replaced the ledger placeholder post behavior with Prisma transaction-backed event creation. The service computes `extendedCost` from movement quantity and `unitCostAtTime`; callers cannot submit direct balance edits or stored extended costs.
- 2026-05-05: Added idempotent UUID handling. If a ledger event UUID already exists, posting returns the existing event with `status: already_posted` and does not insert another ledger or audit row.
- 2026-05-05: Enforced quantity direction rules for all current transaction types: inbound (`RECEIVE`, `TRANSFER_IN`), outbound (`TRANSFER_OUT`, `WASTAGE`, `ISSUE_TO_OPS`, `SALE_CONSUMPTION`), and either-direction correction types (`STOCK_COUNT`, `ADJUSTMENT`).
- 2026-05-05: Added reference validation hooks for purchase orders, receivings, transfers, wastage, stock counts, issues, sales batches, and sync batches. `ADJUSTMENT` remains a hook-approved internal reference until a dedicated adjustment document model is added.
- 2026-05-05: Added transaction-scoped audit log writes for ledger posts and reversals.
- 2026-05-05: Added service-level location access enforcement for ledger posting and reversal posting, including reversal routes where the location is resolved from the original ledger event.
- 2026-05-05: Added database-level immutability migration `20260505090000_ledger_events_immutable`, which creates PostgreSQL triggers preventing `UPDATE` and `DELETE` on `ledger_events`.
- 2026-05-05: `GET /api/inventory/movements` and `GET /api/ledger/events/:id` now read ledger events from the database. Stock-on-hand remains deferred to Phase 4.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --single-quote --write apps/api/src/ledger/ledger.service.ts apps/api/src/ledger/ledger.controller.ts apps/api/src/ledger/dto/post-ledger-event.dto.ts apps/api/src/ledger/dto/reverse-ledger-event.dto.ts apps/api/src/ledger/ledger.service.spec.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run test -w apps/api -- ledger.service.spec.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:migrate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "tasklist"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
- Results:
  - Ledger unit tests passed: 11 tests covering all eight transaction types, duplicate UUID idempotency, invalid quantity rejection, and reversal posting/audit logging.
  - API build passed before and after applying the migration.
  - Prisma migration applied successfully to local PostgreSQL: `20260505090000_ledger_events_immutable`.
  - Database reported in sync after migration application.
  - Developer browser-console testing confirmed authenticated `GET /api/auth/me`, successful ledger posting, idempotent duplicate post behavior, movement read visibility, reversal posting, and idempotent duplicate reversal behavior.
- Issues found:
  - Prisma Client generation failed after migration application with Windows `EPERM` while renaming `node_modules\.prisma\client\query_engine-windows.dll.node`. Multiple Windows `node.exe` processes were active, so no process was killed automatically. No Prisma schema shape changed in Phase 3, and the API build still passed using the existing generated client.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 4: Stock On Hand and Moving Average Costing

Status: `Completed`

Goal: compute stock balances and moving average costs per item per location from ledger events.

Implementation checklist:

- [x] Implement stock-on-hand query.
- [x] Implement movement history query.
- [x] Implement moving average recalculation on `RECEIVE`.
- [x] Use source average cost for `TRANSFER_OUT`.
- [x] Use dispatched cost for `TRANSFER_IN`.
- [x] Use current average cost for wastage, issue to ops, and sales consumption.
- [x] Define and enforce negative stock policy.
- [x] Add tests for costing edge cases.

Acceptance criteria:

- Stock balances match ledger event totals.
- Moving average cost is correct after receiving.
- Transfer costs flow from source to destination.
- Costing behavior is deterministic and tested.

Implementation notes:

- 2026-05-05: Added `CostingService` state calculation from immutable ledger events, returning quantity on hand, moving average unit cost, and inventory value.
- 2026-05-05: Implemented `GET /api/inventory/stock-on-hand` from ledger history with item, location, base UOM, low-stock, last movement, average cost, and inventory value fields.
- 2026-05-05: Ledger posting now derives outbound `unitCostAtTime` from current moving average for transfers out, wastage, issue to ops, sales consumption, and outbound adjustments/count corrections.
- 2026-05-05: `TRANSFER_IN` now inherits its cost from the matching dispatched `TRANSFER_OUT` event for the same transfer and item.
- 2026-05-05: Negative stock policy is block-all: posting or reversing an event that would take current item/location stock below zero raises a conflict before writing the ledger row.
- 2026-05-05: Added service tests for derived stock-on-hand, moving average costing, transfer cost flow, and negative stock rejection.

Test evidence:

- Commands run:
  - `npm test -w apps/api -- --runInBand`
  - `npm run api:build`
  - `git diff --check`
- Results:
  - Windows npm elevated run: `npm test -w apps/api -- --runInBand` passed, 1 suite and 15 tests.
  - Windows npm elevated run: `npm run api:build` passed.
  - `git diff --check` passed.
- Issues found:
  - The default WSL npm shim still fails in this shell with `WSL 1 is not supported`; verification succeeded through elevated Windows npm.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 5: Inventory UI Wired to Real Data

Status: `Completed`

Goal: connect the inventory screen to real stock-on-hand and movement APIs.

Implementation checklist:

- [x] Add API client utility.
- [x] Add environment variable for API base URL.
- [x] Replace inventory mock table with API data.
- [x] Replace dashboard inventory KPIs with API data where available.
- [x] Add loading states.
- [x] Add empty states.
- [x] Add error states.
- [x] Confirm dense table and filters remain usable on mobile and desktop.

Acceptance criteria:

- Inventory screen displays real stock-on-hand data.
- Movement table displays real ledger movement data.
- UI handles loading, empty, and API error states.
- Filters are visible and do not break layout.

Implementation notes:

- 2026-05-05: Added a shared web API client with `NEXT_PUBLIC_API_URL`, JWT bearer handling, typed `/auth/me`, stock-on-hand, and movement calls.
- 2026-05-05: Added `apps/web/.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:3000/api`.
- 2026-05-05: Replaced the Inventory screen mock table with live stock-on-hand rows and live movement rows fetched per authenticated user location.
- 2026-05-05: Added live Inventory KPIs for available stock rows, low-stock count, and stock value.
- 2026-05-05: Wired Dashboard stock value and low-stock KPI cards to live stock balances where available.
- 2026-05-05: Added loading, empty, and error states to reusable data tables.
- 2026-05-09: Wired the shared table eye action to open a row details modal, so the Recent Movement Table view action is functional instead of decorative.
- 2026-05-09: Replaced the dashboard Recent Movement Table static demo rows with live ledger movements across the user's locations. The table now shows date plus time and no longer displays fake references such as `TR-000532` that are not present in the Transfers module.

Test evidence:

- Commands run:
  - `npx prettier --write apps/web/lib/api-client.ts apps/web/components/auth-gate.tsx apps/web/components/data-table.tsx apps/web/components/status-badge.tsx apps/web/components/inventory-live-page.tsx apps/web/components/dashboard-live-page.tsx apps/web/components/screen-page.tsx`
  - `npm run web:build`
  - `npm run web:dev`
  - `npm run api:dev`
  - `git diff --check`
- Results:
  - `npm run web:build` passed with Next.js type checking and linting.
  - Web dev server started at `http://localhost:3001`.
  - API dev server started at `http://localhost:3000/api`.
  - `git diff --check` passed.
- Issues found:
  - Prettier was not run against `.env.example` because no parser is inferred for env files; the file is a one-line key/value example.
  - Running `next build` while the web dev server is active can lock `.next/trace` on Windows; stopping the web dev server and rerunning the build succeeded.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 6: Master Data CRUD

Status: `Completed`

Goal: implement CRUD workflows for items, UOMs, conversions, suppliers, locations, categories, recipes, and reason codes.

Implementation checklist:

- [x] Items API.
- [x] UOM API.
- [x] UOM conversion API.
- [x] Suppliers API.
- [x] Locations API.
- [x] Categories API.
- [x] Reason codes API.
- [x] Recipes/BOM API.
- [x] Master data UI tables/forms.
- [x] Audit logging for create/update/deactivate actions.

Implementation notes:

- 2026-05-05: Replaced placeholder master data endpoints with Prisma-backed CRUD for items, UOMs, UOM conversions, suppliers, locations, categories, reason codes, and recipes/BOMs.
- 2026-05-05: Added class-validator DTOs for master data create/update requests, including required active reference validation for item UOM/category links, UOM conversion endpoints, and recipe output/ingredient/UOM links.
- 2026-05-05: Added create/update/deactivate audit logging for master data actions with user, entity, before/after payloads, IP address, and user agent metadata.
- 2026-05-05: Expanded seed permissions for master data read/create/update/deactivate coverage across new resources.
- 2026-05-05: Added `/master-data` web workspace with resource tabs, live API-backed tables, and create/update/deactivate forms for each Phase 6 master data resource.
- 2026-05-05: Updated Recipes/BOM UI to support multiple ingredient lines per recipe instead of one ingredient per output item.
- 2026-05-05: Changed master data save validation errors to stay in the form with field-level warnings so table contents remain visible after invalid input such as a negative conversion factor.
- 2026-05-05: Reworked recipe ingredient editing from stacked cards into a compact table for recipes with many ingredients, and renamed visible web labels from `Recipes / BOM` to `Recipes`.
- 2026-05-05: Removed horizontal scrolling from the recipe ingredient editor by widening the Recipes form panel and using responsive ingredient rows that stack on narrow screens.
- 2026-05-05: Added master data search and resource-specific filters for items, UOMs, conversions, suppliers, locations, categories, reason codes, and recipes.
- 2026-05-05: Updated the UOM conversion form so users enter `Conversion per 1 From UOM` while the stored `factor` is auto-computed and read-only.
- 2026-05-11: Recipes now expose computed total recipe cost, usable output, and cost per serving from ingredient moving average/supplier fallback cost, UOM conversion, yield %, and wastage factor.
- 2026-05-11: Recipe yield and wastage manual changes require override reasons and are audit-linked to the warehouse/HQ user approving the change.
- 2026-05-11: Added observed-yield recording so actual usable output can update recipe yield from real production results.
- 2026-05-11: Added Menu Pricing as a separate warehouse/HQ workflow for pricing drafts, approval, active price publishing, food cost %, gross profit, and gross margin.
- 2026-05-11: Approved menu prices remain immutable; price changes are handled by cloning an approved price into a new draft, and promo channel prices require an end date.

Acceptance criteria:

- Master data can be created, updated, deactivated, and listed.
- Validation prevents bad data that would break costing or sync.
- Audit logs are created for sensitive changes.

Test evidence:

- Commands run:
  - `npx prettier --write apps/api/src/master-data/master-data.controller.ts apps/api/src/master-data/master-data.module.ts apps/api/src/master-data/master-data.service.ts apps/api/src/master-data/dto/master-data.dto.ts apps/api/prisma/seed.ts apps/web/lib/api-client.ts apps/web/components/master-data-live-page.tsx apps/web/components/screen-page.tsx apps/web/lib/screens.ts`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx`
  - `git diff --check`
  - `npm run api:build`
  - `npm test -w apps/api`
  - `npm run web:build`
  - `npm run api:prisma:seed`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx`
  - `npm run web:build`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx`
  - `npm run web:build`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx apps/web/lib/screens.ts`
  - `npm run web:build`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx`
  - `npm run web:build`
  - `npx prettier --write apps/web/components/master-data-live-page.tsx IMPLEMENTATION_GUIDE.md`
  - `cd apps/web && npx tsc --noEmit`
  - `git diff --check`
- Results:
  - `npx prettier --write ...` passed.
  - `git diff --check` passed.
  - `npm run api:build` passed.
  - `npm test -w apps/api` passed: 1 suite, 15 tests.
  - `npm run web:build` passed after stopping the active web dev server and clearing the generated `.next/trace` file.
  - `npm run api:prisma:seed` passed and loaded the new Phase 6 permissions.
  - Follow-up `npm run web:build` passed after the Recipes/BOM multi-line editor and field-level validation fixes.
  - Follow-up `npm run web:build` passed after the compact recipe ingredient table and Recipes label update.
  - Follow-up `npm run web:build` passed after removing horizontal scrolling from the recipe ingredient editor.
  - Follow-up `npm run web:build` passed after adding master data filters and search.
  - Follow-up `tsc --noEmit` passed after the UOM conversion factor auto-compute UI change.
  - Follow-up `git diff --check` passed after the UOM conversion factor auto-compute UI change.
- Issues found:
  - Running Node/npm inside the sandbox still reports `WSL 1 is not supported. Please upgrade to WSL 2 or above. Could not determine Node.js install directory`; Phase 6 verification used the approved escalated Windows Node/npm commands.
  - The first `npm run web:build` failed with `EPERM` on `apps/web/.next/trace` while the web dev server was active. After stopping the web dev server and removing that generated trace file, the web build passed.
  - Follow-up `npm run web:build` for the UOM conversion UI change was blocked by the same `apps/web/.next/trace` `EPERM` file lock; targeted TypeScript validation passed.
  - No unresolved Phase 6 issues after developer verification.

User sign-off:

- Tested by: Developer
- Date: 2026-05-05
- Approval: Approved by developer.

## Phase 7: Purchasing and Supplier Receiving

Status: `Completed`

Goal: implement purchase orders and supplier receiving that posts `RECEIVE` ledger events.

Implementation checklist:

- [x] PO draft creation.
- [x] PO line editing.
- [x] PO submit for approval.
- [x] PO approval/rejection.
- [x] Receiving against PO.
- [x] Partial receiving.
- [x] Rejected quantity capture.
- [x] DR/invoice reference capture.
- [x] `RECEIVE` ledger posting.
- [x] Moving average update through ledger/costing service.
- [x] Purchasing and receiving UI wiring.

Acceptance criteria:

- Approved POs can be received.
- Receiving posts correct ledger events.
- Moving average cost updates correctly.
- Partial and variance receiving are traceable.

Implementation notes:

- 2026-05-05: Replaced purchasing placeholder service behavior with real purchase order list/detail/create/update/submit/approve/reject flows backed by Prisma.
- 2026-05-05: Added purchasing DTO validation for purchase order lines, draft updates, approval/rejection remarks, and supplier receiving payloads.
- 2026-05-05: Supplier receiving now validates approved or partially received purchase orders, requires matching supplier/location, captures accepted/rejected quantities plus DR/invoice references, and posts `RECEIVE` ledger events in the same database transaction.
- 2026-05-05: Purchase order status now moves through `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `PARTIALLY_RECEIVED`, and `POSTED` based on workflow actions and received quantities.
- 2026-05-05: Added purchasing audit log entries for PO create/update/submit/approve/reject and receiving post actions.
- 2026-05-05: Added live web purchasing screens for purchase order creation/editing, submit/approve/reject actions, receiving against approved POs, rejected quantity capture, and KPI/table refreshes.
- 2026-05-05: Follow-up UI fix: Create PO now uses explicit React validation with an inline error message, and expected date is optional as intended.
- 2026-05-05: Follow-up route fix: `/purchasing` now renders the live purchasing page instead of the static scaffold action buttons.
- 2026-05-05: Added supplier-item default cost lookup for PO lines. PO creation now auto-fills from `supplier_items.unitCost` when available, stores the default cost on each PO line, and requires a cost override reason when the entered unit cost differs from the supplier default or no default exists.
- 2026-05-05: Added PO line override audit fields for overridden-by/at and override-approved-by/at. Approval stamps overridden PO lines with the approver.
- 2026-05-05: Added migration `20260505093000_purchase_order_cost_overrides` for PO line default cost and override tracking fields.
- 2026-05-05: Added sample suppliers and supplier-item default costs to the seed script for local testing.
- 2026-05-05: Purchase order item selection now auto-populates UOM from the selected item's base UOM instead of defaulting to the first UOM record. Seed supplier-item defaults were expanded so local demo PO selections can auto-fill unit cost.
- 2026-05-05: Purchase orders can now be created with multiple line items in the web UI. Supplier, location, and line item selectors are searchable and use active records loaded from master data.
- 2026-05-06: Purchase order creation now uses a staged line-entry workflow: users fill one line, click Add line to move it into a pending line table, can click a pending line to edit/remove it, and only create the actual PO when clicking Create PO.
- 2026-05-05: Purchase order list responses now include line item details for expandable PO table rows. The Purchase Orders table now toggles line item visibility from the Lines column instead of forcing item/qty into the main row.
- 2026-05-05: Clicking Receive from an approved/partially received PO now opens the receiving form on the current purchasing view instead of silently loading hidden receiving state.
- 2026-05-06: Added PO table filters for status, supplier, location, expected date, and PO number search.
- 2026-05-06: Reworked receiving so clicking Receive shows only that selected PO, with document-level DR/invoice fields and a scrollable line table for item, accepted qty, rejected qty, and per-line remarks.
- 2026-05-06: Receiving line table now shows ordered quantity and blocks posting when accepted plus rejected quantity does not equal the ordered quantity for any line.
- 2026-05-06: Create PO now starts with blank supplier/location/item values, changing supplier no longer clears pending line items, and the receiving form has a Close action that returns to the default Create PO form.
- 2026-05-06: Added migration `20260506083000_receiving_line_remarks` so receiving remarks can be stored per item line.
- 2026-05-06: PO unit cost is treated as the cost per 1 selected line UOM. Pending PO line items and expanded Purchase Order line details now show total cost as `qty * unitCost`.
- 2026-05-06: Local master/demo data was reset and reseeded with a fuller working dataset: active locations, UOMs/conversions, categories, items, suppliers, supplier-item default costs, recipes, reason codes, and opening stock ledger entries.
- 2026-05-07: Partially received PO lines now expose ordered, received, rejected, and remaining quantities. Receiving against a partially received PO defaults `Accept Now` to the remaining quantity, validates accepted plus rejected against remaining quantity, and skips zero-accepted ledger events.
- 2026-05-07: Added manager-approved close-balance flow for `PARTIALLY_RECEIVED` POs through `POST /purchasing/purchase-orders/:id/close-balance`. The action requires approval permission, requires a reason, records purchasing audit, appends the reason to PO remarks, and moves the PO to `CLOSED` without adding inventory.
- 2026-05-07: Receiving now requires both DR Ref and Invoice. Each replacement/second delivery creates its own receiving record, and the receiving form shows receiving history for the selected PO. If DR Ref or Invoice differs from the previous receiving for the same PO, a document-change reason is required and stored on the new receiving record remarks.

Partially received process handoff note:

- Current logic: PO status becomes `POSTED` only when cumulative accepted quantity is greater than or equal to the ordered quantity for every PO line. Rejected quantity is recorded on the receiving line, but it does not increase stock and does not count toward closing the PO.
- Example: if a PO line orders 10 units and receiving posts 5 accepted plus 5 rejected, inventory receives only 5 units and the PO remains `PARTIALLY_RECEIVED`.
- Expected next operational step: purchasing/receiving should either wait for supplier redelivery/replacement of the rejected balance and receive the remaining 5 units later, or close/cancel the remaining balance through an approved short-close/variance resolution action.
- Implemented behavior: rejected quantities keep the PO open as `PARTIALLY_RECEIVED` until replacement stock is received or a manager uses `Close balance`.
- Close-balance behavior: the unresolved quantity is closed without adding stock. This is for cases where the supplier will not redeliver or purchasing accepts the shortage/variance.
- Follow-up implementation detail: add reason-code selection to close-balance once variance reason code workflows are finalized. The current close-balance implementation requires free-text remarks and records the audit event.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe compose ps`
  - `/mnt/c/Windows/System32/cmd.exe /C "curl -s -o NUL -w %{http_code} http://localhost:3000/api/docs"`
  - Windows PowerShell live API flow: login as seeded admin, create/find active supplier, create PO, submit PO, approve PO, post receiving, fetch PO detail, and confirm a `RECEIVE` movement for the receiving reference.
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:migrate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:seed"`
  - `npx prettier --write` for touched TypeScript/Markdown files and `prisma format` for the Prisma schema.
  - Windows PowerShell live API flow: verify supplier-item default cost lookup, create PO without unit cost using default cost, reject override without reason, create override with reason, submit and approve override PO, and confirm override approval stamp.
  - Final `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - Final `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` for staged PO line entry.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` for staged PO line entry.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:migrate"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` for PO filters and receiving line table.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma migrate reset --force"` for local demo data reset and reseed.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after seed expansion.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after PO total-cost UI update.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after PO total-cost UI update.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after remaining-quantity receiving and close-balance changes.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after remaining-quantity receiving UI changes.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after remaining-quantity receiving UI changes.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after DR Ref/Invoice enforcement.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after receiving document-history UI changes.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after receiving document-history UI changes.
  - `git diff --check`
- Results:
  - API build passed after purchasing service, controller, and DTO changes.
  - Docker Compose showed PostgreSQL healthy and Redis running.
  - Existing API server responded with `HTTP 200` at `/api/docs`.
  - Live API flow created PO `PO-20260504-0001`, moved it through `PENDING_APPROVAL`, `APPROVED`, and final `POSTED`, created receiving `RR-20260504-0001`, and found 1 matching `RECEIVE` ledger movement for that receiving.
  - First web build failed on a KPI icon type inference issue in the new purchasing screen; after typing the KPI array, follow-up web builds passed.
  - Final web build passed after loading PO detail before editing list rows.
  - Follow-up `tsc --noEmit` passed after replacing native Create PO blocking with visible validation.
  - Follow-up `npm run web:build` passed after fixing the purchasing route switch.
  - Prisma Client generated after clearing an API dev-server file lock.
  - Prisma migration `20260505093000_purchase_order_cost_overrides` applied successfully.
  - Seed command passed and loaded sample suppliers plus supplier-item default costs.
  - Cost override live API check returned default cost `185`, created a default-cost PO at `185` with no override reason, rejected an override without reason with HTTP 400, created an override PO at `199.99` with reason `Vendor quoted temporary promo price`, and stamped `costOverrideApprovedById` on approval.
  - Follow-up seed command passed after adding more supplier-item default costs for local PO auto-fill testing.
  - Final API build passed.
  - Final web build passed.
  - Follow-up web TypeScript check passed after the multi-line PO, searchable dropdown, and expandable line item UI changes.
  - Follow-up API build passed after including PO line details in the purchase order list response.
  - Follow-up web build passed after the purchasing UI changes.
  - Follow-up web TypeScript check and web build passed after the staged PO line-entry workflow.
  - Prisma migration `20260506083000_receiving_line_remarks` applied successfully.
  - Follow-up API and web builds passed after PO filters, selected-PO receiving, and line-level receiving remarks.
  - Local database reset completed through `prisma migrate reset --force`; migrations reapplied and seed data loaded successfully.
  - Prisma Client generation initially hit a Windows `EPERM` file-lock error, then succeeded on retry.
  - Follow-up API build passed after the expanded seed data.
  - Follow-up web TypeScript check and web build passed after adding total cost to PO line item tables.
  - Follow-up API build passed after adding remaining-quantity receiving validation and close-balance endpoint.
  - Follow-up web TypeScript check and web build passed after adding received/rejected/remaining columns, remaining-based receiving defaults, and the Close balance table action.
  - Follow-up API build and web TypeScript check passed after DR Ref/Invoice enforcement and receiving history UI.
  - `git diff --check` passed.
- Issues found:
  - Plain WSL Node/npm and Windows executable calls still fail inside the sandbox with the previously documented WSL socket/tooling issue; verification used the approved escalated Windows Node/npm, Docker, curl, and PowerShell paths.
  - Follow-up `npm run web:build` hit `EPERM` opening `apps/web/.next/trace`, consistent with the known active dev-server trace lock; targeted TypeScript verification passed.
  - Follow-up `npm run web:build` for DR Ref/Invoice history hit the same `.next/trace` file-lock pattern and was stopped after the retry hung in Next build startup; targeted web TypeScript verification passed.
  - The only pre-existing local supplier was inactive, so the live API verification created an active local supplier named `Phase 7 Supplier`.
  - Phase 7 was approved by the developer on 2026-05-07.

User sign-off:

- Tested by: Developer
- Date: 2026-05-07
- Approval: Approved by developer.

## Phase 8: Transfers and Variance Workflow

Status: `Completed`

Goal: implement location-to-location transfer workflow with dispatch, receive, and variance tracking.

Implementation checklist:

- [x] Transfer request creation.
- [x] Transfer approval.
- [x] Picking/dispatch.
- [x] `TRANSFER_OUT` ledger posting.
- [x] Target location receiving.
- [x] `TRANSFER_IN` ledger posting.
- [x] Variance capture.
- [x] Variance review status.
- [x] Transfer UI wiring.

Acceptance criteria:

- Dispatch reduces source stock.
- Receiving increases destination stock.
- Destination cost uses dispatched unit cost.
- Variances are visible and traceable.

Implementation notes:

- 2026-05-07: Replaced placeholder transfer endpoints with Prisma-backed list/detail/create/approve/dispatch/receive flows.
- 2026-05-07: Transfer creation validates active source/target locations, active item lines, distinct locations, and user access to both locations.
- 2026-05-07: Dispatch validates approved status, picked quantities, and source stock before posting `TRANSFER_OUT` ledger events. Posted source moving-average cost is stored on transfer lines.
- 2026-05-07: Receiving validates dispatched status and received quantities, posts `TRANSFER_IN` ledger events using the dispatched transfer cost, and moves transfers to `RECEIVED` or `VARIANCE_REVIEW` based on picked-vs-received quantity.
- 2026-05-07: Added live `/transfers` web workspace with transfer creation, line staging, approval, dispatch quantity entry, receiving quantity entry, variance notes, KPIs, and live transfer table actions.
- 2026-05-09: Clarified transfer scope from warehouse-to-store to location-to-location. The existing implementation supports warehouse-to-branch, branch-to-branch/store-to-store, and any other active source/target location pair, as long as source and target are different and the user has access to both.
- 2026-05-09: Transfer creation now shows a read-only transfer reference placeholder because the actual transfer number is automatically generated on create. Transfer item lines now show the selected item's base UOM in draft, dispatch, and receiving views for visibility.
- 2026-05-09: Developer approved Phase 8 and confirmed branch/store transfer receiving should continue in Phase 9 under Store Operations.
- 2026-05-09: Added transfer source-stock controls. Transfer creation now checks source stock availability, blocks no-stock and over-available quantities, snapshots source available/remaining/threshold values on transfer lines, and flags transfers that will bring source stock to or below low-stock threshold for manager approval visibility. Dispatch still revalidates live source stock before posting `TRANSFER_OUT`.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma format"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after transfer source-stock controls.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after transfer source-stock UI.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after transfer source-stock UI.
- Results:
  - API build passed after replacing transfer placeholders with real service/controller/DTO flows.
  - Web TypeScript check passed after wiring the live transfers page.
  - Web production build passed after the transfers UI changes.
  - Prisma format and Prisma Client generation passed after adding transfer source-stock snapshot fields.
  - Follow-up API build, web TypeScript check, and web production build passed after transfer source-stock controls.
- Issues found:
  - Branch-facing transfer receiving belongs in Phase 9 Store Operations; Phase 8 keeps transfer receiving available in the Transfers page for end-to-end testing.

User sign-off:

- Tested by: Developer
- Date: 2026-05-09
- Approval: Approved by developer.

## Phase 9: Branch Operations

Status: `Ready For Test`

Goal: implement branch wastage, stock count, issue to ops, and sales batch workflows.

Implementation checklist:

- [x] Branch-facing transfer receiving.
- [ ] Wastage draft/submit/approve/post.
- [ ] Stock count draft/submit/approve.
- [ ] Adjustment event creation from approved stock count variance.
- [x] Issue to ops posting.
- [x] Sales batch creation/import.
- [x] Sales consumption from recipes/BOM.
- [x] Branch operations UI wiring.

Acceptance criteria:

- Branch transactions use the central ledger service.
- Approval rules are enforced.
- Posted records cannot be deleted.
- Corrections happen through reversals or adjustment events.

Implementation notes:

- 2026-05-09: Started Phase 9 with branch-facing transfer receiving under Store Operations. The page lists dispatched transfers where the signed-in user has access to the target location, then posts receiving through the shared transfer receive endpoint so `TRANSFER_IN`, variance handling, and destination stock updates stay centralized.
- 2026-05-09: Replaced Branch Ops placeholder endpoints with real branch operations APIs for wastage, stock counts, issue to ops, and sales batches. The first implementation posts through the central ledger service, validates active locations/items, enforces location access, blocks negative stock through current stock checks plus ledger policy, and records audit logs.
- 2026-05-09: Store Operations now includes branch/store selection, stock-on-hand monitoring, incoming transfer receiving, wastage posting, stock count posting, issue-to-ops posting, and sales batch posting. Sales batches consume active recipe/BOM ingredients through `SALE_CONSUMPTION` ledger events, including recipe UOM conversion to ingredient base UOM when required.
- 2026-05-09: Wastage and stock count are implemented as direct-post workflows in this slice. Draft, submit, manager approve, and adjustment-resolution workflows remain open before Phase 9 sign-off.
- 2026-05-09: Reworked Store Operations into tabbed sections so each workflow has enough table/form space. Wastage, stock count, issue-to-ops, and sales batch forms now include UOM selection defaulted from the selected item's base UOM. If a non-base UOM is selected, the UI checks for a configured conversion and the API converts the entered quantity to base UOM before ledger posting.
- 2026-05-09: Added Stock Count Type with `OPENING`, `EOD`, `CYCLE`, and `SPOT`.
- 2026-05-09: Added a UI rule for line-item records: tables that represent records with line items should expose collapsible line details instead of always showing or hiding them. Transfers and Store Operations history tables now use the line count as the expand/collapse control.
- 2026-05-10: Added loose-count item support for stock counts. Item master records can mark an item as loose-count enabled with whole-unit UOM, loose/remainder UOM, and base quantity per whole unit. Store Operations stock count converts full units plus loose quantity into the item base UOM before ledger posting. Seeded `COOKING-OIL` as a loose-count item using `BTL + ML -> L`.
- 2026-05-10: Enforced head-office item creation through `master-data.items:create`; the Master Data UI disables new item creation when the signed-in user lacks that permission.
- 2026-05-10: Store Operations now treats `OPENING` as the branch Beginning Count and exposes only Beginning Count and EOD Count. Cycle and Spot Count are hidden from Store Operations and rejected by the branch count service, while Beginning Count can be posted against active inventory so it can represent the start-of-day count.
- 2026-05-10: Branch stock status now comes from the ledger stock-on-hand response: zero or negative balances are `OUT_OF_STOCK`, positive balances at or below threshold are `LOW`, and all others are `OK`. Low-stock summaries exclude out-of-stock rows.
- 2026-05-10: Wastage and Issue to Ops item selectors now list only items with positive stock in the selected branch/store and show available quantity after item selection. Wastage expanded line details include the wastage reason.
- 2026-05-10: The daily Store Operations session workflow remains open: beginning count gate before prep/ops, previous EOD comparison prompt, EOD lock after final count, and HQ-approved item/package requests for local replacement purchases should be implemented as the next workflow slice.
- 2026-05-11: Transfer dispatch now reserves stock without posting ledger movement. Source `On Hand` remains unchanged until destination receiving; source `Available` is reduced by unresolved dispatched quantity, destination `In Transit In` is increased, and Store Operations prompts source/destination when a dispatched or variance-review transfer remains unresolved.
- 2026-05-11: Transfer receiving now posts both confirmed ledger movements together: `TRANSFER_OUT` at the source and `TRANSFER_IN` at the destination. Variance review keeps only the unresolved balance reserved/floating.
- 2026-05-11: Transfer variance resolution is reviewed from the Transfers page. Manager resolutions support source-retained balance, source-loss adjustment, or receiving the remaining balance at destination; resolving clears the floating reserved quantity and lets EOD close proceed once no other blockers remain.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/web/components/store-operations-live-page.tsx apps/web/components/screen-page.tsx IMPLEMENTATION_GUIDE.md"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/branch-ops/branch-ops.controller.ts apps/api/src/branch-ops/branch-ops.module.ts apps/api/src/branch-ops/branch-ops.service.ts apps/api/src/branch-ops/dto/branch-ops.dto.ts apps/api/prisma/seed.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/web/components/store-operations-expanded-page.tsx apps/web/components/screen-page.tsx apps/web/lib/api-client.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/branch-ops/dto/branch-ops.dto.ts apps/api/src/branch-ops/branch-ops.service.ts apps/web/components/store-operations-expanded-page.tsx"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma format"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after collapsible line-item tables.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after collapsible line-item tables.
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma format"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:generate"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\api && C:\nvm4w\nodejs\npx.cmd prisma migrate status"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:prisma:seed"`
  - `git diff --check`
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/ledger/ledger.service.ts apps/api/src/branch-ops/branch-ops.service.ts apps/web/lib/api-client.ts apps/web/components/inventory-live-page.tsx apps/web/components/dashboard-live-page.tsx apps/web/components/store-operations-expanded-page.tsx IMPLEMENTATION_GUIDE.md PHASE_TEST_INSTRUCTIONS.md"` after Store Operations status/count/filter updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after Store Operations status/count/filter updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after Store Operations status/count/filter updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after Store Operations status/count/filter updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd test -w apps/api -- --runInBand"` after Store Operations status/count/filter updates.
  - Follow-up `git diff --check` after Store Operations status/count/filter updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/ledger/ledger.service.ts apps/api/src/branch-ops/branch-ops.service.ts apps/api/src/transfers/transfers.service.ts apps/api/src/transfers/transfers.controller.ts apps/api/src/transfers/dto/transfers.dto.ts apps/web/lib/api-client.ts apps/web/components/inventory-live-page.tsx apps/web/components/store-operations-expanded-page.tsx apps/web/components/transfers-live-page.tsx apps/web/components/dashboard-live-page.tsx IMPLEMENTATION_GUIDE.md PHASE_TEST_INSTRUCTIONS.md"` after transfer reservation/EOD blocker updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"` after transfer reservation/EOD blocker updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"` after transfer reservation/EOD blocker updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"` after transfer reservation/EOD blocker updates.
  - Follow-up `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd test -w apps/api -- --runInBand"` after transfer reservation/EOD blocker updates.
  - Follow-up `git diff --check` after transfer reservation/EOD blocker updates.
- Results:
  - Prettier passed with no file changes needed.
  - API build passed after replacing Branch Ops placeholders with real endpoints.
  - Prisma Client regenerated successfully after adding `StockCountType`.
  - Web TypeScript check passed.
  - Web production build passed.
  - Loose item migration applied; Prisma reported the database schema is up to date.
  - Seed passed after adding Cooking Oil loose-count setup.
  - Follow-up API build, web typecheck, web production build, API tests, and `git diff --check` passed after Store Operations status/count/filter updates.
  - Follow-up API build, web typecheck, web production build, API tests, and `git diff --check` passed after transfer reservation/EOD blocker updates.
  - `git diff --check` passed.
- Issues found:
  - None for the branch-facing transfer receiving and direct-post branch operation slices.

User sign-off:

- Tested by:
- Date:
- Approval:

## Admin Settings Catch-Up

Status: `Ready For Test`

Goal: replace the Admin Settings placeholder with live user, role, permission, and audit-log management before proceeding with deployment hardening.

Implementation checklist:

- [x] Admin users list.
- [x] Create admin user.
- [x] Edit admin user profile, role, location access, password, and active state.
- [x] Deactivate admin user.
- [x] Prevent self-deactivation.
- [x] Admin roles list.
- [x] Role permission updates.
- [x] Permissions list.
- [x] Audit-log list.
- [x] Admin Settings UI wiring.
- [ ] Arbitrary role creation.

Acceptance criteria:

- Authorized admin users can create, update, and deactivate users.
- User passwords are hashed and are never returned to the UI.
- User location access is editable and reflected in the API response.
- Role permissions can be updated from the Admin Settings UI.
- Admin user mutations and role permission changes create audit logs.
- Admin Settings no longer shows placeholder responses.

Implementation notes:

- 2026-05-11: Added Admin API DTOs and live endpoints for users, roles, permissions, and audit logs.
- 2026-05-11: User creation and update now validate role and location IDs, hash new passwords with bcrypt, replace location access transactionally, and return user data without password hashes.
- 2026-05-11: User deactivation is implemented instead of hard delete. The API blocks a signed-in user from deactivating their own account.
- 2026-05-11: Role permission editing is implemented against existing enum-backed roles. Creating arbitrary new roles is deferred because the current schema uses the fixed `RoleCode` enum and would require a schema/migration decision.
- 2026-05-11: Added Admin Settings UI tabs for Users, Roles, and Audit Logs. The page loads live roles, permissions, locations, users, and audit records through the API client.
- 2026-05-12: Updated the Roles tab into a two-section access workspace: available roles on the left and the selected role's permission access list on the right. Administrator is selected by default when roles load.
- 2026-05-12: Added Audit Trail client-side filters for search, module, action, and date range. Audit rows now show 15 records per page with previous/next pagination.
- 2026-05-12: Added a searchable Location Access field in the Create/Edit User form so admins can filter long location lists by code or name before assigning access.
- 2026-05-12: Added registered sync devices for offline accountability. Admin Settings now has a Devices tab for registering tablets/laptops/POS devices, assigning them to a location, deactivating lost devices, and tracking last-seen sync time.
- 2026-05-12: Offline Sync now requires a registered active device. Sync submissions store the signed-in user on the batch, store the working location on the batch, and reject a device assigned to another location. Ledger metadata also includes device ID, submitted-by user ID, sync batch/event IDs, and working location ID.
- 2026-05-12: Added Prisma migration `20260512090000_sync_device_registration` and seed data for one registered test tablet per seeded location. Run Prisma migrate and seed before testing this slice on an existing database.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/admin/admin.controller.ts apps/api/src/admin/admin.module.ts apps/api/src/admin/admin.service.ts apps/api/src/admin/dto/admin.dto.ts apps/web/components/admin-live-page.tsx apps/web/components/screen-page.tsx apps/web/components/status-badge.tsx apps/web/lib/api-client.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "git diff --check"`
- Results:
  - Prettier passed.
  - API build passed.
  - Web TypeScript check passed.
  - Web production build passed.
  - `git diff --check` passed.
- Issues found:
  - Admin role creation is intentionally deferred until the role model is changed away from a fixed enum or a controlled custom-role design is approved.
  - Manual browser validation is still pending.

User sign-off:

- Tested by:
- Date:
- Approval:

## Extra Features After Phase Completion

These items are approved backlog candidates to evaluate after Phases 0-12 are completed and signed off. They should not block the current phase work unless explicitly pulled forward.

### Knowledge Base Navigation

Goal: add a dedicated `KB` navigation link for operational definitions, examples, and workflow explanations.

Candidate scope:

- [ ] Add `KB` route and navigation entry.
- [ ] Add Inventory KB: stock on hand, stock count, opening count, EOD count, cycle count, spot count, adjustments, ledger events, moving average cost.
- [ ] Add Master Data KB: items, UOMs, conversions, suppliers, locations, categories, reason codes, recipes/BOM.
- [ ] Add Purchasing KB: purchase orders, line items, unit cost, supplier default cost, override, submit approval, approve/reject, PO statuses.
- [ ] Add Receiving KB: DR Ref, invoice, accepted/rejected qty, partial receiving, close balance, receiving history.
- [ ] Add Transfers KB: request, approve, dispatch, in transit, receive, variance, transfer statuses.
- [ ] Add Store Operations KB: wastage, issue to ops, sales batch, stock count types, branch stock monitoring.
- [ ] Include definition, when to use it, examples, status meanings, permission notes, and common mistakes for each topic.

### Bulk Upload and Templates

Goal: support CSV import workflows for setup and operational data while preserving validation and auditability.

Candidate scope:

- [ ] Master Data CSV upload per section: items, UOMs, UOM conversions, suppliers, supplier-item default costs, locations, categories, reason codes, recipes/BOM.
- [ ] Inventory CSV upload for opening balances/counts and selected adjustment workflows.
- [ ] Downloadable CSV template for each supported upload type.
- [ ] Upload preview with row-level validation before commit.
- [ ] Error export for rejected rows.
- [ ] Duplicate detection and update-vs-create behavior rules.
- [ ] Audit log for upload file name, uploaded by, row counts, accepted rows, rejected rows, and resulting records.
- [ ] Permission rules for who can upload master data and inventory data.

## Phase 10: Reports and Exports

Status: `In Progress`

Goal: implement report jobs and exports for operational and audit reporting.

Implementation checklist:

- [x] Report catalog.
- [x] Report run creation.
- [ ] BullMQ report processing.
- [x] Stock on hand report.
- [x] Stock valuation report.
- [x] Movement report.
- [x] Wastage summary.
- [x] Transfer variance report.
- [x] Low stock report.
- [x] Export download flow.
- [x] Report UI wiring.

Acceptance criteria:

- Reports can be queued and completed.
- Completed reports are downloadable.
- Report parameters are validated.
- Export downloads are audit logged.

Implementation notes:

- 2026-05-11: Started Phase 10 with a synchronous CSV report runner instead of placeholder report responses. `GET /api/reports/catalog` returns the available report catalog, `POST /api/reports/runs` validates parameters and stores a report run, `GET /api/reports/runs` returns run history, and `GET /api/reports/runs/:id/download` regenerates and returns CSV content for completed runs.
- 2026-05-11: Initial report keys are `stock-on-hand`, `stock-valuation`, `movements`, `wastage-summary`, `transfer-variance`, and `low-stock`. Report rows are generated from live Prisma data and scoped to the signed-in user's allowed locations.
- 2026-05-11: Reports UI is now live. Users can select report, location, date range, item type, run a CSV report, view run history, and download completed CSV output.
- 2026-05-11: BullMQ/background processing, XLSX/PDF generation, stored file URLs, and report-download audit logs remain open before Phase 10 sign-off. The current implementation completes CSV runs synchronously.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/reports/reports.controller.ts apps/api/src/reports/reports.module.ts apps/api/src/reports/reports.service.ts apps/web/components/reports-live-page.tsx apps/web/components/screen-page.tsx apps/web/lib/api-client.ts"`
- `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
- `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run web:build"`
- Results:
  - Prettier passed.
  - API build passed.
  - Web TypeScript check passed.
  - Web production build passed.
- Issues found:
  - Background report processing and audit logging for downloads are not implemented in this first Phase 10 slice.

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 11: Offline PWA Sync

Status: `In Progress`

Goal: implement offline transaction queueing, bootstrap snapshots, idempotent sync, and rejection handling.

Implementation checklist:

- [ ] PWA shell configuration.
- [ ] IndexedDB event queue.
- [x] Offline bootstrap API.
- [x] Sync status API.
- [x] Sync batch submission API.
- [x] Idempotent UUID processing.
- [x] Rejected event response format.
- [x] Editable rejected local entries.
- [x] Offline Sync UI wiring.

Acceptance criteria:

- Allowed offline actions can be queued locally.
- Disallowed offline actions are blocked.
- Duplicate UUIDs do not duplicate ledger events.
- Rejected events show reasons and remain editable locally.

Implementation notes:

- 2026-05-11: Replaced Sync placeholder endpoints with live bootstrap, status, batch list/detail, and batch submission APIs backed by existing `SyncBatch` and `SyncEvent` tables. The bootstrap response includes allowed locations, active items, UOM context, reason codes, server time, and allowed offline transaction types.
- 2026-05-11: Offline sync submission accepts event batches for allowed stock-touching offline transaction types: `WASTAGE`, `STOCK_COUNT`, `ADJUSTMENT`, `ISSUE_TO_OPS`, and `SALE_CONSUMPTION`. Disallowed event types are stored as rejected sync events with a clear reason.
- 2026-05-11: Sync event processing posts accepted events through the central immutable ledger service using `SYNC_BATCH` as the reference. Duplicate event UUIDs are treated idempotently and do not create duplicate ledger rows.
- 2026-05-11: Offline Sync UI is now live. Users can queue local browser events, submit the queue as a sync batch, inspect received batches, and edit rejected local rows before retrying. The first UI implementation stores local queue data in `localStorage`; full IndexedDB/PWA service worker behavior remains open.
- 2026-05-11: Phase 11 still needs PWA shell/service worker setup and a proper IndexedDB event queue before sign-off.
- 2026-05-12: Offline Sync now uses registered devices from Admin Settings instead of browser-generated device IDs. Users queue events against a selected working location and registered active device; the API rejects devices assigned to another location and records the signed-in user on each sync batch.
- 2026-05-12: Approved offline strategy is broad offline navigation/read cache with selective offline writes. The app shell now shows connection status on every page, live pending local sync count, and an offline read-only banner stating that cached pages are read-only except offline-enabled queues.
- 2026-05-12: Added PWA service worker app-shell caching for primary routes so previously loaded pages can be reopened or navigated while offline. The app registers `/sw.js` from the root layout.
- 2026-05-12: Added IndexedDB offline cache and queue storage. Successful API GET responses are cached and served back when the network is unavailable, covering dashboard-like reads, inventory, master data, purchasing, transfers, reports, menu pricing, admin reads, and store operation history when those endpoints have been loaded before.
- 2026-05-12: Added manual and periodic offline-data refresh from the global connection widget. While online, reference and operational data refresh on app open and every 10 minutes; the header shows the latest cache refresh time.
- 2026-05-12: Store Operations now queues Wastage, Issue to Ops, and Sales Batch outbound events directly to the IndexedDB offline queue when the connection is offline. Stock Count and EOD Count remain online-only because they require current server balances and EOD conflict checks.
- 2026-05-12: Offline conflict handling remains server-authoritative. Rejected sync events stay in the local queue for correction/retry; cached data is treated as last-known data and the offline banner warns users that cached pages are read-only except offline-enabled queues.
- 2026-05-12: Fixed the global header so the connection status pills remain visible without overlapping the signed-in user controls. Operations Dashboard Quick Actions now only shows actionable non-zero items and labels them by severity.
- 2026-05-12: Offline Sync queue inputs now change by event type to mirror Store Operations labels for Wastage, Issue to Ops, and Sales Batch. Store Operations offline posts now show a green queued notification, preserve reason/remarks in the local queue, and the Offline Sync page refreshes when the queue changes.
- 2026-05-12: Added security hardening slice 1-5. Login now requires self-hosted ALTCHA CAPTCHA and has in-memory failed-login lockout. Production requires real JWT/ALTCHA secrets, CORS is restricted by `CORS_ORIGIN`, Swagger is disabled unless explicitly enabled, and API security headers are set. Browser offline cache/queue values are encrypted after Offline PIN setup, locked after inactivity, and cleared with service-worker caches on logout.

Test evidence:

- Commands run:
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npx.cmd prettier --write apps/api/src/sync/sync.controller.ts apps/api/src/sync/sync.module.ts apps/api/src/sync/sync.service.ts apps/api/src/sync/dto/sync.dto.ts apps/web/components/offline-sync-live-page.tsx apps/web/components/screen-page.tsx apps/web/components/status-badge.tsx apps/web/lib/api-client.ts"`
  - `/mnt/c/Windows/System32/cmd.exe /C "C:\nvm4w\nodejs\npm.cmd run api:build"`
  - `/mnt/c/Windows/System32/cmd.exe /C "cd apps\web && C:\nvm4w\nodejs\npx.cmd tsc --noEmit"`
- Results:
  - Prettier passed.
  - API build passed after TypeScript fixes.
  - Web TypeScript check passed.
- Issues found:
  - IndexedDB queueing and service worker/PWA shell are not implemented in this first Phase 11 slice.

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 12: Deployment Hardening and Production Readiness

Status: `Not Started`

Goal: prepare the system for production deployment and operational support.

Implementation checklist:

- [ ] Production Docker build.
- [ ] Environment variable review.
- [ ] Nginx reverse proxy config.
- [ ] HTTPS setup.
- [ ] Database backup notes.
- [ ] Logging strategy.
- [ ] Error monitoring plan.
- [ ] Security review.
- [ ] Smoke test checklist.
- [ ] Release notes.

Acceptance criteria:

- Production build works.
- Deployment steps are documented.
- Sensitive settings are not committed.
- Smoke test checklist passes.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Decision Log

| Date       | Decision                                                                                                                  | Reason                                                                                    | Owner             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------- |
| 2026-05-05 | Implement in vertical slices starting with environment, seed data, auth, ledger, stock-on-hand, then Inventory UI wiring. | Proves the core inventory spine before adding module-specific workflows.                  | Developer / Codex |
| 2026-05-05 | Track significant implementation notes on every guide update.                                                             | The guide must function as a handoff and traceability record, not only a task checklist.  | Developer / Codex |
| 2026-05-11 | Keep Recipes focused on production costing and put selling price/profitability in Menu Pricing.                           | Recipe cost and selling price have different owners, approval rules, and effective dates. | Developer / Codex |

## Change Note Requirements

When updating this guide after work is performed, include relevant notes under the active phase covering:

- Major code changes.
- Feature additions.
- Feature removals.
- Database schema or migration changes.
- New or removed dependencies.
- API endpoint or payload changes.
- UI behavior, layout, or design-system changes.
- Test coverage added or skipped.
- Known risks, defects, blockers, or follow-up work.
- Any decisions that affect future implementation.

## Open Questions

- What terminal/runtime will be used for Node commands: WSL2, Windows PowerShell, or another environment?
- Should refresh tokens be implemented in Phase 2 or deferred until production hardening?
- What is the negative stock policy: block all negative stock, allow selected roles, or allow only for specific transaction types?
- What initial locations, users, and item master records should be seeded for OGFI testing?
