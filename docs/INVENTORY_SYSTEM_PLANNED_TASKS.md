# Inventory System Planned Tasks

This task plan is based on `docs/INVENTORY_SYSTEM_AUDIT.md`. It is grouped by delivery priority and focuses on fixes that reduce demo risk, data integrity risk, and production-readiness risk.

## Immediate Fixes

### 1. Enforce Location Access on Detail Endpoints

- Status: Completed in this pass.
- Task: Add authenticated-user location checks to all detail endpoints that fetch records by ID.
- Reason: Prevent users from opening records for branches/warehouses outside their assigned access if they know or guess a UUID.
- Files likely involved:
  - `apps/api/src/transfers/transfers.controller.ts`
  - `apps/api/src/transfers/transfers.service.ts`
  - `apps/api/src/purchasing/purchasing.controller.ts`
  - `apps/api/src/purchasing/purchasing.service.ts`
  - `apps/api/src/branch-ops/branch-ops.controller.ts`
  - `apps/api/src/branch-ops/branch-ops.service.ts`
- Acceptance criteria:
  - Transfer detail and variance endpoints reject users without access to source or target location.
  - Purchase order and receiving detail endpoints reject users without access to the document location.
  - Stock count detail endpoint rejects users without access to the count location.
  - Existing valid users can still open their own location records.
- Estimated complexity: Medium.
- Risk if not fixed: High.

### 2. Make Document Posting and Ledger Posting Atomic

- Status: Completed in this pass for the listed target flows.
- Task: Refactor high-risk workflows so source document creation/status update and ledger event creation commit together.
- Reason: Prevent documents without ledger movement, or ledger movement without the document status update.
- Files likely involved:
  - `apps/api/src/ledger/ledger.service.ts`
  - `apps/api/src/branch-ops/branch-ops.service.ts`
  - `apps/api/src/transfers/transfers.service.ts`
  - `apps/api/src/purchasing/purchasing.service.ts`
- Target flows:
  - Wastage
  - Stock count variance
  - Issue to operations
  - Emergency purchase
  - Sales batch consumption
  - Transfer receive and variance resolution
  - Adjustment approval
- Acceptance criteria:
  - If ledger posting fails, the source document is not created or not advanced.
  - If document update fails, the ledger event is not created.
  - Existing ledger idempotency behavior remains intact.
- Estimated complexity: High.
- Risk if not fixed: High.

### 3. Add Upload Size, Type, and Row Limits

- Status: Completed in this pass.
- Task: Add explicit upload controls for Excel import endpoints.
- Reason: Prevent accidental oversized files or invalid file uploads from consuming memory.
- Files likely involved:
  - `apps/api/src/master-data/master-data.controller.ts`
  - `apps/api/src/ledger/ledger.controller.ts`
  - `apps/api/src/master-data/master-data-import.service.ts`
  - `apps/api/src/ledger/opening-inventory-import.service.ts`
- Acceptance criteria:
  - Only `.xlsx` uploads are accepted.
  - A clear max file size is enforced.
  - A clear max row count is enforced.
  - Error response tells the user what limit failed.
- Estimated complexity: Low.
- Risk if not fixed: Medium.

### 4. Block Item Base UOM Changes After Usage

- Status: Completed in this pass.
- Task: Prevent changing an item base UOM once that item has dependent inventory or recipe records.
- Reason: Changing base UOM after transactions can reinterpret historical stock quantities and costing.
- Files likely involved:
  - `apps/api/src/master-data/master-data.service.ts`
  - Optional tests in `apps/api/src/master-data` if test coverage is added.
- Usage checks should include:
  - Ledger events
  - Supplier items
  - Purchase order lines
  - Receiving lines
  - Transfer lines
  - Stock count lines
  - Wastage lines
  - Issue lines
  - Emergency purchase lines
  - Recipe lines/output recipes
  - Sales batch lines
- Acceptance criteria:
  - New items can still change base UOM before usage.
  - Used items return a clear validation error when base UOM change is attempted.
  - Other editable item fields still work.
- Estimated complexity: Medium.
- Risk if not fixed: High.

## Before Client Demo

### 1. Add Duplicate Count Controls

- Status: Completed in this pass at the API service layer.
- Task: Prevent accidental duplicate opening and EOD stock counts for the same location/date/type.
- Reason: Duplicate physical counts can double-post variance adjustments.
- Files likely involved:
  - `apps/api/src/branch-ops/branch-ops.service.ts`
  - `apps/api/src/ledger/opening-inventory-import.service.ts`
  - Optional Prisma migration if enforcing with DB uniqueness.
