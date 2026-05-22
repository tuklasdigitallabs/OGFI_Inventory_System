#!/usr/bin/env node

const {
  apiDir,
  backupDatabase,
  backupRoot,
  prepareResetTarget,
  run,
} = require("./db-reset-helpers");

const resetSql = `
TRUNCATE TABLE
  "sync_events",
  "sync_batches",
  "report_runs",
  "audit_logs",
  "adjustment_requests",
  "sales_batch_lines",
  "sales_batches",
  "issue_to_ops_lines",
  "issue_to_ops",
  "wastage_lines",
  "wastage",
  "stock_count_lines",
  "stock_counts",
  "ledger_events",
  "receiving_lines",
  "receivings",
  "purchase_order_lines",
  "purchase_orders",
  "transfer_lines",
  "transfers",
  "recipe_yield_observations",
  "menu_prices"
RESTART IDENTITY CASCADE;
`;

function usage() {
  console.log(`Usage: npm run api:demo-data:reset -- --yes

Options:
  --yes      Required. Confirms this destructive demo-data reset.
  --dry-run  Validate guards and show planned actions without touching the DB.

This reset preserves users, passwords, roles, permissions, master data,
sync devices, and system settings. It clears client testing workflows and
reloads safe baseline seed data without changing seeded account credentials.
`);
}

function main() {
  const args = new Set(process.argv.slice(2));

  if (args.has("-h") || args.has("--help")) {
    usage();
    return;
  }

  const dryRun = args.has("--dry-run");

  if (!dryRun && !args.has("--yes")) {
    usage();
    throw new Error("--yes is required for this destructive demo-data reset.");
  }

  const { databaseUrl, parsed, databaseName } = prepareResetTarget({
    allowRemoteDemoReset: true,
  });

  console.log(`Demo-data reset target: ${parsed.hostname}/${databaseName}`);
  console.log(`Backup directory: ${backupRoot}`);
  console.log("Preserved data: users, credentials, roles, permissions, master data, sync devices, system settings.");
  console.log("Cleared data: purchasing, receiving, transfers, ledger, counts, wastage, issues, sales, sync batches, reports, audits, menu pricing tests.");

  if (dryRun) {
    console.log("Dry run passed. No database changes were made.");
    return;
  }

  const backupPath = backupDatabase(databaseUrl, parsed, databaseName, "demo-data-reset");
  console.log(`Backup created: ${backupPath}`);

  run("npx", [
    "prisma",
    "db",
    "execute",
    "--stdin",
    "--schema",
    "prisma/schema.prisma",
  ], {
    cwd: apiDir,
    input: resetSql,
  });
  run("node", ["scripts/seed-demo-baseline.js"], {
    cwd: apiDir,
  });

  console.log("Demo data reset complete.");
}

try {
  main();
} catch (error) {
  console.error(`Demo-data reset refused: ${error.message}`);
  process.exit(1);
}
