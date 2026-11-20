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

/**
 * One row per posting already announced over Telegram, so a restarted process
 * or a later check on the same day never repeats a closing-date warning.
 */
/**
 * Messages the command bot sent, so /clear can delete them from the chat.
 * Telegram only allows deleting for 48 hours, after which rows are dropped.
 */
export const botMessage = sqliteTable(
  "bot_message",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    /** Chat the message went to; one row per message per chat. */
    chatId: text("chat_id").notNull(),
    messageId: integer("message_id").notNull(),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("bot_message_chat_idx").on(table.chatId, table.sentAt)]
)

export const deadlineReminder = sqliteTable(
  "deadline_reminder",
  {
    id: text("id").primaryKey(),
    organizationId: organizationIdColumn(),
    jobPostId: text("job_post_id")
      .notNull()
      .references(() => jobPost.id, { onDelete: "cascade" }),
    /** Whole days left when the message went out; 0 means "closing today". */
    daysLeft: integer("days_left").notNull(),
    /** Telegram's id for the sent message, so it can be deleted later. */
    messageId: integer("message_id"),
    sentAt: integer("sent_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    uniqueIndex("deadline_reminder_job_uidx").on(
      table.organizationId,
      table.jobPostId
    ),
  ]
)

export type JobPost = typeof jobPost.$inferSelect
export type CandidateProfile = typeof candidateProfile.$inferSelect