- Acceptance criteria:
  - Only one opening count can be posted per location unless explicitly reset.
  - EOD count duplication rules are enforced based on agreed client policy.
  - Duplicate attempt returns a user-friendly error.
- Estimated complexity: Medium.
- Risk if not fixed: Medium.

### 2. Fix Standalone Receiving UOM Handling

- Status: Completed in this pass at the API service layer.
- Task: Add UOM handling to receiving lines that are not linked to a PO.
- Reason: Current standalone receiving treats accepted quantity as base UOM, which can misstate stock if the user enters purchase UOM.
- Files likely involved:
  - `apps/api/src/purchasing/dto/purchasing.dto.ts`
  - `apps/api/src/purchasing/purchasing.service.ts`
  - `apps/web/components/purchasing-live-page.tsx`
  - `apps/web/lib/api-client.ts`
- Acceptance criteria:
  - Standalone receiving line includes selected UOM.
  - API converts received quantity to item base UOM before ledger posting.
  - Missing conversion returns a clear error.
  - PO-linked receiving continues to use PO line/supplier item conversion.
- Estimated complexity: Medium.
- Risk if not fixed: High.

### 3. Treat Invalid Opening Inventory Unit Cost as Import Error

- Status: Completed in this pass.
- Task: Validate unit cost in opening inventory upload instead of silently converting invalid values to zero.
- Reason: Zero-cost opening inventory can distort valuation and average costing.
- Files likely involved:
  - `apps/api/src/ledger/opening-inventory-import.service.ts`
- Acceptance criteria:
  - Blank cost can still fall back to supplier item cost if available.
  - Invalid nonblank cost creates an error row.
  - Error workbook includes the bad row for correction and reupload.
- Estimated complexity: Low.
- Risk if not fixed: Medium.

### 4. Clarify Sales Flow and Hide Placeholder Sales API If Needed

- Status: Completed in this pass by unmounting the placeholder `/api/sales` module and keeping Store Operations sales batches as the client-facing sales path.
- Task: Confirm whether sales should use Store Operations sales batch only, then remove or hide the placeholder `/api/sales` flow if not needed.
- Reason: The implemented sales consumption flow is under branch operations, while `SalesService` is still placeholder-based.
- Files likely involved:
  - `apps/api/src/sales/sales.controller.ts`
  - `apps/api/src/sales/sales.service.ts`
  - `apps/api/src/app.module.ts`
  - `apps/web/components/store-operations-expanded-page.tsx`
- Acceptance criteria:
  - Client-facing sales testing path is clear.
  - Placeholder endpoints are not presented as working production APIs.
  - Branch sales batch consumption remains working.
- Estimated complexity: Low.
- Risk if not fixed: Low to Medium.

### 5. Add Focused Demo Regression Tests

- Status: Completed in this pass with focused service-level specs for opening inventory import and standalone receiving conversion. Existing ledger specs cover negative stock rejection and transfer receipt costing.
- Task: Add or update targeted tests for the flows the client will test first.
- Reason: Client demo will likely touch setup, opening count, receiving, transfer, store ops, and reports.
- Files likely involved:
  - `apps/api/src/ledger/ledger.service.spec.ts`
  - New focused specs for purchasing, transfers, branch ops, and imports if practical.
  - `PHASE_TEST_INSTRUCTIONS.md`
- Acceptance criteria:
  - Tests cover opening inventory upload rules.
  - Tests cover receiving quantity/cost conversion.
  - Tests cover stock-out negative prevention.
  - Tests cover transfer receive/variance behavior.
  - `PHASE_TEST_INSTRUCTIONS.md` is updated with demo validation flows.
- Estimated complexity: Medium.
- Risk if not fixed: Medium.

## Before Production Use

### 1. Implement Revocable Sessions and Refresh Token Rotation

