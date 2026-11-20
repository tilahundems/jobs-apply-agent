import assert from "node:assert/strict"
import { test } from "node:test"
import {
  daysLeftUntil,
  formatReminder,
  telegramDetail,
} from "../src/agent/reminders.service.js"

const now = new Date("2026-11-20T06:00:00Z")

test("counts whole days until a posting closes", () => {
  assert.equal(daysLeftUntil(new Date("2026-11-20T18:00:00Z"), now), 0)
  assert.equal(daysLeftUntil(new Date("2026-11-21T09:00:00Z"), now), 1)
  assert.equal(daysLeftUntil(new Date("2026-11-23T06:00:00Z"), now), 3)
  // A deadline already behind us never reports negative days.
  assert.equal(daysLeftUntil(new Date("2026-11-19T06:00:00Z"), now), 0)
})

test("writes a closing-date message with the posting details", () => {
  const text = formatReminder(
    {
      title: "Backend Engineer",
      company: "Acme Systems",
      location: "Remote",
      url: "https://t.me/jobs/12",
      deadlineAt: new Date("2026-11-22T15:00:00Z"),
    },
    2
  )

  assert.match(text, /Backend Engineer — closes in 2 days/)
  assert.match(text, /Acme Systems · Remote/)
  assert.match(text, /Deadline: 22 Nov 2026/)
  assert.match(text, /https:\/\/t\.me\/jobs\/12/)
})

test("says today or tomorrow near the deadline and escapes HTML", () => {
  const base = {
    company: null,
    location: null,
    url: null,
    deadlineAt: null,
  }

  assert.match(
    formatReminder({ ...base, title: "Data Analyst" }, 0),
    /closes today/
  )
  assert.match(
    formatReminder({ ...base, title: "Data Analyst" }, 1),
    /closes tomorrow/
  )
  // Channel text is untrusted, so angle brackets must not reach Telegram raw.
  assert.match(
    formatReminder({ ...base, title: "Ops <script> & Lead" }, 3),
    /Ops &lt;script&gt; &amp; Lead/
  )
  // A posting without a title still produces a readable message.
  assert.match(formatReminder({ ...base, title: null }, 3), /A posting/)
})

test("surfaces Telegram's own reason instead of a generic failure", () => {
  assert.equal(
    telegramDetail('{"ok":false,"description":"Bad Request: chat not found"}'),
    "Bad Request: chat not found"
  )
  // A non-JSON body still gives the user something to act on.
  assert.equal(telegramDetail("gateway down"), "gateway down")
})
