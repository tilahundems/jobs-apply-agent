import assert from "node:assert/strict"
import { test } from "node:test"
import type { ProfilePreferences } from "@et/db"
import { scoreJob } from "../src/agent/match.js"
import { isDeadlinePassed, parseJob } from "../src/agent/parse.js"
import { parseChannelPage } from "../src/agent/telegram-source.js"

const preferences: ProfilePreferences = {
  titles: ["backend engineer", "software engineer"],
  seniority: "mid",
  locations: ["Addis Ababa", "Remote"],
  remoteOk: true,
  minMatchScore: 70,
  excludeKeywords: ["unpaid", "10+ years"],
  avoidKeywords: [],
}

const profile = {
  skills: ["Python", "Django", "PostgreSQL", "Docker", "REST APIs"],
  preferences,
}

const strongPost = `Position: Backend Engineer
Company: Acme Systems
Location: Remote

We are looking for a backend engineer with 3 years of experience to build
REST APIs with Python and Django on PostgreSQL. Docker experience is a plus.
Requirements: solid SQL, testing habits, clear communication.
Apply by sending your CV to jobs@acme.example
Salary: competitive.`

test("scores a matching posting well above the threshold", () => {
  const parsed = parseJob(strongPost)
  const result = scoreJob(strongPost, parsed, profile)

  assert.equal(parsed.title, "Backend Engineer")
  assert.equal(parsed.company, "Acme Systems")
  assert.equal(result.blocked, false)
  assert.ok(
    result.score >= 70,
    `expected a strong score, received ${result.score}`
  )
  assert.ok(result.matchedSkills.includes("Python"))
  assert.ok(result.matchedSkills.includes("Docker"))
})

test("reads a labelled closing date as the end of that day", () => {
  const parsed = parseJob(`${strongPost}\nDeadline: 25 Nov 2026`)

  assert.ok(parsed.deadlineAt)
  assert.equal(parsed.deadlineAt.getFullYear(), 2026)
  assert.equal(parsed.deadlineAt.getMonth(), 10)
  assert.equal(parsed.deadlineAt.getDate(), 25)
  assert.equal(parsed.deadlineAt.getHours(), 23)
})

test("reads a day-first numeric closing date", () => {
  const parsed = parseJob(`${strongPost}\nApply before 30/11/2026.`)

  assert.ok(parsed.deadlineAt)
  assert.equal(parsed.deadlineAt.getMonth(), 10)
  assert.equal(parsed.deadlineAt.getDate(), 30)
})

test("leaves the deadline empty when the post states none", () => {
  assert.equal(parseJob(strongPost).deadlineAt, null)
})

test("treats a deadline that has passed as closed", () => {
  const yesterday = new Date(Date.now() - 86_400_000)
  const tomorrow = new Date(Date.now() + 86_400_000)

  assert.equal(isDeadlinePassed(yesterday), true)
  assert.equal(isDeadlinePassed(tomorrow), false)
  assert.equal(isDeadlinePassed(null), false)
})

test("blocks a posting that contains an exclusion keyword", () => {
  const text = `${strongPost}\nThis is an unpaid trial period.`
  const result = scoreJob(text, parseJob(text), profile)

  assert.equal(result.blocked, true)
  assert.equal(result.score, 0)
})

test("scores an unrelated posting below the threshold", () => {
  const text = `We are hiring a graphic designer for our studio in Nairobi.
Requirements: Illustrator, Figma, brand systems, 3 years of experience.
Send your portfolio and CV to design@studio.example. Salary negotiable.`
  const result = scoreJob(text, parseJob(text), profile)

  assert.equal(result.blocked, false)
  assert.ok(
    result.score < 70,
    `expected a weak score, received ${result.score}`
  )
  assert.ok(result.gaps.length > 0)
})

test("a shared generic role word is not a title match", () => {
  const text = `VACANCY ANNOUNCEMENT\nPosition: Construction Engineer\nWork Location: from Anywhere/remote in Ethiopia\nDescription: KBEK Group is hiring a construction engineer for a project site.`
  const result = scoreJob(text, parseJob(text), profile)

  assert.ok(
    !result.reasons.some((reason) => reason.startsWith("title partially")),
    `unexpected partial title credit: ${result.reasons.join("; ")}`
  )
  assert.ok(
    result.score < 70,
    `expected a weak score, received ${result.score}`
  )
})

test("caps a posting that matches no target title and no skill", () => {
  const text = `We are hiring a textile engineer to run production lines in Kombolcha.\nRequirements: 3 years of experience. Remote work is not possible.\nSend your CV to hr@example.com by 30 November 2026.`
  const parsed = parseJob(text)
  const result = scoreJob(text, parsed, profile)

  assert.ok(
    result.score <= 30,
    `expected the cap to hold, received ${result.score}`
  )
})

test("reads postings out of a public channel page", () => {
  const html = `
    <div class="tgme_widget_message" data-post="jobs_channel/101">
      <div class="tgme_widget_message_text js-message_text" dir="auto">
        We are hiring a Python developer to build REST APIs. Docker and
        PostgreSQL required. Apply with your CV today.
      </div>
      <time datetime="2026-11-17T09:15:00+00:00"></time>
    </div>
    <div class="tgme_widget_message" data-post="jobs_channel/102">
      <div class="tgme_widget_message_text js-message_text" dir="auto">
        Frontend engineer wanted for a React and TypeScript product team.
        Remote friendly. Send a CV and two code samples.
      </div>
      <time datetime="2026-11-17T10:05:00+00:00"></time>
    </div>`

  const posts = parseChannelPage(html, "jobs_channel", 10)

  assert.equal(posts.length, 2)
  assert.equal(posts[0]?.messageId, 101)
  assert.equal(posts[0]?.url, "https://t.me/jobs_channel/101")
  assert.match(posts[1]?.text ?? "", /Frontend engineer/)
  assert.equal(posts[0]?.postedAt?.toISOString(), "2026-11-17T09:15:00.000Z")
})
