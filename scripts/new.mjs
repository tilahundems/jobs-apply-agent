import { spawnSync } from "node:child_process"
import { randomBytes, randomInt } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { basename, relative, resolve } from "node:path"
import process from "node:process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

const root = process.cwd()
const marker = resolve(root, ".setup-complete")

// Each optional feature lives in its own folders. Removing one deletes those
// paths and package entries, then every line marked `feature:<name>` (or the
// lines between `feature:<name>:start` and `feature:<name>:end`).
const FEATURES = {
  auditLogging: {
    label: "Audit Logging",
    paths: [
      "apps/api/src/audit",
      "apps/api/test/audit.integration.test.ts",
      "apps/web/src/features/audit",
      "apps/web/src/routes/_main/audit-logs",
      "docs/audit.md",
    ],
  },
  apiDocs: {
    label: "API Documentation",
    paths: [
      "apps/api/src/http/openapi.ts",
      "apps/api/src/http/openapi-responses.ts",
    ],
    json: [
      ["apps/api/package.json", "dependencies", "@nestjs/swagger"],
      ["apps/api/package.json", "dependencies", "@scalar/nestjs-api-reference"],
    ],
  },
  payment: {
    label: "Payment",
    paths: [
      "apps/api/src/payments",
      "apps/api/test/telebirr.test.ts",
      "docs/payments.md",
    ],
  },
  i18n: {
    label: "Web Internationalization",
    paths: ["apps/web/src/features/i18n"],
    // Keep the useI18n interface so components need no edits.
    after: () => {
      mkdirSync(resolve(root, "apps/web/src/features/i18n"), {
        recursive: true,
      })
      writeFileSync(
        resolve(root, "apps/web/src/features/i18n/i18n-provider.tsx"),
        `// English-only stand-in for the removed internationalization feature.
export type Language = "en" | "am"

const english = {
  language: "en" as Language,
  setLanguage: (_language: Language) => {},
  t: (text: string) => text,
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  return children
}

export function useI18n() {
  return english
}
`
      )
    },
  },
  mobile: {
    label: "Mobile App",
    paths: ["apps/mobile", "docs/mobile.md"],
    json: [
      ["package.json", "scripts", "dev:mobile"],
      ["apps/api/package.json", "dependencies", "@better-auth/expo"],
      ["turbo.json", "globalEnv", "EXPO_PUBLIC_API_URL"],
    ],
  },
}
// A deployment mode, not a folder: it only changes .env.
const TENANCY = "multiTenancy"
const OPTIONS = [...Object.keys(FEATURES), TENANCY]

const SKIPPED_DIRS = new Set([
  ".git",
  ".kilo",
  ".turbo",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
])
const SKIPPED_FILES = new Set(["scripts/new.mjs", "scripts/new.test.mjs"])

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function assertStarterKitRoot() {
  const required = ["package.json", ".env.example", "apps/api/package.json"]
  const missing = required.filter((file) => !existsSync(resolve(root, file)))
  if (missing.length > 0)
    fail(
      `This does not look like the starter-kit root (missing ${missing.join(", ")}). Run the command from the repository root.`
    )
  const { name } = JSON.parse(
    readFileSync(resolve(root, "package.json"), "utf8")
  )
  if (name !== "et-starter-kit")
    fail(
      "This project has already been renamed. Refusing to replace its Git history."
    )
}

function projectName(input) {
  const name = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  // CI database names append "_test"; PostgreSQL identifiers are limited to 63 bytes.
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name) || name.length > 50) return null
  return { display: input.trim().replace(/\s+/g, " "), normalized: name }
}

async function ask(rl, label, fallback) {
  while (true) {
    const answer = (
      await rl.question(`${label} (${fallback ? "Y/n" : "y/N"}): `)
    )
      .trim()
      .toLowerCase()
    if (answer === "") return fallback
    if (answer === "y" || answer === "yes") return true
    if (answer === "n" || answer === "no") return false
    console.log("Enter yes or no.")
  }
}

async function promptChoices() {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const fallback = projectName(basename(root))?.normalized
    let project = null
    while (!project) {
      const input = await rl.question(
        fallback ? `Project name (${fallback}): ` : "Project name: "
      )
      project = projectName(input.trim() || fallback || "")
      if (!project)
        console.log(
          "Use 1–50 letters, numbers, or hyphens, for example: tena-app"
        )
    }
    const features = {}
    for (const [key, { label }] of Object.entries(FEATURES))
      features[key] = await ask(rl, `Include ${label}`, true)
    features[TENANCY] = await ask(rl, "Enable Multi-Tenancy", false)
    return { project, features }
  } finally {
    rl.close()
  }
}

