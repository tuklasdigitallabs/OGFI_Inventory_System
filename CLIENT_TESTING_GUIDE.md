# OGFI Inventory Client Testing Guide

## Purpose

Use this guide to test the current OGFI Inventory system before client acceptance.

The system is currently focused on inventory, costing, purchasing, receiving, transfers, branch operations, menu pricing, reports, offline sync, and admin controls.

Important scope note: branch sales batch consumption is available under Store Operations, but a full ERP Sales module with customer orders, invoices, payments, returns, and AR is not yet complete.

## General Testing Rules

- Test with at least one admin user and one non-admin user.
- Test with more than one location when possible.
- After creating or posting a transaction, refresh the page and confirm the record is still present.
- Confirm Inventory reflects stock changes after receiving, transfers, wastage, stock counts, issue to ops, and sales batches.
- Record the user, date/time, role, location, test data used, expected result, actual result, and screenshots for failed tests.
- Do not use real supplier invoices, real customer data, or production-sensitive values during testing.

## Recommended Test Accounts

Use the available seeded or admin-created users for these roles:

- Administrator
- Warehouse Manager
- Purchasing
- Branch Manager
- Branch Encoder
- Auditor
- Viewer

If a role does not exist or cannot log in, log that as an admin setup issue.

## 1. Login and Session

### Function to Test

- Login.
- CAPTCHA challenge.
- Current user session.
- Password change if required.
- Logout/session expiry behavior.

### Steps

1. Open `https://inventory.onegourmetph.com`.
2. Log in with a valid user.
3. Confirm the dashboard loads.
4. Confirm the sidebar only shows modules allowed for that role.
5. Refresh the browser.
6. Confirm the session remains valid.
7. Log out or clear the session if logout is available.
8. Try opening the app again.

### Expected Result

- Valid credentials allow access.
- Invalid credentials are rejected.
- The visible navigation matches the user's permissions.
- Protected pages cannot be accessed without login.

### Edge Cases

- Wrong password.
- Blank username or password.
- User with inactive account.
- User with limited permissions.
- User assigned to only one location.
- Expired or cleared browser session.

## 2. Dashboard

### Function to Test

- Operational KPI visibility.
- Recent movement visibility.
- Navigation to major modules.

### Steps

1. Log in as an admin or manager.
2. Open Dashboard.
3. Review KPI cards.
4. Confirm recent movements show real transaction data when transactions exist.
5. Create a stock movement from another module, such as receiving or wastage.
6. Return to Dashboard and refresh.

### Expected Result

- Dashboard loads without placeholder errors.
- KPIs and movement tables reflect available system data.
- Users only see dashboard data allowed by their role/location.

### Edge Cases

- User with no location access.
- No transaction history yet.
- Low stock or out-of-stock item.
- Large number of recent transactions.

## 3. Inventory

### Function to Test

- Stock on hand.
- Inventory movements.
- Adjustment request creation.
- Adjustment approval and rejection.
- Location-specific stock visibility.

### Steps

1. Open Inventory.
2. Select or filter by a location.
3. Search for an item by SKU or name.
4. Confirm on-hand, available, reserved, in-transit, average cost, and value fields.
5. Open movements and confirm transaction history.
6. Create an adjustment request for an item.
7. Log in as a user who can approve adjustments.
8. Approve or reject the request.
9. Refresh Inventory and confirm the stock result.

### Expected Result

- Stock balances are location-specific.
- Movements show posted ledger activity.
- Adjustment requests require valid item, location, quantity, reason, and cost.
- Approved adjustments update stock.
- Rejected adjustments do not update stock.

### Edge Cases

- Adjustment with zero quantity.
- Adjustment with negative or invalid quantity.
- Adjustment without reason code.
- User without approval permission.
- User trying to view unauthorized location.
- Item with no stock history.
- Item below low-stock threshold.

## 4. Master Data

### Function to Test

- Items.
- UOMs.
- UOM conversions.
- Suppliers.
- Locations.
- Categories.
- Reason codes.
- Recipes.

### Steps

1. Open Master Data.
2. Select each resource tab or resource selector.
3. Create a test record where creation is allowed.
4. Edit the test record.
5. Deactivate the test record if allowed.
6. Search for the record.
7. Refresh and confirm changes persist.
8. Click Template and open the downloaded Excel workbook.
9. Confirm the workbook has an Instructions sheet and data sheets for every Master Data section.
10. Add valid rows to multiple sheets, then upload the workbook.
11. Confirm valid rows are created or updated.
12. Upload a workbook with one valid row and one invalid row.
13. Confirm the valid row imports and the failed row appears in the downloadable Error Report.
14. Correct the Error Report workbook and upload it again.

