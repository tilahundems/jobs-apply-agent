import { spawnSync } from "node:child_process"
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, resolve, sep } from "node:path"

const source = resolve(import.meta.dirname, "..")
const setupOnly = process.argv.includes("--setup-only")
const skipped = new Set([
  ".git",
  ".kilo",
  ".env",
  ".setup-complete",
  "node_modules",
  "dist",
  ".turbo",
  "playwright-report",
  "test-results",
])

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, CI: "true" },
  })
  if (result.status !== 0) {
    process.stderr.write(result.stdout ?? "")
    process.stderr.write(result.stderr ?? "")
    throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`)
  }
}

const root = mkdtempSync(resolve(tmpdir(), "et-generated-smoke-"))
try {
  const scenarios = [
    [
      "default",
      ["--non-interactive", "--name=generated-default", "--with=multiTenancy"],
    ],
    [
      "lean",
      [
        "--non-interactive",
        "--name=generated-lean",
        "--without=auditLogging,apiDocs,payment,i18n,multiTenancy,mobile",
      ],
    ],
    ["long-name", ["--non-interactive", "--name=sales-workforce-management"]],
  ]
  if (setupOnly) {
    scenarios.push([
      "tenant",
      ["--non-interactive", "--name=generated-tenant", "--with=multiTenancy"],
    ])
  }
  for (const [name, setupArgs] of scenarios) {
    const target = resolve(root, name)
    cpSync(source, target, {
      recursive: true,
      filter(path) {
        const relative = path.slice(source.length + 1)
        return !relative.split(sep).some((segment) => skipped.has(segment))
      },
    })
    run(process.execPath, ["scripts/new.mjs", ...setupArgs], target)
    const packageName = JSON.parse(
      readFileSync(resolve(target, "package.json"), "utf8")
    ).name
    const expectedName = setupArgs
      .find((arg) => arg.startsWith("--name="))
      ?.slice(7)
    if (packageName !== expectedName) {
      throw new Error(`Generated ${name} has the wrong package name.`)
    }
    if (name === "long-name") {
      const testDatabaseScript = readFileSync(
        resolve(target, "libs/db/scripts/test-database.mjs"),
        "utf8"
      )
      if (!testDatabaseScript.includes(`${expectedName.slice(0, 25)}_test_`)) {
        throw new Error("Generated test database prefix exceeds its budget.")
      }
    }
    const env = readFileSync(resolve(target, ".env"), "utf8")
    const tenancyEnabled = setupArgs.includes("--with=multiTenancy")
    for (const key of ["MULTI_TENANCY", "VITE_MULTI_TENANCY"]) {
      if (!env.includes(`${key}=${tenancyEnabled}\n`)) {
        throw new Error(`Generated ${name} has the wrong ${key} setting.`)
      }
    }
    if (!existsSync(resolve(target, "apps/api/src/notifications"))) {
      throw new Error("Generated project is missing built-in notifications.")
    }
    if (
      name === "lean" &&
      existsSync(resolve(target, "apps/api/src/payments/telebirr"))
    ) {
      throw new Error("Lean project retained payment code.")
    }
    if (!setupOnly && name !== "long-name") {
      run("pnpm", ["install", "--no-frozen-lockfile"], target)
      run("pnpm", ["check:fix"], target)
      run("pnpm", ["check"], target)
      run("pnpm", ["typecheck"], target)
      run("pnpm", ["build"], target)
    }
    console.log(
      `Generated ${basename(target)} ${setupOnly || name === "long-name" ? "completed setup" : "passes checks"}.`
    )
  }
} finally {
  rmSync(root, { recursive: true, force: true })
}
