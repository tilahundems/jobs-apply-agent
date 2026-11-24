import { z } from "zod"

export const idSchema = z.string().trim().min(1)

export const projectInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  description: z.string().trim().min(1, "Description is required.").max(100),
  tagIds: z.array(idSchema).max(10).default([]),
})
export type ProjectInput = z.output<typeof projectInputSchema>

const csvToArray = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : []
  )

export const LIST_FILTER_OPERATORS = [
  "equals",
  "contains",
  "notContains",
  "startsWith",
  "before",
  "after",
] as const
export type ListFilterOperator = (typeof LIST_FILTER_OPERATORS)[number]
const DATE_OPERATORS: readonly ListFilterOperator[] = [
  "equals",
  "before",
  "after",
]
const isoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

/** `field:direction` → `{ field, direction }`, falling back to the default sort. */
function listSortSchema<const S extends readonly [string, ...string[]]>(
  fields: S,
  fallback: S[number]
) {
  const field = z.enum(fields).catch(fallback)
  const direction = z.enum(["asc", "desc"]).catch("desc")
  return z
    .string()
    .optional()
    .transform((value): { field: S[number]; direction: "asc" | "desc" } => {
      const raw = (value ?? "").trim()
      if (!raw) return { field: fallback, direction: "desc" }
      const [name, dir = "asc"] = raw.split(":")
      return {
        field: field.parse(name) as S[number],
        direction: direction.parse(dir),
      }
    })
}

/** Repeated `filter=field:operator:value` tokens; rules combine with AND. */
function listFiltersSchema<const F extends readonly [string, ...string[]]>(
  fields: F,
  dateFields: readonly F[number][]
) {
  const rule = z
    .object({
      field: z.enum(fields),
      operator: z.enum(LIST_FILTER_OPERATORS),
      value: z.string().trim().min(1).max(255),
    })
    .refine(
      ({ field, operator, value }) =>
        dateFields.includes(field)
          ? DATE_OPERATORS.includes(operator) && isoDate(value)
          : !["before", "after"].includes(operator),
      "Invalid filter for field."
    )
  return z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) =>
      value === undefined ? [] : Array.isArray(value) ? value : [value]
    )
    .pipe(z.array(z.string().max(300)).max(10))
    .transform((tokens) =>
      tokens.map((token) => {
        const first = token.indexOf(":")
        const second = token.indexOf(":", first + 1)
        return {
          field: token.slice(0, first),
          operator: token.slice(first + 1, second),
          value: token.slice(second + 1),
        }
      })
    )
    .pipe(z.array(rule))
}

/** Server-paginated list query: page, perPage, search, filter rules, and sort. */
function listQuerySchema<
  const F extends readonly [string, ...string[]],
  const S extends readonly [string, ...string[]],
>(options: {
  filterFields: F
  dateFields: readonly F[number][]
  sortFields: S
  defaultSort: S[number]
}) {
  return pageQuerySchema.extend({
    search: z
      .string()
      .max(255)
      .optional()
      .transform((value) => (value ?? "").trim()),
    filter: listFiltersSchema(options.filterFields, options.dateFields),
    sort: listSortSchema(options.sortFields, options.defaultSort),
  })
}

export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
})
export type PageQuery = z.output<typeof pageQuerySchema>

const emptyToNull = z
  .string()
  .nullable()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim() ?? ""
    return trimmed ? trimmed : null
  })

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const
export const TASK_PRIORITIES = ["low", "medium", "high"] as const
export const TASK_STATUS_LABELS = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
} as const satisfies Record<(typeof TASK_STATUSES)[number], string>
export const TASK_PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const satisfies Record<(typeof TASK_PRIORITIES)[number], string>
export const taskInputSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(80),
  description: emptyToNull.pipe(z.string().max(500).nullable()),
  status: z.enum(TASK_STATUSES).default("todo"),
  priority: z.enum(TASK_PRIORITIES).default("medium"),
  projectId: emptyToNull,
  assigneeId: emptyToNull,
  dueDate: emptyToNull.refine(
    (value) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value),
    "Enter a valid date."
  ),
})
export type TaskInput = z.output<typeof taskInputSchema>

