# Phase Test Instructions

This file tracks validation steps for each implementation phase.

Moving forward, after each phase implementation, update this file with:

- The phase name and scope.
- The exact user flows to validate.
- Expected results for each flow.
- Known limitations or items intentionally left for a later phase.

---

## Admin Settings Catch-Up

Scope: Admin Settings live user management, role permission maintenance, permission visibility, and audit-log review.

### 1. Page Load

- Log in as an admin or head office user with admin permissions.
- Open Admin Settings.
- Confirm the Users, Roles, and Audit tabs are visible.
- Confirm KPI tiles show active users, roles, and audit logs.

Expected result: Admin Settings loads live data and no placeholder response appears.

### 2. Create User

- Open the Users tab.
- Enter full name, email, username, password, role, active state, and one or more location access values.
- Search Location Access by location code or name.
- Confirm matching locations are filtered and selected locations remain selected.
- Click Save User.
- Confirm the new user appears in the user table.
- Confirm password is not displayed anywhere in the user table or response-driven UI.

Expected result: Admin can create a user with role and location access.

### 3. Edit User

- Click the edit action for a user.
- Change full name, role, active state, and location access.
- Leave password blank.
- Click Save User.
- Confirm profile, role, active status, and locations update while password remains unchanged.
- Edit again and enter a new password of at least 8 characters.
- Confirm save succeeds.

Expected result: Admin can update user metadata, role, location scope, active state, and password only when a new password is provided.

### 4. Deactivate User

- Click deactivate for a test user that is not the signed-in user.
- Confirm the user changes to Inactive.
- Try deactivating the currently signed-in user if possible.

Expected result: Other users can be deactivated, but self-deactivation is blocked.

### 5. Role Permissions

- Open the Roles tab.
- Confirm Administrator is selected by default.
- Confirm the left section shows the available role list.
- Click a different role in the left section.
- Confirm the right section shows module permission cards instead of one long flat list.
- Confirm each module card shows an access summary and enabled permission count.
- Use the None, View, Manage, and Full controls on a non-admin test role.
- Expand Advanced on a module and confirm the exact permission checkboxes are still available.
- Search for a permission or module and confirm the visible cards are filtered.
- Use Enabled and Changed filters and confirm the list reflects the selected filter.
- Select or clear an advanced permission checkbox on a non-admin test role.
- Click Save Permissions.
- Refresh the page.
- Confirm the permission change persists.
- Log in as a user with that role if possible and confirm the changed permission affects access.

Expected result: Existing role permissions can be maintained from Admin Settings through grouped module controls, with exact advanced permissions still available when needed.

### 6. Audit Logs

- Create, update, or deactivate a user.
- Open the Audit tab.
- Confirm the admin action appears with user, module, action, entity type, and timestamp.
- Update role permissions.
- Confirm a role-permission audit entry appears.
- Confirm only 15 audit rows show on one page.
- Use Previous and Next to move between audit pages when more than 15 rows exist.
- Filter by search text, module, action, and date range.
- Clear filters and confirm the full audit list returns.

Expected result: Admin governance actions are visible in audit history.

### 7. Sync Devices

- Open the Devices tab.
- Register a device with device code, name, type, active state, and assigned location.
- Confirm the device appears in the device table.
- Edit the device and change its name, type, location, or active state.
- Deactivate a test device.
- Confirm deactivated devices cannot be selected for Offline Sync after refresh.
- Confirm device create, update, and deactivate actions appear in Audit Trail.

Expected result: Admins can manage registered sync devices used by Offline Sync.

### Deferred Admin Settings Items

- Create arbitrary custom roles. Current roles are enum-backed and fixed by schema.
- Role name/code redesign for custom roles.
- Fine-grained UI filters for users and audit logs.

### Admin Settings Pass Criteria

Admin Settings passes when admins can create, update, and deactivate users, maintain existing role permissions, manage registered sync devices, and review audit logs for those actions.

---

## Opening Inventory Upload

Scope: Client month-end inventory workbook upload for branch/store beginning inventory.

### 1. Client Count Sheet Upload

- Open Inventory as an admin or warehouse manager with ledger posting access.
- Click Opening Inventory.
- Select a pilot branch/store with no existing inventory movements.
- Set the business date to the client's beginning inventory date.
- Upload the client month-end count workbook.
- Confirm rows with blank COUNT and blank LOOSE are ignored.
- Confirm rows with valid items, UOMs, and pack sizes post as one Opening stock count.
- Confirm Inventory stock on hand increases for the selected branch/store.
- Confirm Inventory Movements show `STOCK_COUNT` entries with reference type `COUNT`.
- For `500GM/PACK`, count UOM `G`, `COUNT = 2`, and `LOOSE = 350`, confirm the system posts `1.35 KG` when the item base UOM is KG.
- For `25KG/SACK`, count UOM `KG`, `COUNT = 2`, and `LOOSE = 5`, confirm the system posts `55 KG`.

