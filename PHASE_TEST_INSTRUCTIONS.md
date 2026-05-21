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
- Confirm the right section shows that role's permission access list.
- Select or clear a permission checkbox on a non-admin test role.
- Click Save Permissions.
- Refresh the page.
- Confirm the permission change persists.
- Log in as a user with that role if possible and confirm the changed permission affects access.

Expected result: Existing role permissions can be maintained from Admin Settings.

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

## Phase 9 - Store Operations

Scope: Branch/store inventory operations, including branch stock visibility, incoming transfer receiving, wastage, stock count, issue to ops, and sales batch posting.

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

### 7. Sales Batch

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

### 8. Permissions

- Log in as a branch user.
- Confirm only allowed branch/store locations appear in the selector.
- Confirm unauthorized branch/store data is not visible.
- Log in with a role that can create but not read a branch operation history.
- Confirm posting works and missing history access does not break the page.
- Log in as manager/admin.
- Confirm permitted history records are visible.

Expected result: Store Operations respects role and location access without breaking workflows.

### 9. Regression Checks

- Confirm Transfers can still be created, approved, dispatched, and received.
- Confirm Inventory reflects Store Operations ledger changes.
- Confirm Dashboard stock value and low stock tiles update after branch operations.
- Confirm all tables with line-item records remain expandable/collapsible.
- Confirm only users with `master-data.items:create` can add new item master records.
- Confirm Store Operations still blocks negative stock for wastage, issue to ops, and sales batch consumption.

Expected result: Phase 9 does not break Purchasing, Transfers, Inventory, or Dashboard stock summaries.

### Deferred Store Operations Workflow Tests

These are intentionally left for the next Store Operations workflow slice:

- Daily inventory session lock: branch cannot start prep/ops before Beginning Count.
- EOD lock: branch cannot post stock-touching operations after EOD Count is finalized.
- Beginning Count prompt when it does not tally with the previous EOD count.
- Store item/package request: branch requests a local replacement item/package size and HQ approves before use.

### Phase 9 Pass Criteria

Phase 9 passes when branch staff can select a branch/store, view current stock, receive transfers, post wastage/count/issues/sales, see ledger-driven stock changes, and expand operation records to view line items.

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
