import {
  closeDb,
  db,
  member,
  organization,
  project,
  projectTag,
  rootDb,
  SINGLE_TENANT_ID,
  tag,
  task,
  withTenantTransaction,
} from "@et/db"
import { eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { auth } from "./auth.js"

import {
  assignRoleByKey,
  ROLE_ADMIN,
  ROLE_USER,
  seedRolesAndPermissions,
} from "./authz/permissions.js"
import { env } from "./env.js"

type SeedTaskStatus = "todo" | "in_progress" | "done"
type SeedTaskPriority = "low" | "medium" | "high"
type SeedAssignee = "admin" | "member"
const DEMO_ORGANIZATION_ID = "seed-demo-organization"
const DEMO_ORGANIZATION_SLUG = "demo-workspace"

function recordId(id: string) {
  return env.MULTI_TENANCY ? `tenant-${id}` : id
}

const SEED_TAGS = [
  { id: "seed-tag-frontend", label: "Frontend", color: "#3b82f6" },
  { id: "seed-tag-backend", label: "Backend", color: "#8b5cf6" },
  { id: "seed-tag-design", label: "Design", color: "#ec4899" },
  { id: "seed-tag-urgent", label: "Urgent", color: "#ef4444" },
  { id: "seed-tag-research", label: "Research", color: "#14b8a6" },
  { id: "seed-tag-operations", label: "Operations", color: "#f59e0b" },
  { id: "seed-tag-growth", label: "Growth", color: "#22c55e" },
  { id: "seed-tag-compliance", label: "Compliance", color: "#64748b" },
] as const

const SEED_PROJECTS = [
  {
    id: "seed-project-atlas-website",
    name: "Atlas Website Redesign",
    description: "Refresh marketing site IA, visuals, and conversion paths.",
    tagIds: ["seed-tag-frontend", "seed-tag-design"],
    tasks: [
      {
        id: "seed-task-atlas-audit",
        title: "Audit current landing pages",
        description: "Capture bounce points and outdated content on key pages.",
        status: "done" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-28",
      },
      {
        id: "seed-task-atlas-homepage",
        title: "Ship homepage hero variants",
        description: "Implement two hero layouts for the next design review.",
        status: "in_progress" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-12",
      },
      {
        id: "seed-task-atlas-qa",
        title: "QA responsive breakpoints",
        description: "Check tablet and mobile layouts before launch.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-20",
      },
    ],
  },
  {
    id: "seed-project-northstar-app",
    name: "Northstar Mobile App",
    description: "Ship the first customer-facing iOS and Android release.",
    tagIds: ["seed-tag-frontend", "seed-tag-backend"],
    tasks: [
      {
        id: "seed-task-northstar-auth",
        title: "Finish auth onboarding flow",
        description:
          "Cover sign-in, password reset, and first-run permissions.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-10",
      },
      {
        id: "seed-task-northstar-push",
        title: "Wire push notification tokens",
        description: "Register device tokens and handle opt-in prompts.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-18",
      },
      {
        id: "seed-task-northstar-beta",
        title: "Prepare TestFlight beta",
        description: "Collect build notes and invite the first 20 testers.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-26",
      },
    ],
  },
  {
    id: "seed-project-billing",
    name: "Billing Reconciliation",
    description: "Automate invoice matching and payment exception review.",
    tagIds: ["seed-tag-backend", "seed-tag-operations"],
    tasks: [
      {
        id: "seed-task-billing-map",
        title: "Map invoice source fields",
        description: "Document required fields from Stripe and the ledger.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-22",
      },
      {
        id: "seed-task-billing-match",
        title: "Build payment matching job",
        description: "Match settled charges to open invoices overnight.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-14",
      },
      {
        id: "seed-task-billing-exceptions",
        title: "Review unmatched exceptions",
        description: "Triage leftover payments that need a human owner.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-22",
      },
    ],
  },
  {
    id: "seed-project-warehouse",
    name: "Data Warehouse Migration",
    description: "Move analytics pipelines to the new warehouse stack.",
    tagIds: ["seed-tag-backend", "seed-tag-research"],
    tasks: [
      {
        id: "seed-task-warehouse-inventory",
        title: "Inventory existing pipelines",
        description: "List owners, freshness, and downstream dashboards.",
        status: "done" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-18",
      },
      {
        id: "seed-task-warehouse-events",
        title: "Migrate event fact tables",
        description: "Backfill last 90 days and compare row counts.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-16",
      },
      {
        id: "seed-task-warehouse-cutover",
        title: "Plan warehouse cutover",
        description: "Write the freeze window and rollback checklist.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-30",
      },
    ],
  },
  {
    id: "seed-project-support",
    name: "Support Inbox Overhaul",
    description: "Reduce ticket handle time with better routing and macros.",
    tagIds: ["seed-tag-operations", "seed-tag-growth"],
    tasks: [
      {
        id: "seed-task-support-macros",
        title: "Draft first-response macros",
        description: "Cover refunds, access issues, and billing questions.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-08-30",
      },
      {
        id: "seed-task-support-routing",
        title: "Tune ticket routing rules",
        description: "Send urgent billing tickets to the on-call queue.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-11",
      },
      {
        id: "seed-task-support-sla",
        title: "Publish new SLA targets",
        description: "Share first-response and resolution goals with the team.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-25",
      },
    ],
  },
  {
    id: "seed-project-partners",
    name: "Partner Portal Launch",
    description: "Give partners a self-serve space for leads and assets.",
    tagIds: ["seed-tag-frontend", "seed-tag-growth"],
    tasks: [
      {
        id: "seed-task-partners-access",
        title: "Define partner access roles",
        description: "Separate lead viewers from campaign editors.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-25",
      },
      {
        id: "seed-task-partners-leads",
        title: "Build shared lead inbox",
        description: "Let partners claim and update inbound leads.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-15",
      },
      {
        id: "seed-task-partners-assets",
        title: "Upload launch asset pack",
        description: "Add logos, one-pagers, and approved email copy.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-24",
      },
    ],
  },
  {
    id: "seed-project-security",
    name: "Security Audit Remediation",
    description: "Close high-priority findings from the last audit.",
    tagIds: ["seed-tag-compliance", "seed-tag-urgent", "seed-tag-backend"],
    tasks: [
      {
        id: "seed-task-security-secrets",
        title: "Rotate leaked service secrets",
        description: "Replace exposed keys and revoke the old credentials.",
        status: "done" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-20",
      },
      {
        id: "seed-task-security-mfa",
        title: "Enforce MFA for admins",
        description: "Require a second factor before privileged actions.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-09",
      },
      {
        id: "seed-task-security-report",
        title: "Write remediation report",
        description: "Summarize closed findings and remaining risks.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-21",
      },
    ],
  },
  {
    id: "seed-project-onboarding",
    name: "Onboarding Playbook",
    description: "Standardize first-week setup for new hires and customers.",
    tagIds: ["seed-tag-operations", "seed-tag-design"],
    tasks: [
      {
        id: "seed-task-onboarding-checklist",
        title: "Write day-one checklist",
        description: "Cover accounts, tools, and the first team intro.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-08-27",
      },
      {
        id: "seed-task-onboarding-guide",
        title: "Record product walkthrough",
        description: "Keep the first-week demo under 12 minutes.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-17",
      },
      {
        id: "seed-task-onboarding-survey",
        title: "Add week-one survey",
        description: "Ask new users what still feels unclear.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-23",
      },
    ],
  },
  {
    id: "seed-project-analytics",
    name: "Analytics Dashboard",
    description: "Surface weekly KPIs for growth, product, and finance.",
    tagIds: ["seed-tag-research", "seed-tag-growth"],
    tasks: [
      {
        id: "seed-task-analytics-metrics",
        title: "Agree on weekly KPI set",
        description: "Lock the 8 metrics that every team will review.",
        status: "done" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-21",
      },
      {
        id: "seed-task-analytics-charts",
        title: "Build weekly trend charts",
        description: "Show week-over-week change for the core KPIs.",
        status: "in_progress" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-13",
      },
      {
        id: "seed-task-analytics-share",
        title: "Share Monday digest",
        description: "Email the snapshot to leads every Monday morning.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-28",
      },
    ],
  },
  {
    id: "seed-project-rate-limits",
    name: "API Rate Limit Upgrade",
    description: "Roll out fair usage limits without breaking clients.",
    tagIds: ["seed-tag-backend", "seed-tag-urgent"],
    tasks: [
      {
        id: "seed-task-rate-baseline",
        title: "Measure current API usage",
        description: "Find the 95th percentile of requests per client.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-08-24",
      },
      {
        id: "seed-task-rate-headers",
        title: "Add rate-limit headers",
        description: "Return remaining quota and reset time on every response.",
        status: "in_progress" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-12",
      },
      {
        id: "seed-task-rate-docs",
        title: "Update public API docs",
        description: "Explain the new limits and how clients should retry.",
        status: "todo" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-19",
      },
    ],
  },
  {
    id: "seed-project-design-system",
    name: "Internal Design System",
    description: "Publish shared tokens, components, and usage guidance.",
    tagIds: ["seed-tag-design", "seed-tag-frontend"],
    tasks: [
      {
        id: "seed-task-ds-tokens",
        title: "Publish color and type tokens",
        description: "Export the latest Figma tokens into the web package.",
        status: "done" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-08-29",
      },
      {
        id: "seed-task-ds-inputs",
        title: "Document form components",
        description: "Add usage notes for input, select, and date fields.",
        status: "in_progress" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-14",
      },
      {
        id: "seed-task-ds-review",
        title: "Run design-system review",
        description: "Collect adoption gaps from product and marketing.",
        status: "todo" as SeedTaskStatus,
        priority: "low" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-27",
      },
    ],
  },
  {
    id: "seed-project-feedback",
    name: "Customer Feedback Loop",
    description: "Collect, tag, and route product feedback to owners.",
    tagIds: ["seed-tag-research", "seed-tag-operations"],
    tasks: [
      {
        id: "seed-task-feedback-intake",
        title: "Create feedback intake form",
        description: "Capture source, severity, and the related product area.",
        status: "done" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-08-26",
      },
      {
        id: "seed-task-feedback-tags",
        title: "Tag last month of tickets",
        description: "Apply the new taxonomy to recent support threads.",
        status: "in_progress" as SeedTaskStatus,
        priority: "medium" as SeedTaskPriority,
        assignee: "member" as SeedAssignee,
        dueDate: "2026-09-16",
      },
      {
        id: "seed-task-feedback-owners",
        title: "Assign product area owners",
        description: "Route each tagged theme to a named DRI.",
        status: "todo" as SeedTaskStatus,
        priority: "high" as SeedTaskPriority,
        assignee: "admin" as SeedAssignee,
        dueDate: "2026-09-29",
      },
    ],
  },
] as const

async function seedTagsProjectsAndTasks(
  organizationId: string,
  assignees: { admin: string; member: string }
) {
  const now = new Date()
  const projectIds = SEED_PROJECTS.map((item) => recordId(item.id))

  await db
    .insert(tag)
    .values(
      SEED_TAGS.map((item) => ({
        id: recordId(item.id),
        organizationId,
        label: item.label,
        color: item.color,
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoUpdate({
      target: tag.id,
      set: {
        label: sql`excluded.label`,
        color: sql`excluded.color`,
        updatedAt: now,
      },
    })

  await db
    .insert(project)
    .values(
      SEED_PROJECTS.map((item) => ({
        id: recordId(item.id),
        organizationId,
        name: item.name,
        description: item.description,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      }))
    )
    .onConflictDoUpdate({
      target: project.id,
      set: {
        name: sql`excluded.name`,
        description: sql`excluded.description`,
        deletedAt: null,
        updatedAt: now,
      },
    })

  await db.delete(projectTag).where(inArray(projectTag.projectId, projectIds))
  await db.insert(projectTag).values(
    SEED_PROJECTS.flatMap((item) =>
      item.tagIds.map((tagId) => ({
        organizationId,
        projectId: recordId(item.id),
        tagId: recordId(tagId),
      }))
    )
  )

  await db
    .insert(task)
    .values(
      SEED_PROJECTS.flatMap((item) =>
        item.tasks.map((seedTask) => ({
          id: recordId(seedTask.id),
          organizationId,
          title: seedTask.title,
          description: seedTask.description,
          status: seedTask.status,
          priority: seedTask.priority,
          projectId: recordId(item.id),
          assigneeId: assignees[seedTask.assignee],
          dueDate: seedTask.dueDate,
          createdAt: now,
          updatedAt: now,
        }))
      )
    )
    .onConflictDoUpdate({
      target: task.id,
      set: {
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        status: sql`excluded.status`,
        priority: sql`excluded.priority`,
        projectId: sql`excluded.project_id`,
        assigneeId: sql`excluded.assignee_id`,
        dueDate: sql`excluded.due_date`,
        updatedAt: now,
      },
    })

  console.log(
    `Seeded ${SEED_TAGS.length} tags, ${SEED_PROJECTS.length} projects, and ${SEED_PROJECTS.length * 3} tasks`
  )
}

const seedAdmin = z
  .object({
    name: z.string().trim().min(1).default("Demo User"),
    email: z.string().trim().email().default("demo@example.com"),
    password: z.string().min(8).default("demo-password"),
  })
  .parse({
    name: process.env.SEED_USER_NAME,
    email: process.env.SEED_USER_EMAIL,
    password: process.env.SEED_USER_PASSWORD,
  })

const seedMember = z
  .object({
    name: z.string().trim().min(1).default("Regular User"),
    email: z.string().trim().email().default("user@example.com"),
    password: z.string().min(8).default("user-password"),
  })
  .parse({
    name: process.env.SEED_MEMBER_NAME,
    email: process.env.SEED_MEMBER_EMAIL,
    password: process.env.SEED_MEMBER_PASSWORD,
  })

async function ensureUser(input: {
  name: string
  email: string
  password: string
}) {
  const email = input.email.toLowerCase()
  const existingUser = await db.query.user.findFirst({
    columns: { id: true },
    where: (user, { eq }) => eq(user.email, email),
  })

  if (existingUser) {
    console.log(`Seed user already exists: ${email}`)
    return existingUser.id
  }

  const created = await auth.api.signUpEmail({
    body: {
      name: input.name,
      email,
      password: input.password,
    },
  })

  console.log(`Created seed user: ${email}`)
  return created.user.id
}

async function ensureDemoOrganization(assignees: {
  admin: string
  member: string
}) {
  await db
    .insert(organization)
    .values({
      id: DEMO_ORGANIZATION_ID,
      name: "Demo Workspace",
      slug: DEMO_ORGANIZATION_SLUG,
    })
    .onConflictDoNothing({ target: organization.id })

  const [existing] = await db
    .select({ slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, DEMO_ORGANIZATION_ID))
  if (existing?.slug !== DEMO_ORGANIZATION_SLUG)
    throw new Error("The demo organization ID belongs to another organization")

  await db
    .insert(member)
    .values([
      {
        id: "seed-demo-owner",
        organizationId: DEMO_ORGANIZATION_ID,
        userId: assignees.admin,
        role: "owner",
      },
      {
        id: "seed-demo-member",
        organizationId: DEMO_ORGANIZATION_ID,
        userId: assignees.member,
        role: "member",
      },
    ])
    .onConflictDoUpdate({
      target: [member.organizationId, member.userId],
      set: { role: sql`excluded.role` },
    })
  console.log("Seeded Demo Workspace organization and memberships")
}

async function seed() {
  await seedRolesAndPermissions()
  console.log("Seeded admin and user role definitions")

  const adminId = await ensureUser(seedAdmin)
  const memberId = await ensureUser(seedMember)
  if (env.MULTI_TENANCY) {
    await withTenantTransaction(rootDb, DEMO_ORGANIZATION_ID, async () => {
      await ensureDemoOrganization({
        admin: adminId,
        member: memberId,
      })
      await seedTagsProjectsAndTasks(DEMO_ORGANIZATION_ID, {
        admin: adminId,
        member: memberId,
      })
    })
  } else {
    await assignRoleByKey(adminId, ROLE_ADMIN)
    console.log(`Assigned admin role to ${seedAdmin.email.toLowerCase()}`)
    await assignRoleByKey(memberId, ROLE_USER)
    console.log(`Assigned user role to ${seedMember.email.toLowerCase()}`)
    await withTenantTransaction(rootDb, SINGLE_TENANT_ID, () =>
      seedTagsProjectsAndTasks(SINGLE_TENANT_ID, {
        admin: adminId,
        member: memberId,
      })
    )
  }
}

try {
  if (
    process.env.ALLOW_DEMO_SEED !== "true" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error(
      "Demo seeding requires ALLOW_DEMO_SEED=true and a non-production environment"
    )
  }
  await seed()
} finally {
  await closeDb()
}
