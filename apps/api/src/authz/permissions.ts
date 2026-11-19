import {
  subject as an,
  createMongoAbility,
  type ForcedSubject,
  type MongoAbility,
  type RawRuleOf,
} from "@casl/ability"
import type { ACTIONS, SUBJECTS } from "@et/contracts"
import {
  currentOrganizationId,
  type Database,
  db,
  permission,
  role,
  rolePermission,
  rootDb,
  SINGLE_TENANT_ID,
  userRole,
  withTenantTransaction,
} from "@et/db"
import { eq } from "drizzle-orm"
import { env } from "../env.js"

export type Action = (typeof ACTIONS)[number] | (string & {})
export type Subject = (typeof SUBJECTS)[number]
export type AppSubject = Subject | ForcedSubject<Exclude<Subject, "all">>
export type AppAbility = MongoAbility<[Action, AppSubject]>
export type AppAbilityRule = RawRuleOf<AppAbility>

export const ROLE_ADMIN = "admin"
export const ROLE_USER = "user"
export const USER_ID_PLACEHOLDER = "${user.id}"

/** Better Auth stores organization roles as a comma-separated list. */
const memberRoles = (role: string | null | undefined) => role?.split(",") ?? []
export const isOrgOwner = (role: string | null | undefined) =>
  memberRoles(role).includes("owner")
export const isOrgAdmin = (role: string | null | undefined) =>
  memberRoles(role).some((item) => item === "owner" || item === "admin")
/** The starter role a membership falls back to when it has no `app_role_id`. */
export const memberRoleKey = (role: string | null | undefined) =>
  isOrgAdmin(role) ? ROLE_ADMIN : ROLE_USER

const CRUD_ACTIONS = ["create", "read", "update", "delete"] as const
const CATALOG_SUBJECTS = [
  "Project",
  "Task",
  "Role",
  "User",
  "Tag",
  "JobPost",
  "CandidateProfile",
] as const

type SeedPermission = {
  id: string
  action: Action
  subject: Subject
  fields?: string[]
  conditions?: Record<string, unknown> | null
  inverted?: boolean
  reason?: string | null
}

type SeedRole = {
  id: string
  key: string
  name: string
  description: string
  permissions: SeedPermission[]
}

function adminPermissions(): SeedPermission[] {
  return [
    {
      id: "perm_admin_manage_all",
      action: "manage",
      subject: "all",
    },
  ]
}

function catalogPermissions(): SeedPermission[] {
  return CATALOG_SUBJECTS.flatMap((recordSubject) =>
    CRUD_ACTIONS.map((action) => ({
      id: `perm_${action}_${recordSubject.toLowerCase()}`,
      action,
      subject: recordSubject,
    }))
  )
}

export const SEEDED_ROLES: SeedRole[] = [
  {
    id: "role_admin",
    key: ROLE_ADMIN,
    name: "Admin",
    description: "Full access to every record and action.",
    permissions: adminPermissions(),
  },
  {
    id: "role_user",
    key: ROLE_USER,
    name: "User",
    description:
      "Can manage projects, tasks and tags, and read the user directory.",
    permissions: catalogPermissions().filter(
      (p) =>
        !["Role", "User"].includes(p.subject) ||
        (p.subject === "User" && p.action === "read")
    ),
  },
]

export function interpolateConditions(
  conditions: unknown,
  userId: string
): unknown {
  if (typeof conditions === "string") {
    return conditions.replaceAll(USER_ID_PLACEHOLDER, userId)
  }

  if (Array.isArray(conditions)) {
    return conditions.map((item) => interpolateConditions(item, userId))
  }

  if (conditions !== null && typeof conditions === "object") {
    return Object.fromEntries(
      Object.entries(conditions).map(([key, value]) => [
        key,
        interpolateConditions(value, userId),
      ])
    )
  }

  return conditions
}

export function toCaslRule(
  row: {
    action: string
    subject: string
    fields: string[]
    conditions: unknown
    inverted: boolean
    reason: string | null
  },
  userId: string
): AppAbilityRule {
  const conditions = interpolateConditions(row.conditions, userId)

  return {
    action: row.action as Action,
    subject: row.subject as Subject,
    ...(row.fields.length > 0 ? { fields: row.fields } : {}),
    ...(conditions != null
      ? { conditions: conditions as AppAbilityRule["conditions"] }
      : {}),
    ...(row.inverted ? { inverted: true } : {}),
    ...(row.reason ? { reason: row.reason } : {}),
  }
}