Expected result: The client's month-end count sheet can become the selected branch/store's beginning inventory.

### 2. Validation and Error Report

- Upload a workbook with an unknown item, unknown UOM, missing UOM conversion, or duplicate item.
- Confirm the upload does not post.
- Download the error workbook.
- Confirm the error workbook includes original sheet, row, category, item, purchase UOM, UOM, COUNT, LOOSE, unit cost, and error messages.
- Fix the error workbook and upload it again.

Expected result: Invalid opening inventory rows are rejected with a downloadable workbook that can be corrected and resubmitted.

### 3. Duplicate Opening Guard

- Upload opening inventory successfully for one branch/store.
- Try uploading opening inventory again for the same branch/store after ledger movements exist.
- Confirm the second upload is blocked.

Expected result: A branch/store cannot accidentally post beginning inventory twice after inventory movement has started.

---

## Phase 9 - Store Operations

Scope: Branch/store inventory operations, including branch stock visibility, incoming transfer receiving, wastage, stock count, issue to ops, emergency purchases, and sales batch posting.

### 1. Branch Selector

- Open Store Operations.
- Click the Branch / Store selector.
- Confirm it opens as a searchable dropdown.
- Type part of a branch/store code or name.
- Confirm matching branches/stores are filtered.
- Select a branch/store.
- Confirm Stock On Hand, Incoming Transfers, and operation history reload for the selected branch/store.

Expected result: Branch/store selection controls all Store Operations data shown on the page.

### 2. Branch Stock On Hand

- Select a branch/store with inventory.
- Confirm stock rows show only inventory for the selected branch/store.
- Confirm quantity displays with UOM.
- Confirm status badges use these colors:
  - OK = green
  - Low = yellow
  - Out of Stock = red
- Issue or waste the full available quantity for one stock row.
- Refresh Store Operations and Inventory.
- Confirm the row no longer appears as Low and shows Out of Stock in red if the item/location balance remains visible.

Expected result: Branch stock is ledger-based, location-specific, and visually clear.

### 3. Incoming Transfers

- Create and dispatch a transfer to a branch/store.
- Confirm dispatch does not create a `TRANSFER_OUT` ledger movement yet.
- Confirm source On Hand is unchanged, Source Available is reduced, Reserved Out increases, and destination In Transit In increases.
- Open Store Operations for the target branch/store.
- Confirm the dispatched transfer appears under Incoming Transfers.
- Receive the transfer.
- Confirm receiving posts both `TRANSFER_OUT` at the source and `TRANSFER_IN` at the destination.
- Confirm branch stock increases.
- Confirm the transfer no longer appears as incoming after receiving.
- Test a received quantity variance if applicable.
- Confirm variance leaves the unresolved quantity reserved/floating until manager resolution.
- Resolve a variance as source retained, source loss, and receive balance in separate test records.
- Confirm each resolution clears the EOD blocker and leaves On Hand, Available, Reserved Out, and In Transit In tallied.

Expected result: Dispatch reserves stock without ledger deduction. Receiving is the point where source and destination ledger movements are posted. Variance remains floating until resolved.

### 3A. EOD Transfer Blockers

- Dispatch a transfer and do not receive it before EOD.
- Open Store Operations for both source and destination.
- Confirm each location shows an unresolved transfer prompt.
- Create a transfer variance.
- Confirm the variance remains an unresolved transfer prompt until manager resolution.

Expected result: Stores can see floating transfer inventory and cannot consider EOD clean while dispatched or variance-review transfers remain open.

### 4. Wastage

- Confirm the Item dropdown only lists items with positive available stock in the selected branch/store.
- Select an item.
- Confirm the form shows the selected item's available quantity.
- Confirm UOM defaults to the item base UOM.
- Enter a valid wasted quantity and reason.
- Post wastage.
- Confirm branch stock decreases.
- Confirm wastage history appears.
- Expand the wastage history line count.
- Confirm line details show item, quantity, UOM, and wastage reason.
- Change UOM to a non-base UOM without a conversion.
- Confirm posting is blocked with a clear error.
- Try wasting more than available stock.
- Confirm posting is blocked.