function parseArgs(args) {
  const list = (prefix) =>
    new Set(
      (args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "")
        .split(",")
        .filter(Boolean)
    )
  const name = args.find((arg) => arg.startsWith("--name="))?.slice(7)
  const project = projectName(
    name ?? (args.includes("--yes") ? basename(root) : "")
  )
  if (!project)
    fail(
      args.includes("--yes")
        ? "--yes requires a valid project name from the directory or --name=NAME."
        : "--non-interactive requires a valid --name=NAME."
    )
  const without = list("--without=")
  const withOptions = list("--with=")
  if ([...without].some((option) => !OPTIONS.includes(option)))
    fail("--without contains an unknown capability.")
  if ([...withOptions].some((option) => option !== TENANCY))
    fail(
      "--with only accepts multiTenancy; other capabilities are included by default."
    )
  const features = Object.fromEntries(
    Object.keys(FEATURES).map((key) => [key, !without.has(key)])
  )
  features[TENANCY] = withOptions.has(TENANCY) && !without.has(TENANCY)
  return { project, features }
}

function editFile(relativePath, transform) {
  const path = resolve(root, relativePath)
  if (!existsSync(path)) return
  const content = readFileSync(path, "utf8")
  const next = transform(content)
  if (next !== content) writeFileSync(path, next)
}

function replaceAll(relativePath, replacements) {
  editFile(relativePath, (content) =>
    replacements.reduce(
      (acc, [from, to]) => acc.replaceAll(from, () => to),
      content
    )
  )
}

function removeJsonEntry(file, key, entry) {
  editFile(file, (content) => {
    const json = JSON.parse(content)
    const value = json[key]
    if (Array.isArray(value)) json[key] = value.filter((item) => item !== entry)
    else if (value) delete value[entry]
    return `${JSON.stringify(json, null, 2)}\n`
  })
}

const BLOCK = /feature:(\w+):(start|end)\b/
const LINE = /feature:(\w+)(?![:\w])/
// The marker comment itself, in TS, JSX, shell/YAML, or Markdown syntax.
const TRAILING = /\s*(?:\/\/|#|\{\/\*|<!--)\s*feature:\w+\s*(?:\*\/\}|-->)?\s*$/

/** Drops removed features' marked lines and blocks; unmarks kept ones. */
export function stripFeatureMarkers(content, removed) {
  const output = []
  let skipping = null
  for (const line of content.split("\n")) {
    const block = line.match(BLOCK)
    if (skipping) {
      if (block?.[1] === skipping && block[2] === "end") skipping = null
      continue
    }
    if (block) {
      if (removed.has(block[1]) && block[2] === "start") skipping = block[1]
      continue
    }
    const single = line.match(LINE)
    if (single && TRAILING.test(line)) {
      if (!removed.has(single[1])) output.push(line.replace(TRAILING, ""))
      continue
    }
    output.push(line)
  }
  return output.join("\n")
}

function textFiles(dir = root) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name)
    if (entry.isDirectory())
      return SKIPPED_DIRS.has(entry.name) ? [] : textFiles(path)
    return entry.isFile() && !SKIPPED_FILES.has(relative(root, path))
      ? [path]
      : []
  })
}

export function selectFeatures(features) {
  const removed = new Set(
    Object.keys(FEATURES).filter((key) => features[key] === false)
  )
  for (const key of removed) {
    const { paths = [], json = [], after } = FEATURES[key]
    for (const path of paths)
      rmSync(resolve(root, path), { recursive: true, force: true })
    for (const [file, field, entry] of json) removeJsonEntry(file, field, entry)
    after?.()
  }
  for (const path of textFiles()) {
    const content = readFileSync(path, "utf8")
    if (content.includes("\0") || !content.includes("feature:")) continue
    const next = stripFeatureMarkers(content, removed)
    if (next !== content) writeFileSync(path, next.replace(/\n{3,}/g, "\n\n"))
  }
  if (features.mobile !== false)
    ensureCopy("apps/mobile/.env.example", "apps/mobile/.env")
}

function updateIdentity(display, name, postgresPort) {
  const html = display
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
  replaceAll("package.json", [
    [`"name": "et-starter-kit"`, `"name": "${name}"`],
  ])
  replaceAll("README.md", [["# et-starter-kit", `# ${display}`]])
  replaceAll("apps/web/index.html", [
    ["<title>ET Starter Kit</title>", `<title>${html}</title>`],
  ])
  replaceAll("apps/web/public/manifest.json", [
    [
      `"short_name": "Ethio telecom"`,
      `"short_name": ${JSON.stringify(display)}`,
    ],
    [`"name": "Ethio telecom"`, `"name": ${JSON.stringify(display)}`],
  ])
  replaceAll("compose.yaml", [
    ["${POSTGRES_PORT:-5432}", `\${POSTGRES_PORT:-${postgresPort}}`],
  ])
  replaceAll(".env.example", [
    [
      "postgres://et:et@localhost:5432/et",
      `postgres://${name}:${name}@localhost:${postgresPort}/${name}`,
    ],
    ["POSTGRES_PORT=5432", `POSTGRES_PORT=${postgresPort}`],
  ])
  replaceAll(".github/workflows/check.yml", [["et_test", `${name}_test`]])
  // Leave room for "_test_" and a 32-character UUID in PostgreSQL identifiers.
  replaceAll("libs/db/scripts/test-database.mjs", [
    ["et_test_", `${name.slice(0, 25)}_test_`],
  ])
}

