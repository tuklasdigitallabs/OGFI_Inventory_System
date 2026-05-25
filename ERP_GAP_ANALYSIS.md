# ERP Gap Analysis

## Purpose

This document lists the missing functions needed to grow OGFI Inventory from an inventory and costing system into a full ERP platform.

Current state: the system already covers inventory, stock ledger, costing, purchasing, receiving, transfers, branch operations, menu pricing, reports, offline sync, admin users, RBAC, and audit logs.

Target state: a full ERP should connect operational transactions to finance, sales, people, assets, planning, compliance, and executive reporting.

## Current ERP-Level Foundations

- Central item, UOM, supplier, location, category, reason code, and recipe master data.
- Role-based access control and location access.
- Immutable inventory ledger.
- Stock-on-hand and moving average costing.
- Purchase orders and supplier receiving.
- Warehouse and branch transfer workflows.
- Branch wastage, stock count, issue-to-ops, and sales batch consumption.
- Menu pricing and recipe costing support.
- CSV reports for inventory and movement visibility.
- Offline PWA sync foundation.
- Admin user, role, device, and audit-log management.

## Missing Functions for Full ERP

### 1. Finance Core

Status: Missing.

Required functions:

- General Ledger chart of accounts.
- Journal entry creation, approval, posting, and reversal.
- Accounting periods and period close.
- Trial balance.
- Balance sheet.
- Income statement.
- Cash flow statement.
- Audit trail for accounting entries.
- Fiscal year setup.
- Cost center and department accounting.
- Multi-branch accounting consolidation.

Why it matters:

- The current system tracks operational inventory value, but it does not yet produce official books of account.

### 2. Accounts Payable

Status: Missing.

Required functions:

- Supplier invoice recording.
- Invoice matching against purchase orders and receiving records.
- Tax, discount, and freight handling.
- Payment scheduling.
- Payment recording.
- Supplier balance tracking.
- AP aging report.
- Debit memo and supplier credit handling.
- Payment approval workflow.

Why it matters:

- Purchasing and receiving exist, but supplier financial obligations are not yet tracked.

### 3. Accounts Receivable

Status: Missing.

Required functions:

- Customer master data.
- Customer invoices.
- Credit sales tracking.
- Payment collection.
- Customer balance tracking.
- AR aging report.
- Credit memo handling.
- Statement of account.
- Collection status and follow-up tracking.

Why it matters:

- Sales consumption exists for inventory, but customer billing and collections do not.

### 4. Cash and Banking

Status: Missing.

Required functions:

- Cash account setup.
- Bank account setup.
- Cash receipts.
- Cash disbursements.
- Bank reconciliation.
- Deposit tracking.
- Check or transfer payment references.
- Cash position report.

Why it matters:

- A full ERP must track actual cash movement, not only operational inventory movement.

### 5. Sales Order and POS Integration

Status: Partial.

Current support:

- Branch sales batch consumption exists through branch operations and offline sync.
- The standalone sales API service still has scaffold behavior.

Required functions:

- Customer order lifecycle.
- Sales quotation.
- Sales order approval.
- Delivery or fulfillment.
- Sales invoice generation.
- POS import or direct POS integration.
- Sales return handling.
- Discount, promo, and tax rules.
- Gross sales, net sales, and margin reports.

Why it matters:

- The system can consume inventory from sales batches, but it does not yet manage the full selling process.

### 6. Procurement Expansion

Status: Partial.

Current support:

- Purchase order creation, approval, receiving, and closing exist.

Required functions:

- Purchase request or requisition.
- Request for quotation.
- Supplier quotation comparison.
- Purchase approval matrix.
- Blanket purchase orders.
- Contract pricing.
- Landed cost allocation.
- Supplier performance scorecards.

Why it matters:

- Purchasing exists, but full procurement planning and supplier commercial control are not complete.

### 7. Budgeting and Cost Control

Status: Missing.

Required functions:

- Annual and monthly budgets.
- Budget per branch, department, account, or cost center.
- Purchase budget checks.
- Expense budget checks.
- Actual vs budget reports.
- Budget revision workflow.

Why it matters:

- ERP systems need financial planning controls, not only transaction recording.

### 8. Human Resources and Payroll

Status: Missing.

Required functions:

- Employee master data.
- Job roles and departments.
- Attendance or timekeeping integration.
- Payroll computation.
- Benefits and deductions.
- Leave management.
- Payroll approval.
- Payroll journal posting.

Why it matters:

- People cost is a major operational cost area and normally belongs in a complete ERP.

### 9. Fixed Assets

Status: Missing.

Required functions:

- Asset register.
- Asset categories.
- Acquisition cost tracking.
- Depreciation rules.
- Depreciation posting to GL.
- Asset transfer between locations.
- Asset disposal.
- Asset count and audit.

Why it matters:

- Equipment, leasehold improvements, vehicles, and store assets need lifecycle and accounting control.

### 10. Manufacturing or Production Planning

Status: Partial.

Current support:

- Recipes and ingredient costing exist.
- Sales batch consumption can reduce ingredient stock.

Required functions:

- Production orders.
- Batch manufacturing.
- Planned vs actual ingredient usage.
- Yield variance.
- Work-in-process inventory.
- Finished goods receipt from production.
- Production scheduling.
- Material requirements planning.