### Expected Result

- Records can be created, updated, searched, and deactivated according to permissions.
- Required fields are enforced.
- Deactivated records should not be used in new transactions where active records are required.
- Master Data can be bulk-created or bulk-updated from one Excel workbook.
- Failed import rows can be downloaded, corrected, and resubmitted.

### Edge Cases

- Duplicate SKU, code, or supplier reference.
- Missing required field.
- Invalid UOM conversion factor.
- Deactivating a record used by existing transactions.
- Creating an item without base UOM.
- Creating recipe lines with duplicate ingredients.
- User with read-only master data permission.
- Blank active value in the import workbook should default to Active.
- Error report upload should ignore the errorMessages column after correction.
- Invalid workbook type or missing workbook file.

## 5. Recipes

### Function to Test

- Recipe/BOM setup.
- Ingredient lines.
- Yield and wastage assumptions.
- Recipe costing support.

### Steps

1. Open Recipes.
2. Create a recipe for a finished good or menu item.
3. Add ingredient lines.
4. Save the recipe.
5. Edit the recipe and adjust quantities.
6. Confirm recipe cost changes where shown.
7. Deactivate a test recipe if allowed.

### Expected Result

- Recipes save with valid output item and ingredient lines.
- Ingredient quantities and UOMs are validated.
- Recipe changes are reflected in costing/menu pricing where applicable.

### Edge Cases

- Recipe without lines.
- Duplicate ingredient lines.
- Ingredient without UOM conversion.
- Inactive ingredient item.
- User without recipe update permission.

## 6. Menu Pricing

### Function to Test

- Draft menu pricing.
- Target food cost or margin.
- Submit for approval.
- Approve menu price.
- Clone approved price.

### Steps

1. Open Menu Pricing.
2. Create a draft price for a recipe.
3. Set channel, selling price, effective date, and optional target.
4. Save the draft.
5. Submit the draft.
6. Log in as an approver.
7. Approve the pending price.
8. Clone an approved price to create a new draft.

### Expected Result

- Drafts can be created and submitted by permitted users.
- Only permitted users can approve.
- Approved prices are protected from direct editing.
- Promo prices require an end date.

### Edge Cases

- Selling price of zero or invalid number.
- Promo price without end date.
- Effective end date before effective date.
- User without approval permission.
- Recipe without valid costing.

## 7. Purchasing

### Function to Test

- Purchase order creation.
- Purchase order update.
- Submit/approve/reject.
- Close balance.
- Supplier item cost lookup.

### Steps

1. Open Purchasing.
2. Create a purchase order with supplier, location, expected date, and item lines.
3. Save the purchase order.
4. Submit the purchase order.
5. Log in as an approver.
6. Approve or reject the purchase order.
7. For approved POs, test close balance when applicable.

### Expected Result

- Purchase orders save with valid supplier, location, items, quantities, and costs.
- Draft POs can be edited.
- Approval status controls what actions are available.
- Rejected POs do not proceed to receiving.

### Edge Cases

- PO without lines.
- Duplicate item lines.
- Invalid quantity or unit cost.
- Inactive supplier.
- Inactive item.
- User without approval permission.
- User without access to PO location.
- Cost override requiring approval if configured.

## 8. Receiving

### Function to Test

- Supplier receiving.
- Receiving against purchase order.
- Accepted and rejected quantities.
- Ledger stock increase.
- Receiving remarks and invoice/DR reference.

### Steps

1. Open Receiving or Purchasing receiving flow.
2. Select an approved PO if testing PO-based receiving.
3. Enter DR reference and invoice reference.
4. Enter accepted and rejected quantities.
5. Post receiving.
6. Open Inventory for the receiving location.
7. Confirm stock increased for accepted quantity.
8. Confirm receiving appears in history/detail.

### Expected Result

- Receiving posts accepted quantity into inventory.
- Rejected quantity does not increase stock.
- PO remaining quantity updates when receiving is linked to a PO.
- Required references are enforced.

### Edge Cases

- Receiving more than PO remaining quantity.
- Negative accepted or rejected quantity.
- Missing DR reference.
- Missing invoice reference.
- Receiving inactive item.
- Receiving against rejected/cancelled PO.
- User without receiving permission.

## 9. Transfers

### Function to Test

- Transfer creation.
- Approval.
- Dispatch.
- Receive.
- Variance review and resolution.
- Source reservation and destination in-transit tracking.

### Steps

1. Open Transfers.
2. Create a transfer from warehouse/source location to branch/target location.
3. Add item lines and requested quantities.
4. Submit or save as required by the UI.
5. Approve the transfer.
6. Dispatch picked quantities.
7. Open Store Operations for the target branch.
8. Receive the transfer.
9. Confirm Inventory changes at source and target locations.

