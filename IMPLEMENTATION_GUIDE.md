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

Phase 1: Database Migration and Seed Foundation

Current status: `Not Started`

Next action: validate the Prisma schema for migration readiness, create the initial migration, and add repeatable seed data for roles, permissions, admin user, locations, UOMs, items, and reason codes.

## Phase Checklist

| Phase | Name | Status | User Sign-Off |
| --- | --- | --- | --- |
| 0 | Environment, Dependency, and Baseline Validation | Completed | 2026-05-05 |
| 1 | Database Migration and Seed Foundation | Not Started | Pending |
| 2 | Auth, RBAC, and Location Access | Not Started | Pending |
| 3 | Immutable Ledger Engine | Not Started | Pending |
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

Status: `Not Started`

Goal: create the first database migration and seed enough baseline data for auth, master data, and inventory testing.

Implementation checklist:

- [ ] Validate and adjust `apps/api/prisma/schema.prisma` if needed.
- [ ] Create initial Prisma migration.
- [ ] Add seed script for roles.
- [ ] Add seed script for permissions.
- [ ] Add seed script for admin user.
- [ ] Add seed script for sample locations.
- [ ] Add seed script for UOMs and conversions.
- [ ] Add seed script for sample categories/items.
- [ ] Add seed script for reason codes.
- [ ] Document seed credentials in a safe local-only way.

Acceptance criteria:

- `prisma migrate dev` succeeds on a clean database.
- Seed script succeeds on a clean database.
- Seed script is idempotent or safely repeatable.
- Baseline data supports the first ledger and inventory UI tests.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 2: Auth, RBAC, and Location Access

Status: `Not Started`

Goal: implement login, JWT auth, current user lookup, role permissions, and location access checks.

Implementation checklist:

- [ ] Add auth DTOs.
- [ ] Implement password hashing and login.
- [ ] Implement JWT access token issuing.
- [ ] Implement refresh token path or explicitly defer it with a tracked note.
- [ ] Add current user endpoint.
- [ ] Add auth guard.
- [ ] Add permission guard.
- [ ] Add location access guard.
- [ ] Add audit logs for sensitive auth/admin actions.
- [ ] Wire UI login state or temporary dev session strategy.

Acceptance criteria:

- Valid users can log in.
- Invalid credentials fail safely.
- Protected API routes reject unauthenticated requests.
- Role permission checks work.
- Location-scoped users cannot access unauthorized locations.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

## Phase 3: Immutable Ledger Engine

Status: `Not Started`

Goal: implement the core service for posting immutable inventory ledger events.

Implementation checklist:

- [ ] Add ledger event DTOs.
- [ ] Implement transaction-safe ledger posting.
- [ ] Enforce idempotent event UUIDs.
- [ ] Enforce valid `qtyIn`/`qtyOut` rules.
- [ ] Prevent direct balance edits.
- [ ] Implement reversal support for corrections.
- [ ] Add reference type and reference ID validation hooks.
- [ ] Add audit logging for ledger posts.
- [ ] Add unit tests for allowed transaction types.

Acceptance criteria:

- Ledger events are immutable after posting.
- Duplicate UUIDs do not create duplicate events.
- Invalid quantities are rejected.
- Ledger posting runs inside a database transaction.
- All ledger posts create audit logs.

Test evidence:

- Commands run:
- Results:
- Issues found:

User sign-off:

- Tested by:
- Date:
- Approval:

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
