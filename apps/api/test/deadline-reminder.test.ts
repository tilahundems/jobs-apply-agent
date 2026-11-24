import assert from "node:assert/strict"
import { test } from "node:test"
import {
  daysLeftUntil,
  formatNewJobs,
  formatReminder,
} from "../src/agent/reminders.service.js"
import { telegramChatIds, telegramDetail } from "../src/agent/telegram-api.js"

const now = new Date("2026-11-20T06:00:00Z")

/** Every optional field empty, so each test only states what it cares about. */
const base = {
  company: null,
  location: null,
  url: null,
  deadlineAt: null,
  score: null,
}

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

test("announces new postings as one digest", () => {
  const text = formatNewJobs([
    {
      title: "Backend Engineer",
      company: "Acme Systems",
      location: "Remote",
      url: "https://t.me/jobs/12",
      deadlineAt: new Date("2026-11-22T15:00:00Z"),
      score: 72,
    },
  ])

  assert.match(text, /1 new posting/)
  assert.match(text, /1\. <b>Backend Engineer<\/b> — 72% match/)
  assert.match(text, /Acme Systems · Remote/)
  assert.match(text, /Closes 22 Nov 2026/)
  assert.match(text, /https:\/\/t\.me\/jobs\/12/)
  // Channel text is untrusted here too.
  assert.match(
    formatNewJobs([{ ...base, title: "Ops <script> & Lead", score: null }]),
    /Ops &lt;script&gt; &amp; Lead/
  )
})

test("keeps a large scan to one readable message", () => {
  const rows = Array.from({ length: 13 }, (_, index) => ({
    ...base,
    title: `Role ${index + 1}`,
    url: null,
    score: null,
  }))

  const text = formatNewJobs(rows)
  assert.match(text, /13 new postings/)
  assert.match(text, /10\. <b>Role 10<\/b>/)
  assert.doesNotMatch(text, /Role 11/)
  assert.match(text, /…and 3 more in the app\./)
})

test("sends to the owner first, then everyone else once", () => {
  assert.deepEqual(telegramChatIds("111, 222", "333"), ["111", "222", "333"])
  // A friend who is already in the owner's list is not messaged twice.
  assert.deepEqual(telegramChatIds("111,222", "222, 333"), [
    "111",
    "222",
    "333",
  ])
  // Blank values, the default, leave nobody to message.
  assert.deepEqual(telegramChatIds("", ""), [])
})

test("surfaces Telegram's own reason instead of a generic failure", () => {
  assert.equal(
    telegramDetail('{"ok":false,"description":"Bad Request: chat not found"}'),
    "Bad Request: chat not found"
  )
  // A non-JSON body still gives the user something to act on.
  assert.equal(telegramDetail("gateway down"), "gateway down")
})