### Expected Result

- Transfer creation validates source, target, and item quantities.
- Source and target must be different.
- Dispatch reserves or moves stock according to the workflow.
- Receiving posts final stock movement.
- Variances remain open until resolved.

### Edge Cases

- Transfer to the same location.
- Requested quantity greater than available stock.
- Dispatch quantity missing.
- Receive quantity greater than dispatched quantity.
- Partial receive.
- Variance receive.
- User without dispatch/receive permission.
- User without access to source or target location.

## 10. Store Operations

### Function to Test

- Branch selector.
- Branch stock on hand.
- Incoming transfers.
- Wastage.
- Stock count.
- Issue to operations.
- Sales batch consumption.

### Steps

1. Open Store Operations.
2. Select a branch/store.
3. Confirm stock rows load for that branch.
4. Receive an incoming transfer if one exists.
5. Record wastage for an item with available stock.
6. Post a beginning or EOD stock count.
7. Post issue to operations.
8. Post a sales batch for a finished/menu item with a valid recipe.
9. Refresh Inventory and confirm stock changes.

### Expected Result

- Store Operations is scoped to the selected branch.
- Wastage, stock count, issue to ops, and sales batch records post through the ledger.
- Stock cannot go negative.
- Histories show posted branch operations.

### Edge Cases

- Wastage more than available stock.
- Issue more than available stock.
- Stock count with invalid quantity.
- Sales batch for item without recipe.
- Sales batch with insufficient ingredient stock.
- UOM without conversion.
- Branch user trying unauthorized branch.
- Loose-count item with full units plus loose quantity.

## 11. Reports

### Function to Test

- Report catalog.
- Report run creation.
- Report history.
- CSV download.
- Location/date filtering.

### Steps

1. Open Reports.
2. Select a report such as Stock On Hand, Stock Valuation, Movements, Wastage Summary, Transfer Variance, or Low Stock.
3. Enter required parameters.
4. Run the report.
5. Confirm the run appears in history.
6. Download the CSV.
7. Open the CSV and confirm values match expected transactions.

### Expected Result

- Reports run successfully with valid parameters.
- Reports only include locations the user can access.
- Downloaded CSV is readable.

### Edge Cases

- Missing required date range.
- Date from after date to.
- Unauthorized location.
- No records for selected filters.
- Large date range.
- User with report read but not run permission.

## 12. Offline Sync

### Function to Test

- Bootstrap data.
- Device selection.
- Offline queue.
- Offline PIN.
- Sync batch submission.
- Rejected event handling.

### Steps

1. Open Offline Sync.
2. Confirm bootstrap data loads for allowed locations.
3. Register/select an active sync device if required.
4. Unlock offline storage with offline PIN if configured.
5. Create offline events such as wastage, stock count, issue to ops, or sales consumption.
6. Reconnect and submit sync batch.
7. Confirm sync status shows completed or completed with rejections.
8. Check Inventory and Store Operations for posted results.

### Expected Result

- Offline data is scoped to allowed locations.
- Valid offline events sync and post.
- Duplicate events are idempotent.
- Invalid events are rejected with a reason.

### Edge Cases

- Wrong offline PIN.
- Inactive sync device.
- Duplicate event UUID.
- Event for unauthorized location.
- Event type not allowed offline.
- Missing required quantity or reason.
- Offline event with insufficient stock.
- Browser cache cleared before sync.

## 13. Admin Settings - Users

### Function to Test

- Create user.
- Edit user.
- Deactivate user.
- Reset password.
- Unlock/unrestrict user if available.
- Location access assignment.

### Steps

1. Log in as Administrator.
2. Open Admin Settings > Users.
3. Create a test user with role and location access.
4. Edit the user name, active state, role, and location access.
5. Reset the user's password if available.
6. Deactivate the user.
7. Try logging in as the deactivated user.

### Expected Result

- Users can be managed by admins.
- Passwords are not displayed.
- Location access controls what data the user can see.
- Deactivated users cannot log in.
- Admin cannot deactivate their own account.

### Edge Cases

- Duplicate email.
- Duplicate username.
- Missing role.
- No location access.
- Invalid email format.
- Self-deactivation.
- Non-admin trying to access Admin Settings.

## 14. Admin Settings - Roles and Permissions

### Function to Test

- Role selection.
- Module permission cards.
- Quick permission modes.
- Advanced exact permission editing.
- Search and filters.
- Save role permissions.

### Steps

