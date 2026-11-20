import { existsSync } from "node:fs"
import { dirname, isAbsolute, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { z } from "zod"

let rootDir = process.cwd()

function loadRootEnv(metaUrl: string) {
  let dir = dirname(fileURLToPath(metaUrl))

  for (let i = 0; i < 6; i++) {
    const envPath = resolve(dir, ".env")
    if (existsSync(envPath)) {
      process.loadEnvFile(envPath)
      rootDir = dir
      return
    }
    dir = resolve(dir, "..")
  }
}

loadRootEnv(import.meta.url)

const parsed = z
  .object({
    /** SQLite file, relative to the repository root. */
    DATABASE_FILE: z.string().min(1).default("data/job-apply-agent.db"),
    /**
     * Hosted libSQL (Turso) endpoint. When set, the file above is ignored, so
     * the app survives a host that wipes its disk between deploys.
     */
    TURSO_DATABASE_URL: z.string().min(1).default(""),
    TURSO_AUTH_TOKEN: z.string().default(""),
    MULTI_TENANCY: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .parse(process.env)

if (parsed.MULTI_TENANCY)
  throw new Error(
    "MULTI_TENANCY is not supported on the SQLite build: SQLite has no row-level security. Run with MULTI_TENANCY=false."
  )

export const env = {
  ...parsed,
  rootDir,
}

export const databaseFile = isAbsolute(env.DATABASE_FILE)
  ? env.DATABASE_FILE
  : resolve(env.rootDir, env.DATABASE_FILE)

/** A remote endpoint supersedes the local file, so the same build runs both ways. */
export const remoteDatabaseUrl = env.TURSO_DATABASE_URL