Expected result: Wastage consumes stock, validates UOM conversion, prevents invalid stock movement, and keeps expandable line history.

### 5. Stock Count

- Select an item.
- Confirm UOM defaults to the item base UOM.
- Confirm the only available count types are Beginning Count and EOD Count.
- Post a Beginning Count for an active branch item.
- Confirm variance is calculated against current system quantity and posts through the ledger.
- Post an EOD Count.
- Confirm variance is calculated against system quantity.
- Select seeded loose item `COOKING-OIL`.
- Confirm stock count shows full-unit and loose-count fields instead of a single counted quantity.
- Enter `9` full units and `600` loose count.
- Confirm the computed total is `9.6 L`.
- Post the count.
- Confirm Inventory and Branch Stock On Hand display the item as whole units plus loose quantity.
- Confirm stock count history appears.
- Expand the stock count history line count.
- Confirm line details show correctly.

Expected result: Beginning and EOD counts adjust against current system stock. Cycle and Spot Count are not exposed in Store Operations.

Loose item expected result: Full units plus loose count are converted to the item base UOM before ledger posting. Example: `9 BTL + 600 ML` for Cooking Oil becomes `9.6 L`.

### 6. Issue To Ops

- Confirm the Item dropdown only lists items with positive available stock in the selected branch/store.
- Select an item.
- Confirm the form shows the selected item's available quantity.
- Confirm UOM defaults to the item base UOM.
- Enter a valid issued quantity.
- Post Issue to Ops.
- Confirm branch stock decreases.
- Confirm issue history appears.
- Expand the issue history line count.
- Confirm line details show correctly.
- Try issuing more than available stock.
- Confirm posting is blocked.
- Change UOM to a non-base UOM without a conversion.
- Confirm posting is blocked with a clear error.

Expected result: Issue to Ops records operational stock consumption without allowing invalid quantities or missing conversions.

### 7. Emergency Purchase

- Select a branch/store.
- Open the Emergency Purchase tab.
- Select an active item.
- Confirm UOM defaults to the item base UOM.
- Enter purchased quantity, unit cost, source/store, optional brand, receipt reference, reason, and remarks.
- Post Emergency Purchase.
- Confirm branch stock increases.
- Confirm inventory average cost updates from the emergency purchase unit cost.
- Confirm emergency purchase history appears.
- Expand the emergency purchase history line count.
- Confirm line details show item, quantity, UOM, unit cost, and optional brand.
- Change UOM to a non-base UOM with a valid conversion.
- Enter the cost per selected UOM and post.
- Confirm ledger unit cost is converted to base UOM cost.
- Change UOM to a non-base UOM without a conversion.
- Confirm posting is blocked with a clear error.
- Disconnect network and try posting.
- Confirm posting is blocked because emergency purchases are online-only.

Expected result: Emergency Purchase lets branch staff record emergency/local buys, increases stock through a posted `RECEIVE` ledger movement, keeps source/brand/receipt audit details, and validates UOM conversion.

### 8. Sales Batch

- Confirm the Item dropdown only lists finished goods.
- Select a finished item or menu item with an active recipe.
- Enter quantity sold.
- Post Sales Batch.
- Confirm ingredient stock is consumed from the branch/store.
- Confirm sales batch history appears.
- Expand the sales batch history line count.
- Confirm line details show correctly.
- Try posting a sales batch for an item without an active recipe.
- Confirm posting is blocked with a clear error.
- Try posting when ingredient stock is insufficient.
- Confirm posting is blocked.

Expected result: Sales Batch consumes recipe ingredients from branch inventory through ledger events.

### 9. Permissions

- Log in as a branch user.
- Confirm only allowed branch/store locations appear in the selector.
- Confirm unauthorized branch/store data is not visible.
- Log in with a role that can create but not read a branch operation history.
- Confirm posting works and missing history access does not break the page.
- Log in as manager/admin.
- Confirm permitted history records are visible.

Expected result: Store Operations respects role and location access without breaking workflows.

### 10. Regression Checks

- Confirm Transfers can still be created, approved, dispatched, and received.
- Confirm Inventory reflects Store Operations ledger changes.
- Confirm Dashboard stock value and low stock tiles update after branch operations.
- Confirm all tables with line-item records remain expandable/collapsible.
- Confirm only users with `master-data.items:create` can add new item master records.
- Confirm Store Operations still blocks negative stock for wastage, issue to ops, and sales batch consumption.
- Confirm Emergency Purchase increases stock without changing transfer, receiving, or purchase order records.

