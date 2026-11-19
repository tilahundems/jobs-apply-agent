import { AuthzService, an } from "@et/authz"
import type { RoleInput, RoleUpdateInput } from "@et/contracts"
import {
  db,
  lockRoleAssignments,
  member,
  permission,
  requiredOrganizationId,
  role,
  rolePermission,
  tenantWhere,
  userRole,
} from "@et/db"
import { HttpStatus, Inject, Injectable } from "@nestjs/common"
import { and, eq, inArray, ne, type SQL } from "drizzle-orm"
import { memberRoleKey, ROLE_ADMIN, ROLE_USER } from "../authz/permissions.js"
import {
  type AuditRecorder,
  auditChanges,
  InjectAudit,
} from "../common/audit.port.js"
import { env } from "../env.js"
import { apiError } from "../http/api-error.js"
import { assertDelegation, ensureRoleManager } from "./role-management.js"

const isSystemRole = (key: string) => [ROLE_ADMIN, ROLE_USER].includes(key)
const roleRelations = {
  rolePermissions: { with: { permission: true } },
  userRoles: { columns: { userId: true } },
} as const

function serializeRole<
  T extends {
    key: string
    rolePermissions: Array<{ permission: typeof permission.$inferSelect }>
    userRoles: Array<{ userId: string }>
  },
>(row: T) {
  const { rolePermissions, userRoles, ...rest } = row
  return {
    ...rest,
    permissions: rolePermissions.map((link) => link.permission),
    userCount: userRoles.length,
    isSystem: isSystemRole(row.key),
  }
}

@Injectable()
export class RolesService {
  constructor(
    @Inject(AuthzService) private readonly authz: AuthzService,
    @InjectAudit() private readonly audit?: AuditRecorder
  ) {}

  async list(conditions: SQL) {
    const rows = await db.query.role.findMany({
      where: and(conditions, tenantWhere(role.organizationId)),
      with: roleRelations,
      orderBy: (table, { asc }) => [asc(table.name)],
    })
    if (!env.MULTI_TENANCY) return rows.map(serializeRole)
    const members = await db.query.member.findMany({
      columns: { appRoleId: true, role: true },
      where: eq(member.organizationId, requiredOrganizationId()),
    })
    return rows.map((row) => ({
      ...serializeRole(row),
      userCount: members.filter((item) =>
        item.appRoleId
          ? item.appRoleId === row.id
          : row.key === memberRoleKey(item.role)
      ).length,
    }))
  }

