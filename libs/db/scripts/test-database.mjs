import { spawn } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * Runs the integration suites against a throwaway SQLite file, so a test run
 * never touches the development database in `data/`.
 */
const mode = process.argv[2] ?? "integration"
if (mode !== "integration" && mode !== "e2e")
  throw new Error(`Unknown test mode: ${mode}`)

const directory = mkdtempSync(join(tmpdir(), "job-apply-agent-test-"))
const databaseFile = join(directory, "test.db")

function run(command, args, env, cwd = ".") {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" })
    child.on("error", reject)
    child.on("exit", (status) => resolve(status ?? 1))
  })
}

const env = {
  ...process.env,
  DATABASE_FILE: databaseFile,
  MULTI_TENANCY: "false",
  VITE_MULTI_TENANCY: "false",
  PERMISSION_INTEGRATION_TEST: "1",
  AUDIT_INTEGRATION_TEST: "1",
  NOTIFICATION_INTEGRATION_TEST: "1",
  BETTER_AUTH_SECRET: "integration-test-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:4000",
  WEB_ORIGIN: "http://localhost:3000",
  API_URL: "http://localhost:4000",
  PORT: "4000",
}

try {
  const migrateCode = await run(
    process.execPath,
    ["dist/migrate.js"],
    env,
    "libs/db"
  )
  if (migrateCode !== 0)
    throw new Error(`Migration failed with exit code ${migrateCode}`)

  if (mode === "e2e") {
    const e2eEnv = {
      ...env,
      ALLOW_DEMO_SEED: "true",
      NODE_ENV: "test",
      VITE_API_URL: "http://localhost:3000",
      SEED_USER_NAME: "Demo User",
      SEED_USER_EMAIL: "demo@example.com",
      SEED_USER_PASSWORD: "demo-password",
      SEED_MEMBER_NAME: "Regular User",
      SEED_MEMBER_EMAIL: "user@example.com",
      SEED_MEMBER_PASSWORD: "user-password",
    }
    const seedCode = await run(
      process.execPath,
      ["dist/seed.js"],
      e2eEnv,
      "apps/api"
    )
    if (seedCode !== 0)
      throw new Error(`Demo seed failed with exit code ${seedCode}`)
    process.exitCode = await run(
      process.execPath,
      ["node_modules/playwright/cli.js", "test"],
      e2eEnv,
      "apps/web"
    )
  } else {
    process.exitCode = await run(
      process.execPath,
      [
        "--import",
        "tsx",
        "--test",
        "--test-concurrency=1",
        "test/permissions.integration.test.ts",
        "test/security.integration.test.ts",
        "test/audit.integration.test.ts",
        "test/notifications.integration.test.ts",
      ],
      env,
      "apps/api"
    )
  }
} finally {
  rmSync(directory, { recursive: true, force: true })
}