export const tagInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required.").max(40),
  color: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .transform((value) => {
      const expanded =
        value.length === 4
          ? `#${[...value.slice(1)].map((char) => char + char).join("")}`
          : value
      return expanded.toLowerCase()
    }),
})
export type TagInput = z.output<typeof tagInputSchema>

export const userInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  roleId: idSchema.optional(),
})
export const createUserInputSchema = userInputSchema.extend({
  roleId: idSchema,
  email: z.string().trim().email("Enter a valid email.").toLowerCase(),
  password: z.string().min(8).max(128),
})
export type UserInput = z.output<typeof userInputSchema>
export type CreateUserInput = z.output<typeof createUserInputSchema>

export const roleInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().trim().min(1).max(80),
  description: z
    .string()
    .trim()
    .max(240)
    .optional()
    .nullable()
    .transform((value) => value || null),
  permissionIds: z
    .array(idSchema)
    .max(64)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Choose each permission only once."
    ),
})
export type RoleInput = z.output<typeof roleInputSchema>
export const roleUpdateInputSchema = roleInputSchema.extend({
  permissionIds: roleInputSchema.shape.permissionIds.optional(),
})
export type RoleUpdateInput = z.output<typeof roleUpdateInputSchema>

export const ACTIONS = ["manage", "create", "read", "update", "delete"] as const
export const SUBJECTS = [
  "all",
  "Project",
  "Task",
  "Tag",
  "User",
  "Role",
  "Permission",
  "AuditLog",
  "JobPost",
  "CandidateProfile",
] as const
export const permissionInputSchema = z.object({
  subject: z.enum(SUBJECTS),
  action: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9:_-]*$/),
  conditions: z
    .record(z.string(), z.json())
    .nullable()
    .transform((value) => (value && Object.keys(value).length ? value : null)),
})
export type PermissionInput = z.output<typeof permissionInputSchema>

export const auditListQuerySchema = pageQuerySchema
  .extend({
    q: z.string().trim().max(255).optional(),
    actor: z.string().trim().max(255).optional(),
    actorId: z.string().trim().min(1).max(255).optional(),
    action: z.string().trim().min(1).max(80).optional(),
    resourceType: z.string().trim().min(1).max(80).optional(),
    resourceId: z.string().trim().min(1).max(255).optional(),
    organizationId: z.string().trim().min(1).max(255).optional(),
    status: z.enum(["success", "failed"]).optional(),
    sort: z.enum(["newest", "oldest"]).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    path: ["to"],
    message: "End date must be on or after start date.",
  })
export type AuditListQuery = z.output<typeof auditListQuerySchema>
export const projectListQuerySchema = listQuerySchema({
  filterFields: ["name", "description", "tags", "createdAt"],
  dateFields: ["createdAt"],
  sortFields: ["name", "description", "createdAt", "updatedAt"],
  defaultSort: "createdAt",
}).extend({ tagIds: csvToArray })
export type ProjectListQuery = z.output<typeof projectListQuerySchema>
export const tagListQuerySchema = listQuerySchema({
  filterFields: ["label", "color", "createdAt"],
  dateFields: ["createdAt"],
  sortFields: ["label", "color", "createdAt"],
  defaultSort: "createdAt",
})
export type TagListQuery = z.output<typeof tagListQuerySchema>
export const taskListQuerySchema = listQuerySchema({
  filterFields: [
    "title",
    "project",
    "status",
    "priority",
    "assignee",
    "dueDate",
    "createdAt",
  ],
  dateFields: ["dueDate", "createdAt"],
  sortFields: [
    "title",
    "project",
    "status",
    "priority",
    "assignee",
    "dueDate",
    "createdAt",
  ],
  defaultSort: "createdAt",
})
export type TaskListQuery = z.output<typeof taskListQuerySchema>
export type Page<T> = { items: T[]; total: number }

