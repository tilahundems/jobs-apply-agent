import "reflect-metadata"

import assert from "node:assert/strict"
import { test } from "node:test"
import { Controller, Get, Module } from "@nestjs/common"
import { ObservabilityModule } from "../src/observability/observability.module.js"
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

class TestMetricsModule {}
Module({
  imports: [ObservabilityModule],
  controllers: [TestUsersController],
})(TestMetricsModule)

test("metrics endpoint exposes bounded route labels", async () => {
  const { app, base } = await startApp(TestMetricsModule)
  try {
    assert.equal((await fetch(`${base}/api/v1/users/first-user`)).status, 200)
    assert.equal((await fetch(`${base}/api/v1/users/second-user`)).status, 200)
    assert.equal(
      (await fetch(`${base}/api/v1/private-id-should-not-be-a-label`)).status,
      404
    )
    const metrics = await fetch(`${base}/metrics`)
    assert.equal(metrics.status, 200)
    assert.match(metrics.headers.get("content-type") ?? "", /text\/plain/)
    const exposition = await metrics.text()
    assert.match(exposition, /http_requests_total/)
    assert.match(exposition, /http_request_duration_seconds/)
    assert.match(exposition, /http_requests_in_flight/)
    assert.match(exposition, /process_cpu_user_seconds_total/)
    assert.ok(!exposition.includes("first-user"))
    assert.ok(!exposition.includes("second-user"))
    assert.ok(!exposition.includes("private-id-should-not-be-a-label"))
    assert.match(
      exposition,
      /http_requests_total\{method="GET",route="\/api\/v1\/users\/:id",status_code="200"\} 2/
    )
    assert.match(
      exposition,
      /http_requests_total\{method="GET",route="unmatched",status_code="404"\} 1/
    )
  } finally {
    await app.close()
  }
})