export function createAppAbility(rules: AppAbilityRule[]): AppAbility {
  return createMongoAbility<AppAbility>(rules)
}

export async function seedRolesAndPermissions() {
  if (env.MULTI_TENANCY) {
    return withTenantTransaction(rootDb, SINGLE_TENANT_ID, seedRoleTemplates)
  }
  return seedRoleTemplates()
}

async function seedRoleTemplates() {
  for (const seeded of SEEDED_ROLES) {
    await db
      .insert(role)
      .values({
        id: seeded.id,
        organizationId: SINGLE_TENANT_ID,
        key: seeded.key,
        name: seeded.name,
        description: seeded.description,
      })
      .onConflictDoUpdate({
        target: [role.organizationId, role.key],
        set: {
          name: seeded.name,
          description: seeded.description,
        },
      })

    const saved = await db.query.role.findFirst({
      columns: { id: true },
      where: (roleTable, { and: andOp, eq: eqOp }) =>
        andOp(
          eqOp(roleTable.organizationId, SINGLE_TENANT_ID),
          eqOp(roleTable.key, seeded.key)
        ),
    })

    if (!saved) {
      throw new Error(`Unable to seed role: ${seeded.key}`)
    }

    await db.delete(rolePermission).where(eq(rolePermission.roleId, saved.id))

    if (seeded.permissions.length === 0) {
      continue
    }

    await db
      .insert(permission)
      .values(
        seeded.permissions.map((item) => ({
          id: item.id,
          organizationId: SINGLE_TENANT_ID,
          action: item.action,
          subject: item.subject,
          fields: item.fields ?? [],
          conditions: item.conditions ?? null,
          inverted: item.inverted ?? false,
          reason: item.reason ?? null,
        }))
      )
      .onConflictDoNothing()
    await db
      .insert(rolePermission)
      .values(
        seeded.permissions.map((item) => ({
          roleId: saved.id,
          permissionId: item.id,
          organizationId: SINGLE_TENANT_ID,
        }))
      )
      .onConflictDoNothing()
  }
}

export async function assignRoleByKey(userId: string, roleKey: string) {
  if (env.MULTI_TENANCY) return
  const saved = await db.query.role.findFirst({
    columns: { id: true },
    where: (roleTable, { and: andOp, eq: eqOp }) =>
      andOp(
        eqOp(roleTable.organizationId, SINGLE_TENANT_ID),
        eqOp(roleTable.key, roleKey)
      ),
  })

  if (!saved) {
    throw new Error(`Role not found: ${roleKey}`)
  }

  await db
    .insert(userRole)
    .values({
      userId,
      roleId: saved.id,
    })
    .onConflictDoNothing()
}

export async function loadRulesForUser(
  userId: string,
  client: Pick<Database, "query"> = db,
  organizationId: string | null = currentOrganizationId()
): Promise<AppAbilityRule[]> {
  if (env.MULTI_TENANCY) {
    if (!organizationId) return []
    const membership = await client.query.member.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.userId, userId), eq(table.organizationId, organizationId)),
    })
    if (!membership) return []
    const roleKey =
      membership.role === "member" || isOrgAdmin(membership.role)
        ? memberRoleKey(membership.role)
        : membership.role
    const assigned = await client.query.role.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.organizationId, organizationId),
          membership.appRoleId
            ? eq(table.id, membership.appRoleId)
            : eq(table.key, roleKey)
        ),
      with: { rolePermissions: { with: { permission: true } } },
    })
    return (
      assigned?.rolePermissions.map((item) =>
        toCaslRule(item.permission, userId)
      ) ?? []
    )
  }
  const assignments = await client.query.userRole.findMany({
    where: (table, { eq: eqOp }) => eqOp(table.userId, userId),
    orderBy: (table, { asc }) => [asc(table.roleId)],
    with: {
      role: {
        with: {
          rolePermissions: {
            with: { permission: true },
            orderBy: (table, { asc }) => [asc(table.permissionId)],
          },
        },
      },
    },
  })

  return assignments.flatMap((assignment) =>
    assignment.role.rolePermissions.map((item) =>
      toCaslRule(item.permission, userId)
    )
  )
}

export async function abilityForUser(userId: string) {
  return createAppAbility(await loadRulesForUser(userId))
}

export { an }