export function updateMobileIdentity(display, name) {
  const scheme = `app-${name}`
  replaceAll("apps/mobile/app.json", [
    ['"name": "ET Starter Kit"', `"name": ${JSON.stringify(display)}`],
    ['"slug": "et-starter-kit-mobile"', `"slug": "${name}-mobile"`],
    ['"scheme": "etstarterkit"', `"scheme": "${scheme}"`],
  ])
  replaceAll("apps/mobile/lib/auth-client.ts", [
    ['scheme: "etstarterkit"', `scheme: "${scheme}"`],
    ['storagePrefix: "etstarterkit"', `storagePrefix: "${scheme}"`],
  ])
  replaceAll("apps/api/src/env.ts", [
    ['.default("etstarterkit")', `.default("${scheme}")`],
  ])
  for (const file of [".env", ".env.example"])
    replaceAll(file, [
      ["MOBILE_SCHEME=etstarterkit", `MOBILE_SCHEME=${scheme}`],
    ])
}

function ensureCopy(from, to, transform = (content) => content) {
  if (existsSync(resolve(root, to)) || !existsSync(resolve(root, from)))
    return false
  writeFileSync(
    resolve(root, to),
    transform(readFileSync(resolve(root, from), "utf8"))
  )
  return true
}

export function saveFeatureFlags({ multiTenancy }) {
  const path = resolve(root, ".env")
  if (!existsSync(path)) fail("Cannot save feature flags: .env is missing.")
  let content = readFileSync(path, "utf8")
  for (const key of ["MULTI_TENANCY", "VITE_MULTI_TENANCY"]) {
    const line = `${key}=${multiTenancy}`
    const pattern = new RegExp(`^${key}=.*$`, "m")
    content = pattern.test(content)
      ? content.replace(pattern, line)
      : `${content.trimEnd()}\n${line}\n`
  }
  if (multiTenancy && !/^MIGRATION_DATABASE_URL=/m.test(content)) {
    const ownerUrl = content.match(/^DATABASE_URL=(.+)$/m)?.[1]
    if (!ownerUrl)
      fail("Cannot configure tenant database role: DATABASE_URL is missing.")
    // Tenant mode runs the app as a restricted role; migrations keep the owner.
    const appUrl = (password) => {
      const url = new URL(ownerUrl)
      url.username = `${decodeURIComponent(url.pathname.slice(1))}_app`
      url.password = password
      return `MIGRATION_DATABASE_URL=${ownerUrl}\nDATABASE_URL=${url}`
    }
    content = content.replace(
      /^DATABASE_URL=.+$/m,
      appUrl(randomBytes(32).toString("base64url"))
    )
    editFile(".env.example", (example) =>
      example.replace(/^DATABASE_URL=.+$/m, appUrl("replace-with-a-secret"))
    )
  }
  writeFileSync(path, content)
}

function git(...args) {
  return spawnSync("git", args, { cwd: root, stdio: "inherit" }).status === 0
}

async function main() {
  if (existsSync(marker))
    return console.log("✓ Setup has already run for this project.")
  assertStarterKitRoot()
  const args = process.argv.slice(2)
  const { project, features } =
    args.includes("--yes") || args.includes("--non-interactive")
      ? parseArgs(args)
      : await promptChoices()
  const { display, normalized } = project
  const postgresPort = randomInt(10000, 60000)

  updateIdentity(display, normalized, postgresPort)
  const envCreated = ensureCopy(".env.example", ".env", (content) =>
    content.replace(
      "BETTER_AUTH_SECRET=replace-with-openssl-rand-base64-32-output",
      `BETTER_AUTH_SECRET=${randomBytes(32).toString("base64")}`
    )
  )
  saveFeatureFlags(features)
  selectFeatures(features)
  if (features.mobile) updateMobileIdentity(display, normalized)

  editFile(".gitignore", (content) =>
    content.split("\n").some((line) => line.trim() === ".setup-complete")
      ? content
      : `${content.trimEnd()}\n.setup-complete\n`
  )
  rmSync(resolve(root, ".git"), { recursive: true, force: true })
  if (!git("init")) fail("git init failed. Is Git installed?")
  writeFileSync(marker, `${new Date().toISOString()}\n`)
  git("add", "-A")
  const committed = git("commit", "-m", "Initial project setup")

  const summary = Object.entries(FEATURES).map(
    ([key, { label }]) => `${label} ${features[key] ? "included" : "removed"}`
  )
  summary.push(`Multi-Tenancy ${features[TENANCY] ? "enabled" : "disabled"}`)
  console.log(`
✓ Project configured: ${normalized}
✓ PostgreSQL host port: ${postgresPort}${envCreated ? "\n✓ Environment file created with a secure auth secret" : ""}
✓ ${summary.join("; ")}
✓ New Git repository initialized${
    committed
      ? ""
      : `

Git user configuration is missing. Commit manually:
  git config user.name "Your Name"
  git config user.email "you@example.com"
  git commit -m "Initial project setup"`
  }

Project is ready. Run pnpm install and pnpm check:fix, then follow README Setup.
`)
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  await main()
