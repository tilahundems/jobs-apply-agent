import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatJobCard,
  formatJobLine,
  isJobRef,
  parseCommand,
} from "../src/agent/bot.service.js"

const now = new Date("2026-11-20T06:00:00Z")

const job = {
  id: "39aebfff-7f65-47d2-a9cc-52048fc3435a",
  title: "Backend <Engineer> & Platform",
  company: "Acme Systems",
  location: "Addis Ababa",
  url: "https://t.me/jobs/12",
  score: 84,
  status: "new",
  deadlineAt: new Date("2026-11-20T18:00:00Z"),
}

test("reads a command and its argument, ignoring the bot suffix", () => {
  assert.deepEqual(parseCommand("/jobs@jobapplyagent_bot 3"), {
    command: "jobs",
    args: "3",
  })
  assert.deepEqual(parseCommand("/applied  39aebfff "), {
    command: "applied",
    args: "39aebfff",
  })
  // Plain chat is not a command, and a bare slash is nothing.
  assert.equal(parseCommand("hello there"), null)
  assert.equal(parseCommand("/"), null)
})

test("accepts full ids and short prefixes, not prose", () => {
  assert.equal(isJobRef("39aebfff-7f65-47d2-a9cc-52048fc3435a"), true)
  assert.equal(isJobRef("39aebfff"), true)
  assert.equal(isJobRef("hey"), false)
})

test("lists a posting with its score and closing day, escaped for HTML", () => {
  const line = formatJobLine(job, now)
  assert.match(line, /Backend &lt;Engineer&gt; &amp; Platform/)
  assert.match(line, /Acme Systems/)
  assert.match(line, /84%/)
  assert.match(line, /closes today/)
  // An applied posting is marked so the list cannot be misread.
  assert.match(
    formatJobLine({ ...job, status: "applied", deadlineAt: null }, now),
    /no deadline \(applied\)/
  )
})

test("shows one posting in full with an id to act on", () => {
  const card = formatJobCard(job, now)
  assert.match(card, /Acme Systems · Addis Ababa/)
  assert.match(card, /Match: 84% · Status: new/)
  assert.match(card, /Deadline: 2026-11-20 \(closes today\)/)
  assert.match(card, /39aebfff-7f65-47d2-a9cc-52048fc3435a/)
  // A posting without a deadline says so instead of guessing.
  assert.match(formatJobCard({ ...job, deadlineAt: null }, now), /not stated/)
})