Expected result: Phase 9 does not break Purchasing, Transfers, Inventory, or Dashboard stock summaries.

### Deferred Store Operations Workflow Tests

These are intentionally left for the next Store Operations workflow slice:

- Daily inventory session lock: branch cannot start prep/ops before Beginning Count.
- EOD lock: branch cannot post stock-touching operations after EOD Count is finalized.
- Beginning Count prompt when it does not tally with the previous EOD count.
- Store item/package request: branch requests a new local replacement item/package size and HQ approves before use.

### Phase 9 Pass Criteria

Phase 9 passes when branch staff can select a branch/store, view current stock, receive transfers, post wastage/count/issues/emergency purchases/sales, see ledger-driven stock changes, and expand operation records to view line items.

---

## Phase 10 - Reports and Exports

Scope: CSV report catalog, report run creation, run history, and CSV downloads for operational inventory reports.

### 1. Report Catalog and Page Load

- Open Reports.
- Confirm the report selector loads:
  - Stock On Hand
  - Stock Valuation
  - Inventory Movements
  - Wastage Summary
  - Transfer Variance
  - Low Stock
- Confirm the location selector shows only locations allowed for the signed-in user.
- Confirm the run history table loads existing report runs.

Expected result: Reports page loads live catalog and run history without placeholder data.

### 2. Stock On Hand CSV

- Select Stock On Hand.
- Select one allowed location.
- Run the report.
- Confirm a completed report run appears.
- Download CSV.
- Confirm CSV contains location, SKU, item, category, item type, UOM, qty on hand, average unit cost, and inventory value.

Expected result: CSV reflects current ledger-derived stock balances for the selected location.

### 3. Stock Valuation CSV

- Select Stock Valuation.
- Select all allowed locations or a specific location.
- Run the report and download CSV.
- Compare total inventory value against Inventory stock value summary.

Expected result: Report values are derived from live ledger quantities and costs.

### 4. Inventory Movements CSV

- Select Inventory Movements.
- Enter a date range.
- Optionally select location and item type.
- Run and download CSV.
- Confirm movement rows include business date, location, SKU, item, movement type, qty in, qty out, unit cost, extended cost, and reference.

Expected result: Date and location filters narrow movement rows correctly.

### 5. Wastage Summary CSV

- Post or use an existing wastage record.
- Select Wastage Summary.
- Enter a date range covering the wastage business date.
- Run and download CSV.
- Confirm rows include wastage number, reason, item, qty, UOM, unit cost, extended cost, and status.

Expected result: Wastage report can be used for operations review.

### 6. Transfer Variance CSV

- Use an existing transfer variance or create one by receiving less than dispatched quantity.
- Select Transfer Variance.
- Run and download CSV.
- Confirm rows include transfer number, source, target, item, picked qty, received qty, variance qty, and status.

Expected result: Transfer variance report surfaces unresolved or mismatched transfer lines.

### 7. Low Stock CSV

- Select Low Stock.
- Run and download CSV.
- Confirm rows only show items at or below low stock threshold.
- Confirm out-of-stock rows are marked separately from low rows.

Expected result: Low stock report matches Inventory low/empty stock visibility.

### 8. Permissions and Location Scope

- Log in as a branch user.
- Run a report for all allowed locations.
- Confirm rows only include that user's allowed locations.
- Try selecting or requesting an unauthorized location through the API if possible.
- Confirm the API rejects it.

Expected result: Reports respect the same location scope as Inventory and Store Operations.

### Deferred Phase 10 Items

These are intentionally left for a later Phase 10 slice:

- Background queue processing with BullMQ.
- XLSX and PDF export formats.
- Persisted generated files or object storage URLs.
- Audit log entry when a report is downloaded.

### Phase 10 Pass Criteria

Phase 10 passes when users can run each CSV report, download the output, verify location/date filters, and confirm report rows match live operational data.

---

## Phase 11 - Offline PWA Sync

Scope: Offline bootstrap data, local browser queue, sync batch submission, idempotent event UUID handling, rejected event review/edit/retry, and sync batch monitoring.

### 0S. Security Hardening Smoke Test

- Open the login page.
- Confirm the ALTCHA CAPTCHA appears and login is blocked until it is completed.
- Try five invalid logins for the same username/IP.
- Confirm additional login attempts are blocked with a too-many-attempts message.
- Log in successfully and create a six-character-or-longer Offline PIN.
- Refresh the page and confirm Offline PIN unlock is required before cached data opens.
- Queue or refresh offline data, then sign out.
- Confirm pending sync count returns to zero and offline cached pages/data are cleared from this browser.

