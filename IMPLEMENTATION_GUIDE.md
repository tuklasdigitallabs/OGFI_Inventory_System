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

Phase 4: Stock On Hand and Moving Average Costing

Current status: `Not Started`

Next action: implement stock-on-hand queries and moving average costing from immutable ledger events.

## Phase Checklist

| Phase | Name | Status | User Sign-Off |
| --- | --- | --- | --- |
| 0 | Environment, Dependency, and Baseline Validation | Completed | 2026-05-05 |
| 1 | Database Migration and Seed Foundation | Completed | 2026-05-05 |
| 2 | Auth, RBAC, and Location Access | Completed | 2026-05-05 |
| 3 | Immutable Ledger Engine | Completed | 2026-05-05 |
| 4 | Stock On Hand and Moving Average Costing | Not Started | Pending |
| 5 | Inventory UI Wired to Real Data | Not Started | Pending |
| 6 | Master Data CRUD | Not Started | Pending |
| 7 | Purchasing and Supplier Receiving | Not Started | Pending |
| 8 | Transfers and Variance Workflow | Not Started | Pending |
| 9 | Branch Operations | Not Started | Pending |
| 10 | Reports and Exports | Not Started | Pending |
| 11 | Offline PWA Sync | Not Started | Pending |
| 12 | Deployment Hardening and Production Readiness | Not Started | Pending |

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

Status: `Not Started`

Goal: compute stock balances and moving average costs per item per location from ledger events.

Implementation checklist:

- [ ] Implement stock-on-hand query.
- [ ] Implement movement history query.
- [ ] Implement moving average recalculation on `RECEIVE`.
- [ ] Use source average cost for `TRANSFER_OUT`.
- [ ] Use dispatched cost for `TRANSFER_IN`.
- [ ] Use current average cost for wastage, issue to ops, and sales consumption.
- [ ] Define and enforce negative stock policy.
- [ ] Add tests for costing edge cases.

Acceptance criteria:

- Stock balances match ledger event totals.
- Moving average cost is correct after receiving.
- Transfer costs flow from source to destination.
- Costing behavior is deterministic and tested.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 5: Inventory UI Wired to Real Data

Status: `Not Started`

Goal: connect the inventory screen to real stock-on-hand and movement APIs.

Implementation checklist:

- [ ] Add API client utility.
- [ ] Add environment variable for API base URL.
- [ ] Replace inventory mock table with API data.
- [ ] Replace dashboard inventory KPIs with API data where available.
- [ ] Add loading states.
- [ ] Add empty states.
- [ ] Add error states.
- [ ] Confirm dense table and filters remain usable on mobile and desktop.

Acceptance criteria:

- Inventory screen displays real stock-on-hand data.
- Movement table displays real ledger movement data.
- UI handles loading, empty, and API error states.
- Filters are visible and do not break layout.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 6: Master Data CRUD

Status: `Not Started`

Goal: implement CRUD workflows for items, UOMs, conversions, suppliers, locations, categories, recipes, and reason codes.

Implementation checklist:

- [ ] Items API.
- [ ] UOM API.
- [ ] UOM conversion API.
- [ ] Suppliers API.
- [ ] Locations API.
- [ ] Categories API.
- [ ] Reason codes API.
- [ ] Recipes/BOM API.
- [ ] Master data UI tables/forms.
- [ ] Audit logging for create/update/deactivate actions.

Acceptance criteria:

- Master data can be created, updated, deactivated, and listed.
- Validation prevents bad data that would break costing or sync.
- Audit logs are created for sensitive changes.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 7: Purchasing and Supplier Receiving

Status: `Not Started`

Goal: implement purchase orders and supplier receiving that posts `RECEIVE` ledger events.

Implementation checklist:

- [ ] PO draft creation.
- [ ] PO line editing.
- [ ] PO submit for approval.
- [ ] PO approval/rejection.
- [ ] Receiving against PO.
- [ ] Partial receiving.
- [ ] Rejected quantity capture.
- [ ] DR/invoice reference capture.
- [ ] `RECEIVE` ledger posting.
- [ ] Moving average update through ledger/costing service.
- [ ] Purchasing and receiving UI wiring.

Acceptance criteria:

- Approved POs can be received.
- Receiving posts correct ledger events.
- Moving average cost updates correctly.
- Partial and variance receiving are traceable.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 8: Transfers and Variance Workflow

Status: `Not Started`

Goal: implement warehouse-to-store transfer workflow with dispatch, receive, and variance tracking.

Implementation checklist:

- [ ] Transfer request creation.
- [ ] Transfer approval.
- [ ] Picking/dispatch.
- [ ] `TRANSFER_OUT` ledger posting.
- [ ] Store receiving.
- [ ] `TRANSFER_IN` ledger posting.
- [ ] Variance capture.
- [ ] Variance review status.
- [ ] Transfer UI wiring.

Acceptance criteria:

- Dispatch reduces source stock.
- Receiving increases destination stock.
- Destination cost uses dispatched unit cost.
- Variances are visible and traceable.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 9: Branch Operations

Status: `Not Started`

Goal: implement branch wastage, stock count, issue to ops, and sales batch workflows.

Implementation checklist:

- [ ] Wastage draft/submit/approve/post.
- [ ] Stock count draft/submit/approve.
- [ ] Adjustment event creation from approved stock count variance.
- [ ] Issue to ops posting.
- [ ] Sales batch creation/import.
- [ ] Sales consumption from recipes/BOM.
- [ ] Branch operations UI wiring.

Acceptance criteria:

- Branch transactions use the central ledger service.
- Approval rules are enforced.
- Posted records cannot be deleted.
- Corrections happen through reversals or adjustment events.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 10: Reports and Exports

Status: `Not Started`

Goal: implement report jobs and exports for operational and audit reporting.

Implementation checklist:

- [ ] Report catalog.
- [ ] Report run creation.
- [ ] BullMQ report processing.
- [ ] Stock on hand report.
- [ ] Stock valuation report.
- [ ] Movement report.
- [ ] Wastage summary.
- [ ] Transfer variance report.
- [ ] Low stock report.
- [ ] Export download flow.
- [ ] Report UI wiring.

Acceptance criteria:

- Reports can be queued and completed.
- Completed reports are downloadable.
- Report parameters are validated.
- Export downloads are audit logged.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 11: Offline PWA Sync

Status: `Not Started`

Goal: implement offline transaction queueing, bootstrap snapshots, idempotent sync, and rejection handling.

Implementation checklist:

- [ ] PWA shell configuration.
- [ ] IndexedDB event queue.
- [ ] Offline bootstrap API.
- [ ] Sync status API.
- [ ] Sync batch submission API.
- [ ] Idempotent UUID processing.
- [ ] Rejected event response format.
- [ ] Editable rejected local entries.
- [ ] Offline Sync UI wiring.

Acceptance criteria:

- Allowed offline actions can be queued locally.
- Disallowed offline actions are blocked.
- Duplicate UUIDs do not duplicate ledger events.
- Rejected events show reasons and remain editable locally.

Test evidence:

- Commands run:
- Results:
- Issues found:

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

| Date | Decision | Reason | Owner |
| --- | --- | --- | --- |
| 2026-05-05 | Implement in vertical slices starting with environment, seed data, auth, ledger, stock-on-hand, then Inventory UI wiring. | Proves the core inventory spine before adding module-specific workflows. | Developer / Codex |
| 2026-05-05 | Track significant implementation notes on every guide update. | The guide must function as a handoff and traceability record, not only a task checklist. | Developer / Codex |

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
