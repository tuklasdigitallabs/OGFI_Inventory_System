#!/usr/bin/env node

const {
  apiDir,
  backupDatabase,
  backupRoot,
  prepareResetTarget,
  run,
} = require("./db-reset-helpers");

function usage() {
  console.log(`Usage: npm run api:db:reset:local -- --yes

Options:
  --yes      Required. Confirms this destructive local reset.
  --dry-run  Validate guards and show planned actions without touching the DB.

Environment:
  DATABASE_URL is read from apps/api/.env when not already set.
  LOCAL_RESET_BACKUP_DIR may override the backup directory.
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
    throw new Error("--yes is required for this destructive local reset.");
  }

  const { databaseUrl, parsed, databaseName } = prepareResetTarget();

  console.log(`Local reset target: ${parsed.hostname}/${databaseName}`);
  console.log(`Backup directory: ${backupRoot}`);

  if (dryRun) {
    console.log("Dry run passed. No database changes were made.");
    return;
  }

  const backupPath = backupDatabase(databaseUrl, parsed, databaseName, "reset");
  console.log(`Backup created: ${backupPath}`);

  run("npx", ["prisma", "migrate", "reset", "--force", "--skip-seed"], {
    cwd: apiDir,
  });
  run("npx", ["prisma", "db", "seed"], { cwd: apiDir });

  console.log("Local database reset complete.");
}

try {
  main();
} catch (error) {
  console.error(`Local database reset refused: ${error.message}`);
  process.exit(1);
}
