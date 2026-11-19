import assert from "node:assert/strict"
import { test } from "node:test"
import { AuthzService } from "@et/authz"
import { db, notification, project, task, user } from "@et/db"
import { eq } from "drizzle-orm"
import { AppModule } from "../src/app.module.js"
import { NotificationStreamService } from "../src/notifications/notification-stream.service.js"
import { NotificationsService } from "../src/notifications/notifications.service.js"
import { TasksService } from "../src/tasks/tasks.service.js"
import { startApp } from "./start-app.js"

// Runs first: the next test closes the shared database pool on shutdown.
test("assigning a task notifies the new assignee once", {
  skip: process.env.NOTIFICATION_INTEGRATION_TEST !== "1",
}, async () => {
  const actorId = crypto.randomUUID()
  const assigneeId = crypto.randomUUID()
  const authz = new AuthzService({
    subjects: { Project: project, Task: task, User: user },
    loadRules: () => [{ action: "manage", subject: "all" }],
  })
  const tasks = new TasksService(
    authz,
    new NotificationsService(new NotificationStreamService())
  )
  const assigned = () =>
    db.select().from(notification).where(eq(notification.userId, assigneeId))
  try {
    await db.insert(user).values(
      [actorId, assigneeId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.invalid`,
        emailVerified: false,
      }))
    )
    const input = {
      title: "Review the launch checklist",
      description: null,
      status: "todo" as const,
      priority: "medium" as const,
      projectId: null,
      assigneeId,
      dueDate: null,
    }
    const created = await tasks.create(actorId, input)
    const [sent] = await assigned()
    assert.equal(sent?.type, "task.assigned")
    assert.equal(sent?.actionUrl, `/tasks/${created.id}`)

    // Editing without changing the assignee, or self-assigning, sends nothing new.
    await tasks.update(
      actorId,
      created.id,
      { ...input, title: "Renamed" },
      eq(task.id, created.id)
    )
    await tasks.update(
      actorId,
      created.id,
      { ...input, assigneeId: actorId },
      eq(task.id, created.id)
    )
    assert.equal((await assigned()).length, 1)
    await db.delete(task).where(eq(task.id, created.id))
  } finally {
    await db.delete(notification).where(eq(notification.userId, assigneeId))
    await db.delete(user).where(eq(user.id, actorId))
    await db.delete(user).where(eq(user.id, assigneeId))
  }
})

test("notifications persist, page, filter, mutate, and stay private", {
  skip: process.env.NOTIFICATION_INTEGRATION_TEST !== "1",
}, async () => {
  const { app, base } = await startApp(AppModule)
  const service = app.get(NotificationsService)
  const stream = app.get(NotificationStreamService)

  async function signUp() {
    const email = `notification-${crypto.randomUUID()}@example.invalid`
    const response = await fetch(`${base}/api/v1/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        name: email,
        email,
        password: "test-password-123",
      }),
    })
    assert.equal(response.status, 200, await response.clone().text())
    const body = (await response.json()) as { user: { id: string } }
    return {
      id: body.user.id,
      cookie: response.headers
        .getSetCookie()
        .map((header) => header.split(";")[0])
        .join("; "),
    }
  }

  function request(path: string, cookie?: string, method = "GET") {
    return fetch(`${base}/api/v1/notifications${path}`, {
      method,
      headers: cookie ? { Cookie: cookie } : {},
    })
  }

  try {
    const owner = await signUp()
    const other = await signUp()
    const events: string[] = []
    const subscription = stream
      .stream(owner.id)
      .subscribe((event) => events.push(event.type ?? ""))
    const foreignEvents: string[] = []
    const foreignSubscription = stream
      .stream(other.id)
      .subscribe((event) => foreignEvents.push(event.type ?? ""))
    const sseController = new AbortController()
    try {
      assert.equal((await request("/stream")).status, 401)
      const sseResponse = await fetch(`${base}/api/v1/notifications/stream`, {
        headers: { Cookie: owner.cookie },
        signal: sseController.signal,
      })
      assert.equal(sseResponse.status, 200)
      assert.ok(sseResponse.body)
      const reader = sseResponse.body.getReader()
      const first = await service.notify({
        userId: owner.id,
        type: "test.created",
        title: "First",
        message: "First message",
      })
      const timeout = setTimeout(() => sseController.abort(), 3000)
      let eventText = ""
      try {
        while (!eventText.includes("event: notification.created")) {
          const chunk = await reader.read()
          if (chunk.done) break
          eventText += new TextDecoder().decode(chunk.value)
        }
      } finally {
        clearTimeout(timeout)
      }
      assert.match(eventText, /event: notification.created/)
      const second = await service.notify({
        userId: owner.id,
        type: "test.created",
        title: "Second",
        message: "Second message",
      })
      const foreign = await service.notify({
        userId: other.id,
        type: "test.created",
        title: "Private",
        message: "Other user",
      })
      assert.deepEqual(events, ["notification.created", "notification.created"])
      assert.deepEqual(foreignEvents, ["notification.created"])
      assert.equal((await request("", undefined)).status, 401)

      const pageResponse = await request("?limit=1", owner.cookie)
      assert.equal(pageResponse.status, 200)
      const page = (await pageResponse.json()) as {
        items: Array<{ id: string }>
        nextCursor: string
      }
      assert.equal(page.items.length, 1)
      assert.ok(page.nextCursor)
      const next = (await (
        await request(
          `?limit=1&cursor=${encodeURIComponent(page.nextCursor)}`,
          owner.cookie
        )
      ).json()) as { items: Array<{ id: string }>; nextCursor: string | null }
      assert.equal(next.items.length, 1)
      assert.notEqual(next.items[0]?.id, page.items[0]?.id)
      assert.equal(next.nextCursor, null)
      assert.equal((await request("?cursor=broken", owner.cookie)).status, 400)
      assert.equal((await request("?limit=101", owner.cookie)).status, 400)

      const count = (await (
        await request("/unread-count", owner.cookie)
      ).json()) as { count: number }
      assert.equal(count.count, 2)
      assert.equal(
        (await request(`/${foreign.id}/read`, owner.cookie, "PATCH")).status,
        404
      )
      assert.equal(
        (await request(`/${foreign.id}`, owner.cookie, "DELETE")).status,
        404
      )
      assert.equal(
        (await request(`/${first.id}/read`, owner.cookie, "PATCH")).status,
        200
      )
      const unread = (await (
        await request("?status=unread", owner.cookie)
      ).json()) as { items: Array<{ id: string }> }
      assert.deepEqual(
        unread.items.map((item) => item.id),
        [second.id]
      )
      assert.equal(
        (await request("/read-all", owner.cookie, "PATCH")).status,
        200
      )
      assert.equal(
        (
          (await (await request("/unread-count", owner.cookie)).json()) as {
            count: number
          }
        ).count,
        0
      )
      assert.equal(
        (await request(`/${second.id}`, owner.cookie, "DELETE")).status,
        200
      )
      assert.equal(
        (
          (await (await request("", other.cookie)).json()) as {
            items: Array<{ id: string }>
          }
        ).items[0]?.id,
        foreign.id
      )
    } finally {
      sseController.abort()
      subscription.unsubscribe()
      foreignSubscription.unsubscribe()
    }
  } finally {
    await app.close()
  }
})