Expected result: Login has CAPTCHA/rate limiting, offline data requires PIN unlock, and logout clears confidential local data.

### 0. Global Connection Status

- Open any authenticated page.
- Confirm the header shows Online or Offline status.
- Confirm the Online/Offline and pending sync pills do not overlap the signed-in user controls.
- Queue one local offline event.
- Confirm the pending sync count updates in the header.
- Click Refresh Offline Data while online.
- Confirm the cache timestamp updates in the header.
- Disconnect the network while the app is already open.
- Confirm the header changes to Offline.
- Confirm an offline banner appears on every page, stating cached pages are read-only except offline-enabled queues.

Expected result: Connection state and pending local sync count are visible throughout the app.

### 0A. PWA App Shell and Cached Reads

- While online, visit Dashboard, Inventory, Master Data, Purchasing, Transfers, Store Operations, Reports, Menu Pricing, Admin, and Offline Sync.
- Click Refresh Offline Data.
- Disconnect the network.
- Navigate among the previously visited pages.
- Confirm pages open from the cached app shell.
- Confirm read-only data appears from the latest cache when that page/API data was previously loaded.
- Confirm modules that are not offline-write capable remain read-only while offline.

Expected result: Previously loaded pages can be reopened offline and show last-known cached data.

### 0B. Operations Dashboard Action Queue

- Open the Operations Dashboard.
- Confirm Quick Actions and Alerts shows only rows with counts greater than zero.
- Confirm each visible action displays a severity label: Critical, High, Medium, or Low.
- Confirm critical/high actions have stronger visual emphasis than medium/low actions.
- Confirm the empty state appears when no approvals or alerts require action.

Expected result: The dashboard action queue is exception-driven and visually prioritizes urgent work.

### 1. Bootstrap and Status

- Open Offline Sync.
- Confirm the page loads allowed locations, active items, and allowed offline event types.
- Confirm KPI tiles show local queue count, server pending count, and rejected count.
- Confirm Sync Batches table loads existing batches or an empty state.

Expected result: Offline Sync page is live and no longer shows placeholder data.

### 2. Queue Local Event

- Select an allowed location.
- Select a registered active device assigned to that location.
- Select an allowed event type, such as `ADJUSTMENT`.
- Select an item.
- Enter either Qty In or Qty Out.
- Enter Unit Cost and Business Date.
- Click Add to Queue.
- Confirm the event appears under Local Queue.

Expected result: Event is stored locally in the browser with working location and device ID. It is not sent to the server until Submit Queue is clicked.

### 2A. Store Operations Offline Queue

- Open Store Operations while online and refresh offline data.
- Disconnect the network.
- Post Wastage for an available item.
- Confirm a green queued notification appears, the event is saved to the offline queue, and the pending sync count increases.
- Post Issue to Ops and Sales Batch while offline if valid test data exists.
- Open Offline Sync and confirm the Store Operations events appear in Local Queue for the same location/device.
- Try Stock Count or EOD Count while offline.
- Confirm Stock Count/EOD is blocked with a message requiring reconnect/current server balances.
- Reconnect and submit the queue from Offline Sync.

Expected result: Safe outbound store operation events queue offline; Stock Count and EOD remain online-only.

### 2B. Offline Sync Event Inputs

- Open Offline Sync.
- Select `WASTAGE`.
- Confirm the form shows Item, Qty wasted, UOM, Reason, Business date, and Remarks.
- Select `ISSUE_TO_OPS`.
- Confirm the form shows Item, Qty issued, UOM, Business date, and Remarks.
- Select `SALE_CONSUMPTION`.
- Confirm the form shows Item, Qty sold, UOM, Business date, and Remarks.
- Select `ADJUSTMENT`.
- Confirm the form shows adjustment direction, quantity, UOM, unit cost, business date, and remarks.
- Select `STOCK_COUNT`.
- Confirm the form explains Stock Count is online-only from Store Operations and Add to Queue is disabled.

Expected result: Manual Offline Sync queue inputs match the Store Operations workflow labels and only allow safe offline event types.

### 3. Submit Queue

- With at least one queued event for the selected location, click Submit Queue.
- Confirm the event leaves the local queue if processed successfully.
- Confirm a new sync batch appears in Sync Batches.
- Confirm the sync batch shows the selected registered device.
- Confirm Inventory Movements shows the corresponding ledger event with reference `SYNC_BATCH`.

