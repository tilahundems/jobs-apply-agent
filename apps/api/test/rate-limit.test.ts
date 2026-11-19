import "reflect-metadata"

import assert from "node:assert/strict"
import { test } from "node:test"
import {
  Controller,
  Get,
  Module,
  RequestMethod,
  VersioningType,
} from "@nestjs/common"
import { NestFactory } from "@nestjs/core"
import { AllowAnonymous } from "@thallesp/nestjs-better-auth"
import { AppModule } from "../src/app.module.js"
import { HealthController } from "../src/health.controller.js"
import { RateLimitModule } from "../src/http/rate-limit.module.js"

class TestController {
  item() {
    return { ok: true }
  }

  other() {
    return { ok: true }
  }
}

Controller("items")(TestController)
Get()(
  TestController.prototype,
  "item",
  Object.getOwnPropertyDescriptor(TestController.prototype, "item")!
)
Get("other")(
  TestController.prototype,
  "other",
  Object.getOwnPropertyDescriptor(TestController.prototype, "other")!
)

class TestRateLimitModule {}
Module({
  imports: [RateLimitModule],
  controllers: [TestController, HealthController],
})(TestRateLimitModule)

test("HTTP routes are limited per endpoint and health stays available", async () => {
  const app = await NestFactory.create(TestRateLimitModule, {
    abortOnError: false,
    logger: false,
  })
  await app.listen(0, "127.0.0.1")

  try {
    const address = app.getHttpServer().address()
    assert.ok(address && typeof address !== "string")
    const base = `http://127.0.0.1:${address.port}`

    for (let attempt = 0; attempt < 100; attempt++) {
      const response = await fetch(`${base}/items`)
      assert.equal(response.status, 200, `request ${attempt + 1}`)
    }

    const blocked = await fetch(`${base}/items`, {
      headers: { "X-Forwarded-For": "203.0.113.10" },
    })
    assert.equal(blocked.status, 429)
    assert.ok(Number(blocked.headers.get("retry-after")) > 0)

    assert.equal((await fetch(`${base}/items/other`)).status, 200)
    assert.equal((await fetch(`${base}/health`)).status, 200)
  } finally {
    await app.close()
  }
})

test("the default app includes infrastructure and limits API and Better Auth routes", async () => {
  AllowAnonymous()(TestController)
  class TestAppModule {}
  Module({ imports: [AppModule], controllers: [TestController] })(TestAppModule)

  const app = await NestFactory.create(TestAppModule, {
    abortOnError: false,
    bodyParser: false,
    logger: false,
  })
  app.setGlobalPrefix("api", {
    exclude: [{ path: "metrics", method: RequestMethod.GET }],
  })
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" })
  await app.listen(0, "127.0.0.1")

  try {
    const address = app.getHttpServer().address()
    assert.ok(address && typeof address !== "string")
    const base = `http://127.0.0.1:${address.port}`
    const first = await fetch(`${base}/api/v1/items`, {
      headers: { "X-Request-Id": "default-app-request" },
    })
    assert.equal(first.status, 200)
    assert.equal(first.headers.get("x-request-id"), "default-app-request")
    for (let attempt = 1; attempt < 100; attempt++) {
      assert.equal((await fetch(`${base}/api/v1/items`)).status, 200)
    }
    assert.equal((await fetch(`${base}/api/v1/items`)).status, 429)

    const metrics = await fetch(`${base}/metrics`)
    assert.equal(metrics.status, 200)
    assert.match(await metrics.text(), /http_requests_total/)
    assert.equal((await fetch(`${base}/api/v1/notifications`)).status, 401)
    assert.equal(
      (await fetch(`${base}/api/v1/notifications/stream`)).status,
      401
    )

    const url = `${base}/api/v1/auth/get-session`

    let blocked = false
    for (let attempt = 0; attempt < 101; attempt++) {
      const response = await fetch(url, {
        headers: { "X-Forwarded-For": `203.0.113.${(attempt % 200) + 1}` },
      })
      if (response.status === 429) {
        blocked = true
        break
      }
      assert.equal(response.status, 200, `auth request ${attempt + 1}`)
    }
    assert.ok(blocked, "Better Auth should reject requests over its limit")
  } finally {
    await app.close()
  }
})