Why it matters:

- Recipe costing is a foundation, but production execution and planning are separate ERP capabilities.

### 11. Warehouse Management Expansion

Status: Partial.

Current support:

- Location-level stock, transfers, receiving, and stock counts exist.

Required functions:

- Bin or shelf locations.
- Lot and batch tracking.
- Expiry date tracking.
- FEFO/FIFO picking support.
- Barcode scanning.
- Putaway workflow.
- Picking and packing workflow.
- Inventory reservation by order.

Why it matters:

- Current inventory is strong at item/location level, but warehouse operations are not yet deep WMS-level.

### 12. Quality Control

Status: Missing.

Required functions:

- Receiving inspection.
- Quality hold status.
- Rejection and return-to-supplier process.
- Batch quality records.
- Expiry and spoilage controls.
- Corrective action tracking.

Why it matters:

- Food or branch operations usually need quality checks tied to receiving, storage, production, and wastage.

### 13. CRM and Customer Management

Status: Missing.

Required functions:

- Customer profiles.
- Contacts.
- Customer groups.
- Sales history.
- Customer pricing rules.
- Credit limits.
- Account status.

Why it matters:

- A full ERP should manage customer relationships, not only inventory impact from sales.

### 14. Workflow and Approval Engine

Status: Partial.

Current support:

- Some module-specific approvals exist, such as purchase orders, transfers, adjustments, and menu prices.

Required functions:

- Configurable approval matrix.
- Approval levels by amount, branch, role, or module.
- Delegation.
- Escalation.
- Approval history.
- Notification rules.

Why it matters:

- Full ERP workflows should be configurable instead of hardcoded per module.

### 15. Notifications and Task Inbox

Status: Missing.

Required functions:

- User task inbox.
- Pending approval notifications.
- Low stock alerts.
- Transfer variance alerts.
- Sync rejection alerts.
- Email or messaging integration.
- Notification read/unread state.

Why it matters:

- ERP users need a central place to act on exceptions and approvals.

### 16. Executive Dashboards and BI

Status: Partial.

Current support:

- Operational dashboard and inventory reports exist.

Required functions:

- Financial dashboard.
- Sales dashboard.
- Procurement dashboard.
- Branch profitability.
- Cost variance dashboard.
- Cash position dashboard.
- Drilldown from KPI to transaction.
- Scheduled reports.

Why it matters:

- Full ERP reporting should connect operations, finance, and performance.

### 17. Compliance, Tax, and Document Controls

Status: Missing.

Required functions:

- Tax code setup.
- VAT or sales tax tracking.
- Withholding tax support if required.
- Official document numbering.
- Document cancellation controls.
- Retention policy.
- Exportable accounting records.

Why it matters:

- Finance modules must support legal and audit requirements.

### 18. System Administration and Production Hardening

Status: Partial.

Current support:

- Admin users, roles, permissions, devices, and audit logs exist.

Required functions:

- Refresh token rotation.
- Backup and restore procedure.
- Production environment checklist.
- Monitoring and alerting.
- Error tracking.
- Rate-limit tuning.
- Data retention policies.
- Disaster recovery plan.
- Security review.
- Dependency audit remediation.

Why it matters:

- A system can be functionally broad but still not production ERP-ready without operational hardening.

## Recommended Implementation Order

### Phase A: Accounting Foundation

- Chart of accounts.
- Accounting periods.
- Journal entries.
- Inventory-to-GL posting rules.
- Trial balance.

Reason:

- This turns inventory value into auditable financial records.

### Phase B: AP from Existing Purchasing

- Supplier invoices.
- PO and receiving invoice matching.
- Supplier payments.
- AP aging.

Reason:

- The purchasing workflow already exists, so AP is the natural first finance module.

### Phase C: Sales and AR

- Replace remaining sales scaffold.
- Customer master data.
- Sales invoice.
- Customer payments.
- AR aging.

Reason:

- This completes the revenue side and connects sales consumption to customer billing.

### Phase D: Cash, Banking, and Financial Statements

- Cash receipts and disbursements.
- Bank accounts.
- Bank reconciliation.
- Balance sheet and income statement.

Reason:

- These make finance usable for day-to-day business control.

### Phase E: ERP Expansion Modules

- Budgeting.
- HR/payroll.
- Fixed assets.
- Production planning.
- Quality control.
- Warehouse bin/lot/expiry controls.

Reason:

- These broaden the ERP after finance and sales are stable.

### Phase F: Platform Hardening

- Monitoring.
- Backups.
- Security review.
- Configurable approvals.
- Notifications.
- Scheduled reports.

Reason:

- These make the system ready for real operational scale.

## Minimum Definition of Full ERP

The system can be considered full ERP when it can:

- Record operational transactions.
- Convert operational transactions into accounting entries.
- Track supplier payables.
- Track customer receivables.
- Track cash and bank movement.
- Produce financial statements.
- Manage procurement, inventory, sales, and branch operations end to end.
- Enforce approvals, permissions, audit trails, and period controls.
- Support production deployment with backup, monitoring, and security controls.

## Current Classification

Current classification: inventory and costing ERP module with strong operational foundations.

Not yet: complete ERP suite.

Primary missing area: finance core, especially GL, AP, AR, cash, banking, and financial statements.
