import assert from "node:assert/strict"
import type { INestApplication } from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { configureApp } from "../src/http/configure-app.js"

/** Starts a module with the production HTTP setup on a random local port. */
export async function startApp(
  module: unknown,
  setup?: (app: INestApplication) => void
) {
  const app = await NestFactory.create(module, {
    bodyParser: false,
    logger: false,
  })
  configureApp(app)
  setup?.(app)
  await app.listen(0, "127.0.0.1")
  const address = app.getHttpServer().address()
  assert.ok(address && typeof address !== "string")
  return { app, base: `http://127.0.0.1:${address.port}` }
}
