import assert from "node:assert/strict"
import { test } from "node:test"
import {
  formatJobCard,
  formatJobLine,
  isJobRef,
  jobPage,
  menuCommand,
  pageLabel,
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

test("turns keyboard labels into the commands they stand for", () => {
  assert.deepEqual(menuCommand("Postings"), { command: "jobs", args: "" })
  assert.deepEqual(menuCommand("  Closing soon "), {
    command: "closing",
    args: "",
  })
  assert.deepEqual(menuCommand("Clear"), { command: "clear", args: "" })
  // Ordinary chat must not be swallowed as a command.
  assert.equal(menuCommand("hello"), null)
})

test("accepts full ids and short prefixes, not prose", () => {
  assert.equal(isJobRef("39aebfff-7f65-47d2-a9cc-52048fc3435a"), true)
  assert.equal(isJobRef("39aebfff"), true)
  assert.equal(isJobRef("hey"), false)
})

test("pages /jobs within the real number of pages", () => {
  assert.equal(jobPage("", 3), 1)
  assert.equal(jobPage("2", 3), 2)
  assert.equal(jobPage("0", 3), 1)
  assert.equal(jobPage("500", 3), 3)
  assert.equal(jobPage("many", 3), 1)
  // One posting still has a page to stand on.
  assert.equal(jobPage("4", 0), 1)
})

test("states the same totals the web list shows", () => {
  assert.equal(pageLabel(1, 3, 23), "1–10 of 23 · page 1 of 3")
  assert.equal(pageLabel(3, 3, 23), "21–23 of 23 · page 3 of 3")
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
