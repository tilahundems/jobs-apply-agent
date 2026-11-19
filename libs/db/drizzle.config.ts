import { resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { defineConfig } from "drizzle-kit"

let root = process.cwd()

try {
  const envPath = resolve(fileURLToPath(new URL("../../.env", import.meta.url)))
  process.loadEnvFile(envPath)
  root = resolve(fileURLToPath(new URL("../../", import.meta.url)))
} catch {
  // Environment may already be provided by the process.
}

const file = process.env.DATABASE_FILE ?? "data/job-apply-agent.db"

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${file.startsWith("/") || file.includes(":") ? file : resolve(root, file)}`,
  },
})
