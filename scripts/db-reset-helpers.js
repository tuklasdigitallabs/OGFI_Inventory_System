const {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  unlinkSync,
} = require("fs");
const { tmpdir } = require("os");
const { join, resolve } = require("path");
const { spawnSync } = require("child_process");

const rootDir = resolve(__dirname, "..");
const apiDir = existsSync(join(rootDir, "apps", "api", "package.json"))
  ? join(rootDir, "apps", "api")
  : rootDir;
const envPath = join(apiDir, ".env");
const backupRoot =
  process.env.LOCAL_RESET_BACKUP_DIR ||
  join(tmpdir(), "ogfi-inventory-db-backups");
const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "host.docker.internal",
]);
const safeNodeEnvs = new Set(["development", "local", "test"]);
const dangerousPattern = /prod|production|live/i;

function loadApiEnv() {
  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function parseDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  let parsed;

  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }

  return { databaseUrl, parsed };
}

function assertSafeTarget(databaseUrl, parsed, options = {}) {
  const nodeEnv = process.env.NODE_ENV;

  if (!safeNodeEnvs.has(nodeEnv)) {
    throw new Error(
      `NODE_ENV must be one of ${[...safeNodeEnvs].join(", ")}. Current value: ${
        nodeEnv || "(unset)"
      }.`,
    );
  }

  if (!["postgresql:", "postgres:"].includes(parsed.protocol)) {
    throw new Error("Only PostgreSQL DATABASE_URL values are supported.");
  }

  const allowRemoteDemoReset =
    options.allowRemoteDemoReset &&
    process.env.ALLOW_REMOTE_DEMO_RESET === "true";

  if (!allowRemoteDemoReset && !localHosts.has(parsed.hostname)) {
    throw new Error(
      `Refusing to reset non-local database host "${parsed.hostname}". Set ALLOW_REMOTE_DEMO_RESET=true only for an approved demo VPS reset.`,
    );
  }

  const databaseName = parsed.pathname.replace(/^\//, "");

  if (!databaseName || dangerousPattern.test(databaseName)) {
    throw new Error(
      `Refusing production-looking database name "${databaseName || "(empty)"}".`,
    );
  }

  if (dangerousPattern.test(parsed.pathname) || dangerousPattern.test(parsed.hostname)) {
    throw new Error("Refusing production-looking DATABASE_URL.");
  }

  return databaseName;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
    stdio: options.input ? ["pipe", "inherit", "inherit"] : "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed.`);
  }
}

function commandAvailable(command) {
  const result = spawnSync(command, ["--version"], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  return !result.error && result.status === 0;
}

function runToFile(command, args, filePath) {
  const fd = openSync(filePath, "w");
  let shouldRemove = false;

  try {
    const result = spawnSync(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", fd, "inherit"],
      shell: process.platform === "win32",
    });

    if (result.error) {
      throw result.error;
    }

    if (result.status !== 0) {
      throw new Error(`${command} ${args.join(" ")} failed.`);
    }
  } catch (error) {
    shouldRemove = true;
    throw error;
  } finally {
    closeSync(fd);
    if (shouldRemove) {
      unlinkSync(filePath);
    }
  }
}

function backupWithDocker(parsed, databaseName, backupPath) {
  if (!commandAvailable("docker")) {
    throw new Error("pg_dump or docker is required for backup before reset.");
  }

  runToFile(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${decodeURIComponent(parsed.password)}`,
      "ogfi-inventory-postgres",
      "pg_dump",
      "-h",
      "localhost",
      "-U",
      decodeURIComponent(parsed.username),
      "-d",
      databaseName,
      "--format",
      "custom",
    ],
    backupPath,
  );
}

function backupDatabase(databaseUrl, parsed, databaseName, label) {
  mkdirSync(backupRoot, { recursive: true });

  const backupPath = join(
    backupRoot,
    `${databaseName}-before-${label}-${timestamp()}.dump`,
  );

  if (commandAvailable("pg_dump")) {
    run("pg_dump", [
      "--dbname",
      databaseUrl,
      "--format",
      "custom",
      "--file",
      backupPath,
    ]);
  } else {
    backupWithDocker(parsed, databaseName, backupPath);
  }

  return backupPath;
}

function prepareResetTarget(options = {}) {
  loadApiEnv();

  const { databaseUrl, parsed } = parseDatabaseUrl();
  const databaseName = assertSafeTarget(databaseUrl, parsed, options);

  return { databaseUrl, parsed, databaseName };
}

module.exports = {
  apiDir,
  backupDatabase,
  backupRoot,
  prepareResetTarget,
  run,
};