Expected result: Accepted offline events are processed through the central immutable ledger using the signed-in user, selected working location, and registered device.

### 4. Rejected Event Editing

- Queue an invalid event, for example an outbound quantity greater than available stock.
- Submit Queue.
- Confirm the rejected event remains in Local Queue with rejection reason.
- Edit the rejected event quantity or unit cost directly in the Local Queue row.
- Submit Queue again.
- Confirm it processes after correction.

Expected result: Rejected local events are editable and retryable.

### 5. Duplicate UUID Idempotency

- Submit a queue successfully.
- Re-submit the same event UUID through the API if possible.
- Confirm the API reports duplicate/already processed behavior and does not create another ledger event.

Expected result: Duplicate event UUIDs do not duplicate inventory movements.

### 6. Disallowed Offline Event Type

- Submit a batch through the API with a transaction type not allowed offline, such as `RECEIVE` or `TRANSFER_IN`.
- Confirm the sync event is rejected with a clear reason.

Expected result: Disallowed offline actions are blocked server-side.

### 7. Permissions and Location Scope

- Log in as a branch user.
- Confirm only allowed locations are shown.
- Confirm only registered active devices for the selected location are shown.
- Try submitting a batch for an unauthorized location through the API if possible.
- Confirm the API rejects it.
- Try submitting a batch using a device assigned to another location through the API if possible.
- Confirm the API rejects it.

Expected result: Sync respects user location scope and registered-device location assignment.

### Deferred Phase 11 Items

These are intentionally left for the next Offline Sync slice:

- PWA manifest/service worker shell.
- IndexedDB queue instead of localStorage.
- Automatic replay when connection returns.
- Editable rejected queue integration in Store Operations forms.
- Offline bootstrap snapshot versioning.

### Phase 11 Pass Criteria

Phase 11 passes when users can queue offline stock-touching events, submit them as sync batches, verify ledger results, confirm duplicate UUID idempotency, and edit/retry rejected local entries.

## Dev Super User Recovery Validation

Scope: local seeded break-glass account for resetting or unlocking restricted admin accounts.

### 1. Seed Dev Super User

- Set `SEED_DEV_SUPER_PASSWORD` in `apps/api/.env`.
- Run the API seed command.
- Log in with `SEED_DEV_SUPER_USERNAME`.
- Open Admin Settings.

Expected result: the dev super user can log in, has admin permissions, and can see user management.

### 2. Recover Restricted Admin

- Restrict or lock a non-dev admin account through failed login attempts.
- Log in as the dev super user.
- Use Admin Settings to unlock or unrestrict the affected admin account.
- Reset the affected admin password if needed.
- Log in as the recovered admin with the reset password.

Expected result: the dev super user can clear admin account restrictions and reset admin passwords without direct database edits.

### Known Limitations

- The dev super user is intended for local/development recovery and is only seeded when `SEED_DEV_SUPER_PASSWORD` is configured.
- Keep the dev super user password out of source control and production environments unless a formal break-glass policy is approved.

## Security Hardening Validation

Scope: API request throttling, security headers, nginx edge limits, and VPS port exposure.

### 0. Web Production API URL

- Build the web image with `apps/web/Dockerfile`.
- Confirm the build receives `NEXT_PUBLIC_API_URL=https://inventory.onegourmetph.com/api` through the Docker build argument or default.
- Open the production login page and inspect the ALTCHA widget challenge URL.
- Confirm the challenge URL is `https://inventory.onegourmetph.com/api/auth/altcha-challenge`, not `http://localhost:3000/api/auth/altcha-challenge`.

Expected result: the production web bundle calls the public production API URL baked in at build time.

### 1. API Request Limits

- Call `/api/auth/login` more than 10 times from the same client IP within 60 seconds.
- Confirm the API returns HTTP 429 with a retry message after the allowed attempts.
- Call `/api/auth/altcha-challenge` more than 30 times from the same client IP within 60 seconds.
- Confirm the API returns HTTP 429 after the allowed challenge requests.
- Browse rapidly through Admin, Master Data, Inventory, Purchasing, Receiving, Transfers, Store Operations, Reports, and Offline Sync as an admin user.
- Confirm ordinary authenticated navigation does not return HTTP 429 or sign the user out.

Expected result: login and ALTCHA challenge abuse is throttled without blocking normal app use.

### 2. Security Headers

- Request `https://inventory.onegourmetph.com/` and `https://inventory.onegourmetph.com/api/auth/altcha-challenge`.
- Confirm HTTPS remains active and HSTS is present.
- Confirm API responses do not expose `X-Powered-By`.