// ---------------------------------------------------------------------------
// Job agent: postings read from Telegram, and the profile they are matched to.
// ---------------------------------------------------------------------------

export const JOB_STATUSES = [
  "new",
  "prepared",
  "applied",
  "dismissed",
  "blocked",
] as const
export const JOB_STATUS_LABELS = {
  new: "New",
  prepared: "Prepared",
  applied: "Applied",
  dismissed: "Dismissed",
  blocked: "Blocked",
} as const satisfies Record<(typeof JOB_STATUSES)[number], string>
export type JobStatus = (typeof JOB_STATUSES)[number]

export const JOB_SENIORITIES = [
  "intern",
  "junior",
  "mid",
  "senior",
  "lead",
  "principal",
] as const

export const jobListQuerySchema = listQuerySchema({
  filterFields: ["title", "company", "channel", "status", "createdAt"],
  dateFields: ["createdAt"],
  sortFields: ["title", "company", "score", "postedAt", "createdAt"],
  // Newest first, so a scan's findings are the first thing on the list.
  defaultSort: "createdAt",
})
export type JobListQuery = z.output<typeof jobListQuerySchema>

/** The user's own decision about a posting; the agent never sets these. */
export const jobStatusInputSchema = z.object({
  status: z.enum(["new", "prepared", "applied", "dismissed"]),
})
export type JobStatusInput = z.output<typeof jobStatusInputSchema>

const stringList = (max: number, itemMax = 80) =>
  z
    .array(z.string().trim().min(1).max(itemMax))
    .max(max)
    .default([])
    .transform((values) => [...new Set(values)])

export const profileExperienceSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(120),
  title: z.string().trim().min(1, "Title is required.").max(120),
  start: z.string().trim().max(20).default(""),
  end: z.string().trim().max(20).default(""),
  bullets: stringList(20, 500),
})

export const profileEducationSchema = z.object({
  degree: z.string().trim().min(1, "Degree is required.").max(120),
  school: z.string().trim().min(1, "School is required.").max(160),
  year: z.string().trim().max(20).default(""),
})

export const profilePreferencesSchema = z.object({
  titles: stringList(20, 60),
  seniority: z.enum(JOB_SENIORITIES).or(z.literal("")).default(""),
  locations: stringList(20, 60),
  remoteOk: z.boolean().default(true),
  minMatchScore: z.coerce.number().int().min(0).max(100).default(70),
  excludeKeywords: stringList(40, 60),
  avoidKeywords: stringList(40, 60),
})

export const profileSourcesSchema = z.object({
  channels: stringList(50, 120),
  messagesPerChannel: z.coerce.number().int().min(5).max(200).default(50),
})

export const profileInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Enter a valid email.").max(160),
  phone: z
    .string()
    .trim()
    .max(40)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null)),
  location: z.string().trim().max(120).default(""),
  headline: z.string().trim().max(140).default(""),
  summary: z.string().trim().max(2000).default(""),
  links: z
    .object({
      linkedin: z.string().trim().max(300).default(""),
      github: z.string().trim().max(300).default(""),
      portfolio: z.string().trim().max(300).default(""),
    })
    .default({ linkedin: "", github: "", portfolio: "" }),
  skills: stringList(100, 60),
  experience: z.array(profileExperienceSchema).max(20).default([]),
  education: z.array(profileEducationSchema).max(10).default([]),
  preferences: profilePreferencesSchema.default({
    titles: [],
    seniority: "",
    locations: [],
    remoteOk: true,
    minMatchScore: 70,
    excludeKeywords: [],
    avoidKeywords: [],
  }),
  sources: profileSourcesSchema.default({
    channels: [],
    messagesPerChannel: 50,
  }),
})
export type ProfileInput = z.output<typeof profileInputSchema>