- Status: Completed in this pass with persistent user sessions, refresh-token rotation, logout revocation, and account-change session invalidation.
- Task: Replace access-token-only session behavior with persistent sessions and refresh-token rotation.
- Reason: Logout, password change, deactivation, lockout, and role changes should invalidate active sessions.
- Files likely involved:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/auth/auth.service.ts`
  - `apps/api/src/auth/strategies/jwt.strategy.ts`
  - `apps/web/components/auth-gate.tsx`
  - `apps/web/lib/api-client.ts`
- Acceptance criteria:
  - Login creates a server-side session or refresh-token record.
  - Refresh rotates refresh tokens.
  - Logout revokes the active session.
  - Deactivate/lock/password reset invalidates existing sessions.
  - Expired/revoked sessions are rejected.
- Estimated complexity: High.
- Risk if not fixed: High.

### 2. Replace Count-Based Document Numbering

- Status: Completed in this pass with a database-backed `document_sequences` counter and shared document-number helper.
- Task: Use database-backed sequence/counter generation for business document numbers.
- Reason: Current same-day count logic can collide under concurrent requests.
- Files likely involved:
  - `apps/api/prisma/schema.prisma`
  - `apps/api/src/purchasing/purchasing.service.ts`
  - `apps/api/src/transfers/transfers.service.ts`
  - `apps/api/src/branch-ops/branch-ops.service.ts`
  - `apps/api/src/ledger/ledger.service.ts`
  - `apps/api/src/ledger/opening-inventory-import.service.ts`
- Acceptance criteria:
  - Concurrent requests produce unique numbers without failing due to duplicate document number.
  - Numbering remains readable by prefix/date.
  - Existing documents keep their current numbers.
- Estimated complexity: Medium.
- Risk if not fixed: Medium.

### 3. Add Concurrency-Safe Stock Posting

- Status: Completed in this pass for ledger-backed stock postings using transaction-scoped advisory locks per location/item.
- Task: Introduce a reliable concurrency strategy for inventory postings.
- Reason: Current stock checks calculate state before posting and can race under simultaneous stock-out operations.
- Possible approaches:
  - Use transaction-level advisory locks per `locationId:itemId`.
  - Add an inventory balance table updated atomically.
  - Use serializable transactions for posting flows.
- Files likely involved:
  - `apps/api/src/ledger/ledger.service.ts`
  - `apps/api/src/costing/costing.service.ts`
  - `apps/api/prisma/schema.prisma`
- Acceptance criteria:
  - Simultaneous stock-out requests cannot push stock negative.
  - Transfer reservations are respected atomically.
  - Average costing remains correct after concurrent receiving/outbound actions.
- Estimated complexity: High.
- Risk if not fixed: High.

### 4. Preserve or Archive Audit Logs During Production Resets

- Status: Completed in this pass for the demo-data reset script by preserving audit logs and recording a reset audit entry.
- Task: Ensure production cleanup/reset operations never silently delete audit history.
- Reason: Audit logs are compliance and traceability records.
- Files likely involved:
  - `scripts/reset-demo-data.js`
  - `scripts/db-reset-helpers.js`
  - Future VPS cleanup scripts or runbooks.
- Acceptance criteria:
  - Production reset requires explicit confirmation and backup.
  - Audit logs are archived before deletion or preserved by default.
  - Reset logs record who ran the reset and when.
- Estimated complexity: Low.
- Risk if not fixed: Medium.

### 5. Store Generated Report Output

- Status: Completed in this pass by storing generated CSV content on the report run and downloading the stored snapshot.
- Task: Persist the report result generated at run time.
- Reason: Current report downloads regenerate from live data, so completed report results can change later.
- Files likely involved:
  - `apps/api/src/reports/reports.service.ts`
  - `apps/api/prisma/schema.prisma`
- Acceptance criteria:
  - Completed report download returns the same data generated at run time.
  - Report run stores output path/blob or immutable content.
  - Report generation errors are retained for troubleshooting.
- Estimated complexity: Medium.
- Risk if not fixed: Medium.

### 6. Harden Production Authentication Defaults

- Status: Completed in this pass with per-user random temporary passwords and an empty login identifier field.
- Task: Remove predictable provisioning defaults and production-facing login hints.
- Reason: Shared temporary passwords and default admin hints are unnecessary production exposure.
- Files likely involved:
  - `apps/api/src/auth/password-policy.ts`
  - `apps/api/src/admin/admin.service.ts`
  - `apps/web/components/auth-gate.tsx`
- Acceptance criteria:
  - New/reset passwords are random per user.
  - Admin can securely communicate/reset temporary credentials.
  - Login identifier field is empty by default in production.
- Estimated complexity: Medium.
- Risk if not fixed: Medium.

### 7. Production-Grade Rate Limiting and Monitoring

- Status: Completed in this pass with Redis-backed rate limiting support, structured rate-limit warnings, and public health/readiness checks.
- Task: Replace or supplement in-memory API rate limiting with shared infrastructure and add operational monitoring.
- Reason: In-memory rate limits reset on restart and do not work across multiple API instances.
- Files likely involved:
  - `apps/api/src/main.ts`
  - Redis or deployment infrastructure config
  - VPS/deployment runbooks
- Acceptance criteria:
  - Login and API rate limits are enforced consistently.
  - Failed login spikes and API errors are visible in logs/monitoring.
  - Health checks cover API, web, database, and migration status.
- Estimated complexity: Medium.
- Risk if not fixed: Low to Medium.