Expected result: public responses keep security headers and avoid framework disclosure.

### 3. VPS Port Exposure

- Check public listening ports on the VPS.
- Confirm only intended public ports remain reachable: 22 for SSH, 80 for HTTP redirect/ACME, and 443 for HTTPS.
- Confirm Postgres, Redis, API, web, and internal QSYS app ports are not directly exposed.

Expected result: public traffic reaches apps through nginx only.

### Known Limitations

- In-memory API throttling is per API container. If the API is scaled horizontally later, replace it with shared Redis-backed throttling.
- Firewall and SSH daemon hardening require sudo/root access to verify and enforce.

## Performance Cache Validation

Scope: short client-side caching for safe reference data and fresh reads for inventory/transaction data.

### 1. Reference Data Cache

- Log in and open Purchasing.
- Confirm suppliers, locations, items, and UOM selectors load normally.
- Navigate away and return within five minutes.
- Confirm reference selectors are available quickly without affecting purchase order freshness.

Expected result: stable reference data can reuse the short client cache.

### 2. Master Data Lazy Loading

- Open Master Data.
- Confirm the first visible tab and its required reference lists load.
- Open another Master Data tab.
- Confirm that tab loads when selected.

Expected result: unopened Master Data tabs are not fetched until needed.

### 3. Fresh Inventory and Transactions

- Open Inventory and refresh stock/movements.
- Create or update a purchase order, receiving, transfer, branch operation, report run, or sync batch.
- Return to the related section and confirm the latest server data is shown.

Expected result: inventory balances and transaction lists are always fetched from the server, not from client cache.

## Master Data Excel Import

Scope: Excel template download, bulk create/update import, partial success handling, and downloadable correction workbook for rejected rows.

### 1. Template Download

- Log in as an admin user with read access to all Master Data sections.
- Open Master Data.
- Click Template.
- Open the downloaded workbook.
- Confirm it includes the Instructions sheet and sheets for UOMs, Categories, Suppliers, Locations, Reason Codes, Items, UOM Conversions, Supplier Items, Recipes, and Recipe Lines.
- Confirm each data sheet has headers in row 1 and sample data in row 2.

Expected result: the workbook can be used as the single source template for all Master Data imports.

### 2. Valid Bulk Import

- Fill out valid rows across at least UOMs, Categories, Suppliers, Locations, Items, Supplier Items, Recipes, and Recipe Lines.
- Keep the active column blank on at least one row.
- Upload the workbook from Master Data.
- Confirm the import summary shows imported rows with created/updated counts.
- Refresh the affected Master Data tabs.
- Confirm imported records are visible and blank active values default to Active.
- Confirm Supplier Items can distinguish the same internal item by supplier, brand, supplier SKU, pack size, purchase UOM, and default unit cost.
- Confirm Supplier Items show Base Qty and Base UOM separately, with the Purchase UOM to Base result reading like `1 SACK = 25.00 KG`.
- In Supplier Items, search by an internal item SKU or name and confirm matching supplier catalog rows are shown.
- In Supplier Items, filter by Status, Supplier, and Brand and confirm the table narrows to matching rows.

Expected result: valid rows are created or updated without needing one-by-one entry.

### 3. Partial Import And Error Report

- Upload a workbook with at least one valid row and at least one invalid row, such as a duplicate recipe line ingredient, missing SKU, invalid enum value, or missing UOM reference.
- Confirm valid rows are still imported.
- Confirm the summary shows failed rows.
- Download the Error Report.
- Open the report and confirm it contains only failed entries plus an errorMessages column.
- Correct the workbook and upload the corrected Error Report.

Expected result: users can fix rejected rows from the downloadable error workbook and resubmit it.

### Known Limitations

- The import endpoint requires create and update permissions for all Master Data sections because a single workbook can touch every section.
- The template supports `.xlsx` workbooks only.

## Supplier Item Catalog Selection

Scope: supplier/brand-specific item selection in Purchasing while keeping Inventory tied to the internal item master.

### 1. Supplier Item Master Data

- Open Master Data.
- Open Supplier Items.
- Create two catalog rows for the same internal item using different supplier, brand, supplier SKU, pack size, purchase UOM, or default cost.
- Confirm the table shows supplier, internal item, brand, supplier SKU, pack, purchase UOM, cost, and status.

Expected result: purchasing options are maintained separately from the internal inventory item.

### 2. Purchase Order Item Selection

