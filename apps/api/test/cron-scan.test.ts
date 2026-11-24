import "reflect-metadata"

import assert from "node:assert/strict"
import { test } from "node:test"
import { Module } from "@nestjs/common"
import { CronController } from "../src/agent/cron.controller.js"
import { type IngestSummary, JobsService } from "../src/agent/jobs.service.js"
import { env } from "../src/env.js"
import { startApp } from "./start-app.js"

const summary: IngestSummary = {
  channels: 2,
  fetched: 30,
  added: 3,
  belowThreshold: 4,
  excluded: 1,
  expired: 0,
  warnings: [],
}

/** Records scans so a refused request can be shown to reach no service. */
function fakeJobs() {
  const calls: number[] = []
  return {
    calls,
    jobs: {
      ingest: async () => {
        calls.push(Date.now())
        return summary
      },
    },
  }
}

async function appWith(jobs: unknown) {
  class CronTestModule {}
  Module({
    controllers: [CronController],
    providers: [{ provide: JobsService, useValue: jobs }],
  })(CronTestModule)
  return await startApp(CronTestModule)
}

test("a scheduled scan needs the shared secret", async () => {
  const { calls, jobs } = fakeJobs()
  const { app, base } = await appWith(jobs)
  const previous = env.CRON_SECRET

  try {
    env.CRON_SECRET = ""
    const off = await fetch(`${base}/api/v1/cron/scan`, { method: "POST" })
    assert.equal(off.status, 503)

    env.CRON_SECRET = "s3cret-value"
    const missing = await fetch(`${base}/api/v1/cron/scan`, {
      method: "POST",
    })
    assert.equal(missing.status, 401)

    const wrong = await fetch(`${base}/api/v1/cron/scan`, {
      method: "POST",
      headers: { "x-cron-secret": "another-value" },
    })
    assert.equal(wrong.status, 401)
    assert.equal(calls.length, 0)
  } finally {
    env.CRON_SECRET = previous
    await app.close()
  }
})

test("the right secret runs one scan and returns its summary", async () => {
  const { calls, jobs } = fakeJobs()
  const { app, base } = await appWith(jobs)
  const previous = env.CRON_SECRET

  try {
    env.CRON_SECRET = "s3cret-value"
    const response = await fetch(`${base}/api/v1/cron/scan`, {
      method: "POST",
      headers: { "x-cron-secret": "s3cret-value" },
    })
    assert.equal(response.status, 201)
    const body = (await response.json()) as { started: boolean }
    assert.equal(body.started, true)
    assert.equal((body as { summary: IngestSummary }).summary.added, 3)
    assert.equal(calls.length, 1)
  } finally {
    env.CRON_SECRET = previous
    await app.close()
  }
})
