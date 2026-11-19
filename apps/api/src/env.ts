import process from "node:process"
import { dbEnv } from "@et/db"
import { z } from "zod"

// Importing @et/db loads the repository root .env first.

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  /** Minutes between automatic channel scans. 0 disables the background loop. */
  AGENT_INGEST_MINUTES: z.coerce.number().int().min(0).default(0),
})

export const env = {
  ...schema.parse(process.env),
  MULTI_TENANCY: dbEnv.MULTI_TENANCY,
}
