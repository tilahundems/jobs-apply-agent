import "reflect-metadata"

import assert from "node:assert/strict"
import { test } from "node:test"

import { AppModule } from "../src/app.module.js"
import { startApp } from "./start-app.js"

test("API routes use the v1 URI prefix", async () => {
  const { app, base } = await startApp(AppModule)

  try {
    const users = await fetch(`${base}/api/v1/users`)
    assert.equal(users.status, 401)
    assert.equal((await fetch(`${base}/api/users`)).status, 404)

    const auth = await fetch(`${base}/api/v1/auth/get-session`)
    assert.equal(auth.status, 200, await auth.text())
    assert.equal((await fetch(`${base}/api/auth/get-session`)).status, 404)
  } finally {
    await app.close()
  }
})