- Open Purchasing.
- Select a supplier.
- Confirm the line-item selector shows only that supplier's catalog items.
- Select a catalog item and confirm UOM and default cost load from the selected supplier item.
- Save the PO and expand it in the table.
- Confirm the line shows the internal item plus brand/supplier SKU details.
- Receive the PO.
- Confirm the receiving document keeps the PO purchase quantity and purchase UOM cost.
- Confirm the ledger movement posts quantity in the internal item's base UOM and unit cost converted to base UOM cost.
- Confirm Stock on Hand average unit cost updates using the converted base UOM cost.

Expected result: users choose the intended supplier catalog item before the PO line is saved.

### Costing Notes

- Inventory, receiving, costing, and ledger balances still post to the internal item.
- Receiving keeps supplier catalog context, but received stock remains consolidated by internal item.
- Positive stock count or adjustment variances with no entered cost use current average cost when one exists.

## Local Database Reset Script

Scope: local-only database reset helper for development environments.

### 1. Guarded Dry Run

- Run `npm run api:db:reset:local -- --dry-run`.
- Confirm it reports the local database target and backup directory without changing the database.
- Temporarily override `NODE_ENV=production` or use a non-local `DATABASE_URL`.
- Confirm the script refuses to run.

Expected result: unsafe or production-looking targets are blocked before backup or reset work begins.

### 2. Local Reset

- Run `npm run api:db:reset:local -- --yes`.
- Confirm a `pg_dump` backup is created before reset.
- Confirm Prisma migrations recreate the schema.
- Confirm the existing local seed script loads baseline development data.

Expected result: the local API database is rebuilt from existing Prisma migrations and seeded with local baseline data.

### Known Limitations

- The script targets the API PostgreSQL database only. Browser IndexedDB offline cache and queue data are separate and are not cleared.
- The seed step uses existing `apps/api/.env` seed variables and does not edit credential or production config files.

## Demo Data Reset Script

Scope: reset client testing/demo workflow data while preserving accounts and configuration.

### 1. Guarded Dry Run

- Run `npm run api:demo-data:reset -- --dry-run`.
- Confirm it reports the local database target, backup directory, preserved data, and cleared data.
- Temporarily override `NODE_ENV=production` or use a production-looking `DATABASE_URL`.
- Confirm the script refuses to run.

Expected result: unsafe targets are blocked before backup or reset work begins.

### 2. Client Testing Data Reset

- Run `npm run api:demo-data:reset -- --yes`.
- Confirm a `pg_dump` backup is created before data is cleared.
- Confirm purchasing, receiving, transfer, ledger, count, wastage, issue, sales, sync, report, audit, and menu-pricing test records are cleared.
- Confirm users, passwords, roles, permissions, master data, sync devices, and system settings remain available.
- Confirm the existing seed restores safe baseline master data and opening stock without changing seeded account credentials.

Expected result: client testers get a clean operational dataset without losing login credentials or local configuration.

### Known Limitations

- Browser IndexedDB offline cache and queue data are separate and are not cleared.
- This is not a schema reset. Use the full local database reset only when migrations and schema recreation must be tested.
- In the deployed API container, run `ALLOW_REMOTE_DEMO_RESET=true NODE_ENV=development npm run demo-data:reset -- --dry-run` before the `--yes` run, then copy the printed backup file out of the container.

## Admin User Role Selector Contract

Scope: user create/update wiring between Admin UI role selection and API validation.

### 1. Runtime Contract Check

- Deploy the current API image.
- Run `curl -k https://127.0.0.1/api/build-info`.
- Confirm `roleSelectorContract` is `uuid-or-role-code`.

Expected result: the live API is not an older image that only accepts UUID role selectors.

### 2. Admin User Save

- Log in as an administrator and open Admin > Users.
- Create a user with the default role selected.
- Edit an existing user and change their role.
- Confirm each save succeeds without `roleId must be a UUID`.

Expected result: the UI submits the current role UUID, and the API also accepts a role code or role name if a stale client sends one.

### 3. Regression Checks

- Run `npm test -w apps/api -- admin.dto.spec.ts`.
- Run `npm run api:build`.
- Run `npm run web:build`.

Expected result: role UUIDs, including deterministic seeded UUIDs such as `33333333-3333-3333-3333-333333333333`, uppercase role codes, lowercase role codes, role names, and short display labels pass DTO validation; unknown non-empty role selectors fail during role lookup with `Role is invalid.`

### Known Limitations

- Existing rollback images still contain the old UUID-only contract. Use `/api/build-info` after every emergency image swap to confirm the expected API is live.
