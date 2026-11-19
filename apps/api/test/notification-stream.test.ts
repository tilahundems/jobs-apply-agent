import assert from "node:assert/strict"
import { test } from "node:test"
import { NotificationStreamService } from "../src/notifications/notification-stream.service.js"

test("notification stream sends events only to the recipient and cleans up", () => {
  const stream = new NotificationStreamService()
  const own: unknown[] = []
  const other: unknown[] = []
  const otherOrganization: unknown[] = []
  const ownSubscription = stream
    .stream("one")
    .subscribe((event) => own.push(event))
  const otherSubscription = stream
    .stream("two")
    .subscribe((event) => other.push(event))
  const otherOrganizationSubscription = stream
    .stream("one", "organization-b")
    .subscribe((event) => otherOrganization.push(event))

  stream.publish("one", "notification.created", { id: "first" })
  assert.deepEqual(own, [
    { type: "notification.created", data: { id: "first" } },
  ])
  assert.deepEqual(other, [])
  assert.deepEqual(otherOrganization, [])

  stream.publish(
    "one",
    "notification.created",
    { id: "tenant-only" },
    "organization-b"
  )
  assert.equal(own.length, 1)
  assert.equal(otherOrganization.length, 1)

  ownSubscription.unsubscribe()
  stream.publish("one", "notification.created", { id: "second" })
  assert.equal(own.length, 1)
  otherSubscription.unsubscribe()
  otherOrganizationSubscription.unsubscribe()
})
