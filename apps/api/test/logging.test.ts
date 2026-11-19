import "reflect-metadata"

import assert from "node:assert/strict"
import { Writable } from "node:stream"
import { test } from "node:test"
import { Controller, Get, Module } from "@nestjs/common"
import pino from "pino"
import { env } from "../src/env.js"
import {
  loggerConfig,
  redactedPaths,
} from "../src/observability/logging/logger.config.js"
import { PinoLoggerModule } from "../src/observability/logging/logger.module.js"
import { RequestLoggingModule } from "../src/observability/logging/request-logging.module.js"
import { startApp } from "./start-app.js"

class TestUsersController {
  getUser() {
    return { ok: true }
  }
}
Controller("users")(TestUsersController)
Get(":id")(
  TestUsersController.prototype,
  "getUser",
  Object.getOwnPropertyDescriptor(TestUsersController.prototype, "getUser")!
)

class TestLoggingModule {}
Module({
  imports: [PinoLoggerModule, RequestLoggingModule],
  controllers: [TestUsersController],
})(TestLoggingModule)

test("logging supplies safe request IDs", async () => {
  assert.equal(
    (loggerConfig.pinoHttp as { level: string }).level,
    env.LOG_LEVEL
  )
  const { app, base } = await startApp(TestLoggingModule)
  try {
    const first = await fetch(`${base}/api/v1/users/first-user`, {
      headers: { "x-request-id": "client-request-1" },
    })
    assert.equal(first.status, 200)
    assert.equal(first.headers.get("x-request-id"), "client-request-1")
    const second = await fetch(`${base}/api/v1/users/second-user`, {
      headers: { "x-request-id": "not a safe id" },
    })
    assert.equal(second.status, 200)
    assert.match(second.headers.get("x-request-id") ?? "", /^[\da-f-]{36}$/i)
  } finally {
    await app.close()
  }
})

test("Pino redacts sensitive authentication fields in nested records", () => {
  const records: string[] = []
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      records.push(String(chunk))
      callback()
    },
  })
  const logger = pino(
    { redact: { paths: [...redactedPaths], censor: "[Redacted]" } },
    stream
  )
  logger.info({
    authorization: "Bearer top-secret",
    req: {
      headers: { cookie: "session=top-secret", "x-api-key": "top-secret" },
      body: { password: "top-secret", refresh_token: "top-secret" },
    },
  })
  assert.equal(records.length, 1)
  assert.ok(!records[0]!.includes("top-secret"))
  assert.ok(records[0]!.includes("[Redacted]"))
})
