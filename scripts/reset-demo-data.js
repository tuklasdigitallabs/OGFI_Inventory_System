#!/usr/bin/env node

const { randomUUID } = require("crypto");
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

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function resetAuditSql({ backupPath, databaseName, hostname }) {
  const after = JSON.stringify({
    backupPath,
    databaseName,
    hostname,
    preserved: ["audit_logs"],
    resetBy: process.env.USERNAME || process.env.USER || "unknown",
    resetAt: new Date().toISOString(),
    resetType: "demo-data-reset",
  });

  return `
INSERT INTO "audit_logs" (
  "id",
  "module",
  "action",
  "entityType",
  "after",
  "createdAt"
) VALUES (
  ${sqlString(randomUUID())}::uuid,
  'admin',
  'demo-data.reset',
  'Database',
  ${sqlString(after)}::jsonb,
  NOW()
);
`;
}

function usage() {
  console.log(`Usage: npm run api:demo-data:reset -- --yes

Options:
  --yes      Required. Confirms this destructive demo-data reset.
  --dry-run  Validate guards and show planned actions without touching the DB.

This reset preserves users, passwords, roles, permissions, master data,
sync devices, system settings, and audit logs. It clears client testing workflows and
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
  console.log("Preserved data: users, credentials, roles, permissions, master data, sync devices, system settings, audit logs.");
  console.log("Cleared data: purchasing, receiving, transfers, ledger, counts, wastage, issues, sales, sync batches, reports, menu pricing tests.");

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
  run("npx", [
    "prisma",
    "db",
    "execute",
    "--stdin",
    "--schema",
    "prisma/schema.prisma",
  ], {
    cwd: apiDir,
    input: resetAuditSql({
      backupPath,
      databaseName,
      hostname: parsed.hostname,
    }),
  });

  console.log("Demo data reset complete.");
  console.log("Audit logs were preserved and a reset audit entry was recorded.");
}

try {
  main();
} catch (error) {
  console.error(`Demo-data reset refused: ${error.message}`);
  process.exit(1);
}
