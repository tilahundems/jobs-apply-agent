import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core"
import { organizationIdColumn } from "./tenant-policy.js"
import { createdAt, updatedAt } from "./timestamps.js"

export const JOB_STATUS_VALUES = [
  "new",
  "prepared",
  "applied",
  "dismissed",
  "blocked",
] as const

export type JobStatus = (typeof JOB_STATUS_VALUES)[number]

export type ProfileExperience = {
  company: string
  title: string
  start: string
  end: string
  bullets: string[]
}

export type ProfileEducation = {
  degree: string
  school: string
  year: string
}

export type ProfilePreferences = {
  titles: string[]
  seniority: string
  locations: string[]
  remoteOk: boolean
  minMatchScore: number
  excludeKeywords: string[]
  avoidKeywords: string[]
}

export type ProfileSources = {
  channels: string[]
  messagesPerChannel: number
}

export const EMPTY_PREFERENCES: ProfilePreferences = {
  titles: [],
  seniority: "",
  locations: [],
  remoteOk: true,
  minMatchScore: 70,
  excludeKeywords: [],
  avoidKeywords: [],
}

export const EMPTY_SOURCES: ProfileSources = {
  channels: [],
  messagesPerChannel: 50,
}

/**
 * The single row describing the candidate. One per organization; the agent
 * reads it to score postings and to write tailored applications.
 */
export const candidateProfile = sqliteTable(
  "candidate_profile",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    location: text("location").notNull().default(""),
    headline: text("headline").notNull().default(""),
    summary: text("summary").notNull().default(""),
    skills: text("skills", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    links: text("links", { mode: "json" })
      .$type<Record<string, string>>()
      .notNull()
      .$defaultFn(() => ({})),
    experience: text("experience", { mode: "json" })
      .$type<ProfileExperience[]>()
      .notNull()
      .$defaultFn(() => []),
    education: text("education", { mode: "json" })
      .$type<ProfileEducation[]>()
      .notNull()
      .$defaultFn(() => []),
    preferences: text("preferences", { mode: "json" })
      .$type<ProfilePreferences>()
      .notNull()
      .$defaultFn(() => EMPTY_PREFERENCES),
    sources: text("sources", { mode: "json" })
      .$type<ProfileSources>()
      .notNull()
      .$defaultFn(() => EMPTY_SOURCES),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("candidate_profile_organization_id_idx").on(table.organizationId),
    uniqueIndex("candidate_profile_organization_uidx").on(table.organizationId),
  ]
)

/**
 * A posting read from a Telegram channel, the score it received, and (once
 * prepared) the tailored CV and cover letter the user reviews before applying.
 */
export const jobPost = sqliteTable(
  "job_post",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    externalKey: text("external_key").notNull(),
    channel: text("channel").notNull(),
    messageId: integer("message_id"),
    postedAt: integer("posted_at", { mode: "timestamp" }),
    /** Closing date the post itself states, if any. */
    deadlineAt: integer("deadline_at", { mode: "timestamp" }),
    title: text("title"),
    company: text("company"),
    location: text("location"),
    url: text("url"),
    rawText: text("raw_text").notNull(),
    score: integer("score").notNull().default(0),
    blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
    status: text("status", { enum: JOB_STATUS_VALUES })
      .notNull()
      .default("new"),
    reasons: text("reasons", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    gaps: text("gaps", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    matchedSkills: text("matched_skills", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    tailoredCv: text("tailored_cv"),
    coverLetter: text("cover_letter"),
    preparedAt: integer("prepared_at", { mode: "timestamp" }),
    appliedAt: integer("applied_at", { mode: "timestamp" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("job_post_organization_external_uidx").on(
      table.organizationId,
      table.externalKey
    ),
    index("job_post_organization_id_idx").on(table.organizationId),
    index("job_post_score_idx").on(table.score),
  ]
)

export type JobPost = typeof jobPost.$inferSelect
export type CandidateProfile = typeof candidateProfile.$inferSelect