1. Open Admin Settings > Roles.
2. Select a non-admin role.
3. Confirm module cards are visible.
4. Use None, View, Manage, and Full on a module.
5. Expand Advanced.
6. Select or clear exact permissions.
7. Use search to find a module or permission.
8. Use Enabled and Changed filters.
9. Save Access.
10. Refresh the page.
11. Confirm permission changes persisted.
12. Log in as a user with that role and confirm access changed.

### Expected Result

- Role permissions can be maintained without using a long flat permission list.
- Quick controls update the underlying permission selections.
- Advanced checkboxes remain available for exact control.
- Sensitive permissions are visually marked.

### Edge Cases

- Remove all permissions from a non-admin role.
- Give a read-only role create/update permission.
- Add Admin Settings permissions to a non-admin role.
- Save without changes.
- Refresh before saving changes.
- User editing a role without role-update permission.

## 15. Admin Settings - Devices

### Function to Test

- Sync device registration.
- Device update.
- Device deactivation.
- Device location assignment.

### Steps

1. Open Admin Settings > Devices.
2. Create a device with code, name, type, active state, and optional location.
3. Edit the device.
4. Deactivate the test device.
5. Open Offline Sync and confirm inactive devices are not selectable.

### Expected Result

- Active devices can be used for sync.
- Inactive devices cannot be used for new sync activity.
- Device actions appear in audit logs.

### Edge Cases

- Duplicate device code.
- Missing device name.
- Invalid or inactive location.
- Device with no assigned location.
- Non-admin user attempting device management.

## 16. Admin Settings - Audit Trail

### Function to Test

- Audit log visibility.
- Audit filtering.
- Pagination.
- Admin action tracking.

### Steps

1. Open Admin Settings > Audit Trail.
2. Create, update, or deactivate a test user.
3. Return to Audit Trail.
4. Filter by module, action, search text, and date range.
5. Use pagination if available.

### Expected Result

- Admin and governance actions appear in the audit log.
- Filters return matching records.
- Audit rows show user, module, action, entity, and timestamp.

### Edge Cases

- No logs for selected filter.
- Date range with no results.
- Search by user, action, entity, or module.
- User without audit permission.

## 17. Admin Settings - Offline PIN

### Function to Test

- Offline PIN policy visibility.
- Offline PIN reset.
- Offline PIN verification through Offline Sync.

### Steps

1. Open Admin Settings > Offline PIN.
2. Set or reset the offline PIN.
3. Open Offline Sync.
4. Unlock offline storage using the new PIN.
5. Try an incorrect PIN.

### Expected Result

- Admin can reset the offline PIN.
- Correct PIN unlocks offline storage.
- Wrong PIN is rejected.
- Actual PIN is not displayed after saving.

### Edge Cases

- PIN confirmation mismatch.
- Blank PIN.
- Too-short PIN if length rules apply.
- Non-admin trying to reset PIN.

## 18. Permission and Location Access Regression

### Function to Test

- Role permissions.
- Location access.
- Unauthorized route protection.

### Steps

1. Create or select a user with limited permissions.
2. Assign the user to only one branch.
3. Log in as that user.
4. Confirm only allowed navigation appears.
5. Try direct URL access to restricted modules.
6. Try viewing or posting data for another location.

### Expected Result

- Restricted modules are hidden or blocked.
- Unauthorized API actions fail.
- Unauthorized locations are not visible or actionable.

### Edge Cases

- User with no permissions.
- User with permission but no location access.
- User with location access but missing module permission.
- Direct URL access to hidden pages.

## 19. End-to-End Inventory Flow

### Function to Test

- Complete operational flow from purchasing to branch consumption.

### Steps

1. Create a PO for an item.
2. Approve the PO.
3. Receive the item into warehouse.
4. Confirm warehouse stock increases.
5. Create a transfer to branch.
6. Approve and dispatch the transfer.
7. Receive the transfer at branch.
8. Confirm branch stock increases.
9. Record wastage or issue to ops at branch.
10. Confirm branch stock decreases.
11. Run Stock On Hand and Movements reports.

### Expected Result

- Each transaction updates the next operational state.
- Ledger movements match the transaction trail.
- Reports match inventory balances.

### Edge Cases

- Partial receiving.
- Transfer variance.
- Wastage after transfer.
- Insufficient stock at branch.
- User role changes during the flow.

## 20. Known Current Limitations to Communicate

- Full ERP Sales module is not complete.
- Finance GL/AP/AR modules are not yet implemented.
- Cash/banking, payroll, fixed assets, CRM, and production planning are not yet implemented.
- Reports are CSV-focused.
- Some deployment and production-hardening work may still require final sign-off.

## Test Result Template

Use this format for each issue found:

```text
Module:
Function tested:
User/role:
Location:
Steps performed:
Expected result:
Actual result:
Screenshot/video:
Severity: Critical / High / Medium / Low
Notes:
```