  async create(userId: string, input: RoleInput) {
    const { permissionIds, ...details } = input
    const candidate = {
      id: crypto.randomUUID(),
      organizationId: requiredOrganizationId(),
      ...details,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await this.authz.assert(userId, "create", an("Role", candidate), [
      ...Object.keys(details),
      "permissions",
    ])

    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const chosen = permissionIds.length
        ? await tx
            .select()
            .from(permission)
            .where(
              and(
                inArray(permission.id, permissionIds),
                tenantWhere(permission.organizationId)
              )
            )
        : []
      if (chosen.length !== permissionIds.length)
        apiError(
          HttpStatus.BAD_REQUEST,
          "One or more permissions no longer exist. Refresh and try again."
        )
      const [duplicate] = await tx
        .select()
        .from(role)
        .where(and(eq(role.key, input.key), tenantWhere(role.organizationId)))
        .limit(1)
      if (duplicate)
        apiError(HttpStatus.BAD_REQUEST, "A role with this key already exists.")
      for (const item of chosen)
        await assertDelegation(tx, userId, "grant", "Permission", item)
      await tx.insert(role).values(candidate)
      if (permissionIds.length)
        await tx.insert(rolePermission).values(
          permissionIds.map((permissionId) => ({
            roleId: candidate.id,
            permissionId,
            organizationId: requiredOrganizationId(),
          }))
        )
      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "ROLE_CREATED",
          resourceType: "role",
          resourceId: candidate.id,
          newValues: { ...details, permissionIds: [...permissionIds].sort() },
        },
        tx
      )
      return {
        ...candidate,
        permissions: chosen,
        userCount: 0,
        isSystem: isSystemRole(candidate.key),
      }
    })
  }

  async update(
    userId: string,
    id: string,
    input: RoleUpdateInput,
    conditions: SQL
  ) {
    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select()
        .from(role)
        .where(
          and(conditions, tenantWhere(role.organizationId), eq(role.id, id))
        )
      if (!existing) apiError(HttpStatus.NOT_FOUND, "Role not found")
      const { permissionIds: requestedIds, ...details } = input
      const previous = await tx.query.rolePermission.findMany({
        where: eq(rolePermission.roleId, id),
        with: { permission: true },
      })
      const permissionIds =
        requestedIds ?? previous.map((link) => link.permissionId)
      await this.authz.assert(
        userId,
        "update",
        an("Role", { ...existing, ...details }),
        [...Object.keys(details), ...(requestedIds ? ["permissions"] : [])]
      )
      if (isSystemRole(existing.key) && input.key !== existing.key)
        apiError(HttpStatus.BAD_REQUEST, "System role keys cannot be changed.")
      const [duplicate] = await tx
        .select()
        .from(role)
        .where(
          and(
            tenantWhere(role.organizationId),
            eq(role.key, input.key),
            ne(role.id, id)
          )
        )
        .limit(1)
      if (duplicate)
        apiError(HttpStatus.BAD_REQUEST, "A role with this key already exists.")
      const chosen = permissionIds.length
        ? await tx
            .select()
            .from(permission)
            .where(
              and(
                inArray(permission.id, permissionIds),
                tenantWhere(permission.organizationId)
              )
            )
        : []
      if (chosen.length !== permissionIds.length)
        apiError(
          HttpStatus.BAD_REQUEST,
          "One or more permissions no longer exist. Refresh and try again."
        )
      for (const item of chosen)
        if (!previous.some((link) => link.permissionId === item.id))
          await assertDelegation(tx, userId, "grant", "Permission", item)
      for (const link of previous)
        if (!permissionIds.includes(link.permissionId))
          await assertDelegation(
            tx,
            userId,
            "revoke",
            "Permission",
            link.permission
          )
      await tx
        .update(role)
        .set(details)
        .where(and(eq(role.id, id), tenantWhere(role.organizationId)))
      await tx.delete(rolePermission).where(eq(rolePermission.roleId, id))
      if (permissionIds.length)
        await tx.insert(rolePermission).values(
          permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
            organizationId: requiredOrganizationId(),
          }))
        )
      await ensureRoleManager(tx)
      const changes = auditChanges(
        {
          ...existing,
          permissionIds: previous.map((link) => link.permissionId).sort(),
        },
        { ...details, permissionIds: [...permissionIds].sort() }
      )
      if (changes)
        await this.audit?.record(
          {
            actorId: userId,
            actorType: "USER",
            action: "ROLE_UPDATED",
            resourceType: "role",
            resourceId: id,
            ...changes,
          },
          tx
        )
      const saved = await tx.query.role.findFirst({
        where: and(eq(role.id, id), tenantWhere(role.organizationId)),
        with: roleRelations,
      })
      return serializeRole(saved!)
    })
  }

  async remove(userId: string, id: string, conditions: SQL) {
    return await db.transaction(async (tx) => {
      await lockRoleAssignments(tx)
      const [existing] = await tx
        .select()
        .from(role)
        .where(
          and(conditions, tenantWhere(role.organizationId), eq(role.id, id))
        )
      if (!existing) apiError(HttpStatus.NOT_FOUND, "Role not found")
      if (isSystemRole(existing.key))
        apiError(HttpStatus.BAD_REQUEST, "System roles cannot be deleted.")
      const [assigned] = env.MULTI_TENANCY
        ? await tx
            .select({ id: member.id })
            .from(member)
            .where(
              and(
                eq(member.appRoleId, id),
                eq(member.organizationId, requiredOrganizationId())
              )
            )
            .limit(1)
        : await tx
            .select({ id: userRole.userId })
            .from(userRole)
            .where(eq(userRole.roleId, id))
            .limit(1)
      if (assigned)
        apiError(
          HttpStatus.BAD_REQUEST,
          "Reassign users before deleting this role."
        )
      await tx
        .delete(role)
        .where(and(eq(role.id, id), tenantWhere(role.organizationId)))
      await ensureRoleManager(tx)
      await this.audit?.record(
        {
          actorId: userId,
          actorType: "USER",
          action: "ROLE_DELETED",
          resourceType: "role",
          resourceId: id,
          oldValues: { key: existing.key, name: existing.name },
        },
        tx
      )
      return { ok: true as const }
    })
  }
}
